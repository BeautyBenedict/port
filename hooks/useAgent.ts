// hooks/useAgent.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, getAddress } from "viem";
import { toast } from "sonner";
import { fetchBalances, getPublicClient } from "@/lib/usyc";
import type { Balances } from "@/lib/usyc";

// ─── ERC-20 transfer ABI ──────────────────────────────────────────────────────
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Arc Testnet USDC contract
const USDC_ADDRESS = getAddress("0x3600000000000000000000000000000000000000");

// ─── Smart Traders ────────────────────────────────────────────────────────────
// All addresses are EIP-55 checksummed (standard Hardhat accounts — valid on any EVM)
export interface SmartTrader {
  id: string;
  name: string;
  avatar: string;
  winRate: string;
  profit24h: string;
  action: string;
  actionLabel: string;
  amount: string;
  amountUSDC: string;
  walletAddress: `0x${string}`;
  reasoning: string;
}

export const SMART_TRADERS: SmartTrader[] = [
  {
    id: "trader-1",
    name: "YieldAlpha",
    avatar: "🛡",
    winRate: "94%",
    profit24h: "+$1,240",
    action: "Send USDC",
    actionLabel: "Mirror position — transfer USDC",
    amount: "1.00 USDC",
    amountUSDC: "1.00",
    walletAddress: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    reasoning:
      "YieldAlpha has been consistently profitable over the past 24h, rotating into stablecoin positions ahead of market uncertainty. Copying mirrors their defensive positioning with a 94% win rate.",
  },
  {
    id: "trader-2",
    name: "StableMax",
    avatar: "⚖️",
    winRate: "89%",
    profit24h: "+$850",
    action: "Send USDC",
    actionLabel: "Mirror position — transfer USDC",
    amount: "2.00 USDC",
    amountUSDC: "2.00",
    walletAddress: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
    reasoning:
      "StableMax consistently holds winning USDC positions during volatility windows. Their 89% accuracy in timing entries and exits on Arc makes them a reliable trader to mirror.",
  },
  {
    id: "trader-3",
    name: "ApexSwerve",
    avatar: "⚡",
    winRate: "85%",
    profit24h: "+$2,100",
    action: "Send USDC",
    actionLabel: "Mirror position — transfer USDC",
    amount: "0.50 USDC",
    amountUSDC: "0.50",
    walletAddress: getAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
    reasoning:
      "ApexSwerve is the most aggressive performer this week. Quick USDC rotations during price action spikes give them an edge. Small copy amount keeps risk low while capturing their alpha.",
  },
  {
    id: "trader-4",
    name: "ArcWhale",
    avatar: "🐋",
    winRate: "91%",
    profit24h: "+$3,400",
    action: "Send USDC",
    actionLabel: "Mirror position — transfer USDC",
    amount: "1.50 USDC",
    amountUSDC: "1.50",
    walletAddress: getAddress("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"),
    reasoning:
      "ArcWhale moves large volumes with precision. Their 91% win rate comes from deep on-chain analysis and disciplined position sizing. Following their USDC moves is a proven strategy on Arc.",
  },
  {
    id: "trader-5",
    name: "DeltaNeutral",
    avatar: "📐",
    winRate: "88%",
    profit24h: "+$670",
    action: "Send USDC",
    actionLabel: "Mirror position — transfer USDC",
    amount: "0.75 USDC",
    amountUSDC: "0.75",
    walletAddress: getAddress("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"),
    reasoning:
      "DeltaNeutral runs low-risk, high-frequency USDC rotations to extract consistent yield. Their conservative but steady 88% win rate makes them ideal for users who prefer stable returns.",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CopyTxLog {
  id: string;
  timestamp: number;
  traderName: string;
  type: string;
  amount: string;
  status: "success" | "failed";
  txHash?: `0x${string}`;
  explanation: string;
}

export interface CopierState {
  balances: Balances | null;
  transactions: CopyTxLog[];
  isExecuting: boolean;
  error: string | null;
  status: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAgent() {
  const { address, isConnected } = useAccount();
  const wagmiClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const mounted = useRef(true);

  const [state, setState] = useState<CopierState>({
    balances: null,
    transactions: [],
    isExecuting: false,
    error: null,
    status: "Ready — select a smart trader to copy",
  });

  const set = useCallback(
    (patch: Partial<CopierState>) => setState((p) => ({ ...p, ...patch })),
    []
  );

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
  const addLog = useCallback(
    (entry: Omit<CopyTxLog, "id">) => {
      setState((p) => ({
        ...p,
        transactions: [
          { ...entry, id: crypto.randomUUID() },
          ...p.transactions,
        ].slice(0, 50),
      }));
    },
    []
  );

  // ── AI Explanation ────────────────────────────────────────────────────────
  const getAIExplanation = useCallback(
    async (trader: SmartTrader): Promise<string> => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            traderName: trader.name,
            tradeType: trader.action,
            amount: trader.amount,
            traderReasoning: trader.reasoning,
          }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        return data.explanation || trader.reasoning;
      } catch {
        // Fallback to static reasoning — app still works without AI
        return `Copying ${trader.name}'s strategy: ${trader.reasoning}`;
      }
    },
    []
  );

  // ── Execute Copy Trade ────────────────────────────────────────────────────
  const copyTrader = useCallback(
    async (trader: SmartTrader) => {
      if (!address) { toast.error("Connect your wallet first"); return; }
      if (!walletClient) { toast.error("Wallet not ready"); return; }
      if (!mounted.current) return;

      set({
        isExecuting: true,
        error: null,
        status: `Consulting AI about ${trader.name}'s trade…`,
      });

      try {
        // 1. Get AI explanation first
        const explanation = await getAIExplanation(trader);
        set({ status: "AI analysis complete — checking your balance…" });

        // 2. Parse and validate amount
        const amountRaw = parseUnits(trader.amountUSDC, 6);

        // 3. Check USDC balance
        const bal = await fetchBalances(address);
        if (mounted.current) set({ balances: bal });

        if (bal.usdc < amountRaw) {
          throw new Error(
            `Insufficient USDC. Need ${trader.amountUSDC} USDC, you have ${bal.usdcFormatted} USDC`
          );
        }

        // 4. Validate destination address (getAddress throws if invalid)
        const toAddress = getAddress(trader.walletAddress);

        // 5. Execute — simple ERC-20 USDC transfer to trader wallet
        // No Teller, no allowlist, no special permissions needed
        set({ status: "Waiting for your wallet signature…" });
        toast.loading("Waiting for signature…", { id: "tx" });

        const client = wagmiClient ?? getPublicClient();

        const txHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [toAddress, amountRaw],
          account: address,
        });

        // 6. Wait for on-chain confirmation
        set({ status: "Confirming on-chain…" });
        toast.loading("Confirming on-chain…", { id: "tx" });

        const receipt = await client.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        });

        if (receipt.status === "reverted") {
          throw new Error(
            "Transaction reverted — check your USDC balance and try again"
          );
        }

        // 7. Log success only after confirmed
        addLog({
          timestamp: Date.now(),
          traderName: trader.name,
          type: trader.action,
          amount: trader.amount,
          status: "success",
          txHash,
          explanation,
        });

        toast.success(`Copied ${trader.name}'s trade ✓`, { id: "tx" });
        set({ status: `Successfully copied ${trader.name} ✓`, error: null });
        await refreshBalances();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Transaction failed";

        // User-friendly messages for common failures
        let msg = raw;
        if (
          raw.toLowerCase().includes("user rejected") ||
          raw.toLowerCase().includes("denied") ||
          raw.toLowerCase().includes("cancelled")
        ) {
          msg = "Transaction cancelled — you rejected the signature";
        } else if (raw.includes("reverted")) {
          msg = "Transaction failed on-chain — check your USDC balance";
        } else if (raw.includes("Insufficient")) {
          msg = raw; // already friendly
        } else if (raw.includes("invalid address") || raw.includes("InvalidAddress")) {
          msg = "Invalid trader address — please contact support";
        }

        console.error("[CopyTrader]", err);
        toast.error(msg, { id: "tx" });

        addLog({
          timestamp: Date.now(),
          traderName: trader.name,
          type: trader.action,
          amount: trader.amount,
          status: "failed",
          explanation: msg,
        });

        if (mounted.current) set({ error: msg, status: "Failed — see Copied Trades log" });
      } finally {
        if (mounted.current) set({ isExecuting: false });
      }
    },
    [address, walletClient, wagmiClient, getAIExplanation, addLog, refreshBalances, set]
  );

  useEffect(() => {
    if (isConnected && address) refreshBalances();
  }, [isConnected, address, refreshBalances]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return { state, copyTrader, refreshBalances };
}