"use client";
// app/page.tsx — Port: AI Wallet Intelligence · Arc Testnet · © Beauty Benedict

import { useState, useEffect, useRef, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useWalletClient } from "wagmi";
import { Toaster, toast } from "sonner";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useWalletAnalysis } from "@/hooks/useWalletAnalysis";
import { NETWORK_DETAILS } from "@/lib/arc-config";

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#a78bfa" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 1.4s ease", filter: `drop-shadow(0 0 10px ${color}88)` }} />
      <text x={size/2} y={size/2 + 7} textAnchor="middle" fill={color}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fontSize={size >= 160 ? 34 : 20} fontWeight={700} fontFamily="'Space Mono',monospace">{score}</text>
      <text x={size/2} y={size/2 + 22} textAnchor="middle" fill="rgba(255,255,255,0.25)"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fontSize={9} fontFamily="'Space Mono',monospace">/100</text>
    </svg>
  );
}

function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let cur = 0; const step = to / 40;
    const t = setInterval(() => { cur += step; if (cur >= to) { setN(to); clearInterval(t); } else setN(Math.floor(cur)); }, 20);
    return () => clearInterval(t);
  }, [to]);
  return <>{n}</>;
}

// ─── Downloadable Score Card ──────────────────────────────────────────────────
function ScoreCard({ analysis, address }: { analysis: NonNullable<ReturnType<typeof useWalletAnalysis>["state"]["analysis"]>; address: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 800, H = 420;
    canvas.width = W; canvas.height = H;

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0612");
    bg.addColorStop(1, "#150d2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Purple glow top left
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 350);
    glow.addColorStop(0, "rgba(139,92,246,0.25)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "rgba(167,139,250,0.3)";
    ctx.lineWidth = 1.5;
    ctx.roundRect(8, 8, W - 16, H - 16, 16);
    ctx.stroke();

    // PORT logo text
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 28px 'Space Grotesk', sans-serif";
    ctx.fillText("Port", 40, 56);
    ctx.fillStyle = "#7c3aed";
    ctx.font = "500 11px 'Space Mono', monospace";
    ctx.fillText("AI WALLET INTELLIGENCE", 40, 74);

    // Arc Testnet badge
    ctx.fillStyle = "rgba(139,92,246,0.15)";
    ctx.strokeStyle = "rgba(139,92,246,0.4)";
    ctx.lineWidth = 1;
    ctx.roundRect(W - 160, 32, 130, 28, 100);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "600 11px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("ARC TESTNET", W - 95, 51);
    ctx.textAlign = "left";

    // Score circle (drawn manually)
    const scoreColor = analysis.score.overall >= 70 ? "#a78bfa" : analysis.score.overall >= 40 ? "#fbbf24" : "#f87171";
    const cx = 140, cy = 220, radius = 90;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 12;
    ctx.stroke();
    const angle = (analysis.score.overall / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, angle);
    ctx.strokeStyle = scoreColor;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.shadowColor = scoreColor;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = scoreColor;
    ctx.font = "700 48px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(analysis.score.overall), cx, cy + 16);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "500 13px 'Space Mono', monospace";
    ctx.fillText("/ 100", cx, cy + 36);
    ctx.textAlign = "left";

    // Personality
    ctx.font = "500 36px sans-serif";
    ctx.fillText(analysis.personalityIcon, 270, 150);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 22px 'Space Grotesk', sans-serif";
    ctx.fillText(analysis.personality, 320, 148);
    ctx.fillStyle = "#6b7280";
    ctx.font = "400 13px 'Space Grotesk', sans-serif";
    const descWords = analysis.personalityDesc.split(" ");
    let line = ""; let lineY = 172;
    for (const word of descWords) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > 340 && line) {
        ctx.fillText(line, 320, lineY); line = word + " "; lineY += 18;
      } else line = test;
    }
    ctx.fillText(line, 320, lineY);

    // Stat bars
    const bars = [
      ["Tx Health", analysis.score.transactionHealth],
      ["Activity", analysis.score.activityLevel],
      ["Consistency", analysis.score.consistency],
      ["Balance", analysis.score.balance],
    ] as [string, number][];
    bars.forEach(([label, val], i) => {
      const bx = 270, by = 220 + i * 38, bw = 340, bh = 6;
      ctx.fillStyle = "#6b7280";
      ctx.font = "400 11px 'Space Mono', monospace";
      ctx.fillText(label, bx, by);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.roundRect(bx, by + 8, bw, bh, 3);
      ctx.fill();
      const barColor = val >= 70 ? "#a78bfa" : val >= 40 ? "#fbbf24" : "#f87171";
      ctx.fillStyle = barColor;
      ctx.roundRect(bx, by + 8, (val / 100) * bw, bh, 3);
      ctx.fill();
      ctx.fillStyle = barColor;
      ctx.font = "600 11px 'Space Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(val), bx + bw + 32, by + 8);
      ctx.textAlign = "left";
    });

    // Facts row
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.roundRect(30, H - 80, W - 60, 50, 10);
    ctx.fill();
    const facts = [
      ["Transactions", String(analysis.onChain.txCount)],
      ["USDC Balance", `${analysis.onChain.usdcFormatted}`],
      ["Peer Rank", `Top ${100 - analysis.peerPercentile}%`],
      ["Port Scans", String(Number(analysis.onChain.analysisCount))],
    ] as [string, string][];
    facts.forEach(([k, v], i) => {
      const fx = 60 + i * 185;
      ctx.fillStyle = "#4b5563";
      ctx.font = "400 10px 'Space Mono', monospace";
      ctx.fillText(k.toUpperCase(), fx, H - 56);
      ctx.fillStyle = "#c4b5fd";
      ctx.font = "700 14px 'Space Mono', monospace";
      ctx.fillText(v, fx, H - 38);
    });

    // Wallet address bottom
    ctx.fillStyle = "#2d1f4e";
    ctx.font = "400 10px 'Space Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(address, W - 40, H - 18);
    ctx.textAlign = "left";

    // Download
    const link = document.createElement("a");
    link.download = `port-score-${address.slice(0,8)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Score card downloaded!");
  }, [analysis, address]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <button className="dl-btn" onClick={download}>⬇ Download Score Card</button>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { state, analyzeWallet, sendChat, reset } = useWalletAnalysis();

  const [tab, setTab] = useState<"overview" | "timeline" | "challenges" | "chat">("overview");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); },
    [state.analysis?.chatHistory]);

  const handleAnalyze = useCallback(async () => {
    if (!address || !walletClient) { toast.error("Wallet not ready"); return; }
    setTab("overview");
    await analyzeWallet(address, walletClient);
  }, [address, walletClient, analyzeWallet]);

  const handleChat = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !address) return;
    const msg = chatInput.trim(); setChatInput("");
    await sendChat(msg, address);
  }, [chatInput, address, sendChat]);

  const handleShareX = useCallback(() => {
    if (!state.analysis) return;
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://port-ai.vercel.app";
    const text = encodeURIComponent(
      `${state.analysis.shareText}\n\n🏆 Score: ${state.analysis.score.overall}/100\n🧬 ${state.analysis.personality}\n📊 ${state.analysis.onChain.txCount} on-chain transactions\n\nAnalyzed by Port AI on Arc Testnet 👇\n${appUrl}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  }, [state.analysis]);

  const isScanning = ["signing","confirming","fetching_balance","fetching_txs","ai_scoring","ai_personality","ai_insights"].includes(state.status);

  const radarData = state.analysis ? [
    { s: "Tx Health", v: state.analysis.score.transactionHealth },
    { s: "Activity",  v: state.analysis.score.activityLevel },
    { s: "Consistency", v: state.analysis.score.consistency },
    { s: "Balance",   v: state.analysis.score.balance },
    { s: "Overall",   v: state.analysis.score.overall },
  ] : [];

  const chartData = Array.from({ length: 10 }, (_, i) => ({
    t: `T-${10 - i}`,
    v: Math.max(5, (state.analysis?.score.overall ?? 50) - 25 + i * 3 + Math.sin(i) * 6),
  }));

  if (!mounted) return (
    <div style={{ minHeight:"100vh",background:"#0a0612",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ fontFamily:"'Space Mono',monospace",fontSize:11,color:"#2d1f4e",letterSpacing:4 }}>LOADING PORT…</div>
    </div>
  );

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <div className="app">
        <div className="bg-grid" /><div className="bg-glow" />

        {/* ── Header ── */}
        <header className="header">
          <div className="brand">
            <img src="/logo.png" alt="Port" className="logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
            <div>
              <div className="brand-name">Port</div>
              <div className="brand-sub">AI Wallet Intelligence</div>
            </div>
          </div>
          {isConnected && state.status === "done" && (
            <nav className="nav">
              {([["overview","Overview"],["timeline","Timeline"],["challenges","Challenges"],["chat","Ask AI"]] as const)
                .map(([t, l]) => (
                  <button key={t} className={`nav-btn${tab===t?" on":""}`} onClick={() => setTab(t)}>{l}</button>
                ))}
            </nav>
          )}
          <div className="hdr-right">
            {isConnected && state.analysis && (
              <div className="hdr-score" style={{ color: state.analysis.score.overall>=70?"#a78bfa":state.analysis.score.overall>=40?"#fbbf24":"#f87171" }}>
                <span className="hdr-score-num">{state.analysis.score.overall}</span>
                <span className="hdr-score-lbl">score</span>
              </div>
            )}
            <ConnectButton />
            {isConnected && (
              <button className="disc-btn" onClick={() => { disconnect(); reset(); }} title="Disconnect">×</button>
            )}
          </div>
        </header>

        <main className="main">

          {/* ══ LANDING ══ */}
          {!isConnected ? (
            <div className="landing">
              <div className="landing-left">
                <div className="pill">Arc Testnet · AI-Powered · On-Chain · Free</div>
                <h1 className="h1">Your Wallet.<br/><span className="grad">Truly Understood.</span></h1>
                <p className="lp">
                  Port AI reads your real Arc Testnet on-chain data — every transaction, your USDC balance, and activity patterns — then scores your wallet, reveals your financial personality, and gives you insights you can actually act on.
                </p>
                <div className="lstats">
                  {[["7","AI Features"],["100pt","Wallet Score"],["Real","On-Chain Data"],["0","Cost to Scan"]].map(([n,l]) => (
                    <div key={l} className="lstat"><span className="lstat-n">{n}</span><span className="lstat-l">{l}</span></div>
                  ))}
                </div>
                <div className="lcta">
                  <ConnectButton label="Connect Wallet to Start →" />
                </div>
                <p className="lnote">Signs one Arc transaction · No personal data stored · Results in ~15 seconds</p>
              </div>

              <div className="landing-right">
                <div className="preview-card">
                  <div className="prev-glow" />
                  <div className="prev-lbl">Live Sample</div>
                  <ScoreRing score={78} size={120} />
                  <div className="prev-name">🏆 The Veteran</div>
                  <div className="prev-facts">
                    {[["Transactions","124+"],["USDC","45.20"],["Rank","Top 18%"],["Personality","Veteran"]].map(([k,v]) => (
                      <div key={k} className="pf"><span className="pf-k">{k}</span><span className="pf-v">{v}</span></div>
                    ))}
                  </div>
                </div>
                <div className="feat-grid">
                  {[["🎯","Wallet Score","4-dimension analysis"],["🧬","Personality","Your financial type"],
                    ["💬","AI Chat","Ask your AI analyst"],["🏆","Challenges","Real on-chain goals"],
                    ["📊","Timeline","Activity history"],["🐦","Share","Post score to X"]].map(([ic,t,d]) => (
                    <div key={String(t)} className="feat">
                      <span className="feat-ic">{ic}</span>
                      <div><div className="feat-t">{t}</div><div className="feat-d">{d}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : isScanning ? (
            /* ══ SCANNING — INTERACTIVE ══ */
            <div className="scan-wrap">
              <div className="scan-card">
                <div className="scan-glow" />
                <div className="scan-header">
                  <div className="scan-spinner" />
                  <div>
                    <div className="scan-title">Scanning Your Wallet</div>
                    <div className="scan-addr">{address?.slice(0,8)}…{address?.slice(-6)} · Arc Testnet</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="prog-wrap">
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: `${state.progress}%` }} />
                  </div>
                  <span className="prog-pct">{state.progress}%</span>
                </div>

                {/* Steps */}
                <div className="scan-steps">
                  {[
                    ["signing",       "🔏", "Signing Arc transaction"],
                    ["confirming",    "⛓",  "Confirming on-chain"],
                    ["fetching_balance","💰","Reading USDC balance"],
                    ["fetching_txs",  "📜", "Fetching transaction history"],
                    ["ai_scoring",    "🧮", "Computing wallet score"],
                    ["ai_personality","🧬", "Detecting personality"],
                    ["ai_insights",   "💡", "Generating insights"],
                  ].map(([key, icon, label]) => {
                    const steps = ["signing","confirming","fetching_balance","fetching_txs","ai_scoring","ai_personality","ai_insights"];
                    const currentIdx = steps.indexOf(state.status);
                    const stepIdx = steps.indexOf(key);
                    const done = stepIdx < currentIdx;
                    const active = stepIdx === currentIdx;
                    return (
                      <div key={key} className={`scan-step${done?" done":active?" active":""}`}>
                        <span className="ss-icon">{done ? "✓" : icon}</span>
                        <span className="ss-label">{label}</span>
                        {active && <span className="ss-pulse" />}
                      </div>
                    );
                  })}
                </div>

                {/* Arc fact */}
                <div className="arc-fact">
                  <span className="fact-lbl">💡 Arc Fact</span>
                  <p className="fact-txt">{state.arcFact}</p>
                </div>
              </div>
            </div>

          ) : state.status === "idle" || state.status === "error" ? (
            /* ══ ANALYZE PROMPT ══ */
            <div className="az-wrap">
              <div className="az-card">
                <div className="az-glow" />
                <div className="az-addr">
                  <span className="az-dot" />{address?.slice(0,8)}…{address?.slice(-6)}
                  <span className="az-net">Arc Testnet</span>
                </div>
                <h2 className="az-title">Analyze Your Wallet</h2>
                <p className="az-desc">
                  Port AI will scan your real Arc Testnet activity — transaction history, USDC balance, and on-chain patterns — then give you a complete intelligence report including score, personality, insights, and challenges.
                </p>
                <div className="az-steps">
                  {["Sign one Arc transaction to record your analysis on-chain",
                    "AI fetches your real transaction count and balance from Arc RPC",
                    "Receive full wallet score, personality, insights and challenges"].map((s,i) => (
                    <div key={i} className="az-step">
                      <span className="az-n">{i+1}</span><span>{s}</span>
                    </div>
                  ))}
                </div>
                {state.error && <div className="az-err">⚠ {state.error}</div>}
                <button className="az-btn" onClick={handleAnalyze}>
                  🔍 Scan My Wallet on Arc
                </button>
                <p className="az-note">~0.0001 ETH gas · Recorded permanently on Arc Explorer · ~15 seconds</p>
              </div>
            </div>

          ) : state.analysis ? (
            /* ══ RESULTS ══ */
            <div className="results">
              {tab === "overview" && (
                <>
                  <div className="top-row">
                    {/* Score card */}
                    <div className="card score-card">
                      <div className="card-lbl">Wallet Score</div>
                      <div className="ring-wrap"><ScoreRing score={state.analysis.score.overall} size={155} /></div>
                      <div className="sbars">
                        {([["Tx Health",state.analysis.score.transactionHealth],
                           ["Activity", state.analysis.score.activityLevel],
                           ["Consistency",state.analysis.score.consistency],
                           ["Balance",  state.analysis.score.balance]] as [string,number][]).map(([l,v]) => (
                          <div key={l} className="sbar">
                            <span className="sbar-l">{l}</span>
                            <div className="sbar-t"><div className="sbar-f" style={{ width:`${v}%`, background:v>=70?"#a78bfa":v>=40?"#fbbf24":"#f87171" }} /></div>
                            <span className="sbar-v"><Counter to={v} /></span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Personality card */}
                    <div className="card pers-card">
                      <div className="card-lbl">Financial Personality</div>
                      <div className="pers-icon">{state.analysis.personalityIcon}</div>
                      <div className="pers-name">{state.analysis.personality}</div>
                      <div className="pers-desc">{state.analysis.personalityDesc}</div>
                      <div className="peer-wrap">
                        <div className="peer-txt">Better than <strong>{state.analysis.peerPercentile}%</strong> of Arc wallets</div>
                        <div className="peer-t">
                          <div className="peer-f" style={{ width:`${state.analysis.peerPercentile}%` }} />
                          <div className="peer-pip" style={{ left:`${state.analysis.peerPercentile}%` }} />
                        </div>
                      </div>
                      <div className="onchain-tag">
                        <span>✓ Recorded on Arc</span>
                        {state.analysis.registryTxHash && (
                          <a href={`${NETWORK_DETAILS.explorer}/tx/${state.analysis.registryTxHash}`}
                            target="_blank" rel="noreferrer" className="otag-link">View tx ↗</a>
                        )}
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="card summary-card">
                      <div className="card-lbl">AI Summary</div>
                      <p className="sum-txt">{state.analysis.summary}</p>
                      <div className="wfacts">
                        {[["Transactions",String(state.analysis.onChain.txCount)],
                          ["USDC Balance",`${state.analysis.onChain.usdcFormatted} USDC`],
                          ["Port Scans",String(Number(state.analysis.onChain.analysisCount))],
                        ].map(([k,v]) => (
                          <div key={k} className="wf"><span className="wf-k">{k}</span><span className="wf-v">{v}</span></div>
                        ))}
                      </div>
                      <div className="share-row">
                        <button className="x-btn" onClick={handleShareX}>𝕏 Share on X</button>
                        <ScoreCard analysis={state.analysis} address={address ?? ""} />
                      </div>
                      <div className="share-prev">"{state.analysis.shareText}"</div>
                      <button className="re-btn" onClick={handleAnalyze}>↺ Re-scan</button>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="card wide-card">
                    <div className="card-lbl">AI Insights</div>
                    <div className="ins-grid">
                      {state.analysis.insights.map((ins, i) => (
                        <div key={i} className="ins-item">
                          <span className="ins-n">0{i+1}</span>
                          <span className="ins-txt">{ins}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Radar */}
                  <div className="card wide-card">
                    <div className="card-lbl">Score Radar</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="s" tick={{ fill:"#6b7280", fontSize:11 }} />
                        <Radar dataKey="v" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {tab === "timeline" && (
                <>
                  <div className="card wide-card">
                    <div className="card-lbl">Score Projection</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                        <defs>
                          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="t" tick={{ fill:"#374151", fontSize:10 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill:"#374151", fontSize:10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background:"#0d0a1a", border:"1px solid #1f1535", borderRadius:8, fontSize:12 }}
                          labelStyle={{ color:"#9ca3af" }} itemStyle={{ color:"#a78bfa" }} />
                        <Area type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={2} fill="url(#pg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card wide-card">
                    <div className="card-lbl">Transaction History</div>
                    <div className="tx-hero">
                      <span className="tx-big">{state.analysis.onChain.txCount}</span>
                      <span className="tx-sub">total transactions on Arc Testnet (via RPC)</span>
                    </div>
                    {state.analysis.aiAnnotations.length === 0 ? (
                      <div className="empty-note">
                        {state.analysis.onChain.txCount > 0
                          ? `Your ${state.analysis.onChain.txCount} transactions were verified via Arc RPC. Detailed per-transaction annotations require the Arc block explorer API to return full data.`
                          : "No transactions yet. Make your first Arc Testnet transaction and re-scan to see annotations."}
                      </div>
                    ) : (
                      <div className="ann-list">
                        {state.analysis.aiAnnotations.map((a, i) => (
                          <div key={i} className="ann">
                            <div className="ann-dot" />
                            <div>
                              <div className="ann-h">{a.hash==="general"?"General Note":`${a.hash.slice(0,18)}…`}</div>
                              <div className="ann-n">{a.note}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === "challenges" && (
                <div className="card wide-card">
                  <div className="card-lbl">On-Chain Challenges</div>
                  <p className="ch-intro">Every challenge is verified against your real Arc Testnet data — transaction count from RPC, USDC balance, and Port analysis count from the registry contract.</p>
                  <div className="ch-list">
                    {state.analysis.challenges.map(ch => (
                      <div key={ch.id} className={`ch${ch.completed?" done":""}`}>
                        <div className="ch-ic">{ch.icon}</div>
                        <div className="ch-body">
                          <div className="ch-t">{ch.title}</div>
                          <div className="ch-d">{ch.description}</div>
                          <div className="ch-m">{ch.metric}</div>
                        </div>
                        <div className={`ch-badge${ch.completed?" yes":""}`}>{ch.completed?"✓ Done":"Pending"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ch-prog">
                    <span className="ch-prog-t">{state.analysis.challenges.filter(c=>c.completed).length} of {state.analysis.challenges.length} completed</span>
                    <div className="ch-prog-track">
                      <div className="ch-prog-f" style={{ width:`${(state.analysis.challenges.filter(c=>c.completed).length/state.analysis.challenges.length)*100}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {tab === "chat" && (
                <div className="card wide-card chat-card">
                  <div className="card-lbl">Ask Port AI</div>
                  <div className="chat-msgs">
                    <div className="cm ai">
                      <span className="cm-ic">🤖</span>
                      <div className="cm-b">Hi! Your wallet scored <strong>{state.analysis.score.overall}/100</strong> with <strong>{state.analysis.onChain.txCount} transactions</strong> on Arc. You&apos;re <strong>{state.analysis.personality}</strong>. Ask me anything!</div>
                    </div>
                    {state.analysis.chatHistory.map((m,i) => (
                      <div key={i} className={`cm ${m.role}`}>
                        <span className="cm-ic">{m.role==="ai"?"🤖":"👤"}</span>
                        <div className="cm-b">{m.text}</div>
                      </div>
                    ))}
                    {state.chatLoading && (
                      <div className="cm ai">
                        <span className="cm-ic">🤖</span>
                        <div className="cm-b typing"><span/><span/><span/></div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="chips">
                    {["Why is my score this level?","How do I improve my score?","What does my personality mean?","What should I do next on Arc?"].map(s => (
                      <button key={s} className="chip" onClick={() => setChatInput(s)}>{s}</button>
                    ))}
                  </div>
                  <form className="chat-form" onSubmit={handleChat}>
                    <input className="chat-inp" value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask about your wallet…" disabled={state.chatLoading} />
                    <button type="submit" className="chat-send"
                      disabled={state.chatLoading||!chatInput.trim()}>Send →</button>
                  </form>
                </div>
              )}
            </div>
          ) : null}
        </main>

        <footer className="footer">
          <span>© Beauty Benedict · Port v3.0 · AI Wallet Intelligence · Arc Testnet</span>
          <span>Registry: 0xdF9F…3547</span>
        </footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0612;color:#e2e8f0;font-family:'Space Grotesk',system-ui,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
        .app{min-height:100vh;display:flex;flex-direction:column;position:relative;overflow-x:hidden}
        .bg-grid{position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:linear-gradient(rgba(167,139,250,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.025) 1px,transparent 1px);
          background-size:52px 52px}
        .bg-glow{position:fixed;top:-200px;left:50%;transform:translateX(-50%);width:800px;height:500px;
          background:radial-gradient(ellipse,rgba(139,92,246,0.08) 0%,transparent 65%);pointer-events:none;z-index:0}

        /* Header */
        .header{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:12px;
          padding:0 28px;height:62px;background:rgba(10,6,18,0.92);backdrop-filter:blur(24px);
          border-bottom:1px solid rgba(167,139,250,0.1)}
        .brand{display:flex;align-items:center;gap:10px;flex-shrink:0}
        .logo{height:28px;width:auto}
        .brand-name{font-size:18px;font-weight:700;letter-spacing:-0.5px;color:#f1f5f9;line-height:1}
        .brand-sub{font-family:'Space Mono',monospace;font-size:8px;color:#7c3aed;letter-spacing:1.5px;text-transform:uppercase}
        .nav{display:flex;gap:2px}
        .nav-btn{background:transparent;border:none;color:#4b5563;font-family:'Space Grotesk',sans-serif;
          font-size:13px;font-weight:500;padding:5px 13px;border-radius:7px;cursor:pointer;transition:all 0.15s}
        .nav-btn:hover{color:#e2e8f0;background:rgba(255,255,255,0.05)}
        .nav-btn.on{color:#c4b5fd;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.2)}
        .hdr-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
        .hdr-score{display:flex;flex-direction:column;align-items:center}
        .hdr-score-num{font-family:'Space Mono',monospace;font-size:20px;font-weight:700;line-height:1}
        .hdr-score-lbl{font-size:9px;color:#374151;font-family:'Space Mono',monospace;letter-spacing:1px}
        .disc-btn{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);color:#ef4444;
          width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:18px;transition:all 0.15s}
        .disc-btn:hover{background:rgba(239,68,68,0.18)}

        /* Main */
        .main{flex:1;padding:28px;position:relative;z-index:1;max-width:1280px;margin:0 auto;width:100%}

        /* Landing */
        .landing{display:grid;grid-template-columns:1fr 460px;gap:48px;align-items:flex-start;min-height:calc(100vh - 120px);padding-top:40px}
        .landing-left{display:flex;flex-direction:column}
        .pill{display:inline-flex;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);
          color:#a78bfa;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;
          padding:4px 12px;border-radius:100px;margin-bottom:20px;width:fit-content}
        .h1{font-size:52px;font-weight:700;letter-spacing:-2.5px;line-height:1.05;color:#f1f5f9;margin-bottom:16px}
        .grad{background:linear-gradient(135deg,#a78bfa,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .lp{font-size:15px;color:#6b7280;line-height:1.7;margin-bottom:24px;max-width:460px}
        .lstats{display:flex;gap:24px;margin-bottom:24px}
        .lstat{display:flex;flex-direction:column;gap:2px}
        .lstat-n{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;color:#a78bfa;letter-spacing:-1px}
        .lstat-l{font-size:11px;color:#4b5563}
        .lcta{display:flex;margin-bottom:10px}
        .lnote{font-size:11px;color:#2d1f4e}
        .landing-right{display:flex;flex-direction:column;gap:14px}
        .preview-card{background:rgba(15,10,30,0.9);border:1px solid rgba(139,92,246,0.2);border-radius:18px;
          padding:22px;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative;overflow:hidden}
        .prev-glow{position:absolute;top:-50px;left:50%;transform:translateX(-50%);width:180px;height:180px;
          background:radial-gradient(circle,rgba(139,92,246,0.15),transparent 65%);pointer-events:none}
        .prev-lbl{font-family:'Space Mono',monospace;font-size:9px;color:#4b5563;letter-spacing:2px;text-transform:uppercase}
        .prev-name{font-size:14px;font-weight:700;color:#f1f5f9}
        .prev-facts{width:100%;display:flex;flex-direction:column;gap:5px}
        .pf{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
        .pf:last-child{border:none}
        .pf-k{color:#4b5563}
        .pf-v{color:#c4b5fd;font-family:'Space Mono',monospace}
        .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .feat{display:flex;gap:7px;align-items:flex-start;background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);border-radius:9px;padding:9px}
        .feat-ic{font-size:15px;flex-shrink:0}
        .feat-t{font-size:11px;font-weight:600;color:#e2e8f0;margin-bottom:1px}
        .feat-d{font-size:10px;color:#4b5563;line-height:1.4}

        /* Scanning */
        .scan-wrap{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 120px)}
        .scan-card{background:rgba(15,10,30,0.9);border:1px solid rgba(139,92,246,0.2);border-radius:20px;
          padding:36px;max-width:520px;width:100%;position:relative;overflow:hidden}
        .scan-glow{position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:280px;height:280px;
          background:radial-gradient(circle,rgba(139,92,246,0.12),transparent 65%);pointer-events:none}
        .scan-header{display:flex;align-items:center;gap:14px;margin-bottom:22px}
        .scan-spinner{width:36px;height:36px;border-radius:50%;border:2px solid rgba(167,139,250,0.2);
          border-top-color:#a78bfa;animation:spin 0.9s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        .scan-title{font-size:17px;font-weight:700;color:#f1f5f9}
        .scan-addr{font-family:'Space Mono',monospace;font-size:10px;color:#4b5563;margin-top:2px}
        .prog-wrap{display:flex;align-items:center;gap:10px;margin-bottom:22px}
        .prog-track{flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
        .prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:3px;transition:width 0.6s ease}
        .prog-pct{font-family:'Space Mono',monospace;font-size:11px;color:#6b7280;width:32px;text-align:right}
        .scan-steps{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
        .scan-step{display:flex;align-items:center;gap:9px;font-size:12px;color:#2d1f4e;padding:6px 10px;border-radius:7px;transition:all 0.3s;position:relative}
        .scan-step.done{color:#6b7280}
        .scan-step.active{color:#c4b5fd;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15)}
        .ss-icon{font-size:14px;width:20px;text-align:center;flex-shrink:0}
        .scan-step.done .ss-icon{color:#10b981}
        .ss-label{flex:1}
        .ss-pulse{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:blink2 1s infinite}
        @keyframes blink2{0%,100%{opacity:1}50%{opacity:0.3}}
        .arc-fact{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px 14px}
        .fact-lbl{font-size:10px;font-weight:600;color:#a78bfa;letter-spacing:0.5px;display:block;margin-bottom:5px}
        .fact-txt{font-size:12px;color:#6b7280;line-height:1.6}

        /* Analyze prompt */
        .az-wrap{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 120px)}
        .az-card{background:rgba(15,10,30,0.9);border:1px solid rgba(139,92,246,0.2);border-radius:20px;
          padding:44px;max-width:480px;width:100%;text-align:center;position:relative;overflow:hidden}
        .az-glow{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:300px;height:300px;
          background:radial-gradient(circle,rgba(139,92,246,0.12),transparent 65%);pointer-events:none}
        .az-addr{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.07);border-radius:100px;padding:5px 14px;
          font-family:'Space Mono',monospace;font-size:11px;color:#9ca3af;margin-bottom:18px}
        .az-dot{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;flex-shrink:0}
        .az-net{font-size:9px;color:#4b5563;background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:4px}
        .az-title{font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;margin-bottom:10px}
        .az-desc{font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:20px}
        .az-steps{display:flex;flex-direction:column;gap:7px;text-align:left;margin-bottom:22px}
        .az-step{display:flex;align-items:center;gap:10px;font-size:12px;color:#9ca3af}
        .az-n{width:20px;height:20px;border-radius:50%;background:rgba(139,92,246,0.2);
          border:1px solid rgba(139,92,246,0.3);color:#a78bfa;font-size:10px;font-weight:700;
          display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .az-err{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;
          padding:8px 12px;color:#f87171;font-size:12px;margin-bottom:12px}
        .az-btn{width:100%;padding:13px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;
          border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;
          cursor:pointer;transition:all 0.2s;margin-bottom:10px}
        .az-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(139,92,246,0.35)}
        .az-note{font-size:10px;color:#2d1f4e;font-family:'Space Mono',monospace}

        /* Results */
        .results{display:flex;flex-direction:column;gap:16px}
        .top-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .card{background:rgba(15,10,30,0.8);border:1px solid rgba(167,139,250,0.08);border-radius:16px;padding:20px}
        .wide-card{width:100%}
        .card-lbl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#2d1f4e;margin-bottom:16px}

        .score-card{display:flex;flex-direction:column;align-items:center}
        .ring-wrap{margin-bottom:16px}
        .sbars{width:100%;display:flex;flex-direction:column;gap:8px}
        .sbar{display:flex;align-items:center;gap:7px}
        .sbar-l{font-size:10px;color:#4b5563;width:75px;flex-shrink:0}
        .sbar-t{flex:1;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden}
        .sbar-f{height:100%;border-radius:2px;transition:width 1.2s ease}
        .sbar-v{font-family:'Space Mono',monospace;font-size:10px;color:#6b7280;width:20px;text-align:right}

        .pers-card{display:flex;flex-direction:column;align-items:center;text-align:center}
        .pers-icon{font-size:48px;margin-bottom:8px}
        .pers-name{font-size:18px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;margin-bottom:5px}
        .pers-desc{font-size:12px;color:#6b7280;line-height:1.5;margin-bottom:14px}
        .peer-wrap{width:100%;margin-bottom:12px}
        .peer-txt{font-size:12px;color:#9ca3af;margin-bottom:6px}
        .peer-txt strong{color:#a78bfa}
        .peer-t{position:relative;height:5px;background:rgba(255,255,255,0.05);border-radius:3px}
        .peer-f{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#7c3aed,#fbbf24);border-radius:3px;transition:width 1.2s ease}
        .peer-pip{position:absolute;top:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #a78bfa;transition:left 1.2s ease}
        .onchain-tag{display:flex;align-items:center;gap:7px;background:rgba(16,185,129,0.07);
          border:1px solid rgba(16,185,129,0.18);border-radius:100px;padding:4px 11px;font-size:11px;color:#10b981}
        .otag-link{color:#a78bfa;text-decoration:none;font-size:10px}
        .otag-link:hover{text-decoration:underline}

        .summary-card{display:flex;flex-direction:column}
        .sum-txt{font-size:13px;color:#9ca3af;line-height:1.7;margin-bottom:12px}
        .wfacts{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;background:rgba(255,255,255,0.02);border-radius:9px;padding:9px 11px}
        .wf{display:flex;justify-content:space-between;font-size:12px}
        .wf-k{color:#4b5563}
        .wf-v{font-family:'Space Mono',monospace;color:#c4b5fd}
        .share-row{display:flex;gap:7px;margin-bottom:8px}
        .x-btn{flex:1;padding:9px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);
          border-radius:8px;color:#e2e8f0;font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;
          cursor:pointer;transition:all 0.15s}
        .x-btn:hover{background:rgba(0,0,0,0.8);border-color:rgba(255,255,255,0.3)}
        .dl-btn{flex:1;padding:9px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);
          border-radius:8px;color:#a78bfa;font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;
          cursor:pointer;transition:all 0.15s}
        .dl-btn:hover{background:rgba(139,92,246,0.2)}
        .share-prev{font-size:11px;color:#2d1f4e;font-style:italic;margin-bottom:8px;padding:7px 9px;
          background:rgba(255,255,255,0.02);border-radius:7px;line-height:1.5}
        .re-btn{background:transparent;border:1px solid rgba(255,255,255,0.07);color:#4b5563;
          font-family:'Space Grotesk',sans-serif;font-size:11px;padding:6px 12px;border-radius:7px;cursor:pointer;transition:all 0.15s;align-self:flex-start}
        .re-btn:hover{color:#e2e8f0;background:rgba(255,255,255,0.05)}

        .ins-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .ins-item{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:9px;padding:11px}
        .ins-n{font-family:'Space Mono',monospace;font-size:10px;color:#7c3aed;flex-shrink:0;padding-top:1px}
        .ins-txt{font-size:12px;color:#9ca3af;line-height:1.5}

        .tx-hero{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;padding:12px;background:rgba(139,92,246,0.06);border-radius:10px;border:1px solid rgba(139,92,246,0.15)}
        .tx-big{font-family:'Space Mono',monospace;font-size:36px;font-weight:700;color:#a78bfa}
        .tx-sub{font-size:12px;color:#6b7280}
        .empty-note{font-size:12px;color:#4b5563;line-height:1.6;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px}
        .ann-list{display:flex;flex-direction:column;gap:10px}
        .ann{display:flex;gap:11px;align-items:flex-start}
        .ann-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;flex-shrink:0;margin-top:4px;box-shadow:0 0 5px #a78bfa}
        .ann-h{font-family:'Space Mono',monospace;font-size:10px;color:#7c3aed;margin-bottom:2px}
        .ann-n{font-size:12px;color:#9ca3af;line-height:1.5}

        .ch-intro{font-size:12px;color:#6b7280;margin-bottom:14px;line-height:1.6}
        .ch-list{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
        .ch{display:flex;align-items:center;gap:11px;padding:13px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;transition:all 0.15s}
        .ch.done{background:rgba(16,185,129,0.04);border-color:rgba(16,185,129,0.14)}
        .ch-ic{font-size:19px;flex-shrink:0}
        .ch-body{flex:1}
        .ch-t{font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:2px}
        .ch-d{font-size:11px;color:#6b7280;margin-bottom:2px}
        .ch-m{font-family:'Space Mono',monospace;font-size:10px;color:#4b5563}
        .ch-badge{font-family:'Space Mono',monospace;font-size:10px;color:#374151;padding:2px 8px;border-radius:100px;border:1px solid rgba(255,255,255,0.06);white-space:nowrap}
        .ch-badge.yes{color:#10b981;border-color:rgba(16,185,129,0.25);background:rgba(16,185,129,0.07)}
        .ch-prog{display:flex;flex-direction:column;gap:5px}
        .ch-prog-t{font-size:11px;color:#6b7280}
        .ch-prog-track{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden}
        .ch-prog-f{height:100%;background:linear-gradient(90deg,#7c3aed,#10b981);border-radius:2px;transition:width 0.8s ease}

        .chat-card{display:flex;flex-direction:column}
        .chat-msgs{display:flex;flex-direction:column;gap:9px;max-height:360px;overflow-y:auto;margin-bottom:10px;padding-right:4px}
        .chat-msgs::-webkit-scrollbar{width:3px}
        .chat-msgs::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px}
        .cm{display:flex;gap:8px;align-items:flex-start}
        .cm.user{flex-direction:row-reverse}
        .cm-ic{font-size:16px;flex-shrink:0;margin-top:3px}
        .cm-b{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;
          padding:9px 12px;font-size:13px;color:#cbd5e1;line-height:1.5;max-width:78%}
        .cm.user .cm-b{background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.2);color:#c4b5fd}
        .typing{display:flex;gap:4px;align-items:center;padding:11px}
        .typing span{width:5px;height:5px;border-radius:50%;background:#6b7280;animation:blink 1.2s infinite}
        .typing span:nth-child(2){animation-delay:0.2s}
        .typing span:nth-child(3){animation-delay:0.4s}
        @keyframes blink{0%,100%{opacity:0.3}50%{opacity:1}}
        .chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}
        .chip{background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);color:#a78bfa;
          font-size:11px;padding:3px 9px;border-radius:100px;cursor:pointer;transition:all 0.15s;font-family:'Space Grotesk',sans-serif}
        .chip:hover{background:rgba(139,92,246,0.16)}
        .chat-form{display:flex;gap:7px}
        .chat-inp{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:9px;
          padding:10px 13px;color:#e2e8f0;font-family:'Space Grotesk',sans-serif;font-size:13px;outline:none;transition:border-color 0.15s}
        .chat-inp:focus{border-color:rgba(139,92,246,0.4)}
        .chat-inp::placeholder{color:#2d1f4e}
        .chat-send{padding:10px 16px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;border-radius:9px;
          color:#fff;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s}
        .chat-send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(139,92,246,0.3)}
        .chat-send:disabled{opacity:0.45;cursor:not-allowed}

        .footer{position:relative;z-index:1;display:flex;justify-content:space-between;padding:14px 28px;
          border-top:1px solid rgba(167,139,250,0.07);font-family:'Space Mono',monospace;font-size:10px;color:#1a0f2e;flex-wrap:wrap;gap:4px}

        @media(max-width:960px){
          .landing{grid-template-columns:1fr}
          .landing-right{display:none}
          .top-row{grid-template-columns:1fr}
          .ins-grid{grid-template-columns:1fr}
          .main{padding:16px}
          .header{padding:0 16px}
          .nav{display:none}
        }
      `}</style>
    </>
  );
}