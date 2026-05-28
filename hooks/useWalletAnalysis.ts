// hooks/useWalletAnalysis.ts
"use client";

import { useState, useCallback } from "react";
import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { arcTestnet, RPC_URL, CONTRACTS, PORT_REGISTRY_ABI } from "@/lib/arc-config";

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
] as const;

export interface OnChainData {
  usdcBalance: bigint;
  usdcFormatted: string;
  analysisCount: bigint;
  lastAnalyzed: bigint;
  txCount: number;
  recentTxs: RawTx[];
}

export interface RawTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp?: string;
}

export interface WalletScore {
  overall: number;
  transactionHealth: number;
  activityLevel: number;
  consistency: number;
  balance: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: string;
  metric: string;
}

export interface WalletAnalysis {
  score: WalletScore;
  personality: string;
  personalityIcon: string;
  personalityDesc: string;
  summary: string;
  insights: string[];
  challenges: Challenge[];
  peerPercentile: number;
  aiAnnotations: { hash: string; note: string }[];
  chatHistory: { role: "user" | "ai"; text: string }[];
  shareText: string;
  onChain: OnChainData;
  registryTxHash?: `0x${string}`;
}

export type ScanStep =
  | "idle"
  | "signing"
  | "confirming"
  | "fetching_balance"
  | "fetching_txs"
  | "ai_scoring"
  | "ai_personality"
  | "ai_insights"
  | "done"
  | "error";

export interface AnalysisState {
  status: ScanStep;
  analysis: WalletAnalysis | null;
  error: string | null;
  chatLoading: boolean;
  progress: number; // 0-100
  stepLabel: string;
  arcFact: string;
}

// Fun Arc facts shown during scanning
const ARC_FACTS = [
  "Arc Testnet uses Chain ID 5042002 — each testnet has a unique ID to prevent transaction replay attacks.",
  "USDC on Arc is a test token at address 0x3600… — the same standard ERC-20 interface as mainnet.",
  "Arc Testnet transactions are free — you can test without spending real money.",
  "Your Port Registry entry at 0xdF9F… is permanently stored on Arc's blockchain.",
  "Arc Testnet's RPC endpoint is rate-limited — Port reads your data in batches to stay efficient.",
  "EIP-55 checksummed addresses prevent typos — all Port addresses are validated before use.",
  "Block explorers index every transaction — your Port analysis record is publicly verifiable.",
  "Smart contracts on Arc are immutable once deployed — your Port Registry is permanent.",
  "The Arc Testnet mimics mainnet behaviour — what works here works on production chains.",
];

function randomFact() {
  return ARC_FACTS[Math.floor(Math.random() * ARC_FACTS.length)];
}

