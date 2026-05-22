"use client";
// app/page.tsx — Port: Autonomous Portfolio Agent
// Arc Testnet | Agora Hackathon | © Beauty Benedict

import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { Toaster, toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useAgent } from "@/hooks/useAgent";
import type { RiskProfile, TxLog } from "@/hooks/useAgent";
import { REGIME_CONFIG } from "@/lib/regime-engine";
import type { Regime } from "@/lib/regime-engine";
import { NETWORK_DETAILS, arcTestnet } from "@/lib/arc-config";

// ─── Chart seed data ──────────────────────────────────────────────────────────
const CHART = Array.from({ length: 24 }, (_, i) => ({
  t: `${String(i).padStart(2, "0")}:00`,
  v: 1000 + Math.sin(i / 3) * 60 + i * 1.5,
}));

// ─── Countdown timer component ────────────────────────────────────────────────
function Countdown({ target }: { target: number | null }) {
  const [txt, setTxt] = useState("—");
  useEffect(() => {
    if (!target) { setTxt("—"); return; }
    const tick = () => {
      const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const m = Math.floor(s / 60);
      setTxt(m > 0 ? `${m}m ${s % 60}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return <span>{txt}</span>;
}

// ─── Network Onboarding Popup ─────────────────────────────────────────────────
function NetworkPopup({ onClose }: { onClose: () => void }) {
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState("");

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const autoAdd = async () => {
    try {
      await switchChain({ chainId: arcTestnet.id });
      toast.success("Arc Testnet added!");
      onClose();
    } catch {
      toast.error("Auto-add failed — please add manually using the details below");
    }
  };

  const rows = [
    ["Network Name", NETWORK_DETAILS.networkName],
    ["Chain ID", NETWORK_DETAILS.chainId],
    ["RPC URL", NETWORK_DETAILS.rpcUrl],
    ["Currency Symbol", NETWORK_DETAILS.symbol],
    ["Block Explorer", NETWORK_DETAILS.explorer],
  ];

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="popup">
        <div className="popup-glow" />
        <div className="popup-top">
          <div className="popup-icon">🌐</div>
          <div>
            <h2 className="popup-h">Add Arc Testnet</h2>
            <p className="popup-sub">Port runs on Arc Testnet. Add it to your wallet to continue.</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <button className="auto-btn" onClick={autoAdd}>⚡ Auto-Add Arc Testnet</button>

        <div className="or-divider"><span>or add manually in your wallet</span></div>

        <div className="field-list">
          {rows.map(([k, v]) => (
            <div key={k} className="field-row">
              <span className="field-key">{k}</span>
              <div className="field-val-row">
                <span className="field-val">{v.length > 42 ? v.slice(0, 42) + "…" : v}</span>
                <button className="copy-btn" onClick={() => copy(v, k)}>
                  {copied === k ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="popup-note">
          After adding, switch to Arc Testnet in your wallet, then you&apos;re ready to use Port.
        </p>
      </div>
    </div>
  );
}

// ─── Regime badge ─────────────────────────────────────────────────────────────
function RegimeBadge({ regime }: { regime: Regime | null }) {
  const cfg = regime ? REGIME_CONFIG[regime] : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: cfg?.bgColor ?? "rgba(80,80,80,0.1)",
      padding: "5px 11px", borderRadius: 100,
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: cfg?.color ?? "#555",
        boxShadow: `0 0 7px ${cfg?.color ?? "#555"}`,
        animation: "pulse 2s infinite",
        display: "inline-block",
      }} />
      <span style={{
        fontFamily: "'Space Mono',monospace", fontSize: 10,
        fontWeight: 700, letterSpacing: 2,
        color: cfg?.color ?? "#777",
      }}>
        {cfg?.label ?? "IDLE"}
      </span>
    </div>
  );
}

// ─── Transaction log item ─────────────────────────────────────────────────────
function TxItem({ tx }: { tx: TxLog }) {
  const ICON = { deposit: "↓", redeem: "↑", skipped: "–", error: "✕" };
  const COLOR = { deposit: "#10b981", redeem: "#3b82f6", skipped: "#6b7280", error: "#ef4444" };
  const cfg = REGIME_CONFIG[tx.regime];
  const explorerBase = NETWORK_DETAILS.explorer;
  return (
    <div className="tx-row">
      <div className="tx-icon" style={{ color: COLOR[tx.type], borderColor: COLOR[tx.type] + "33" }}>
        {ICON[tx.type]}
      </div>
      <div className="tx-content">
        <div className="tx-meta">
          <span style={{ color: COLOR[tx.type], fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700 }}>
            {tx.type.toUpperCase()}
          </span>
          <span style={{ color: cfg.color, background: cfg.bgColor, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>
            {cfg.label}
          </span>
          <span className="tx-conf">{tx.confidence}% conf</span>
          <span className="tx-ts">{new Date(tx.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="tx-reason">{tx.reasoning}</p>
        {tx.amountIn && (
          <div className="tx-amounts">{tx.amountIn} <span className="tx-arr">→</span> {tx.amountOut}</div>
        )}
        {tx.txHash && (
          <a href={`${explorerBase}/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="tx-link">
            {tx.txHash.slice(0, 20)}… ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Page() {
  // ── Hydration guard — never render wallet state on server ─────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { state, runCycle, startAuto, stopAuto, setRiskProfile, refreshBalances } = useAgent();

  const [tab, setTab] = useState<"dashboard" | "log" | "settings">("dashboard");
  const [showPopup, setShowPopup] = useState(false);

  // ── Popup: only when user actively clicks Connect for the first time ────────
  // We track whether they've seen it this SESSION using sessionStorage
  // This prevents the popup showing on page reload when wallet is already connected
  const prevConnected = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    const seen = sessionStorage.getItem("port_network_popup_shown");
    if (isConnected && !prevConnected.current && !seen) {
      // Wallet just went from disconnected → connected in this session
      const t = setTimeout(() => {
        setShowPopup(true);
        sessionStorage.setItem("port_network_popup_shown", "1");
      }, 700);
      prevConnected.current = true;
      return () => clearTimeout(t);
    }
    if (isConnected) {
      prevConnected.current = true;
    }
    if (!isConnected) {
      // Reset so popup can show again after a fresh connect
      prevConnected.current = false;
      sessionStorage.removeItem("port_network_popup_shown");
    }
  }, [isConnected, mounted]);

  const wrongNetwork = mounted && isConnected && chainId !== arcTestnet.id;

  const allocation = [
    { name: "USDC", value: state.balances?.usdcPct ?? 100, color: "#3b82f6" },
    { name: "USYC", value: state.balances?.usycPct ?? 0,   color: "#10b981" },
  ];

  // ── Loading shell (server + hydration) ───────────────────────────────────
  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#1f2937", letterSpacing: 3 }}>
          LOADING PORT…
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      {showPopup && <NetworkPopup onClose={() => setShowPopup(false)} />}

      <div className="app">
        <div className="grid-bg" aria-hidden />

        {/* ── Header ── */}
        <header className="header">
          <div className="brand">
            <img src="/logo.png" alt="Port" className="logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="brand-name">Port</span>
            <span className="brand-chip">Arc Testnet</span>
          </div>

          {isConnected && (
            <nav className="nav">
              {(["dashboard", "log", "settings"] as const).map((t) => (
                <button key={t} className={`nav-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </nav>
          )}

          <div className="header-right">
            {isConnected && <RegimeBadge regime={state.currentRegime} />}
            {wrongNetwork && (
              <button className="wrong-net" onClick={() => setShowPopup(true)}>⚠ Wrong Network</button>
            )}
            <ConnectButton />
            {isConnected && (
              <button className="disc-btn" onClick={() => disconnect()}>Disconnect</button>
            )}
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="main">

          {!isConnected ? (
            /* ══ LANDING PAGE ══ */
            <div className="landing">
              <div className="landing-card">
                <div className="landing-glow" />
                <img src="/logo.png" alt="Port" className="landing-logo"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <h1 className="landing-h1">Port</h1>
                <p className="landing-tag">Intelligent autonomous regime-adaptive portfolio agent</p>

                <div className="features">
                  {[
                    ["🧠", "AI Regime Detection", "LLM analyses market conditions every 90s and classifies risk_on / risk_off / high_vol"],
                    ["⚡", "Autonomous Execution", "Real on-chain USDC ↔ USYC swaps via the Arc Teller contract"],
                    ["📊", "Live Portfolio", "Track your USDC + USYC balances, allocation %, and full decision log"],
                  ].map(([icon, title, desc]) => (
                    <div key={String(title)} className="feature">
                      <span className="feat-icon">{icon}</span>
                      <div>
                        <div className="feat-title">{title}</div>
                        <div className="feat-desc">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="landing-cta">
                  <ConnectButton label="Connect Wallet to Start" />
                </div>
                <p className="landing-note">Supports MetaMask, OKX, Rabby, Coinbase & all WalletConnect wallets</p>
                <p className="landing-note" style={{ marginTop: 4 }}>Arc Testnet · Chain ID 5042002</p>
              </div>
            </div>

          ) : tab === "dashboard" ? (
            /* ══ DASHBOARD ══ */
            <div className="dashboard">

              {/* Wallet + balance bar */}
              <div className="wallet-bar">
                <div className="wallet-left">
                  <span className="online-dot" />
                  <span className="wallet-addr">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                  <span className="net-tag">Arc Testnet</span>
                </div>
                <div className="wallet-right">
                  <span className="bal-usdc">{state.balances?.usdcFormatted ?? "—"} USDC</span>
                  <span className="bal-sep">·</span>
                  <span className="bal-usyc">{state.balances?.usycFormatted ?? "—"} USYC</span>
                  <button className="icon-btn" onClick={refreshBalances} title="Refresh balances">↺</button>
                </div>
              </div>

              {/* Status bar */}
              <div className="status-bar">
                <div className="status-left">
                  <div className={`status-dot${state.isRunning ? " running" : ""}`} />
                  <span className="status-text">{state.status}</span>
                  {state.isRunning && state.nextCycleAt && (
                    <span className="status-timer">· next in <Countdown target={state.nextCycleAt} /></span>
                  )}
                </div>
                <div className="agent-btns">
                  <button
                    className="run-btn"
                    onClick={runCycle}
                    disabled={state.isExecuting}
                  >
                    {state.isExecuting ? "⏳ Running…" : "▶ Run Agent Cycle"}
                  </button>
                  {state.isRunning ? (
                    <button className="stop-btn" onClick={stopAuto}>⏹ Stop Auto</button>
                  ) : (
                    <button className="auto-mode-btn" onClick={startAuto}>🔄 Auto Mode</button>
                  )}
                </div>
              </div>

              {state.error && <div className="err-bar">⚠ {state.error}</div>}

              {/* Stat cards */}
              <div className="stats">
                {[
                  { label: "Portfolio Value", val: `$${(state.balances?.totalUsd ?? 0).toFixed(2)}`, sub: "Total USD estimate" },
                  { label: "USDC Balance", val: `${state.balances?.usdcFormatted ?? "—"}`, sub: `${(state.balances?.usdcPct ?? 0).toFixed(1)}% · idle`, color: "#3b82f6" },
                  { label: "USYC Balance", val: `${state.balances?.usycFormatted ?? "—"}`, sub: `${(state.balances?.usycPct ?? 0).toFixed(1)}% · earning yield`, color: "#10b981" },
                  { label: "Agent Cycles", val: String(state.cycleCount), sub: `Profile: ${state.riskProfile}`, color: "#f59e0b" },
                ].map(({ label, val, sub, color }) => (
                  <div key={label} className="stat-card">
                    <span className="stat-label">{label}</span>
                    <span className="stat-val" style={{ color }}>{val}</span>
                    <span className="stat-sub">{sub}</span>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="charts">
                <div className="chart-card">
                  <div className="chart-head">
                    <span className="chart-title">Portfolio Value</span>
                    <span className="chart-hint">24h baseline</span>
                  </div>
                  <ResponsiveContainer width="100%" height={175}>
                    <AreaChart data={CHART} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="t" tick={{ fill: "#374151", fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
                      <YAxis tick={{ fill: "#374151", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#3b82f6" }} />
                      <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#g)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card chart-sm">
                  <div className="chart-head"><span className="chart-title">Allocation</span></div>
                  <div className="donut">
                    <PieChart width={145} height={145}>
                      <Pie data={allocation} cx={68} cy={68} innerRadius={42} outerRadius={62} dataKey="value" strokeWidth={0}>
                        {allocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                    <div className="donut-center">
                      <span className="donut-pct">{(state.balances?.usycPct ?? 0).toFixed(0)}%</span>
                      <span className="donut-lbl">yield</span>
                    </div>
                  </div>
                  <div className="donut-leg">
                    {allocation.map((a) => (
                      <div key={a.name} className="leg-row">
                        <span className="leg-dot" style={{ background: a.color }} />
                        <span className="leg-name">{a.name}</span>
                        <span className="leg-pct">{a.value.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Analysis card */}
              {state.regimeAnalysis && (
                <div className="analysis-card">
                  <div className="analysis-head">
                    <span className="analysis-title">AI Regime Analysis</span>
                    <div className="conf-wrap">
                      <span className="conf-lbl">Confidence</span>
                      <div className="conf-track">
                        <div className="conf-fill" style={{
                          width: `${state.regimeAnalysis.confidence}%`,
                          background: REGIME_CONFIG[state.regimeAnalysis.regime].color,
                        }} />
                      </div>
                      <span className="conf-pct">{state.regimeAnalysis.confidence}%</span>
                    </div>
                  </div>
                  <p className="analysis-reason">{state.regimeAnalysis.reasoning}</p>
                  <div className="signals-grid">
                    {([
                      ["Sentiment", state.regimeAnalysis.signals.marketSentiment],
                      ["Volatility", state.regimeAnalysis.signals.volatilityAssessment],
                      ["Yield Opp.", state.regimeAnalysis.signals.yieldOpportunity],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="signal">
                        <span className="sig-k">{k}</span>
                        <span className="sig-v">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rec">
                    <span className="rec-lbl">Recommendation</span>
                    <span className="rec-text">{state.regimeAnalysis.recommendation}</span>
                  </div>
                </div>
              )}
            </div>

          ) : tab === "log" ? (
            /* ══ TRANSACTION LOG ══ */
            <div className="log-tab">
              <div className="log-head">
                <h2 className="log-title">Agent Decision Log</h2>
                <span className="log-count">{state.transactions.length} entries</span>
              </div>
              {state.transactions.length === 0 ? (
                <div className="log-empty">
                  No entries yet — click <strong>Run Agent Cycle</strong> to start
                </div>
              ) : (
                <div className="log-list">
                  {state.transactions.map((tx) => <TxItem key={tx.id} tx={tx} />)}
                </div>
              )}
            </div>

          ) : (
            /* ══ SETTINGS ══ */
            <div className="settings-tab">
              <h2 className="sett-title">Risk Profile</h2>
              <p className="sett-sub">
                Controls how aggressively Port moves between idle USDC and yield-bearing USYC when the agent detects a regime change.
              </p>
              <div className="profiles">
                {([
                  ["conservative", "🛡", "Capital preservation first. Moves most funds to USYC yield during risk-off. Stays cautious even when risk-on."],
                  ["balanced",     "⚖️", "Moderate balance between yield and liquidity. Follows regime signals with reasonable allocation shifts."],
                  ["aggressive",   "⚡", "Maximises yield at all times. Moves heavily into USYC during risk-off. Only retreats in extreme volatility."],
                ] as [RiskProfile, string, string][]).map(([p, icon, desc]) => (
                  <button
                    key={p}
                    className={`profile-card${state.riskProfile === p ? " selected" : ""}`}
                    onClick={() => setRiskProfile(p)}
                  >
                    <span className="p-icon">{icon}</span>
                    <span className="p-name">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                    <span className="p-desc">{desc}</span>
                  </button>
                ))}
              </div>

              <div className="sett-div" />

              <h2 className="sett-title">Network</h2>
              <button className="net-guide-btn" onClick={() => setShowPopup(true)}>
                🌐 Open Arc Testnet Setup Guide
              </button>
              <div className="net-table">
                {([
                  ["Network", NETWORK_DETAILS.networkName],
                  ["Chain ID", NETWORK_DETAILS.chainId],
                  ["USDC Contract", "0x3600…0000"],
                  ["USYC Contract", "0xe918…86C"],
                  ["Teller Contract", "0x9fdF…05A"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="net-row">
                    <span className="net-k">{k}</span>
                    <span className="net-v">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="footer">
          <span>© Beauty Benedict · Port v1.0 · Agora Hackathon 2025</span>
          <span>Arc Testnet · Chain ID 5042002</span>
        </footer>
      </div>

      {/* ══ STYLES ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080b10; color: #e2e8f0; font-family: 'Space Grotesk', system-ui, sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; }

        .app { min-height: 100vh; display: flex; flex-direction: column; position: relative; }
        .grid-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px);
          background-size: 44px 44px; }

        /* Header */
        .header { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 24px; height: 60px; background: rgba(8,11,16,0.92); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .brand { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
        .logo { height: 26px; width: auto; }
        .brand-name { font-size: 19px; font-weight: 700; letter-spacing: -0.5px; background: linear-gradient(135deg, #e2e8f0, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .brand-chip { font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.28); padding: 2px 7px; border-radius: 4px; }
        .nav { display: flex; gap: 2px; }
        .nav-btn { background: transparent; border: none; color: #6b7280; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 500; padding: 5px 13px; border-radius: 7px; cursor: pointer; transition: all 0.15s; }
        .nav-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
        .nav-btn.active { color: #e2e8f0; background: rgba(255,255,255,0.08); }
        .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .disc-btn { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22); color: #ef4444; font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 500; padding: 5px 11px; border-radius: 7px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .disc-btn:hover { background: rgba(239,68,68,0.2); }
        .wrong-net { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.65;transform:scale(1.3)} }

        /* Main */
        .main { flex: 1; padding: 22px 24px; position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; width: 100%; }

        /* Landing */
        .landing { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 100px); }
        .landing-card { background: rgba(13,17,24,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 22px; padding: 52px 44px; max-width: 460px; width: 100%; text-align: center; position: relative; overflow: hidden; }
        .landing-glow { position: absolute; top: -90px; left: 50%; transform: translateX(-50%); width: 380px; height: 380px; background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%); pointer-events: none; }
        .landing-logo { height: 46px; width: auto; margin-bottom: 14px; position: relative; }
        .landing-h1 { font-size: 46px; font-weight: 700; letter-spacing: -2.5px; background: linear-gradient(135deg, #fff 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
        .landing-tag { font-size: 14px; color: #6b7280; line-height: 1.65; margin-bottom: 34px; }
        .features { display: flex; flex-direction: column; gap: 16px; text-align: left; margin-bottom: 36px; }
        .feature { display: flex; gap: 12px; align-items: flex-start; }
        .feat-icon { font-size: 19px; flex-shrink: 0; margin-top: 1px; }
        .feat-title { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 2px; }
        .feat-desc { font-size: 12px; color: #6b7280; line-height: 1.5; }
        .landing-cta { display: flex; justify-content: center; margin-bottom: 16px; }
        .landing-note { font-size: 11px; color: #374151; line-height: 1.6; }

        /* Overlay + Popup */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .popup { background: #0d1117; border: 1px solid rgba(59,130,246,0.28); border-radius: 18px; padding: 30px; max-width: 490px; width: 100%; position: relative; overflow: hidden; }
        .popup-glow { position: absolute; top: -70px; right: -70px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%); pointer-events: none; }
        .popup-top { display: flex; align-items: flex-start; gap: 13px; margin-bottom: 22px; }
        .popup-icon { font-size: 26px; line-height: 1; flex-shrink: 0; }
        .popup-h { font-size: 17px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.3px; }
        .popup-sub { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
        .close-btn { margin-left: auto; background: rgba(255,255,255,0.06); border: none; color: #6b7280; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-size: 11px; flex-shrink: 0; transition: all 0.15s; }
        .close-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.1); }
        .auto-btn { width: 100%; padding: 11px; background: #3b82f6; border: none; border-radius: 9px; color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; margin-bottom: 18px; }
        .auto-btn:hover { background: #2563eb; transform: translateY(-1px); }
        .or-divider { display: flex; align-items: center; gap: 10px; color: #374151; font-size: 11px; margin-bottom: 16px; }
        .or-divider::before, .or-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .field-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .field-row { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 9px; padding: 9px 13px; }
        .field-key { font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #4b5563; display: block; margin-bottom: 4px; }
        .field-val-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .field-val { font-family: 'Space Mono', monospace; font-size: 11px; color: #9ca3af; word-break: break-all; }
        .copy-btn { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.28); color: #3b82f6; font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 4px; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: all 0.15s; }
        .copy-btn:hover { background: rgba(59,130,246,0.22); }
        .popup-note { font-size: 11px; color: #4b5563; text-align: center; line-height: 1.6; }

        /* Dashboard */
        .dashboard { display: flex; flex-direction: column; gap: 16px; }
        .wallet-bar { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 11px; padding: 11px 17px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .wallet-left { display: flex; align-items: center; gap: 8px; }
        .online-dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; animation: pulse 2s infinite; flex-shrink: 0; }
        .wallet-addr { font-family: 'Space Mono', monospace; font-size: 13px; color: #e2e8f0; }
        .net-tag { font-size: 10px; color: #4b5563; background: rgba(255,255,255,0.04); padding: 2px 7px; border-radius: 4px; }
        .wallet-right { display: flex; align-items: center; gap: 9px; }
        .bal-usdc { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; color: #3b82f6; }
        .bal-usyc { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; color: #10b981; }
        .bal-sep { color: #374151; }
        .icon-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07); color: #6b7280; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.15s; }
        .icon-btn:hover { color: #e2e8f0; }

        .status-bar { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 11px; padding: 11px 17px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .status-left { display: flex; align-items: center; gap: 8px; flex: 1; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #374151; flex-shrink: 0; transition: background 0.3s; }
        .status-dot.running { background: #10b981; animation: pulse 1.5s infinite; box-shadow: 0 0 6px #10b981; }
        .status-text { font-size: 13px; color: #9ca3af; }
        .status-timer { font-size: 12px; color: #6b7280; font-family: 'Space Mono', monospace; }
        .agent-btns { display: flex; gap: 8px; }
        .run-btn { padding: 8px 16px; background: #3b82f6; border: none; border-radius: 8px; color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .run-btn:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
        .run-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .stop-btn { padding: 8px 14px; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .stop-btn:hover { background: rgba(239,68,68,0.2); }
        .auto-mode-btn { padding: 8px 14px; background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .auto-mode-btn:hover { background: rgba(16,185,129,0.2); }

        .err-bar { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2); border-radius: 9px; padding: 9px 15px; color: #f87171; font-size: 13px; }

        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 13px; }
        .stat-card { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 17px; display: flex; flex-direction: column; gap: 3px; }
        .stat-label { font-size: 10px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: #374151; }
        .stat-val { font-size: 24px; font-weight: 700; letter-spacing: -0.8px; color: #e2e8f0; }
        .stat-sub { font-size: 11px; color: #374151; }

        .charts { display: grid; grid-template-columns: 1fr 250px; gap: 13px; }
        .chart-card { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 17px; }
        .chart-sm { display: flex; flex-direction: column; }
        .chart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .chart-title { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        .chart-hint { font-size: 10px; color: #374151; font-family: 'Space Mono', monospace; }
        .donut { position: relative; display: flex; justify-content: center; }
        .donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; }
        .donut-pct { font-size: 19px; font-weight: 700; color: #10b981; letter-spacing: -1px; }
        .donut-lbl { font-size: 9px; color: #4b5563; font-family: 'Space Mono', monospace; }
        .donut-leg { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; }
        .leg-row { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #9ca3af; }
        .leg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .leg-name { flex: 1; }
        .leg-pct { font-family: 'Space Mono', monospace; font-size: 11px; color: #6b7280; }

        .analysis-card { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px; }
        .analysis-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .analysis-title { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        .conf-wrap { display: flex; align-items: center; gap: 7px; }
        .conf-lbl { font-size: 10px; color: #4b5563; }
        .conf-track { width: 85px; height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
        .conf-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
        .conf-pct { font-family: 'Space Mono', monospace; font-size: 10px; color: #6b7280; }
        .analysis-reason { font-size: 13px; line-height: 1.7; color: #9ca3af; padding: 11px 13px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 2px solid rgba(59,130,246,0.4); margin-bottom: 13px; }
        .signals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
        .signal { display: flex; flex-direction: column; gap: 3px; }
        .sig-k { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #374151; font-family: 'Space Mono', monospace; }
        .sig-v { font-size: 12px; color: #9ca3af; line-height: 1.4; }
        .rec { display: flex; gap: 10px; padding: 10px 13px; background: rgba(59,130,246,0.05); border-radius: 8px; border: 1px solid rgba(59,130,246,0.14); }
        .rec-lbl { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #3b82f6; font-family: 'Space Mono', monospace; white-space: nowrap; padding-top: 1px; }
        .rec-text { font-size: 12px; color: #9ca3af; line-height: 1.5; }

        /* Log */
        .log-tab { display: flex; flex-direction: column; gap: 14px; }
        .log-head { display: flex; align-items: center; justify-content: space-between; }
        .log-title { font-size: 16px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.3px; }
        .log-count { font-family: 'Space Mono', monospace; font-size: 11px; color: #374151; }
        .log-empty { text-align: center; padding: 70px 20px; color: #374151; font-size: 13px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 12px; line-height: 1.8; }
        .log-list { display: flex; flex-direction: column; gap: 8px; }
        .tx-row { display: flex; gap: 12px; background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.06); border-radius: 11px; padding: 13px; transition: border-color 0.15s; }
        .tx-row:hover { border-color: rgba(255,255,255,0.11); }
        .tx-icon { width: 29px; height: 29px; border-radius: 7px; border: 1px solid; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; background: rgba(255,255,255,0.02); }
        .tx-content { flex: 1; min-width: 0; }
        .tx-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; flex-wrap: wrap; }
        .tx-conf { font-family: 'Space Mono', monospace; font-size: 10px; color: #374151; }
        .tx-ts { font-family: 'Space Mono', monospace; font-size: 10px; color: #374151; margin-left: auto; }
        .tx-reason { font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 5px; }
        .tx-amounts { font-family: 'Space Mono', monospace; font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
        .tx-arr { color: #374151; margin: 0 5px; }
        .tx-link { font-family: 'Space Mono', monospace; font-size: 10px; color: #3b82f6; text-decoration: none; opacity: 0.8; }
        .tx-link:hover { opacity: 1; }

        /* Settings */
        .settings-tab { max-width: 640px; display: flex; flex-direction: column; gap: 13px; }
        .sett-title { font-size: 15px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.2px; }
        .sett-sub { font-size: 12px; color: #6b7280; line-height: 1.6; margin-top: -5px; }
        .profiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .profile-card { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 11px; padding: 17px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 5px; transition: all 0.15s; }
        .profile-card:hover { border-color: rgba(255,255,255,0.13); }
        .profile-card.selected { border-color: #3b82f6; background: rgba(59,130,246,0.06); }
        .p-icon { font-size: 19px; }
        .p-name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
        .p-desc { font-size: 11px; color: #6b7280; line-height: 1.5; }
        .sett-div { height: 1px; background: rgba(255,255,255,0.05); }
        .net-guide-btn { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.22); color: #3b82f6; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 500; padding: 9px 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.15s; }
        .net-guide-btn:hover { background: rgba(59,130,246,0.15); }
        .net-table { background: rgba(13,17,24,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
        .net-row { display: flex; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .net-row:last-child { border-bottom: none; }
        .net-k { font-family: 'Space Mono', monospace; font-size: 10px; color: #4b5563; }
        .net-v { font-family: 'Space Mono', monospace; font-size: 10px; color: #9ca3af; }

        /* Footer */
        .footer { position: relative; z-index: 1; display: flex; justify-content: space-between; padding: 13px 24px; border-top: 1px solid rgba(255,255,255,0.05); font-family: 'Space Mono', monospace; font-size: 10px; color: #1f2937; flex-wrap: wrap; gap: 4px; }

        /* Responsive */
        @media (max-width: 860px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .charts { grid-template-columns: 1fr; }
          .signals-grid { grid-template-columns: 1fr 1fr; }
          .profiles { grid-template-columns: 1fr; }
          .nav { display: none; }
          .main { padding: 14px 14px; }
        }
      `}</style>
    </>
  );
}