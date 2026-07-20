import { useState, useEffect } from "react";
import Head from "next/head";

const MODE_LABELS = {
  normal: { label: "通常モード", color: "#888888" },
  surge: { label: "爆騰モード", color: "#00ff9d" },
  crash: { label: "暴落モード", color: "#ff5566" },
  ai: { label: "AIバブルモード", color: "#cccccc" },
};

function getTodayInfo(isTradingDay) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const now = new Date();
  const day = days[now.getDay()];
  const hour = now.getHours();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  // is_trading_day はサーバー側で日本の祝日も加味して判定済み（backend: is_business_day）。
  // 値が取得できていない場合のみ、クライアント側の曜日判定にフォールバックする。
  const tradingDay = typeof isTradingDay === "boolean" ? isTradingDay : isWeekday;
  const isMarketOpen = tradingDay && hour >= 9 && hour < 16;
  const isUSMarket = tradingDay && (hour >= 23 || hour < 6);
  const isWeekend = !tradingDay;
  return { day, isMarketOpen, isUSMarket, isWeekend };
}

function nextMondayLabel() {
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // 日曜なら1日後、土曜なら2日後
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  return `${next.getMonth() + 1}/${next.getDate()}(月)`;
}

function WeekendBanner({ todayInfo, briefingDate, nextTradingDay }) {
  if (!todayInfo.isWeekend) return null;
  return (
    <div style={{
      background: "#12141a", border: "1px solid #3a3f52", borderRadius: 10,
      padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>🌙</span>
      <div style={{ fontSize: 11, color: "#b8bcd0" }}>
        市場休場中（{todayInfo.day}曜日）— 表示中のデータは{briefingDate || "直近営業日"}の朝刊です。次回更新は{nextTradingDay || nextMondayLabel()} 6:30
      </div>
    </div>
  );
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const [y, m, d] = dateStr.split("/").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function renderInlineBold(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={`${keyPrefix}-b${i}`} style={{ color: "#f0f0f0" }}>{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-t${i}`}>{part}</span>
  );
}

function renderMarkdownLite(text) {
  if (!text) return null;
  return String(text).split("\n").map((line, i) => {
    const t = line.trim();
    if (t.startsWith("### ")) return <div key={i} style={{ fontSize: 12, fontWeight: 800, color: "#f0f0f0", marginTop: 10, marginBottom: 4 }}>{renderInlineBold(t.slice(4), i)}</div>;
    if (t.startsWith("## ")) return <div key={i} style={{ fontSize: 13, fontWeight: 800, color: "#f0f0f0", marginTop: 12, marginBottom: 5 }}>{renderInlineBold(t.slice(3), i)}</div>;
    if (t.startsWith("# ")) return <div key={i} style={{ fontSize: 14, fontWeight: 800, color: "#ffffff", marginTop: 12, marginBottom: 6 }}>{renderInlineBold(t.slice(2), i)}</div>;
    if (t === "") return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ marginBottom: 2 }}>{renderInlineBold(line, i)}</div>;
  });
}

function WeeklyContentCard({ icon, label, data }) {
  if (!data || daysSince(data.date) > 3) return null;
  return (
    <div style={{ background: "#121212", border: "1px solid #3a3f52", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 4 }}>{icon} {label} <span style={{ color: "#5a5a5a" }}>{data.date}</span></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 6 }}>{data.title}</div>
      <div style={{ fontSize: 11, color: "#c8c8c8", lineHeight: 1.7 }}>{renderMarkdownLite(data.note_body)}</div>
    </div>
  );
}

function StockCard({ s, highlighted }) {
  return (
    <div
      id={`stock-${s.code}`}
      style={{
        background: "#121212", border: `1px solid ${highlighted ? "#ffd166" : "#262626"}`,
        boxShadow: highlighted ? "0 0 0 2px #ffd16655" : "none",
        borderRadius: 10, padding: "12px 14px", marginBottom: 10, scrollMarginTop: 60,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 9, color: "#e8e8e8", background: "#e8e8e818", padding: "2px 7px", borderRadius: 8 }}>{s.pattern}</span>
          <div style={{ fontSize: 14, color: "#eeeeee", marginTop: 5, fontWeight: 500 }}>{s.name}<span style={{ color: "#8a8a8a", fontSize: 11 }}> ({s.code})</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          {typeof s.ai_score === "number" ? (() => {
            const combined = Math.round((s.score * 10 + s.ai_score) / 2);
            const color = combined >= 60 ? "#00ff9d" : combined <= 40 ? "#ff5566" : "#ffd166";
            return (
              <>
                <div style={{ fontSize: 9, color: "#8a8a8a" }}>統合スコア</div>
                <div style={{ fontSize: 18, color, fontWeight: 700 }}>{combined}<span style={{ fontSize: 10, color: "#8a8a8a" }}>/100</span></div>
                <div style={{ fontSize: 9, color: "#6a6a6a", marginTop: 3 }}>総合{s.score}/10 ・ AI{s.ai_score}/100</div>
              </>
            );
          })() : (
            <>
              <div style={{ fontSize: 9, color: "#8a8a8a" }}>総合スコア</div>
              <div style={{ fontSize: 15, color: "#ffd166", fontWeight: 500 }}>{s.score}<span style={{ fontSize: 10, color: "#8a8a8a" }}>/10</span></div>
            </>
          )}
        </div>
      </div>

      {s.fundamental && (
        <div style={{ marginBottom: 8, padding: "8px 10px", background: "#0d0d0d", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: "#8a8a8a", marginBottom: 3 }}>ファンダメンタル</div>
          <div style={{ fontSize: 11, color: "#b8b8b8", lineHeight: 1.6 }}>{s.fundamental}</div>
        </div>
      )}

      <div style={{ marginBottom: 8, padding: "8px 10px", background: "#0d0d0d", borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: "#8a8a8a", marginBottom: 3 }}>チャート分析</div>
        <div style={{ fontSize: 11, color: "#b8b8b8", lineHeight: 1.6 }}>{s.reason}</div>
        <div style={{ fontSize: 10, color: "#9a9a9a", marginTop: 6 }}>エントリー条件: {s.entry}</div>
      </div>

      <div style={{ fontSize: 10, color: "#9a9a9a", marginBottom: 6, display: "flex", gap: 14 }}>
        <span>目標 <strong style={{ color: "#00ff9d" }}>{s.target}</strong></span>
        <span>損切 <strong style={{ color: "#ff5566" }}>{s.stop}</strong></span>
      </div>
      <div style={{ fontSize: 10, color: "#787878", fontStyle: "italic" }}>{s.comment}</div>
      {typeof s.ai_score === "number" && (
        <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 6 }}>
          ※統合スコアは、Claudeによる主観的な総合スコア（物語性・材料重視）とテクニカル指標のみで
          機械的に算出したAIスコアの平均値です。内訳の乖離が大きい場合は材料とチャートの評価が
          ズレている状態なので参考にしてください。
        </div>
      )}
    </div>
  );
}

const FG_LABEL_JP = {
  "extreme fear": "極度の恐怖", "fear": "恐怖", "neutral": "中立", "greed": "強欲", "extreme greed": "極度の強欲",
};

function FearGreedGauge({ value, label, diff }) {
  if (typeof value !== "number") {
    return (
      <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "12px 14px", marginBottom: 14, textAlign: "center", color: "#6a6a6a", fontSize: 11 }}>
        Fear &amp; Greed指数はまだ取得できていません
      </div>
    );
  }
  const cx = 100, cy = 95, r = 80;
  const clamped = Math.max(0, Math.min(100, value));
  const angle = 180 - (clamped / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const needleLen = 68;
  const nx = cx + needleLen * Math.cos(rad);
  const ny = cy - needleLen * Math.sin(rad);
  const labelJp = FG_LABEL_JP[(label || "").toLowerCase()] || label || "";
  const diffColor = typeof diff === "number" ? (diff >= 0 ? "#00ff9d" : "#ff5566") : "#8a8a8a";

  return (
    <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 14px 6px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 4 }}>Fear &amp; Greed指数</div>
      <svg viewBox="0 0 200 112" style={{ width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5566" />
            <stop offset="25%" stopColor="#ff9955" />
            <stop offset="50%" stopColor="#ffd166" />
            <stop offset="75%" stopColor="#a8e063" />
            <stop offset="100%" stopColor="#00ff9d" />
          </linearGradient>
        </defs>
        <path d={`M 20 ${cy} A ${r} ${r} 0 0 1 180 ${cy}`} fill="none" stroke="url(#fgGrad)" strokeWidth="14" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#eeeeee" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#eeeeee" />
        <text x={14} y={cy + 18} fontSize="9" fill="#6a6a6a">恐怖</text>
        <text x={162} y={cy + 18} fontSize="9" fill="#6a6a6a">強欲</text>
      </svg>
      <div style={{ textAlign: "center", marginTop: -8, paddingBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#eeeeee" }}>{Math.round(value)}</span>
        <span style={{ fontSize: 12, color: "#8a8a8a", marginLeft: 6 }}>{labelJp}</span>
        {typeof diff === "number" && (
          <span style={{ fontSize: 11, color: diffColor, marginLeft: 8 }}>
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}（前日比）
          </span>
        )}
      </div>
    </div>
  );
}


function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getMarketScore(briefing) {
  if (typeof briefing.market_score === "number") return clampScore(briefing.market_score);
  let score = 50;
  score += Math.max(-18, Math.min(18, (briefing.sox_pct || 0) * 5));
  score += Math.max(-16, Math.min(16, (briefing.nasdaq_pct || 0) * 5));
  score += Math.max(-18, Math.min(18, (briefing.nikkei_pct || 0) * 5));
  if (typeof briefing.vix === "number") score += Math.max(-14, Math.min(10, (20 - briefing.vix) * 1.2));
  return clampScore(score);
}

function marketScoreMeta(score) {
  if (score >= 75) return { label: "攻めの日", sub: "強気", color: "#00ff9d" };
  if (score >= 60) return { label: "選別して攻める", sub: "やや強気", color: "#8ee8b8" };
  if (score >= 45) return { label: "様子見", sub: "中立", color: "#ffd166" };
  if (score >= 30) return { label: "守る日", sub: "警戒", color: "#ff9955" };
  return { label: "無理をしない", sub: "強い警戒", color: "#ff5566" };
}

function shortText(text, max = 120) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSignedPct(value, digits = 2) {
  const n = finiteNumber(value);
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function strategyLines(briefing) {
  if (Array.isArray(briefing.strategy_lines) && briefing.strategy_lines.length) {
    return briefing.strategy_lines.slice(0, 3).map(x => shortText(x));
  }
  const lines = [
    briefing.consideration?.point,
    briefing.consideration?.action,
    briefing.market_summary,
  ].filter(Boolean).map(x => shortText(x));
  const fallbacks = [
    (briefing.sox_pct || 0) > 1 ? "全体指数より半導体の相対強度を優先" : "指数の方向を確認してから入る",
    "急騰銘柄を追わず、押し目まで待つ",
    "過熱銘柄は利確、売られすぎは分割検討",
  ];
  return [...lines, ...fallbacks].slice(0, 3);
}

function nextImportantEvent(briefing) {
  if (Array.isArray(briefing.today_events) && briefing.today_events.length) return briefing.today_events[0];
  const all = [
    ...(briefing.events_jp || []).map(e => ({ ...e, region: "日本" })),
    ...(briefing.events_us || []).map(e => ({ ...e, region: "米国" })),
  ].filter(e => e.date);
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayKey = y + "-" + m + "-" + d;
  return all.sort((a, b) => a.date.localeCompare(b.date)).find(e => e.date >= todayKey) || all[0] || null;
}

function MarketDashboard({ briefing }) {
  const score = getMarketScore(briefing);
  const meta = marketScoreMeta(score);
  const lines = strategyLines(briefing);
  const event = nextImportantEvent(briefing);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (score / 100);
  const eventLevel = event ? getImportance(event) : "low";
  const eventMeta = IMPORTANCE_META[eventLevel];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10, marginBottom: 14 }}>
      <div style={{ background: "linear-gradient(145deg,#151515,#0d0d0d)", border: `1px solid ${meta.color}55`, boxShadow: `0 0 28px ${meta.color}16`, borderRadius: 14, padding: "14px 14px 12px" }}>
        <div style={{ fontSize: 10, color: "#8a8a8a", letterSpacing: 1 }}>TODAY'S MARKET SCORE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
          <div style={{ width: 112, height: 112, position: "relative", flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#252525" strokeWidth="9" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke={meta.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 800, color: meta.color }}>{score}</div>
              <div style={{ fontSize: 9, color: "#777", marginTop: 3 }}>/ 100</div>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: meta.color, lineHeight: 1.25 }}>{meta.label}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{briefing.market_score_label || meta.sub}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <span style={{ fontSize: 9, color: (briefing.nikkei_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>日経 {(briefing.nikkei_pct || 0).toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: (briefing.sox_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>SOX {(briefing.sox_pct || 0).toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: "#aaa" }}>VIX {briefing.vix ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ background: "#121212", border: "1px solid #2c2c2c", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f0f0" }}>今日の3行戦略</div>
            <div style={{ fontSize: 9, color: meta.color }}>ACTION</div>
          </div>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", borderTop: i ? "1px solid #202020" : "none" }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${meta.color}18`, border: `1px solid ${meta.color}44`, color: meta.color, fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#dddddd" }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#121212", border: `1px solid ${eventMeta.color}44`, borderLeft: `4px solid ${eventMeta.color}`, borderRadius: 14, padding: "11px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#8a8a8a" }}>今日は何の日？ / NEXT EVENT</div>
              {event ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#eeeeee", marginTop: 5 }}>{shortText(event.title || event.text, 34)}</div>
                  <div style={{ fontSize: 10, color: "#9a9a9a", marginTop: 4 }}>{event.date}{event.time ? ` ${event.time}` : ""} ・ {event.region || "市場"}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 5 }}>直近の重要イベントを確認中</div>
              )}
            </div>
            <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: eventMeta.color, border: `1px solid ${eventMeta.color}66`, background: `${eventMeta.color}12`, borderRadius: 999, padding: "5px 8px" }}>{eventMeta.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefingView({ briefing }) {
  if (!briefing) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6a6a6a", fontSize: 12 }}>
        朝刊データがまだありません。
      </div>
    );
  }

  const mode = MODE_LABELS[briefing.mode] || MODE_LABELS.normal;
  const sign = briefing.nikkei_diff >= 0 ? "+" : "-";
  const todayInfo = getTodayInfo(briefing.is_trading_day);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <WeekendBanner todayInfo={todayInfo} briefingDate={briefing.date} nextTradingDay={briefing.next_trading_day} />
      <div style={{
        background: "#121212", border: `1px solid ${mode.color}44`,
        borderRadius: 10, padding: "10px 14px", marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: mode.color }}>
          {mode.label} <span style={{ color: "#8a8a8a", fontWeight: 400, fontSize: 10 }}>
            {briefing.date}
            {briefing.market_data_refreshed_at && ` ${new Date(briefing.market_data_refreshed_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新`}
          </span>
        </div>
      </div>

      <MarketDashboard briefing={briefing} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>日経平均</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.nikkei?.toLocaleString()}円</div>
          <div style={{ fontSize: 10, color: briefing.nikkei_diff >= 0 ? "#00ff9d" : "#ff5566" }}>
            {sign}{Math.abs(briefing.nikkei_diff)?.toLocaleString()}円 ({briefing.nikkei_pct?.toFixed(2)}%)
          </div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>ドル円</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.usd_jpy}円</div>
          {typeof briefing.usd_jpy_pct === "number" && (
            <div style={{ fontSize: 10, color: briefing.usd_jpy_pct >= 0 ? "#00ff9d" : "#ff5566" }}>
              {briefing.usd_jpy_pct >= 0 ? "+" : ""}{briefing.usd_jpy_pct.toFixed(2)}%
            </div>
          )}
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>SOX指数</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.sox ? briefing.sox.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.sox_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{typeof briefing.sox_pct === "number" ? (briefing.sox_pct >= 0 ? "+" : "") + briefing.sox_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>VIX</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.vix}</div>
          {typeof briefing.vix_pct === "number" && (
            <div style={{ fontSize: 10, color: briefing.vix_pct >= 0 ? "#ff5566" : "#00ff9d" }}>
              {briefing.vix_pct >= 0 ? "+" : ""}{briefing.vix_pct.toFixed(2)}%
            </div>
          )}
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>TOPIX</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.topix ? briefing.topix.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.topix_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.topix_pct ? (briefing.topix_pct >= 0 ? "+" : "") + briefing.topix_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>NASDAQ</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.nasdaq ? briefing.nasdaq.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.nasdaq_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.nasdaq_pct ? briefing.nasdaq_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>S&P500</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.sp500 ? briefing.sp500.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.sp500_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.sp500_pct ? briefing.sp500_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>米10年債利回り</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.us10y ? `${briefing.us10y}%` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.us10y_diff || 0) >= 0 ? "#ff5566" : "#00ff9d" }}>{typeof briefing.us10y_diff === "number" ? (briefing.us10y_diff >= 0 ? "+" : "") + briefing.us10y_diff.toFixed(2) + "pt" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>ビットコイン</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.btc ? `$${briefing.btc.toLocaleString()}` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.btc_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.btc_pct ? (briefing.btc_pct >= 0 ? "+" : "") + briefing.btc_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>ドル指数(DXY)</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.dxy || "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.dxy_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.dxy_pct ? (briefing.dxy_pct >= 0 ? "+" : "") + briefing.dxy_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>金（ゴールド）</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.gold ? `$${briefing.gold.toLocaleString()}` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.gold_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>{briefing.gold_pct ? (briefing.gold_pct >= 0 ? "+" : "") + briefing.gold_pct.toFixed(2) + "%" : "—"}</div>
        </div>
      </div>

      <FearGreedGauge value={briefing.fear_greed_value} label={briefing.fear_greed_label} diff={briefing.fear_greed_diff} />
      {briefing.market_summary && (
        <div style={{ fontSize: 11.5, lineHeight: 1.8, color: "#b8b8b8", marginBottom: 16, padding: "0 2px" }}>
          {briefing.market_summary}
        </div>
      )}

      {briefing.date && (
        <div style={{ marginBottom: 16, background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: 8 }}>
          <img
            src={`/api/chart?d=${encodeURIComponent(briefing.date)}`}
            alt="日経225チャート（ローソク足・MA・MACD）"
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
            onError={(ev) => { ev.target.style.display = "none"; }}
          />
        </div>
      )}

      <WeeklyContentCard icon="📅" label="今週の振り返り" data={briefing.weekly_review} />
      <WeeklyContentCard icon="🔭" label="来週の注目ポイント" data={briefing.weekly_preview} />

      {(briefing.surges?.length > 0 || briefing.drops?.length > 0) && (
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>本日の急騰・急落</div>
          {briefing.surges?.map((s, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize: 11, color: "#00ff9d", marginBottom: 4 }}>
              <span>▲ {s.name || s.code}<span style={{color:"#8a8a8a", fontSize:10}}> ({s.code})</span></span>
              <span>+{s.pct}%</span>
            </div>
          ))}
          {briefing.drops?.map((s, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize: 11, color: "#ff5566", marginBottom: 4 }}>
              <span>▼ {s.name || s.code}<span style={{color:"#8a8a8a", fontSize:10}}> ({s.code})</span></span>
              <span>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {briefing.consideration?.main && (
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 6 }}>かぶぼっちの考察</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "#b8b8b8" }}>{briefing.consideration.main}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <a href="https://note.com/kabubocchi" target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 90, textAlign: "center", padding: "9px", background: "#121212", border: "1px solid #262626", borderRadius: 10, color: "#e8e8e8", fontSize: 11, textDecoration: "none" }}>note</a>
        <a href="https://x.com/kabubocchi" target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 90, textAlign: "center", padding: "9px", background: "#121212", border: "1px solid #262626", borderRadius: 10, color: "#e8e8e8", fontSize: 11, textDecoration: "none" }}>X</a>
      </div>

      <div style={{ fontSize: 9, color: "#6a6a6a", textAlign: "center", marginTop: 18 }}>
        KabuBocchi | ※投資勧誘ではありません
      </div>
    </div>
  );
}

