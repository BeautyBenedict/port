// hooks/useWalletAnalysis.ts
"use client";

import { useState, useCallback } from "react";
import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { arcTestnet, RPC_URL, CONTRACTS, PORT_REGISTRY_ABI } from "@/lib/arc-config";

// ─── ERC20 ABI ────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OnChainData {
  usdcBalance: bigint;
  usdcFormatted: string;
  analysisCount: bigint;         // how many times this wallet used Port
  lastAnalyzed: bigint;          // timestamp of last analysis
  txCount: number;               // total transactions from RPC
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
  metric: string; // what was checked
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
  registryTxHash?: `0x${string}`; // the on-chain analysis recording tx
}

export interface AnalysisState {
  status: "idle" | "signing" | "loading" | "done" | "error";
  analysis: WalletAnalysis | null;
  error: string | null;
  chatLoading: boolean;
  statusMessage: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWalletAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    analysis: null,
    error: null,
    chatLoading: false,
    statusMessage: "",
  });

  const set = useCallback(
    (patch: Partial<AnalysisState>) => setState((p) => ({ ...p, ...patch })),
    []
  );

  // ── Fetch real on-chain data ──────────────────────────────────────────────
  const fetchOnChainData = useCallback(async (address: `0x${string}`): Promise<OnChainData> => {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(RPC_URL, { retryCount: 3 }),
    });

    const checksumAddr = getAddress(address);

    // Fetch USDC balance, Port analysis count, last analyzed timestamp
    const [usdcBalance, analysisCount, lastAnalyzed] = await Promise.all([
      client.readContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [checksumAddr],
      }).catch(() => 0n),
      client.readContract({
        address: CONTRACTS.PORT_REGISTRY,
        abi: PORT_REGISTRY_ABI,
        functionName: "analysisCount",
        args: [checksumAddr],
      }).catch(() => 0n),
      client.readContract({
        address: CONTRACTS.PORT_REGISTRY,
        abi: PORT_REGISTRY_ABI,
        functionName: "lastAnalyzed",
        args: [checksumAddr],
      }).catch(() => 0n),
    ]);

    // Get transaction count from RPC
    const txCount = await client.getTransactionCount({
      address: checksumAddr,
    }).catch(() => 0);

    // Try to get recent transactions from explorer API
    let recentTxs: RawTx[] = [];
    try {
      const explorerRes = await fetch(
        `https://explorer.testnet.arc.thecanteenapp.com/api/v2/addresses/${checksumAddr}/transactions?limit=20`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (explorerRes.ok) {
        const explorerData = await explorerRes.json();
        // Handle different explorer API response formats
        const items = explorerData.items || explorerData.result || explorerData.transactions || [];
        recentTxs = items.slice(0, 20).map((tx: Record<string, unknown>) => ({
          hash: (tx.hash || tx.txHash || "") as string,
          from: ((tx.from as Record<string, unknown>)?.hash || tx.from || "") as string,
          to: ((tx.to as Record<string, unknown>)?.hash || tx.to || "") as string,
          value: (tx.value || "0") as string,
          blockNumber: (tx.block || tx.blockNumber || "0") as string,
          timeStamp: (tx.timestamp || tx.timeStamp || "") as string,
        }));
      }
    } catch {
      // Explorer failed — we still have txCount from RPC
    }

    return {
      usdcBalance,
      usdcFormatted: parseFloat(formatUnits(usdcBalance, 6)).toFixed(2),
      analysisCount,
      lastAnalyzed,
      txCount,
      recentTxs,
    };
  }, []);

  // ── Record analysis on-chain ──────────────────────────────────────────────
  const recordOnChain = useCallback(async (
    walletClient: { writeContract: Function },
    address: `0x${string}`
  ): Promise<`0x${string}` | undefined> => {
    try {
      const txHash = await walletClient.writeContract({
        address: CONTRACTS.PORT_REGISTRY,
        abi: PORT_REGISTRY_ABI,
        functionName: "recordAnalysis",
        args: [],
        account: address,
      });
      return txHash;
    } catch (err) {
      console.warn("[Port] Registry record failed (non-fatal):", err);
      return undefined;
    }
  }, []);

  // ── Main analyze function ─────────────────────────────────────────────────
  const analyzeWallet = useCallback(async (
    address: `0x${string}`,
    walletClient: { writeContract: Function }
  ) => {
    set({ status: "signing", error: null, statusMessage: "Waiting for your signature on Arc…" });

    try {
      // 1. Record analysis on-chain — user signs a real Arc transaction
      const registryTxHash = await recordOnChain(walletClient, address);
      if (!registryTxHash) {
        // User rejected or error — stop here
        set({ status: "idle", statusMessage: "" });
        return;
      }

      set({ status: "loading", statusMessage: "Transaction confirmed — fetching your on-chain data…" });

      // 2. Fetch real on-chain data
      const onChain = await fetchOnChainData(address);

      set({ statusMessage: "Analysing your wallet with AI…" });

      // 3. Call AI analysis with real data
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          usdcBalance: onChain.usdcFormatted,
          txCount: onChain.txCount,
          analysisCount: Number(onChain.analysisCount),
          lastAnalyzed: Number(onChain.lastAnalyzed),
          recentTxs: onChain.recentTxs.slice(0, 15),
          network: "Arc Testnet",
        }),
      });

      if (!res.ok) throw new Error(`AI service error (${res.status})`);
      const analysis: WalletAnalysis = await res.json();

      // 4. Build dynamic challenges from real data
      const challenges: Challenge[] = [
        {
          id: "c1",
          title: "First Arc Transaction",
          description: "Send at least one transaction on Arc Testnet",
          completed: onChain.txCount > 0,
          icon: "🚀",
          metric: `${onChain.txCount} transactions found`,
        },
        {
          id: "c2",
          title: "Active Wallet",
          description: "Complete 10+ transactions on Arc Testnet",
          completed: onChain.txCount >= 10,
          icon: "⚡",
          metric: `${onChain.txCount}/10 transactions`,
        },
        {
          id: "c3",
          title: "Power User",
          description: "Complete 50+ transactions on Arc Testnet",
          completed: onChain.txCount >= 50,
          icon: "🏆",
          metric: `${onChain.txCount}/50 transactions`,
        },
        {
          id: "c4",
          title: "USDC Holder",
          description: "Hold at least 10 USDC on Arc Testnet",
          completed: parseFloat(onChain.usdcFormatted) >= 10,
          icon: "💰",
          metric: `${onChain.usdcFormatted} USDC held`,
        },
        {
          id: "c5",
          title: "Port Explorer",
          description: "Analyze your wallet with Port 3+ times",
          completed: Number(onChain.analysisCount) >= 3,
          icon: "🔍",
          metric: `${Number(onChain.analysisCount)}/3 analyses`,
        },
      ];

      set({
        status: "done",
        analysis: {
          ...analysis,
          challenges,
          onChain,
          registryTxHash,
          chatHistory: [],
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      console.error("[Analysis]", err);
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        set({ status: "idle", error: null, statusMessage: "" });
      } else {
        set({ status: "error", error: msg, statusMessage: "" });
      }
    }
  }, [set, fetchOnChainData, recordOnChain]);

  // ── AI Chat ───────────────────────────────────────────────────────────────
  const sendChat = useCallback(async (message: string, address: string) => {
    if (!state.analysis) return;

    const userMsg = { role: "user" as const, text: message };
    setState((p) => ({
      ...p,
      chatLoading: true,
      analysis: p.analysis
        ? { ...p.analysis, chatHistory: [...p.analysis.chatHistory, userMsg] }
        : null,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          address,
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
        ...p,
        chatLoading: false,
        analysis: p.analysis
          ? { ...p.analysis, chatHistory: [...p.analysis.chatHistory, aiMsg] }
          : null,
      }));
    } catch {
      setState((p) => ({
        ...p,
        chatLoading: false,
        analysis: p.analysis
          ? {
              ...p.analysis,
              chatHistory: [
                ...p.analysis.chatHistory,
                { role: "ai", text: "Connection issue — please try again." },
              ],
            }
          : null,
      }));
    }
  }, [state.analysis]);

  const reset = useCallback(() => {
    setState({
      status: "idle",
      analysis: null,
      error: null,
      chatLoading: false,
      statusMessage: "",
    });
  }, []);

  return { state, analyzeWallet, sendChat, reset };
}