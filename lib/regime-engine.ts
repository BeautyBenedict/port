// lib/regime-engine.ts

export type Regime = "risk_on" | "risk_off" | "high_vol";

export interface RegimeSignals {
  usdcAllocationPct: number;
  usycAllocationPct: number;
  totalValueUsd: number;
  riskProfile: "conservative" | "balanced" | "aggressive";
  previousRegime: Regime | null;
}

export interface RegimeAnalysis {
  regime: Regime;
  confidence: number;
  reasoning: string;
  signals: {
    marketSentiment: string;
    volatilityAssessment: string;
    yieldOpportunity: string;
    riskFactors: string[];
  };
  recommendation: string;
  shouldAct: boolean;
  targetUsdcPct: number;
}

export const REGIME_CONFIG: Record<Regime, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  risk_on: {
    label: "RISK ON",
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
    description: "Redeploy capital — redeem USYC → USDC",
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