function heatColor(pct) {
  // -3%以下は濃い赤、+3%以上は濃い緑、0%付近はグレー寄りにグラデーション
  const clamped = Math.max(-3, Math.min(3, pct));
  if (clamped >= 0) {
    const t = clamped / 3;
    const bg = `rgba(0,255,157,${0.08 + t * 0.35})`;
    const border = `rgba(0,255,157,${0.25 + t * 0.5})`;
    return { bg, border, text: t > 0.4 ? "#00ff9d" : "#b8b8b8" };
  }
  const t = -clamped / 3;
  const bg = `rgba(255,85,102,${0.08 + t * 0.35})`;
  const border = `rgba(255,85,102,${0.25 + t * 0.5})`;
  return { bg, border, text: t > 0.4 ? "#ff5566" : "#b8b8b8" };
}

function MiniSparkline({ series }) {
  if (!series || series.length < 2) return null;
  const W = 90, H = 24, PAD = 2;
  const maxAbs = Math.max(1, ...series.map(s => Math.abs(s.pct)));
  const stepX = (W - PAD * 2) / (series.length - 1);
  const zeroY = H / 2;
  const scale = (H / 2 - PAD) / maxAbs;
  const yOf = (pct) => zeroY - pct * scale;

  const points = series.map((s, i) => [PAD + i * stepX, yOf(s.pct)]);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${zeroY} L${points[0][0].toFixed(1)},${zeroY} Z`;

  const trendUp = series[series.length - 1].pct >= series[0].pct;
  const lineColor = trendUp ? "#00ff9d" : "#ff5566";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 76, height: 20, display: "block", marginTop: 4 }}>
      <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />
      <path d={areaPath} fill={lineColor} opacity="0.12" stroke="none" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SectorDailyChart({ series }) {
  if (!series || series.length < 2) {
    return <div style={{ fontSize: 10, color: "#6a6a6a", marginBottom: 10 }}>日足データがまだ十分にありません（複数日分たまると表示されます）。</div>;
  }
  const W = 320, H = 90, PAD_L = 6, PAD_R = 6, PAD_T = 10, PAD_B = 16;
  const maxAbs = Math.max(1, ...series.map(s => Math.abs(s.pct)));
  const stepX = series.length > 1 ? (W - PAD_L - PAD_R) / (series.length - 1) : 0;
  const zeroY = PAD_T + (H - PAD_T - PAD_B) / 2;
  const scale = ((H - PAD_T - PAD_B) / 2) / maxAbs;
  const yOf = (pct) => zeroY - pct * scale;

  const points = series.map((s, i) => [PAD_L + i * stepX, yOf(s.pct)]);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${zeroY} L${points[0][0].toFixed(1)},${zeroY} Z`;
  const trendUp = series[series.length - 1].pct >= series[0].pct;
  const lineColor = trendUp ? "#00ff9d" : "#ff5566";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 4 }}>📈 セクター日足（平均騰落率）</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={PAD_L} x2={W - PAD_R} y1={zeroY} y2={zeroY} stroke="#333" strokeWidth="1" />
        <path d={areaPath} fill={lineColor} opacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2" fill={lineColor} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#5a5a5a", marginTop: 2 }}>
        <span>{series[0].date}</span>
        <span>{series[series.length - 1].date}</span>
      </div>
    </div>
  );
}