export function useWalletAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    analysis: null,
    error: null,
    chatLoading: false,
    progress: 0,
    stepLabel: "",
    arcFact: randomFact(),
  });

  const set = useCallback(
    (patch: Partial<AnalysisState>) => setState((p) => ({ ...p, ...patch })),
    []
  );

  const setStep = useCallback((status: ScanStep, stepLabel: string, progress: number) => {
    setState((p) => ({ ...p, status, stepLabel, progress, arcFact: randomFact() }));
  }, []);

  // ── Fetch on-chain data ───────────────────────────────────────────────────
  const fetchOnChainData = useCallback(async (
    address: `0x${string}`,
    client: ReturnType<typeof createPublicClient>
  ): Promise<OnChainData> => {
    const checksumAddr = getAddress(address);

    const [usdcBalance, analysisCount, lastAnalyzed, txCount] = await Promise.all([
      client.readContract({
        address: CONTRACTS.USDC, abi: ERC20_ABI,
        functionName: "balanceOf", args: [checksumAddr],
      }).catch(() => 0n) as Promise<bigint>,
      client.readContract({
        address: CONTRACTS.PORT_REGISTRY, abi: PORT_REGISTRY_ABI,
        functionName: "analysisCount", args: [checksumAddr],
      }).catch(() => 0n) as Promise<bigint>,
      client.readContract({
        address: CONTRACTS.PORT_REGISTRY, abi: PORT_REGISTRY_ABI,
        functionName: "lastAnalyzed", args: [checksumAddr],
      }).catch(() => 0n) as Promise<bigint>,
      client.getTransactionCount({ address: checksumAddr }).catch(() => 0),
    ]);

    // Try explorer for recent txs
    let recentTxs: RawTx[] = [];
    try {
      const r = await fetch(
        `https://explorer.testnet.arc.thecanteenapp.com/api/v2/addresses/${checksumAddr}/transactions?limit=20`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = await r.json();
        const items = d.items || d.result || d.transactions || [];
        recentTxs = items.slice(0, 20).map((tx: Record<string, unknown>) => ({
          hash: (tx.hash || tx.txHash || "") as string,
          from: ((tx.from as Record<string, unknown>)?.hash || tx.from || "") as string,
          to: ((tx.to as Record<string, unknown>)?.hash || tx.to || "") as string,
          value: (tx.value || "0") as string,
          blockNumber: (tx.block || tx.blockNumber || "0") as string,
          timeStamp: (tx.timestamp || tx.timeStamp || "") as string,
        }));
      }
    } catch { /* explorer optional */ }

    return {
      usdcBalance,
      usdcFormatted: parseFloat(formatUnits(usdcBalance, 6)).toFixed(2),
      analysisCount,
      lastAnalyzed,
      txCount,
      recentTxs,
    };
  }, []);

  // ── Main analysis ─────────────────────────────────────────────────────────
  const analyzeWallet = useCallback(async (
    address: `0x${string}`,
    walletClient: { writeContract: Function }
  ) => {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(RPC_URL, { retryCount: 3 }),
    });

    setState((p) => ({ ...p, status: "signing", progress: 5, stepLabel: "Waiting for your Arc transaction signature…", arcFact: randomFact(), error: null }));

    try {
      // Step 1 — Record on-chain
      let registryTxHash: `0x${string}` | undefined;
      try {
        const txHash = await walletClient.writeContract({
          address: CONTRACTS.PORT_REGISTRY,
          abi: PORT_REGISTRY_ABI,
          functionName: "recordAnalysis",
          args: [],
          account: address,
        });

        setStep("confirming", "Confirming your transaction on Arc…", 18);

        await client.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
        registryTxHash = txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("cancelled")) {
          set({ status: "idle", stepLabel: "", progress: 0 });
          return;
        }
        // Non-rejection error — continue anyway, analysis still works
        console.warn("[Port] Registry tx failed (non-fatal):", err);
      }

      // Step 2 — Fetch balance
      setStep("fetching_balance", "Reading your USDC balance from Arc…", 35);
      await new Promise(r => setTimeout(r, 400)); // slight delay for UX

      // Step 3 — Fetch transactions
      setStep("fetching_txs", "Fetching your transaction history…", 52);
      const onChain = await fetchOnChainData(address, client);

      // Step 4 — AI scoring
      setStep("ai_scoring", "AI is computing your wallet score…", 68);
      await new Promise(r => setTimeout(r, 300));

      // Step 5 — AI personality
      setStep("ai_personality", "Detecting your financial personality…", 80);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          usdcBalance: onChain.usdcFormatted,
          txCount: onChain.txCount,
          // Use the UPDATED count (after the tx we just sent)
          analysisCount: Number(onChain.analysisCount),
          lastAnalyzed: Number(onChain.lastAnalyzed),
          recentTxs: onChain.recentTxs.slice(0, 15),
          network: "Arc Testnet",
        }),
      });

      // Step 6 — Insights
      setStep("ai_insights", "Generating personalised insights…", 92);

      if (!res.ok) throw new Error(`AI service error (${res.status})`);
      const aiData = await res.json();

      // Build real challenges from actual on-chain data
      // analysisCount from onChain is the value AFTER the tx confirmed
      const realAnalysisCount = Number(onChain.analysisCount);
      const challenges: Challenge[] = [
        {
          id: "c1", icon: "🚀",
          title: "First Arc Transaction",
          description: "Send at least one transaction on Arc Testnet",
          completed: onChain.txCount > 0,
          metric: `${onChain.txCount} transaction${onChain.txCount !== 1 ? "s" : ""} found`,
        },
        {
          id: "c2", icon: "⚡",
          title: "Active Wallet",
          description: "Complete 10+ transactions on Arc Testnet",
          completed: onChain.txCount >= 10,
          metric: `${onChain.txCount}/10 transactions`,
        },
        {
          id: "c3", icon: "🏆",
          title: "Power User",
          description: "Complete 50+ transactions on Arc Testnet",
          completed: onChain.txCount >= 50,
          metric: `${onChain.txCount}/50 transactions`,
        },
        {
          id: "c4", icon: "💰",
          title: "USDC Holder",
          description: "Hold at least 10 USDC on Arc Testnet",
          completed: parseFloat(onChain.usdcFormatted) >= 10,
          metric: `${onChain.usdcFormatted} USDC held`,
        },
        {
          id: "c5", icon: "🔍",
          title: "Port Explorer",
          description: "Analyze your wallet with Port 3+ times",
          // Uses the count AFTER the tx confirmed — so first scan shows 1/3
          completed: realAnalysisCount >= 3,
          metric: `${realAnalysisCount}/3 analyses`,
        },
      ];

      setStep("done", "Analysis complete!", 100);

      setState((p) => ({
        ...p,
        status: "done",
        progress: 100,
        stepLabel: "Analysis complete!",
        analysis: {
          ...aiData,
          challenges,
          onChain,
          registryTxHash,
          chatHistory: [],
        },
      }));

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      console.error("[Analysis]", err);
      set({ status: "error", error: msg, progress: 0, stepLabel: "" });
    }
  }, [set, setStep, fetchOnChainData]);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = useCallback(async (message: string, address: string) => {
    if (!state.analysis) return;
    const userMsg = { role: "user" as const, text: message };
    setState((p) => ({
      ...p, chatLoading: true,
      analysis: p.analysis ? { ...p.analysis, chatHistory: [...p.analysis.chatHistory, userMsg] } : null,
    }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message, address,
          walletContext: {
            score: state.analysis.score,
            personality: state.analysis.personality,
            usdcBalance: state.analysis.onChain.usdcFormatted,
            txCount: state.analysis.onChain.txCount,
            analysisCount: Number(state.analysis.onChain.analysisCount),
            insights: state.analysis.insights,
          },
        }),
      });
      const data = await res.json();
      const aiMsg = { role: "ai" as const, text: data.reply || "Try again." };
      setState((p) => ({
        ...p, chatLoading: false,
        analysis: p.analysis ? { ...p.analysis, chatHistory: [...p.analysis.chatHistory, aiMsg] } : null,
      }));
    } catch {
      setState((p) => ({
        ...p, chatLoading: false,
        analysis: p.analysis ? {
          ...p.analysis,
          chatHistory: [...p.analysis.chatHistory, { role: "ai", text: "Connection issue — please try again." }],
        } : null,
      }));
    }
  }, [state.analysis]);

  const reset = useCallback(() => {
    setState({ status: "idle", analysis: null, error: null, chatLoading: false, progress: 0, stepLabel: "", arcFact: randomFact() });
  }, []);

  return { state, analyzeWallet, sendChat, reset };
}
