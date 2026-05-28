// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, address, walletContext } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: `You are Port AI, a friendly wallet analyst for Arc Testnet.
Wallet: ${address}
Real data: ${JSON.stringify(walletContext)}
Be concise (2-3 sentences), honest, and specific to their actual data.
Never invent transactions or balances you don't have.`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ reply: data.choices?.[0]?.message?.content ?? "Try again." });
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json({ reply: "Connection issue — please try again." });
  }
}
