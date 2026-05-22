// hooks/useAgent.ts
// Simplified autonomous agent — clear, stable, demo-ready

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { CONTRACTS, TOKENS } from "@/lib/arc-config";
import { fetchBalances, depositUsdc, redeemUsyc, getPublicClient } from "@/lib/usyc";
import type { Balances } from "@/lib/usyc";
import type { Regime, RegimeAnalysis } from "@/lib/regime-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface TxLog {
  id: string;
  timestamp: number;
  type: "deposit" | "redeem" | "skipped" | "error";
  regime: Regime;
  reasoning: string;
  txHash?: `0x${string}`;
  amountIn?: string;
  amountOut?: string;
  confidence: number;
}

export interface AgentState {
  isRunning: boolean;      // auto-mode on/off
  isExecuting: boolean;    // currently running a cycle
  riskProfile: RiskProfile;
  balances: Balances | null;
  currentRegime: Regime | null;
  regimeAnalysis: RegimeAnalysis | null;
  transactions: TxLog[];
  cycleCount: number;
  nextCycleAt: number | null;
  error: string | null;
  status: string;          // human-readable status line
}

// Target % of portfolio to keep in USYC per profile per regime
const TARGET_USYC: Record<RiskProfile, Record<Regime, number>> = {
  conservative: { risk_on: 15, risk_off: 80, high_vol: 40 },
  balanced:     { risk_on: 35, risk_off: 70, high_vol: 30 },
  aggressive:   { risk_on: 55, risk_off: 90, high_vol: 20 },
};