function SectorHeatmap({ heatmap, allChanges, currency, history, heatmapKey, refreshedAt, stale }) {
  const [openSector, setOpenSector] = useState(null);
  if (!heatmap || heatmap.length === 0) return null;

  const stocksInSector = (sector) => {
    return (allChanges || [])
      .filter(c => c.sector === sector)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 10);
  };

  const sectorDailySeries = (sector) => {
    return [...(history || [])]
      .filter(h => h.fileDate && Array.isArray(h[heatmapKey]))
      .sort((a, b) => a.fileDate.localeCompare(b.fileDate))
      .map(h => {
        const found = h[heatmapKey].find(s => s.sector === sector);
        const pct = found ? finiteNumber(found.avg_pct) : null;
        return pct !== null ? { date: h.fileDate.slice(5), pct } : null;
      })
      .filter(Boolean);
  };

  return (
    <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>セクター別ヒートマップ（前日比・タップで日足チャート＋銘柄一覧）</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
        {heatmap.map((h, i) => {
          const avgPct = finiteNumber(h.avg_pct);
          const c = heatColor(avgPct ?? 0);
          const isOpen = openSector === h.sector;
          return (
            <button
              key={i}
              onClick={() => setOpenSector(isOpen ? null : h.sector)}
              style={{
                background: c.bg, border: `1px solid ${isOpen ? c.text : c.border}`, borderRadius: 8, padding: "8px 10px",
                textAlign: "left", fontFamily: "inherit", color: "inherit", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 10, color: "#e8e8e8", fontWeight: 600, marginBottom: 3 }}>{h.sector}</div>
              <div style={{ fontSize: 14, color: c.text, fontWeight: 700 }}>
                {formatSignedPct(avgPct)}
              </div>
              <div style={{ fontSize: 9, color: "#8a8a8a", marginTop: 2 }}>
                {h.up}銘柄↑ / {h.down}銘柄↓ ({h.count}銘柄)
              </div>
              {h.top_mover && (
                <div style={{ fontSize: 9, color: "#6a6a6a", marginTop: 2 }}>
                  最大: {h.top_mover.name} {formatSignedPct(h.top_mover.pct)}
                </div>
              )}
              <MiniSparkline series={sectorDailySeries(h.sector)} />
            </button>
          );
        })}
      </div>

      {openSector && (() => {
        const list = stocksInSector(openSector);
        const series = sectorDailySeries(openSector);
        return (
          <div style={{ marginTop: 10, background: "#0d0d0d", border: "1px solid #262626", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8" }}>{openSector} 上位銘柄</div>
              <button onClick={() => setOpenSector(null)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#8a8a8a", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
            </div>
            <SectorDailyChart series={series} />
            {list.length === 0 ? (
              <div style={{ fontSize: 10, color: "#6a6a6a" }}>この日はこのセクターの銘柄データがありません。</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {list.map((s, i) => {
                  const up = s.pct >= 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", background: "#121212", borderRadius: 6, border: `1px solid ${up ? "#00ff9d" : "#ff5566"}22` }}>
                      <div style={{ fontSize: 9, color: "#6a6a6a", width: 16 }}>{i + 1}</div>
                      <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>{s.name}<span style={{ color: "#6a6a6a", fontSize: 9 }}> ({s.code})</span></div>
                      <div style={{ fontSize: 9, color: "#6a6a6a" }}>{currency === "$" ? `$${s.price}` : `${s.price?.toLocaleString()}円`}</div>
                      <div style={{ fontSize: 11, color: up ? "#00ff9d" : "#ff5566", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
                        {up ? "+" : ""}{s.pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 8 }}>
        ※監視銘柄を業種で分類し、各セクターの平均騰落率を表示（個別銘柄の分散にご注意）
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
        {stale && <span style={{ color: "#ff9955" }}>（取得失敗のため前回値を表示中）</span>}
      </div>
    </div>
  );
}

function TopMovers({ movers, currency }) {
  if (!movers || movers.length === 0) return null;
  return (
    <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>値動き上位10銘柄</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {movers.map((m, i) => {
          const up = m.pct >= 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", background: "#0d0d0d", borderRadius: 6, border: `1px solid ${up ? "#00ff9d" : "#ff5566"}22` }}>
              <div style={{ fontSize: 9, color: "#6a6a6a", width: 16 }}>{i + 1}</div>
              <div style={{ fontSize: 10, color: "#8a8a8a", width: 48 }}>{m.sector}</div>
              <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>{m.name}</div>
              <div style={{ fontSize: 9, color: "#6a6a6a" }}>{currency === "$" ? `$${m.price}` : `${m.price?.toLocaleString()}円`}</div>
              <div style={{ fontSize: 11, color: up ? "#00ff9d" : "#ff5566", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
                {up ? "+" : ""}{m.pct}%
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 8 }}>※監視銘柄内での前日比の値動き（絶対値）が大きい順</div>
    </div>
  );
}

function daysUntilLabel(d) {
  if (d === null || d === undefined) return "";
  if (d === 0) return "本日";
  if (d === 1) return "明日";
  if (d < 0) return `${Math.abs(d)}日前`;
  return `${d}日後`;
}

function daysUntilFromDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

function earningsScore(pct) {
  // サプライズ%は理論上±数千%まで振れうる（特に予想が赤字→黒字転換等で符号が変わると
  // 計算上意味のない極端な値になる）ので、tanhで0-100に滑らかに収める
  if (typeof pct !== "number") return null;
  return Math.round(50 + 50 * Math.tanh(pct / 50));
}

function EarningsScoreBadge({ pct }) {
  const score = earningsScore(pct);
  if (score === null) return null;
  const extreme = Math.abs(pct) > 300;
  const color = score >= 60 ? "#00ff9d" : score <= 40 ? "#ff5566" : "#ffd166";
  return (
    <div style={{ textAlign: "right", minWidth: 48 }}>
      <div style={{ fontSize: 13, color, fontWeight: 700 }}>{score}</div>
      <div style={{ fontSize: 8, color: "#6a6a6a" }}>{extreme ? "予想転換※" : "決算スコア"}</div>
    </div>
  );
}

function EarningsCalendarRow({ e, market, onJump }) {
  const daysUntil = daysUntilFromDate(e.next_earnings_date);
  const soon = daysUntil !== null && daysUntil <= 3;
  return (
    <button
      onClick={() => onJump(market === "日本" ? "jp" : "us", e.code)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", width: "100%",
        background: soon ? "#1a1408" : "#121212", borderRadius: 6, textAlign: "left", fontFamily: "inherit", color: "inherit",
        border: `1px solid ${soon ? "#ffd16644" : "#262626"}`, marginBottom: 5, cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 9, color: "#6a6a6a", width: 40 }}>{market}</div>
      <div style={{ fontSize: 10, color: "#9a9a9a", width: 72 }}>{e.next_earnings_date}</div>
      <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>
        {e.name}<span style={{ color: "#6a6a6a", fontSize: 9 }}> ({e.code})</span>
        {soon && <span style={{ color: "#ffd166", fontSize: 9, marginLeft: 6 }}>{daysUntilLabel(daysUntil)}</span>}
      </div>
      <EarningsScoreBadge pct={e.last_surprise_pct} />
    </button>
  );
}

function EarningsView({ briefing, onJump }) {
  const jpCal = briefing?.jp_earnings_calendar || [];
  const usCal = briefing?.us_earnings_calendar || [];

  const calendar = [
    ...jpCal.map(e => ({ ...e, market: "日本" })),
    ...usCal.map(e => ({ ...e, market: "米国" })),
  ].sort((a, b) => (a.next_earnings_date || "").localeCompare(b.next_earnings_date || ""));

  const hasAny = calendar.length > 0;
  const hasExtreme = calendar.some(e => typeof e.last_surprise_pct === "number" && Math.abs(e.last_surprise_pct) > 300);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>決算</div>

      {!hasAny && (
        <div style={{ color: "#6a6a6a", fontSize: 11, marginBottom: 14 }}>
          決算データはまだありません。「Refresh Earnings Data Only」ワークフローの実行後に表示されます。
        </div>
      )}

      {calendar.length > 0 && (
        <div style={{ background: "#0d0d0d", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>決算カレンダー（日付順・タップで銘柄詳細へ）</div>
          {calendar.map((e, i) => <EarningsCalendarRow key={i} e={e} market={e.market} onJump={onJump} />)}
        </div>
      )}

      <div style={{ fontSize: 9, color: "#5a5a5a" }}>
        ※決算スコアは前回決算のサプライズ%（EPS実績が市場予想をどれだけ上回った/下回ったか）を0〜100に換算した参考値です。
        {hasExtreme && " 「予想転換※」は、予想が赤字→黒字（またはその逆）に転換したことでサプライズ%の計算が数学的に極端な値になっているケースです。スコア自体は参考程度に。"}
        {" "}銘柄名をタップすると日本株/米国株タブの詳細に移動します（その日の注目銘柄に選ばれていない場合は一覧のみの表示になります）。
      </div>
    </div>
  );
}

function ScreenerRow({ t, currency }) {
  const color = t.ai_score >= 60 ? "#00ff9d" : t.ai_score <= 40 ? "#ff5566" : "#ffd166";
  const up = t.change_pct >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#0d0d0d", borderRadius: 6, border: `1px solid ${color}33`, marginBottom: 5 }}>
      <div style={{ fontSize: 9, color: "#6a6a6a", width: 44 }}>{t.sector}</div>
      <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>{t.name}<span style={{ color: "#6a6a6a", fontSize: 9 }}> ({t.code})</span></div>
      <div style={{ fontSize: 9, color: up ? "#00ff9d" : "#ff5566" }}>{up ? "+" : ""}{t.change_pct}%</div>
      <div style={{ fontSize: 13, color, fontWeight: 700, minWidth: 26, textAlign: "right" }}>{t.ai_score}</div>
    </div>
  );
}

function HighConvictionPanel({ screener, currency, refreshedAt }) {
  const hc = screener?.high_conviction || [];
  return (
    <div style={{ background: "#151008", border: "1px solid #ffd16655", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#ffd166", marginBottom: 8 }}>🎯 高確度候補（AIスコア90以上のみ）</div>
      {hc.length === 0 ? (
        <div style={{ fontSize: 11, color: "#8a8a8a", lineHeight: 1.6 }}>
          本日は90点以上の高確度候補はありません。複数の強気シグナル（売られすぎ・バンド下限・出来高急増・トレンド）がほぼ同時に揃う日は稀なので、これは正常な状態です。
        </div>
      ) : (
        hc.map((t, i) => <ScreenerRow key={i} t={t} currency={currency} />)
      )}
      <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 8 }}>
        ※MA25乖離・RSI売られすぎ・BB下限・出来高急増がほぼ全て重なった、極めて限定的な高確度シグナルのみを表示します。投資助言ではありません。
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
      </div>
    </div>
  );
}

function ScreenerPanel({ screener, currency, refreshedAt }) {
  const top = screener?.top || [];
  if (top.length === 0) {
    return (
      <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "12px 14px", marginBottom: 14, color: "#6a6a6a", fontSize: 11 }}>
        スクリーナーデータはまだありません。「Refresh Screener Only」ワークフローの実行後に表示されます。
      </div>
    );
  }
  return (
    <>
      <HighConvictionPanel screener={screener} currency={currency} refreshedAt={refreshedAt} />
      <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>テクニカルスクリーナー（AIスコア上位・参考値）</div>
        {top.map((t, i) => <ScreenerRow key={i} t={t} currency={currency} />)}
        <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 8 }}>
          ※RSI・MA25乖離・BB位置・出来高だけから機械的に算出したスコアです（Claudeの主観判断は含みません）。投資助言ではなく一次スクリーニングの参考情報です。
          {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
        </div>
      </div>
    </>
  );
}

function JpStocksView({ briefing, history, highlightCode }) {
  const stocks = briefing?.stocks_jp || [];
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <SectorHeatmap heatmap={briefing?.sector_heatmap} allChanges={briefing?.jp_all_changes} currency="¥" history={history} heatmapKey="sector_heatmap" refreshedAt={briefing?.jp_sector_heatmap_refreshed_at} stale={briefing?.jp_sector_heatmap_stale} />
      <TopMovers movers={briefing?.jp_top_movers} currency="¥" />
      <ScreenerPanel screener={briefing?.jp_screener} currency="¥" refreshedAt={briefing?.screener_refreshed_at} />
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>日本株 注目銘柄</div>
      {stocks.length > 0 ? (
        stocks.map((s, i) => <StockCard key={i} s={s} highlighted={highlightCode === String(s.code)} />)
      ) : (
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>本日分の銘柄情報はまだありません。</div>
      )}
    </div>
  );
}

function UsStocksView({ briefing, history, highlightCode }) {
  const s = briefing?.stock_us;
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <SectorHeatmap heatmap={briefing?.us_sector_heatmap} allChanges={briefing?.us_all_changes} currency="$" history={history} heatmapKey="us_sector_heatmap" refreshedAt={briefing?.us_sector_heatmap_refreshed_at} stale={briefing?.us_sector_heatmap_stale} />
      <TopMovers movers={briefing?.us_top_movers} currency="$" />
      <ScreenerPanel screener={briefing?.us_screener} currency="$" refreshedAt={briefing?.screener_refreshed_at} />
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>米国株 注目銘柄</div>
      {s ? (
        <StockCard s={{ ...s, code: s.ticker }} highlighted={highlightCode === String(s.ticker)} />
      ) : (
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>本日分の銘柄情報はまだありません。</div>
      )}

    </div>
  );
}

function groupByMonth(events) {
  const groups = {};
  (events || []).forEach(e => {
    const month = (e.date || "").slice(0, 7) || "未定";
    if (!groups[month]) groups[month] = [];
    groups[month].push(e);
  });
  return groups;
}

const IMPORTANCE_META = {
  high:   { label: "最重要", color: "#ff5566", dot: "#ff5566", order: 0 },
  medium: { label: "重要",   color: "#ffd166", dot: "#ffd166", order: 1 },
  low:    { label: "参考",   color: "#8a8a8a", dot: "#4a4a4a", order: 2 },
};
const IMPORTANCE_KEYWORDS = ["日銀", "FOMC", "雇用統計", "CPI", "GDP", "決算", "金融政策"];

function getImportance(e) {
  if (e.importance === "high" || e.importance === "medium" || e.importance === "low") {
    return e.importance;
  }
  if (e.urgent) return "high";
  if (IMPORTANCE_KEYWORDS.some(k => (e.text || "").includes(k))) return "medium";
  return "low";
}

function CalendarSection({ title, events }) {
  const groups = groupByMonth(events);
  const months = Object.keys(groups).sort();
  if (months.length === 0) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>{title}</div>
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>イベント情報はまだありません。</div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>{title}</div>
      {months.map(month => {
        const sorted = [...groups[month]].sort((a, b) => {
          const ia = IMPORTANCE_META[getImportance(a)].order;
          const ib = IMPORTANCE_META[getImportance(b)].order;
          if (ia !== ib) return ia - ib;
          return (a.date || "").localeCompare(b.date || "");
        });
        return (
          <div key={month} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 6 }}>{month}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sorted.map((e, i) => {
                const imp = IMPORTANCE_META[getImportance(e)];
                return (
                  <div key={i} style={{
                    background: "#121212", border: `1px solid ${imp.color}33`, borderLeft: `3px solid ${imp.color}`,
                    borderRadius: 8, padding: "8px 10px", display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <div style={{ fontSize: 10, color: "#9a9a9a", minWidth: 70 }}>{e.date}</div>
                    <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>{e.text}</div>
                    <div style={{ fontSize: 9, color: imp.color, whiteSpace: "nowrap" }}>{imp.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MODE_COLORS = {
  normal: "#888888", surge: "#00ff9d", crash: "#ff5566", ai: "#a78bfa"
};

function DayDetailView({ briefing, onClose }) {
  const mode = MODE_LABELS[briefing.mode] || MODE_LABELS.normal;
  return (
    <div style={{ background: "#0d0d0d", border: `1px solid ${mode.color}44`, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8" }}>{briefing.date} の朝刊</div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#8a8a8a", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>閉じる</button>
      </div>
      <div style={{ padding: "4px 4px 4px" }}>
        <BriefingView briefing={briefing} />
      </div>
      {briefing.stocks_jp?.length > 0 && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", margin: "4px 0 8px" }}>この日の注目銘柄</div>
          {briefing.stocks_jp.map((s, i) => <StockCard key={i} s={s} />)}
        </div>
      )}
    </div>
  );
}

function normalizeSeries(history, field) {
  const pts = [...history]
    .filter(h => h.fileDate && h[field])
    .sort((a, b) => a.fileDate.localeCompare(b.fileDate));
  if (pts.length === 0) return [];
  const base = pts[0][field];
  return pts.map(p => ({ fileDate: p.fileDate, date: p.date, value: (p[field] / base) * 100 }));
}

function IndexCompareChart({ history }) {
  const W = 320, H = 160, PAD_L = 30, PAD_R = 8, PAD_T = 10, PAD_B = 18;

  const series = [
    { key: "nikkei", label: "日経225", color: "#e8e8e8", data: normalizeSeries(history, "nikkei") },
    { key: "nasdaq", label: "NASDAQ", color: "#00ff9d", data: normalizeSeries(history, "nasdaq") },
    { key: "sp500", label: "S&P500", color: "#ffd166", data: normalizeSeries(history, "sp500") },
    { key: "sox", label: "SOX", color: "#ff5566", data: normalizeSeries(history, "sox") },
  ];

  const allDates = [...new Set(history.filter(h => h.fileDate).map(h => h.fileDate))].sort();

  if (allDates.length < 2 || series.every(s => s.data.length < 2)) {
    return (
      <div style={{ marginBottom: 16, background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>年間チャート：日経225 / NASDAQ / S&P500 / SOX</div>
        <div style={{ fontSize: 10, color: "#6a6a6a" }}>データ蓄積中です。数日分たまるとチャートが表示されます。</div>
      </div>
    );
  }

  const xOf = (fileDate) => {
    const i = allDates.indexOf(fileDate);
    return PAD_L + (i / (allDates.length - 1)) * (W - PAD_L - PAD_R);
  };

  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const minV = Math.min(100, ...allValues);
  const maxV = Math.max(100, ...allValues);
  const spread = Math.max(1, maxV - minV);
  const yOf = (v) => PAD_T + (1 - (v - minV) / spread) * (H - PAD_T - PAD_B);

  const buildPath = (data) => data.map((d, i) => `${i === 0 ? "M" : "L"}${xOf(d.fileDate).toFixed(1)},${yOf(d.value).toFixed(1)}`).join(" ");
  const gridYs = [minV, (minV + maxV) / 2, maxV];

  return (
    <div style={{ marginBottom: 16, background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8" }}>年間チャート：日経225 / NASDAQ / S&P500 / SOX</div>
        <div style={{ display: "flex", gap: 10 }}>
          {series.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ fontSize: 9, color: "#8a8a8a" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {gridYs.map((gv, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yOf(gv)} y2={yOf(gv)} stroke="#262626" strokeWidth="1" />
            <text x={2} y={yOf(gv) + 3} fontSize="7" fill="#6a6a6a">{gv.toFixed(0)}</text>
          </g>
        ))}
        {series.map(s => s.data.length > 1 && (
          <path key={s.key} d={buildPath(s.data)} fill="none" stroke={s.color} strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6a6a6a", marginTop: 4 }}>
        <span>{allDates[0]}</span>
        <span>{allDates[allDates.length - 1]}</span>
      </div>
      <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 6 }}>
        ※各指数ともデータ収集開始日を100として指数化した相対パフォーマンス比較です（実際の指数値ではありません）。日々の朝刊配信でデータが蓄積されるほど表示期間が伸びます。
      </div>
    </div>
  );
}

function HistoryView({ history }) {
  const [selectedDate, setSelectedDate] = useState("");
  const [dayData, setDayData] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState("");

  const loadDay = (fileDate) => {
    if (!fileDate) return;
    setSelectedDate(fileDate);
    setDayLoading(true);
    setDayError("");
    setDayData(null);
    fetch(`/api/history?date=${fileDate}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setDayError(d.error || "取得に失敗しました");
        else setDayData(d.data);
      })
      .catch(() => setDayError("通信エラーが発生しました"))
      .finally(() => setDayLoading(false));
  };

  if (!history || history.length === 0) {
    return <div style={{ padding: 20, color: "#6a6a6a", fontSize: 12 }}>履歴データがまだありません。明日以降蓄積されます。</div>;
  }

  const fileDates = history.map(h => h.fileDate).filter(Boolean).sort();

  // 銘柄出現頻度ランキング
  const stockCount = {};
  history.forEach(h => {
    (h.stocks_jp || []).forEach(s => {
      const key = `${s.name}（${s.code}）`;
      stockCount[key] = (stockCount[key] || 0) + 1;
    });
  });
  const topStocks = Object.entries(stockCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // モード統計
  const modeStat = {};
  history.forEach(h => { modeStat[h.mode] = (modeStat[h.mode] || 0) + 1; });

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>

      {/* 日付ピッカー */}
      <div style={{ marginBottom: 16, background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>過去の朝刊を呼び出す</div>
        <input
          type="date"
          value={selectedDate}
          min={fileDates[0]}
          max={fileDates[fileDates.length - 1]}
          onChange={(e) => loadDay(e.target.value)}
          style={{ background: "#0d0d0d", color: "#eeeeee", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", fontSize: 12, colorScheme: "dark" }}
        />
        <div style={{ fontSize: 9, color: "#6a6a6a", marginTop: 6 }}>
          保存期間: {fileDates[0]} 〜 {fileDates[fileDates.length - 1]}
        </div>
        {dayLoading && <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 8 }}>読み込み中...</div>}
        {dayError && <div style={{ fontSize: 11, color: "#ff5566", marginTop: 8 }}>{dayError}</div>}
      </div>

      {dayData && <DayDetailView briefing={dayData} onClose={() => { setDayData(null); setSelectedDate(""); }} />}

      <IndexCompareChart history={history} />

      {/* 相場モード統計 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>直近の相場モード統計</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(modeStat).map(([mode, count]) => (
            <div key={mode} style={{ background: "#121212", border: `1px solid ${MODE_COLORS[mode] || "#262626"}44`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: MODE_COLORS[mode] || "#e8e8e8" }}>{mode}</div>
              <div style={{ fontSize: 16, color: "#eeeeee", fontWeight: 700 }}>{count}日</div>
            </div>
          ))}
        </div>
      </div>

      {/* 日経平均推移 */}
      <div style={{ marginBottom: 16, background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>日経平均 直近推移</div>
        {[...history].reverse().map((h, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 10, color: "#8a8a8a" }}>{h.date}</div>
            <div style={{ fontSize: 11, color: "#eeeeee" }}>{h.nikkei?.toLocaleString()}円</div>
            <div style={{ fontSize: 10, color: (h.nikkei_pct || 0) >= 0 ? "#00ff9d" : "#ff5566" }}>
              {h.nikkei_pct >= 0 ? "+" : ""}{h.nikkei_pct?.toFixed(2)}%
            </div>
            <div style={{ fontSize: 9, color: MODE_COLORS[h.mode] || "#888" }}>{h.mode}</div>
          </div>
        ))}
      </div>

      {/* 注目銘柄ランキング */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>注目銘柄 出現ランキング</div>
        {topStocks.length === 0 ? (
          <div style={{ color: "#6a6a6a", fontSize: 11 }}>データ蓄積中...</div>
        ) : (
          topStocks.map(([name, count], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#e8e8e8" }}>{i+1}. {name}</div>
              <div style={{ fontSize: 11, color: "#ffd166" }}>{count}回</div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

const MONTHLY_FLOW = [
  { m: 1,  label: "1月",  level: "medium", desc: "大発会・米雇用統計・FOMC" },
  { m: 2,  label: "2月",  level: "high",   desc: "日本Q3決算ラッシュ" },
  { m: 3,  label: "3月",  level: "high",   desc: "日銀会合・米メジャーSQ・期末" },
  { m: 4,  label: "4月",  level: "medium", desc: "新年度入り・日銀会合" },
  { m: 5,  label: "5月",  level: "high",   desc: "日本本決算発表ラッシュ・FOMC" },
  { m: 6,  label: "6月",  level: "medium", desc: "株主総会シーズン・米メジャーSQ" },
  { m: 7,  label: "7月",  level: "medium", desc: "日銀会合・日本Q1決算発表開始" },
  { m: 8,  label: "8月",  level: "medium", desc: "日本Q1決算本格化・米国は薄商い" },
  { m: 9,  label: "9月",  level: "high",   desc: "日銀会合・米メジャーSQ・中間配当権利落ち" },
  { m: 10, label: "10月", level: "medium", desc: "米国Q3決算発表開始" },
  { m: 11, label: "11月", level: "high",   desc: "日本中間決算ラッシュ・米決算本格化" },
  { m: 12, label: "12月", level: "high",   desc: "米メジャーSQ・FOMC・掉尾の一振" },
];

function YearlyFlowView({ eventsJp, eventsUs }) {
  const currentMonth = new Date().getMonth() + 1;
  const nextMonth = (currentMonth % 12) + 1;
  const [openMonth, setOpenMonth] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const merged = [
    ...(eventsJp || []).map(e => ({ ...e, source: "日本" })),
    ...(eventsUs || []).map(e => ({ ...e, source: "米国" })),
  ];

  const eventsForMonth = (m) => {
    const mm = String(m).padStart(2, "0");
    return merged
      .filter(e => (e.date || "").slice(5, 7) === mm)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  };

  const visibleMonths = showAll
    ? MONTHLY_FLOW
    : MONTHLY_FLOW.filter(mo => mo.m === currentMonth || mo.m === nextMonth);

  return (
    <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8" }}>
          {showAll ? "年間の値動きが起こりやすい月（参考・タップで日程を表示）" : "直近の値動きが起こりやすい月（参考・タップで日程を表示）"}
        </div>
        <button
          onClick={() => { setShowAll(!showAll); setOpenMonth(null); }}
          style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#8a8a8a", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          {showAll ? "直近だけに戻す" : "年間スケジュールを見る"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: showAll ? "repeat(3,1fr)" : "repeat(2,1fr)", gap: 6 }}>
        {visibleMonths.map(mo => {
          const imp = IMPORTANCE_META[mo.level];
          const isNow = mo.m === currentMonth;
          const isOpen = openMonth === mo.m;
          return (
            <button
              key={mo.m}
              onClick={() => setOpenMonth(isOpen ? null : mo.m)}
              style={{
                background: isOpen ? `${imp.color}28` : isNow ? `${imp.color}18` : "#0d0d0d",
                border: `1px solid ${isOpen ? imp.color : isNow ? imp.color : "#262626"}`,
                borderRadius: 8, padding: "7px 8px", textAlign: "left",
                fontFamily: "inherit", color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: "#e8e8e8", fontWeight: isNow ? 700 : 500 }}>{mo.label}</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: imp.dot, display: "inline-block" }} />
              </div>
              <div style={{ fontSize: 9, color: "#8a8a8a", lineHeight: 1.4 }}>{mo.desc}</div>
            </button>
          );
        })}
      </div>

      {openMonth && (() => {
        const dayEvents = eventsForMonth(openMonth);
        const mo = MONTHLY_FLOW.find(x => x.m === openMonth);
        return (
          <div style={{ marginTop: 10, background: "#0d0d0d", border: "1px solid #262626", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8" }}>{mo.label}の予定日</div>
              <button onClick={() => setOpenMonth(null)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#8a8a8a", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
            </div>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 10, color: "#6a6a6a", lineHeight: 1.6 }}>
                この月の具体的な日程データはまだありません。朝刊配信が近づくと下の「日本」「米国」欄に個別の日付が追加されます。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dayEvents.map((e, i) => {
                  const imp = IMPORTANCE_META[getImportance(e)];
                  return (
                    <div key={i} style={{ background: "#121212", border: `1px solid ${imp.color}33`, borderLeft: `3px solid ${imp.color}`, borderRadius: 6, padding: "6px 8px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 9, color: "#9a9a9a", minWidth: 62 }}>{e.date}</div>
                      <div style={{ fontSize: 10, color: "#6a6a6a", minWidth: 26 }}>{e.source}</div>
                      <div style={{ fontSize: 10, color: "#eeeeee", flex: 1 }}>{e.text}</div>
                      <div style={{ fontSize: 9, color: imp.color, whiteSpace: "nowrap" }}>{imp.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: "#5a5a5a", marginTop: 8 }}>
        ※日本・米国の決算シーズンや金融政策イベントなど、例年起こりやすい傾向を示す一般的な参考情報です。特定の値動きを保証するものではありません。
      </div>
    </div>
  );
}

function CalendarView({ briefing }) {
  if (!briefing) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6a6a6a", fontSize: 12 }}>
        カレンダーデータがまだありません。
      </div>
    );
  }
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 14 }}>月次イベントカレンダー</div>
      <YearlyFlowView eventsJp={briefing.events_jp} eventsUs={briefing.events_us} />
      <CalendarSection title="日本" events={briefing.events_jp} />
      <CalendarSection title="米国" events={briefing.events_us} />
    </div>
  );
}

export default function SwingStation() {
  const [tab, setTab] = useState("briefing");
  const [highlightTarget, setHighlightTarget] = useState(null); // { market: 'jp'|'us', code: string }

  const jumpToStock = (market, code) => {
    setTab(market);
    setHighlightTarget({ market, code: String(code) });
  };

  useEffect(() => {
    if (!highlightTarget) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`stock-${highlightTarget.code}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [highlightTarget, tab]);
  const [briefing, setBriefing] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = () => {
    setIsRefreshing(true);
    fetch("/api/latest?t=" + Date.now())
      .then(r => r.json())
      .then(d => {
        setBriefing(d);
        setLastUpdated(new Date());
      })
      .catch(e => console.error("fetch error:", e))
      .finally(() => setIsRefreshing(false));
  };

  const loadHistory = () => {
    fetch("/api/history?t=" + Date.now())
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  // 5分ごとに自動で最新データを再取得
  useEffect(() => {
    const id = setInterval(() => {
      loadData();
      loadHistory();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const [history, setHistory] = useState([]);
  const [historyTab, setHistoryTab] = useState("calendar");

  useEffect(() => { loadHistory(); }, []);
  const todayInfo = getTodayInfo(briefing?.is_trading_day);

  const B = ({ style, ...p }) => <button style={{ fontFamily: "inherit", cursor: "pointer", border: "none", ...style }} {...p} />;

  const TABS = [
    { id: "briefing", label: "朝刊" },
    { id: "jp", label: "日本株" },
    { id: "us", label: "米国株" },
    { id: "earnings", label: "決算" },
    { id: "calendar", label: "予定" },
    { id: "history", label: "履歴" },
  ];

  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })} ${lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
    : "--:--";

  return (
    <>
      <Head>
        <title>KabuBocchi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"#0a0a0a", fontFamily:"'JetBrains Mono','Courier New',monospace", color:"#d0d0d0" }}>
        <style>{`
          @keyframes ssP{0%,100%{opacity:1}50%{opacity:.2}}
          @keyframes ssSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          *{box-sizing:border-box}
          html,body{height:100%;margin:0;padding:0}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#e8e8e825;border-radius:2px}
          button{cursor:pointer}
        `}</style>

        {/* Header */}
        <div style={{ background:"#080808", borderBottom:"1px solid #262626", padding:"8px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <img src="/logo.png" alt="かぶぼっち" style={{ width:30, height:30, borderRadius:"50%" }} />
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:900, color:"#e8e8e8", letterSpacing:2 }}>
            KabuBocchi
          </div>
          <div style={{ fontSize:8, color:"#6a6a6a", marginLeft:2 }}>数日〜1週間の押し目スイング特化</div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <button
              onClick={() => { loadData(); loadHistory(); }}
              disabled={isRefreshing}
              title={`最終更新日: ${lastUpdatedLabel}（5分ごとに自動更新）`}
              style={{
                display:"flex", alignItems:"center", gap:5, background:"#121212", border:"1px solid #262626",
                borderRadius:8, padding:"3px 9px", fontFamily:"inherit", cursor: isRefreshing ? "default" : "pointer",
              }}
            >
              <span style={{
                display:"inline-block", width:9, height:9, fontSize:9, lineHeight:"9px", color:"#8a8a8a",
                animation: isRefreshing ? "ssSpin 0.7s linear infinite" : "none",
              }}>⟳</span>
              <span style={{ fontSize:9, color:"#8a8a8a" }}>{isRefreshing ? "更新中" : `最終更新日: ${lastUpdatedLabel}`}</span>
            </button>
            <div style={{
              padding:"2px 8px", borderRadius:8, fontSize:9,
              background: todayInfo.isMarketOpen ? "#0a2a0a" : "#161616",
              border: `1px solid ${todayInfo.isMarketOpen ? "#00ff9d33" : "#5a5a5a"}`,
              color: todayInfo.isMarketOpen ? "#00ff9d" : "#8a8a8a",
            }}>
              {todayInfo.isMarketOpen ? "東証OPEN" : todayInfo.isUSMarket ? "NY OPEN" : `${todayInfo.day}曜`}
            </div>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#e8e8e8", animation:"ssP 2s infinite" }}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#080808", borderBottom:"1px solid #1f1f1f", flexShrink:0 }}>
          {TABS.map(t => (
            <B key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:"8px", fontSize:11,
              background: tab===t.id ? "#121212" : "transparent",
              borderBottom: tab===t.id ? "2px solid #e8e8e8" : "2px solid transparent",
              color: tab===t.id ? "#e8e8e8" : "#5a5a5a",
            }}>{t.label}</B>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
          <div style={{ display:tab==="briefing"?"block":"none", height:"100%" }}>
            <BriefingView briefing={briefing} />
          </div>
          <div style={{ display:tab==="jp"?"block":"none", height:"100%" }}>
            <JpStocksView briefing={briefing} history={history} highlightCode={highlightTarget?.market === "jp" ? highlightTarget.code : null} />
          </div>
          <div style={{ display:tab==="us"?"block":"none", height:"100%" }}>
            <UsStocksView briefing={briefing} history={history} highlightCode={highlightTarget?.market === "us" ? highlightTarget.code : null} />
          </div>
          <div style={{ display:tab==="earnings"?"block":"none", height:"100%" }}>
            <EarningsView briefing={briefing} onJump={jumpToStock} />
          </div>
          <div style={{ display:tab==="calendar"?"block":"none", height:"100%" }}>
            <CalendarView briefing={briefing} />
          </div>
          <div style={{ display:tab==="history"?"block":"none", height:"100%" }}>
            <HistoryView history={history} />
          </div>
        </div>
      </div>
    </>
  );
}


