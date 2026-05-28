// app/api/regime/route.ts
// Server-side API route — calls Groq LLM to explain the copied trade
// Keeps API key secure, never exposed to client

import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface CopyRequest {
  traderName: string;
  tradeType: string;
  amount: string;
  traderReasoning: string;
}

function buildPrompt(params: CopyRequest): string {
  return `You are Port, a friendly AI Trade Copier Agent on Arc Testnet. 
The user is about to copy a trade from a smart trader.

Trader Details:
- Name: ${params.traderName}
- Action: ${params.tradeType} (approx. ${params.amount})
- Smart Trader Strategy: ${params.traderReasoning}

Provide a short, clear, and reassuring explanation (2 sentences) explaining to the user why it makes sense to copy this trade and what is about to happen (e.g. "We are copying YieldAlpha by swapping USDC into USYC to capture yield while the market is volatile. This transaction will safely deposit your USDC into the Arc Teller contract.").

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "explanation": "<your friendly 2-sentence explanation here>"
}`;
}

export async function POST(req: NextRequest) {
  let body: CopyRequest | null = null;
  try {
    body = (await req.json()) as CopyRequest;
    
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Missing GROQ_API_KEY");
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 256,
        messages: [
          {
            role: "system",
            content: "You are a helpful DeFi agent. Always respond with only valid JSON containing an 'explanation' field, no markdown fences, no preamble.",
          },
          {
            role: "user",
            content: buildPrompt(body),
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
    const result = JSON.parse(cleaned) as { explanation: string };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/regime]", err);
    
    // Fallback explanation if LLM is unavailable
    const traderName = body?.traderName ?? "Smart Trader";
    const tradeType = body?.tradeType ?? "USDC ↔ USYC swap";
    const amount = body?.amount ?? "funds";
    const fallbackText = `Copying ${traderName}'s recent action by executing a ${tradeType} swap for ${amount}. This aligns your portfolio with their current high-performance strategy on Arc Testnet.`;
    
    return NextResponse.json(
      {
        explanation: fallbackText,
      },
      { status: 200 }
    );
  }
}