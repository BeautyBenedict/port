// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are Port AI, an intelligent on-chain wallet analyzer for Arc Testnet.
You receive REAL data about a wallet — actual transaction count, actual USDC balance, actual on-chain history.
Your job is to give honest, accurate, specific analysis based on EXACTLY what the data shows.
NEVER say a wallet is "new" if it has transactions. NEVER make up data. Be honest about what you see.
Respond with ONLY valid JSON — no markdown, no extra text.`;

function buildPrompt(d: {
  address: string;
  usdcBalance: string;
  txCount: number;
  analysisCount: number;
  lastAnalyzed: number;
  recentTxs: unknown[];
}) {
  const bal = parseFloat(d.usdcBalance);
  const isVeteran = d.txCount > 50;
  const isActive = d.txCount > 10;
  const isNew = d.txCount === 0;
  const hasUsedPort = d.analysisCount > 0;
  const lastDate = d.lastAnalyzed > 0
    ? new Date(d.lastAnalyzed * 1000).toLocaleDateString()
    : "never";

  return `Analyze this Arc Testnet wallet with REAL on-chain data:

Wallet: ${d.address}
USDC Balance: ${bal.toFixed(2)} USDC
Total Transactions (from RPC): ${d.txCount} — this is REAL, use it accurately
Previous Port Analyses: ${d.analysisCount} (last: ${lastDate})
Recent Transactions: ${JSON.stringify(d.recentTxs.slice(0, 8))}

Context:
- ${isVeteran ? "This is a VETERAN wallet with 50+ transactions — acknowledge their experience" : ""}
- ${isActive && !isVeteran ? "This is an ACTIVE wallet with solid transaction history" : ""}
- ${isNew ? "This wallet has no transactions yet — be welcoming and encouraging" : ""}
- ${hasUsedPort ? `This user has used Port ${d.analysisCount} times before` : "This is their first Port analysis"}
- Balance context: ${bal > 100 ? "significant USDC holdings" : bal > 10 ? "moderate USDC balance" : bal > 0 ? "small USDC balance" : "no USDC currently"}

IMPORTANT: Score must reflect the real tx count (${d.txCount} txs). A wallet with 50+ txs should score 65-85. A wallet with 0 txs scores 20-35.

Return ONLY this JSON:
{
  "score": {
    "overall": <realistic score based on data>,
    "transactionHealth": <0-100, based on tx count: 0txs=10, 1-5=30, 6-20=55, 21-50=70, 50+=85>,
    "activityLevel": <0-100, same scale as transactionHealth>,
    "consistency": <0-100, estimate from tx pattern>,
    "balance": <0-100, based on USDC: 0=10, <1=20, 1-10=40, 10-100=65, 100+=85>
  },
  "personality": "<The Hodler|The Active Trader|The Newcomer|The Whale|The Strategist|The Explorer|The Builder|The Veteran>",
  "personalityIcon": "<single emoji>",
  "personalityDesc": "<one honest sentence about this personality>",
  "summary": "<2-3 sentences, honest and specific to their real data, no generic statements>",
  "insights": [
    "<insight specific to their tx count>",
    "<insight about their USDC balance>",
    "<insight about their Arc activity pattern>",
    "<insight about what they should do next>"
  ],
  "peerPercentile": <realistic percentile: 0txs=20, 1-10txs=45, 11-50=65, 50+=80>,
  "aiAnnotations": [
    {"hash": "<real tx hash from their data or 'general'>", "note": "<plain English what this tx did>"}
  ],
  "shareText": "<punchy one-liner for X/Twitter, include their score>"
}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 1800,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildPrompt(body) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[/api/analyze]", err);
    // Honest fallback
    const txCount = (await req.json().catch(() => ({ txCount: 0 }))).txCount ?? 0;
    const overall = txCount > 50 ? 72 : txCount > 10 ? 55 : txCount > 0 ? 38 : 22;
    return NextResponse.json({
      score: { overall, transactionHealth: overall, activityLevel: overall - 5, consistency: overall - 8, balance: 30 },
      personality: txCount > 50 ? "The Veteran" : txCount > 10 ? "The Explorer" : txCount > 0 ? "The Newcomer" : "The Observer",
      personalityIcon: txCount > 50 ? "🏆" : txCount > 10 ? "🧭" : "🌱",
      personalityDesc: "Determined to make their mark on Arc Testnet.",
      summary: `This wallet has ${txCount} transactions on Arc Testnet. ${txCount > 0 ? "Keep building on-chain activity to improve your score." : "Make your first transaction to get started."}`,
      insights: [
        `Transaction count: ${txCount} — ${txCount > 50 ? "veteran level activity" : txCount > 10 ? "solid foundation" : "room to grow"}`,
        "USDC balance is being tracked on Arc Testnet",
        "Each transaction improves your wallet health score",
        txCount > 0 ? "Keep your activity consistent to boost consistency score" : "Send your first USDC transaction to activate your wallet score",
      ],
      peerPercentile: txCount > 50 ? 80 : txCount > 10 ? 60 : 35,
      aiAnnotations: [],
      shareText: `My Arc Testnet wallet scored ${overall}/100 on Port AI — ${txCount} transactions and counting! 🚀`,
    });
  }
}