const MIN_USDC_RAW = BigInt("2000000"); // 2 USDC minimum to act
const REBALANCE_DRIFT = 12;            // only rebalance if allocation drifts >12%
const AUTO_INTERVAL  = 90_000;        // 90 seconds

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgent() {
  const { address } = useAccount();
  const wagmiClient  = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const mounted  = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<AgentState>({
    isRunning: false, isExecuting: false,
    riskProfile: "balanced",
    balances: null, currentRegime: null, regimeAnalysis: null,
    transactions: [], cycleCount: 0, nextCycleAt: null,
    error: null, status: "Ready — connect wallet to start",
  });

  const set = useCallback((patch: Partial<AgentState>) =>
    setState((p) => ({ ...p, ...patch })), []);

  // ── Balances ──────────────────────────────────────────────────────────────

  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const bal = await fetchBalances(address);
      if (mounted.current) set({ balances: bal, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "RPC error";
      if (mounted.current) set({ error: `Balance fetch failed: ${msg}` });
    }
  }, [address, set]);

  // ── Log ───────────────────────────────────────────────────────────────────

  const addLog = useCallback((entry: Omit<TxLog, "id">) => {
    setState((p) => ({
      ...p,
      transactions: [{ ...entry, id: crypto.randomUUID() }, ...p.transactions].slice(0, 50),
    }));
  }, []);

  // ── One agent cycle ───────────────────────────────────────────────────────

  const runCycle = useCallback(async () => {
    if (!address) { toast.error("Connect your wallet first"); return; }
    if (!walletClient) { toast.error("Wallet not ready"); return; }
    if (!mounted.current) return;

    set({ isExecuting: true, error: null, status: "Fetching portfolio…" });

    try {
      // 1. Balances
      const bal = await fetchBalances(address);
      if (mounted.current) set({ balances: bal });

      // 2. LLM regime detection
      set({ status: "Analysing market regime with AI…" });
      const res = await fetch("/api/regime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signals: {
            usdcAllocationPct: bal.usdcPct,
            usycAllocationPct: bal.usycPct,
            totalValueUsd: bal.totalUsd,
            riskProfile: state.riskProfile,
            previousRegime: state.currentRegime,
          },
        }),
      });

      if (!res.ok) throw new Error(`AI service error (${res.status})`);
      const analysis: RegimeAnalysis = await res.json();

      if (!mounted.current) return;
      set({ currentRegime: analysis.regime, regimeAnalysis: analysis,
            cycleCount: state.cycleCount + 1,
            status: `Regime: ${analysis.regime.toUpperCase()} (${analysis.confidence}% confidence)` });

      // 3. Should we rebalance?
      const targetUsyc = TARGET_USYC[state.riskProfile][analysis.regime];
      const drift = targetUsyc - bal.usycPct;

      if (!analysis.shouldAct || Math.abs(drift) < REBALANCE_DRIFT) {
        addLog({ timestamp: Date.now(), type: "skipped", regime: analysis.regime,
                 reasoning: analysis.reasoning, confidence: analysis.confidence });
        set({ status: `${analysis.regime.toUpperCase()} — portfolio balanced, no action needed` });
        toast.info("No rebalance needed");
        return;
      }

      const client = wagmiClient ?? getPublicClient();

      if (drift > 0) {
        // ── Deposit USDC → USYC ──
        const pct = Math.min(drift / 100, 0.95);
        const amount = BigInt(Math.floor(Number(bal.usdc) * pct));

        if (amount < MIN_USDC_RAW) {
          addLog({ timestamp: Date.now(), type: "skipped", regime: analysis.regime,
                   reasoning: `Need to deposit but amount (${formatUnits(amount, 6)} USDC) is below 2 USDC minimum`,
                   confidence: analysis.confidence });
          set({ status: "Amount too small to deposit" });
          return;
        }

        set({ status: `Depositing ${formatUnits(amount, 6)} USDC → USYC…` });
        toast.loading("Depositing USDC → USYC…", { id: "tx" });

        const txHash = await depositUsdc(client, walletClient, address, amount);

        addLog({
          timestamp: Date.now(), type: "deposit", regime: analysis.regime,
          reasoning: analysis.reasoning, txHash,
          amountIn: `${formatUnits(amount, 6)} USDC`,
          amountOut: "USYC",
          confidence: analysis.confidence,
        });
        toast.success("Deposited USDC → USYC ✓", { id: "tx" });
        set({ status: "Deposit complete — refreshing balances…" });

      } else {
        // ── Redeem USYC → USDC ──
        const pct = Math.min((-drift) / 100, 0.95);
        const amount = BigInt(Math.floor(Number(bal.usyc) * pct));

        if (amount < MIN_USDC_RAW) {
          addLog({ timestamp: Date.now(), type: "skipped", regime: analysis.regime,
                   reasoning: `Need to redeem but amount (${formatUnits(amount, 6)} USYC) is below minimum`,
                   confidence: analysis.confidence });
          set({ status: "Amount too small to redeem" });
          return;
        }

        set({ status: `Redeeming ${formatUnits(amount, 6)} USYC → USDC…` });
        toast.loading("Redeeming USYC → USDC…", { id: "tx" });

        const txHash = await redeemUsyc(client, walletClient, address, amount);

        addLog({
          timestamp: Date.now(), type: "redeem", regime: analysis.regime,
          reasoning: analysis.reasoning, txHash,
          amountIn: `${formatUnits(amount, 6)} USYC`,
          amountOut: "USDC",
          confidence: analysis.confidence,
        });
        toast.success("Redeemed USYC → USDC ✓", { id: "tx" });
        set({ status: "Redemption complete — refreshing balances…" });
      }

      // Final balance refresh
      await refreshBalances();
      set({ status: "Cycle complete ✓" });

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Agent]", err);
      addLog({ timestamp: Date.now(), type: "error",
               regime: state.currentRegime ?? "high_vol",
               reasoning: msg, confidence: 0 });
      toast.error(msg, { id: "tx" });
      if (mounted.current) set({ error: msg, status: "Error — see log" });
    } finally {
      if (mounted.current) set({ isExecuting: false });
    }
  }, [address, walletClient, wagmiClient, state.riskProfile, state.currentRegime, state.cycleCount, refreshBalances, addLog, set]);

  // ── Auto mode ─────────────────────────────────────────────────────────────

  const startAuto = useCallback(() => {
    if (timerRef.current) return;
    set({ isRunning: true, nextCycleAt: Date.now() + AUTO_INTERVAL });
    toast.success("Auto mode ON — runs every 90 seconds");
    timerRef.current = setInterval(() => {
      if (mounted.current) {
        setState((p) => ({ ...p, nextCycleAt: Date.now() + AUTO_INTERVAL }));
        runCycle();
      }
    }, AUTO_INTERVAL);
  }, [runCycle, set]);

  const stopAuto = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    set({ isRunning: false, nextCycleAt: null });
    toast.info("Auto mode OFF");
  }, [set]);

  const setRiskProfile = useCallback((p: RiskProfile) => {
    set({ riskProfile: p });
    toast.info(`Risk profile: ${p}`);
  }, [set]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => { if (address) refreshBalances(); }, [address, refreshBalances]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { state, runCycle, startAuto, stopAuto, setRiskProfile, refreshBalances };
}