// app/api/explain/route.ts
// AI explanation for copy trade actions

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { traderName, tradeType, amount, traderReasoning } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: "You are Port, an AI trade copier agent on Arc Testnet. Write short, clear, confident explanations (2-3 sentences max) for why a user should copy a specific trade. Be direct and informative. No markdown.",
          },
          {
            role: "user",
            content: `Explain why the user should copy this trade:\nTrader: ${traderName}\nAction: ${tradeType}\nAmount: ${amount}\nTrader's reasoning: ${traderReasoning}`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq error ${response.status}`);

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content?.trim() ?? traderReasoning;

    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[/api/explain]", err);
    return NextResponse.json(
      { explanation: "This trader has a strong track record on Arc Testnet. Copying their position mirrors a proven strategy." },
      { status: 200 }
    );
  }
}