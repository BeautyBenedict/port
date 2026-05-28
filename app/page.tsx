"use client";
// app/page.tsx — Port: AI Wallet Intelligence · Arc Testnet
// © Beauty Benedict

import { useState, useEffect, useRef, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useWalletClient } from "wagmi";
import { Toaster, toast } from "sonner";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 1.4s ease", filter: `drop-shadow(0 0 10px ${color}88)` }}
      />
      <text x={size/2} y={size/2 + 7}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        textAnchor="middle" fill={color}
        fontSize={size >= 160 ? 34 : 20} fontWeight={700} fontFamily="'Space Mono',monospace">
        {score}
      </text>
      <text x={size/2} y={size/2 + 22}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        textAnchor="middle" fill="rgba(255,255,255,0.25)"
        fontSize={9} fontFamily="'Space Mono',monospace">
        /100
      </text>
    </svg>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = to / 40;
    const t = setInterval(() => {
      cur += step;
      if (cur >= to) { setN(to); clearInterval(t); }
      else setN(Math.floor(cur));
    }, 20);
    return () => clearInterval(t);
  }, [to]);
  return <>{n}</>;
}

// ─── Share card generator ─────────────────────────────────────────────────────
function generateShareUrl(score: number, personality: string, shareText: string, address: string) {
  const text = encodeURIComponent(
    `${shareText}\n\n🏆 Score: ${score}/100 | ${personality}\n📍 Arc Testnet · Analyzed by Port AI\n\nhttps://port-arc.vercel.app`
  );
  return `https://twitter.com/intent/tweet?text=${text}`;
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
    await analyzeWallet(address, walletClient);
  }, [address, walletClient, analyzeWallet]);

  const handleChat = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !address) return;
    const msg = chatInput.trim();
    setChatInput("");
    await sendChat(msg, address);
  }, [chatInput, address, sendChat]);

  const handleShare = useCallback(() => {
    if (!state.analysis || !address) return;
    const url = generateShareUrl(
      state.analysis.score.overall,
      state.analysis.personality,
      state.analysis.shareText,
      address
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }, [state.analysis, address]);

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
    <div style={{ minHeight: "100vh", background: "#0a0612", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#2d1f4e", letterSpacing: 4 }}>LOADING PORT…</div>
    </div>
  );

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <div className="app">
        <div className="bg-grid" />
        <div className="bg-glow" />

        {/* ── Header ── */}
        <header className="header">
          <div className="brand">
            <img src="/logo.png" alt="Port" className="logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <div className="brand-name">Port</div>
              <div className="brand-sub">AI Wallet Intelligence</div>
            </div>
          </div>

          {isConnected && state.status === "done" && (
            <nav className="nav">
              {([["overview","Overview"],["timeline","Timeline"],["challenges","Challenges"],["chat","Ask AI"]] as const)
                .map(([t, l]) => (
                  <button key={t} className={`nav-btn${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>{l}</button>
                ))}
            </nav>
          )}

          <div className="hdr-right">
            {isConnected && state.analysis && (
              <div className="hdr-score">
                <span className="hdr-score-num" style={{
                  color: state.analysis.score.overall >= 70 ? "#a78bfa" : state.analysis.score.overall >= 40 ? "#fbbf24" : "#f87171"
                }}>
                  {state.analysis.score.overall}
                </span>
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

          {/* ══ LANDING — NOT CONNECTED ══ */}
          {!isConnected ? (
            <div className="landing">
              <div className="landing-left">
                <div className="landing-pill">Arc Testnet · AI-Powered · On-Chain</div>
                <h1 className="landing-h1">
                  Your Wallet.<br/>
                  <span className="grad">Truly Understood.</span>
                </h1>
                <p className="landing-p">
                  Port AI reads your real Arc Testnet on-chain data — transactions, balances, activity patterns — and gives you a complete intelligence report in seconds. Connect once, learn everything.
                </p>
                <div className="landing-stats">
                  {[["7", "AI Features"],["100", "Point Score"],["Real", "On-Chain Data"]].map(([n,l]) => (
                    <div key={l} className="landing-stat">
                      <span className="ls-num">{n}</span>
                      <span className="ls-lbl">{l}</span>
                    </div>
                  ))}
                </div>
                <div className="cta-row">
                  <ConnectButton label="Analyze My Wallet →" />
                </div>
                <p className="landing-note">One real Arc transaction · No personal data stored · Free forever</p>
              </div>

              <div className="landing-right">
                <div className="preview-card">
                  <div className="preview-glow" />
                  <div className="preview-label">Sample Analysis</div>
                  <ScoreRing score={73} size={130} />
                  <div className="preview-personality">🏆 The Veteran</div>
                  <div className="preview-facts">
                    {[["Transactions","124"],["USDC Balance","45.20"],["Peer Rank","Top 22%"],["Challenges","3/5 done"]].map(([k,v]) => (
                      <div key={k} className="pf-row">
                        <span className="pf-k">{k}</span>
                        <span className="pf-v">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="features-grid">
                  {[
                    ["🎯","Wallet Score","Scored across 4 real dimensions"],
                    ["🧬","AI Personality","Your on-chain financial type"],
                    ["💬","AI Chat","Ask anything about your wallet"],
                    ["🏆","Challenges","Dynamic goals from your real data"],
                    ["📊","Timeline","Visual on-chain activity history"],
                    ["🐦","Share to X","Post your score as a tweet"],
                  ].map(([icon,title,desc]) => (
                    <div key={String(title)} className="feat">
                      <span className="feat-icon">{icon}</span>
                      <div>
                        <div className="feat-title">{title}</div>
                        <div className="feat-desc">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : state.status === "idle" || state.status === "error" ? (
            /* ══ CONNECTED — ANALYZE PROMPT ══ */
            <div className="analyze-wrap">
              <div className="analyze-card">
                <div className="ac-glow" />
                <div className="ac-addr">
                  <span className="ac-dot" />
                  {address?.slice(0,8)}…{address?.slice(-6)}
                  <span className="ac-net">Arc Testnet</span>
                </div>
                <div className="ac-title">Ready to Analyze</div>
                <p className="ac-desc">
                  Port AI will call your real Arc Testnet data — actual transaction count, USDC balance, and activity — then score and analyze your wallet. One small gas transaction records your analysis on-chain permanently.
                </p>
                <div className="ac-steps">
                  {["Sign one Arc transaction (proves on-chain activity)","AI fetches your real transaction history","Receive your complete wallet intelligence report"].map((s,i) => (
                    <div key={i} className="ac-step">
                      <span className="ac-step-n">{i+1}</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                {state.error && <div className="ac-err">⚠ {state.error}</div>}
                <button className="analyze-btn" onClick={handleAnalyze}>
                  🔍 Analyze My Wallet on Arc
                </button>
                <p className="ac-note">Costs ~0.0001 ETH gas · Records permanently on Arc Explorer</p>
              </div>
            </div>

          ) : state.status === "signing" || state.status === "loading" ? (
            /* ══ LOADING ══ */
            <div className="loading-wrap">
              <div className="loader-ring" />
              <div className="loader-title">{state.statusMessage || "Analyzing…"}</div>
              <div className="loader-steps">
                {["Waiting for Arc transaction signature",
                  "Reading your on-chain transaction history",
                  "Computing wallet score across 4 dimensions",
                  "Generating AI personality and insights"].map((s,i) => (
                  <div key={s} className="lstep" style={{ animationDelay: `${i*0.5}s` }}>
                    <span className="lstep-dot" />{s}
                  </div>
                ))}
              </div>
            </div>

          ) : state.analysis ? (
            /* ══ RESULTS ══ */
            <div className="results">

              {/* ── OVERVIEW ── */}
              {tab === "overview" && (
                <>
                  <div className="top-row">
                    {/* Score */}
                    <div className="card score-card">
                      <div className="card-lbl">Wallet Score</div>
                      <div className="score-ring-wrap">
                        <ScoreRing score={state.analysis.score.overall} size={155} />
                      </div>
                      <div className="score-bars">
                        {([["Tx Health", state.analysis.score.transactionHealth],
                           ["Activity",  state.analysis.score.activityLevel],
                           ["Consistency",state.analysis.score.consistency],
                           ["Balance",   state.analysis.score.balance]] as [string,number][]).map(([l,v]) => (
                          <div key={l} className="sbar-row">
                            <span className="sbar-lbl">{l}</span>
                            <div className="sbar-track">
                              <div className="sbar-fill" style={{
                                width: `${v}%`,
                                background: v>=70?"#a78bfa":v>=40?"#fbbf24":"#f87171"
                              }} />
                            </div>
                            <span className="sbar-val"><Counter to={v} /></span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Personality */}
                    <div className="card pers-card">
                      <div className="card-lbl">Financial Personality</div>
                      <div className="pers-icon">{state.analysis.personalityIcon}</div>
                      <div className="pers-name">{state.analysis.personality}</div>
                      <div className="pers-desc">{state.analysis.personalityDesc}</div>
                      <div className="peer-section">
                        <div className="peer-txt">Better than <strong>{state.analysis.peerPercentile}%</strong> of Arc wallets</div>
                        <div className="peer-track">
                          <div className="peer-fill" style={{ width: `${state.analysis.peerPercentile}%` }} />
                          <div className="peer-pip" style={{ left: `${state.analysis.peerPercentile}%` }} />
                        </div>
                      </div>
                      <div className="onchain-badge">
                        <span>✓</span>
                        <span>Recorded on Arc</span>
                        {state.analysis.registryTxHash && (
                          <a href={`${NETWORK_DETAILS.explorer}/tx/${state.analysis.registryTxHash}`}
                            target="_blank" rel="noreferrer" className="tx-badge-link">
                            View tx ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Summary + Share */}
                    <div className="card summary-card">
                      <div className="card-lbl">AI Summary</div>
                      <p className="summary-txt">{state.analysis.summary}</p>
                      <div className="wallet-facts">
                        {[
                          ["Transactions", state.analysis.onChain.txCount.toString()],
                          ["USDC Balance", `${state.analysis.onChain.usdcFormatted} USDC`],
                          ["Port Analyses", state.analysis.onChain.analysisCount.toString()],
                        ].map(([k,v]) => (
                          <div key={k} className="wfact">
                            <span className="wfact-k">{k}</span>
                            <span className="wfact-v">{v}</span>
                          </div>
                        ))}
                      </div>
                      <button className="share-x-btn" onClick={handleShare}>
                        <span>𝕏</span> Share Score on X
                      </button>
                      <div className="share-preview">"{state.analysis.shareText}"</div>
                      <button className="reanalyze-btn" onClick={handleAnalyze}>↺ Re-analyze</button>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="card insights-card">
                    <div className="card-lbl">AI Insights</div>
                    <div className="insights-grid">
                      {state.analysis.insights.map((ins, i) => (
                        <div key={i} className="insight">
                          <span className="ins-n">0{i+1}</span>
                          <span className="ins-txt">{ins}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Radar */}
                  <div className="card radar-card">
                    <div className="card-lbl">Score Radar</div>
                    <ResponsiveContainer width="100%" height={210}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="s" tick={{ fill: "#6b7280", fontSize: 11 }} />
                        <Radar dataKey="v" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* ── TIMELINE ── */}
              {tab === "timeline" && (
                <>
                  <div className="card full-card">
                    <div className="card-lbl">Score Projection</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="t" tick={{ fill: "#374151", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill: "#374151", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: "#0d0a1a", border: "1px solid #1f1535", borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#a78bfa" }} />
                        <Area type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={2} fill="url(#pg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="card full-card">
                    <div className="card-lbl">Transaction Annotations</div>
                    <div className="tx-count-bar">
                      <span className="tx-count-num">{state.analysis.onChain.txCount}</span>
                      <span className="tx-count-lbl">total transactions found on Arc Testnet via RPC</span>
                    </div>
                    {state.analysis.aiAnnotations.length === 0 ? (
                      <div className="empty-note">
                        {state.analysis.onChain.txCount > 0
                          ? `Your ${state.analysis.onChain.txCount} transactions were counted from the Arc RPC. Detailed annotations require the Arc explorer API to return transaction data.`
                          : "No transactions found yet. Make your first Arc transaction to see annotations here."}
                      </div>
                    ) : (
                      <div className="ann-list">
                        {state.analysis.aiAnnotations.map((a, i) => (
                          <div key={i} className="ann-item">
                            <div className="ann-dot" />
                            <div>
                              <div className="ann-hash">{a.hash === "general" ? "General Note" : `${a.hash.slice(0,18)}…`}</div>
                              <div className="ann-note">{a.note}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── CHALLENGES ── */}
              {tab === "challenges" && (
                <div className="card full-card">
                  <div className="card-lbl">On-Chain Challenges</div>
                  <p className="ch-intro">Checked against your real Arc Testnet transaction count and balance.</p>
                  <div className="ch-list">
                    {state.analysis.challenges.map((ch) => (
                      <div key={ch.id} className={`ch-item${ch.completed ? " done" : ""}`}>
                        <div className="ch-icon">{ch.icon}</div>
                        <div className="ch-body">
                          <div className="ch-title">{ch.title}</div>
                          <div className="ch-desc">{ch.description}</div>
                          <div className="ch-metric">{ch.metric}</div>
                        </div>
                        <div className={`ch-badge${ch.completed ? " yes" : ""}`}>
                          {ch.completed ? "✓ Done" : "Pending"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ch-progress">
                    <span className="ch-prog-txt">
                      {state.analysis.challenges.filter(c=>c.completed).length} of {state.analysis.challenges.length} completed
                    </span>
                    <div className="ch-prog-track">
                      <div className="ch-prog-fill" style={{
                        width: `${(state.analysis.challenges.filter(c=>c.completed).length / state.analysis.challenges.length) * 100}%`
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── AI CHAT ── */}
              {tab === "chat" && (
                <div className="card full-card chat-card">
                  <div className="card-lbl">Ask Port AI</div>
                  <div className="chat-msgs">
                    <div className="chat-msg ai">
                      <span className="cm-icon">🤖</span>
                      <div className="cm-bubble">
                        Hi! I've analyzed your Arc wallet. You scored <strong>{state.analysis.score.overall}/100</strong> with {state.analysis.onChain.txCount} transactions on-chain. You're <strong>{state.analysis.personality}</strong>. Ask me anything!
                      </div>
                    </div>
                    {state.analysis.chatHistory.map((m, i) => (
                      <div key={i} className={`chat-msg ${m.role}`}>
                        <span className="cm-icon">{m.role==="ai"?"🤖":"👤"}</span>
                        <div className="cm-bubble">{m.text}</div>
                      </div>
                    ))}
                    {state.chatLoading && (
                      <div className="chat-msg ai">
                        <span className="cm-icon">🤖</span>
                        <div className="cm-bubble typing"><span/><span/><span/></div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="chat-chips">
                    {["Why is my score this level?","How do I improve?","What does my personality mean?","What should I do next on Arc?"].map(s => (
                      <button key={s} className="chip" onClick={() => setChatInput(s)}>{s}</button>
                    ))}
                  </div>
                  <form className="chat-form" onSubmit={handleChat}>
                    <input className="chat-inp" value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask about your wallet…" disabled={state.chatLoading} />
                    <button type="submit" className="chat-send"
                      disabled={state.chatLoading || !chatInput.trim()}>Send →</button>
                  </form>
                </div>
              )}
            </div>

          ) : null}
        </main>

        <footer className="footer">
          <span>© Beauty Benedict · Port v3.0 · AI Wallet Intelligence · Arc Testnet</span>
          <span>Contract: 0xdF9F8686…3547</span>
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
          padding:0 28px;height:62px;background:rgba(10,6,18,0.9);backdrop-filter:blur(24px);
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
          width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:18px;transition:all 0.15s;line-height:1}
        .disc-btn:hover{background:rgba(239,68,68,0.18)}

        /* Main */
        .main{flex:1;padding:28px;position:relative;z-index:1;max-width:1280px;margin:0 auto;width:100%}

        /* Landing */
        .landing{display:grid;grid-template-columns:1fr 480px;gap:48px;align-items:flex-start;min-height:calc(100vh - 120px);padding-top:40px}
        .landing-left{display:flex;flex-direction:column;gap:0;padding-top:20px}
        .landing-pill{display:inline-flex;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);
          color:#a78bfa;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;
          padding:4px 12px;border-radius:100px;margin-bottom:20px;width:fit-content}
        .landing-h1{font-size:52px;font-weight:700;letter-spacing:-2.5px;line-height:1.05;color:#f1f5f9;margin-bottom:18px}
        .grad{background:linear-gradient(135deg,#a78bfa,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .landing-p{font-size:15px;color:#6b7280;line-height:1.7;margin-bottom:28px;max-width:460px}
        .landing-stats{display:flex;gap:24px;margin-bottom:28px}
        .landing-stat{display:flex;flex-direction:column;gap:2px}
        .ls-num{font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#a78bfa;letter-spacing:-1px}
        .ls-lbl{font-size:11px;color:#4b5563}
        .cta-row{display:flex;margin-bottom:12px}
        .landing-note{font-size:11px;color:#2d1f4e}

        /* Preview card on landing */
        .landing-right{display:flex;flex-direction:column;gap:16px}
        .preview-card{background:rgba(15,10,30,0.9);border:1px solid rgba(139,92,246,0.2);border-radius:18px;
          padding:24px;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;overflow:hidden}
        .preview-glow{position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:200px;height:200px;
          background:radial-gradient(circle,rgba(139,92,246,0.15),transparent 65%);pointer-events:none}
        .preview-label{font-family:'Space Mono',monospace;font-size:9px;color:#4b5563;letter-spacing:2px;text-transform:uppercase}
        .preview-personality{font-size:15px;font-weight:700;color:#f1f5f9}
        .preview-facts{width:100%;display:flex;flex-direction:column;gap:6px}
        .pf-row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
        .pf-row:last-child{border:none}
        .pf-k{color:#4b5563}
        .pf-v{color:#c4b5fd;font-family:'Space Mono',monospace}
        .features-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .feat{display:flex;gap:8px;align-items:flex-start;background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:10px}
        .feat-icon{font-size:16px;flex-shrink:0}
        .feat-title{font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:1px}
        .feat-desc{font-size:10px;color:#4b5563;line-height:1.4}

        /* Analyze screen */
        .analyze-wrap{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 120px)}
        .analyze-card{background:rgba(15,10,30,0.9);border:1px solid rgba(139,92,246,0.2);border-radius:20px;
          padding:44px;max-width:480px;width:100%;text-align:center;position:relative;overflow:hidden}
        .ac-glow{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:300px;height:300px;
          background:radial-gradient(circle,rgba(139,92,246,0.12),transparent 65%);pointer-events:none}
        .ac-addr{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.07);border-radius:100px;padding:5px 14px;
          font-family:'Space Mono',monospace;font-size:11px;color:#9ca3af;margin-bottom:20px}
        .ac-dot{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;flex-shrink:0}
        .ac-net{font-size:9px;color:#4b5563;background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:4px}
        .ac-title{font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;margin-bottom:10px}
        .ac-desc{font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:20px}
        .ac-steps{display:flex;flex-direction:column;gap:8px;text-align:left;margin-bottom:24px}
        .ac-step{display:flex;align-items:center;gap:10px;font-size:12px;color:#9ca3af}
        .ac-step-n{width:20px;height:20px;border-radius:50%;background:rgba(139,92,246,0.2);
          border:1px solid rgba(139,92,246,0.3);color:#a78bfa;font-size:10px;font-weight:700;
          display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .ac-err{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;
          padding:8px 12px;color:#f87171;font-size:12px;margin-bottom:14px}
        .analyze-btn{width:100%;padding:13px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;
          border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;
          cursor:pointer;transition:all 0.2s;margin-bottom:10px}
        .analyze-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(139,92,246,0.35)}
        .ac-note{font-size:10px;color:#2d1f4e;font-family:'Space Mono',monospace}

        /* Loading */
        .loading-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;min-height:calc(100vh - 120px)}
        .loader-ring{width:72px;height:72px;border-radius:50%;border:2px solid rgba(167,139,250,0.2);
          border-top-color:#a78bfa;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .loader-title{font-size:16px;font-weight:600;color:#e2e8f0;text-align:center}
        .loader-steps{display:flex;flex-direction:column;gap:10px}
        .lstep{display:flex;align-items:center;gap:8px;font-size:12px;color:#374151;
          animation:fade-in 0.6s ease forwards;opacity:0}
        @keyframes fade-in{to{opacity:1;color:#6b7280}}
        .lstep-dot{width:5px;height:5px;border-radius:50%;background:#a78bfa;flex-shrink:0}

        /* Results */
        .results{display:flex;flex-direction:column;gap:16px}
        .top-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .card{background:rgba(15,10,30,0.8);border:1px solid rgba(167,139,250,0.08);border-radius:16px;padding:20px}
        .full-card{width:100%}
        .card-lbl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;
          color:#2d1f4e;margin-bottom:16px}

        /* Score card */
        .score-card{display:flex;flex-direction:column;align-items:center}
        .score-ring-wrap{margin-bottom:18px}
        .score-bars{width:100%;display:flex;flex-direction:column;gap:8px}
        .sbar-row{display:flex;align-items:center;gap:8px}
        .sbar-lbl{font-size:10px;color:#4b5563;width:78px;flex-shrink:0}
        .sbar-track{flex:1;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden}
        .sbar-fill{height:100%;border-radius:2px;transition:width 1.2s ease}
        .sbar-val{font-family:'Space Mono',monospace;font-size:10px;color:#6b7280;width:22px;text-align:right}

        /* Personality card */
        .pers-card{display:flex;flex-direction:column;align-items:center;text-align:center}
        .pers-icon{font-size:50px;margin-bottom:8px}
        .pers-name{font-size:19px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;margin-bottom:6px}
        .pers-desc{font-size:12px;color:#6b7280;line-height:1.5;margin-bottom:16px}
        .peer-section{width:100%;margin-bottom:14px}
        .peer-txt{font-size:12px;color:#9ca3af;margin-bottom:7px}
        .peer-txt strong{color:#a78bfa}
        .peer-track{position:relative;height:5px;background:rgba(255,255,255,0.05);border-radius:3px}
        .peer-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#7c3aed,#fbbf24);
          border-radius:3px;transition:width 1.2s ease}
        .peer-pip{position:absolute;top:50%;transform:translate(-50%,-50%);width:11px;height:11px;
          border-radius:50%;background:#fff;border:2px solid #a78bfa;transition:left 1.2s ease}
        .onchain-badge{display:flex;align-items:center;gap:6px;background:rgba(16,185,129,0.08);
          border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:4px 12px;font-size:11px;color:#10b981}
        .tx-badge-link{color:#a78bfa;text-decoration:none;font-size:10px;margin-left:4px}
        .tx-badge-link:hover{text-decoration:underline}

        /* Summary card */
        .summary-card{display:flex;flex-direction:column}
        .summary-txt{font-size:13px;color:#9ca3af;line-height:1.7;margin-bottom:14px}
        .wallet-facts{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;
          background:rgba(255,255,255,0.02);border-radius:10px;padding:10px 12px}
        .wfact{display:flex;justify-content:space-between;font-size:12px}
        .wfact-k{color:#4b5563}
        .wfact-v{font-family:'Space Mono',monospace;color:#c4b5fd}
        .share-x-btn{width:100%;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);
          border-radius:9px;color:#e2e8f0;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;
          cursor:pointer;transition:all 0.15s;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:7px}
        .share-x-btn:hover{background:rgba(0,0,0,0.7);border-color:rgba(255,255,255,0.3)}
        .share-preview{font-size:11px;color:#2d1f4e;font-style:italic;margin-bottom:10px;
          padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:7px;line-height:1.5}
        .reanalyze-btn{background:transparent;border:1px solid rgba(255,255,255,0.07);color:#4b5563;
          font-family:'Space Grotesk',sans-serif;font-size:12px;padding:7px 14px;border-radius:8px;
          cursor:pointer;transition:all 0.15s;align-self:flex-start}
        .reanalyze-btn:hover{color:#e2e8f0;background:rgba(255,255,255,0.05)}

        /* Insights */
        .insights-card{width:100%}
        .insights-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .insight{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:12px}
        .ins-n{font-family:'Space Mono',monospace;font-size:10px;color:#7c3aed;flex-shrink:0;padding-top:1px}
        .ins-txt{font-size:12px;color:#9ca3af;line-height:1.5}
        .radar-card{width:100%}

        /* Timeline */
        .tx-count-bar{display:flex;align-items:baseline;gap:8px;margin-bottom:16px;
          padding:12px;background:rgba(139,92,246,0.06);border-radius:10px;border:1px solid rgba(139,92,246,0.15)}
        .tx-count-num{font-family:'Space Mono',monospace;font-size:32px;font-weight:700;color:#a78bfa}
        .tx-count-lbl{font-size:12px;color:#6b7280}
        .empty-note{font-size:13px;color:#4b5563;line-height:1.6;text-align:center;padding:20px}
        .ann-list{display:flex;flex-direction:column;gap:12px}
        .ann-item{display:flex;gap:12px;align-items:flex-start}
        .ann-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;flex-shrink:0;margin-top:4px;box-shadow:0 0 5px #a78bfa}
        .ann-hash{font-family:'Space Mono',monospace;font-size:10px;color:#7c3aed;margin-bottom:2px}
        .ann-note{font-size:12px;color:#9ca3af;line-height:1.5}

        /* Challenges */
        .ch-intro{font-size:12px;color:#6b7280;margin-bottom:16px}
        .ch-list{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
        .ch-item{display:flex;align-items:center;gap:12px;padding:14px;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:11px;transition:all 0.15s}
        .ch-item.done{background:rgba(16,185,129,0.04);border-color:rgba(16,185,129,0.15)}
        .ch-icon{font-size:20px;flex-shrink:0}
        .ch-body{flex:1}
        .ch-title{font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:2px}
        .ch-desc{font-size:11px;color:#6b7280;margin-bottom:2px}
        .ch-metric{font-family:'Space Mono',monospace;font-size:10px;color:#4b5563}
        .ch-badge{font-family:'Space Mono',monospace;font-size:10px;color:#374151;
          padding:3px 9px;border-radius:100px;border:1px solid rgba(255,255,255,0.06);white-space:nowrap}
        .ch-badge.yes{color:#10b981;border-color:rgba(16,185,129,0.25);background:rgba(16,185,129,0.07)}
        .ch-progress{display:flex;flex-direction:column;gap:6px}
        .ch-prog-txt{font-size:12px;color:#6b7280}
        .ch-prog-track{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden}
        .ch-prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#10b981);border-radius:2px;transition:width 0.8s ease}

        /* Chat */
        .chat-card{display:flex;flex-direction:column;gap:0}
        .chat-msgs{display:flex;flex-direction:column;gap:10px;max-height:380px;overflow-y:auto;margin-bottom:12px;padding-right:4px}
        .chat-msgs::-webkit-scrollbar{width:3px}
        .chat-msgs::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px}
        .chat-msg{display:flex;gap:8px;align-items:flex-start}
        .chat-msg.user{flex-direction:row-reverse}
        .cm-icon{font-size:16px;flex-shrink:0;margin-top:3px}
        .cm-bubble{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
          border-radius:11px;padding:9px 13px;font-size:13px;color:#cbd5e1;line-height:1.5;max-width:78%}
        .chat-msg.user .cm-bubble{background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.2);color:#c4b5fd}
        .typing{display:flex;gap:4px;align-items:center;padding:12px}
        .typing span{width:5px;height:5px;border-radius:50%;background:#6b7280;animation:blink 1.2s infinite}
        .typing span:nth-child(2){animation-delay:0.2s}
        .typing span:nth-child(3){animation-delay:0.4s}
        @keyframes blink{0%,100%{opacity:0.3}50%{opacity:1}}
        .chat-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
        .chip{background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);color:#a78bfa;
          font-size:11px;padding:4px 9px;border-radius:100px;cursor:pointer;transition:all 0.15s;
          font-family:'Space Grotesk',sans-serif}
        .chip:hover{background:rgba(139,92,246,0.16)}
        .chat-form{display:flex;gap:7px}
        .chat-inp{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
          border-radius:9px;padding:10px 13px;color:#e2e8f0;font-family:'Space Grotesk',sans-serif;
          font-size:13px;outline:none;transition:border-color 0.15s}
        .chat-inp:focus{border-color:rgba(139,92,246,0.4)}
        .chat-inp::placeholder{color:#2d1f4e}
        .chat-send{padding:10px 16px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;
          border-radius:9px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;
          cursor:pointer;white-space:nowrap;transition:all 0.15s}
        .chat-send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(139,92,246,0.3)}
        .chat-send:disabled{opacity:0.45;cursor:not-allowed}

        /* Footer */
        .footer{position:relative;z-index:1;display:flex;justify-content:space-between;padding:14px 28px;
          border-top:1px solid rgba(167,139,250,0.07);font-family:'Space Mono',monospace;
          font-size:10px;color:#1a0f2e;flex-wrap:wrap;gap:4px}

        @media(max-width:960px){
          .landing{grid-template-columns:1fr}
          .landing-right{display:none}
          .top-row{grid-template-columns:1fr}
          .insights-grid{grid-template-columns:1fr}
          .features-grid{grid-template-columns:1fr}
          .main{padding:16px}
          .header{padding:0 16px}
          .nav{display:none}
        }
      `}</style>
    </>
  );
}