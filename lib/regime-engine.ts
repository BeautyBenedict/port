// lib/regime-engine.ts
// LLM-powered market regime detector using Claude API
// Returns structured JSON reasoning with regime classification

export type Regime = "risk_on" | "risk_off" | "high_vol";

export interface RegimeSignals {
  /** USDC balance as percentage of total portfolio */
  usdcAllocationPct: number;
  /** USYC balance as percentage of total portfolio */
  usycAllocationPct: number;
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** User's selected risk profile */
  riskProfile: "conservative" | "balanced" | "aggressive";
  /** Timestamp of last regime change */
  lastRegimeChange?: number;
  /** Previous regime for context */
  previousRegime?: Regime;
}

export interface RegimeAnalysis {
  regime: Regime;
  confidence: number; // 0–100
  reasoning: string;
  signals: {
    marketSentiment: string;
    volatilityAssessment: string;
    yieldOpportunity: string;
    riskFactors: string[];
  };
  recommendation: string;
  shouldAct: boolean;
  targetUsdcPct: number; // what % should be USDC after rebalance
}

// ─── Prompt Construction ──────────────────────────────────────────────────────

function buildRegimePrompt(signals: RegimeSignals): string {
  const profileGuidance = {
    conservative: "Prefer capital preservation. Move to USYC yield at ANY sign of uncertainty.",
    balanced: "Balance yield and liquidity. Move 60-80% to USYC during risk-off, keep 40% USDC for opportunities.",
    aggressive: "Maximize yield. Only move to USDC during extreme high volatility signals.",
  };

  return `You are an autonomous DeFi portfolio manager for Port, an intelligent regime-adaptive yield optimizer running on Arc Testnet.

Current Portfolio State:
- USDC (idle): ${signals.usdcAllocationPct.toFixed(1)}%
- USYC (earning yield): ${signals.usycAllocationPct.toFixed(1)}%
- Total Value: $${signals.totalValueUsd.toFixed(2)}
- Risk Profile: ${signals.riskProfile.toUpperCase()} — ${profileGuidance[signals.riskProfile]}
- Previous Regime: ${signals.previousRegime ?? "unknown"}

Market Context (simulate realistic DeFi conditions for Arc Testnet):
Analyze current simulated conditions including:
1. Crypto market sentiment (fear/greed indicators)
2. Stablecoin yield spreads
3. On-chain volatility signals
4. Liquidity conditions
5. Risk appetite in DeFi markets

Based on this analysis, classify the current regime and decide if the portfolio should be rebalanced.

Respond ONLY with a valid JSON object in this exact schema (no markdown, no extra text):
{
  "regime": "risk_on" | "risk_off" | "high_vol",
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation of why you classified this regime>",
  "signals": {
    "marketSentiment": "<brief assessment>",
    "volatilityAssessment": "<brief assessment>",
    "yieldOpportunity": "<brief assessment>",
    "riskFactors": ["<risk 1>", "<risk 2>"]
  },
  "recommendation": "<what action the agent should take>",
  "shouldAct": <true|false — should portfolio be rebalanced now?>,
  "targetUsdcPct": <integer 0-100 — target USDC allocation after rebalance>
}`;
}

// ─── Main Regime Detection Function ──────────────────────────────────────────

export async function detectRegime(
  signals: RegimeSignals
): Promise<RegimeAnalysis> {
  try {
    const response = await fetch("/api/regime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals }),
    });

    if (!response.ok) {
      throw new Error(`Regime API error: ${response.status}`);
    }

    const data = await response.json();
    return data as RegimeAnalysis;
  } catch (error) {
    console.error("[RegimeEngine] Detection failed:", error);
    // Fallback: conservative default
    return {
      regime: "risk_off",
      confidence: 40,
      reasoning:
        "Could not reach regime detection service. Defaulting to risk-off for capital preservation.",
      signals: {
        marketSentiment: "Unknown — API unreachable",
        volatilityAssessment: "Elevated (assumed)",
        yieldOpportunity: "Moderate — USYC yield available",
        riskFactors: ["Connectivity issue", "Unable to assess current conditions"],
      },
      recommendation: "Hold current positions until connectivity is restored",
      shouldAct: false,
      targetUsdcPct: signals.usdcAllocationPct,
    };
  }
}

// ─── Regime Color / Label Helpers ─────────────────────────────────────────────

export const REGIME_CONFIG: Record<
  Regime,
  { label: string; color: string; bgColor: string; description: string }
> = {
  risk_on: {
    label: "RISK ON",
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
    description: "Deploy capital — redeem USYC → USDC",
  },
  risk_off: {
    label: "RISK OFF",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
    description: "Seek yield — deposit USDC → USYC",
  },
  high_vol: {
    label: "HIGH VOL",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    description: "Extreme caution — hold positions",
  },
};