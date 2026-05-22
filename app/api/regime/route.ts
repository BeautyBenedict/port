// app/api/regime/route.ts
// Server-side API route — calls Groq LLM to detect market regime
// Keeps API key secure, never exposed to client

import { NextRequest, NextResponse } from "next/server";
import type { RegimeSignals, RegimeAnalysis } from "@/lib/regime-engine";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt(signals: RegimeSignals): string {
  const profileGuidance = {
    conservative: "Strongly prefer capital preservation. Move to yield at any uncertainty.",
    balanced: "Balance yield and liquidity. Moderate risk tolerance.",
    aggressive: "Maximize yield. Only flee to USDC in extreme conditions.",
  };

  return `You are an autonomous DeFi portfolio agent for Port, an intelligent yield optimizer on Arc Testnet.

Portfolio State:
- USDC (idle): ${signals.usdcAllocationPct.toFixed(1)}% of portfolio
- USYC (earning yield): ${signals.usycAllocationPct.toFixed(1)}% of portfolio
- Total Value: $${signals.totalValueUsd.toFixed(2)}
- Risk Profile: ${signals.riskProfile} — ${profileGuidance[signals.riskProfile]}
- Previous Regime: ${signals.previousRegime ?? "none"}

Analyze current DeFi market conditions and classify the regime. Consider:
1. Stablecoin yields and demand signals
2. Overall crypto risk appetite
3. On-chain volatility indicators
4. Liquidity conditions
5. Whether current allocation matches the detected regime

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "regime": "risk_on" or "risk_off" or "high_vol",
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentences explaining your classification>",
  "signals": {
    "marketSentiment": "<brief assessment>",
    "volatilityAssessment": "<brief assessment>",
    "yieldOpportunity": "<brief assessment>",
    "riskFactors": ["<factor 1>", "<factor 2>"]
  },
  "recommendation": "<specific action the agent should take>",
  "shouldAct": <true or false>,
  "targetUsdcPct": <integer 0-100>
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { signals } = (await req.json()) as { signals: RegimeSignals };

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: "You are a DeFi portfolio agent. Always respond with only valid JSON, no markdown fences, no preamble.",
          },
          {
            role: "user",
            content: buildPrompt(signals),
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? "{}";

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const analysis: RegimeAnalysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[/api/regime]", err);
    // Safe fallback — agent stays put, no trades
    return NextResponse.json(
      {
        regime: "high_vol",
        confidence: 30,
        reasoning: "Could not reach AI service. Defaulting to high-volatility caution mode to protect capital.",
        signals: {
          marketSentiment: "Unknown — AI service unreachable",
          volatilityAssessment: "Elevated (assumed for safety)",
          yieldOpportunity: "Unknown",
          riskFactors: ["API unavailable", "Cannot assess current conditions"],
        },
        recommendation: "Hold current positions until AI service is restored",
        shouldAct: false,
        targetUsdcPct: 50,
      },
      { status: 200 }
    );
  }
}