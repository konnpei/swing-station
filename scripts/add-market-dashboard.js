const fs = require('fs');

const file = 'pages/index.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('function MarketDashboard({ briefing })')) {
  console.log('MarketDashboard already installed.');
  process.exit(0);
}

const componentAnchor = 'function BriefingView({ briefing }) {';
if (!src.includes(componentAnchor)) {
  throw new Error('Component anchor not found; refusing to patch.');
}

const component = String.raw`
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

function shortText(text, max = 44) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
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
      <div style={{ background: "linear-gradient(145deg,#151515,#0d0d0d)", border: \`1px solid \${meta.color}55\`, boxShadow: \`0 0 28px \${meta.color}16\`, borderRadius: 14, padding: "14px 14px 12px" }}>
        <div style={{ fontSize: 10, color: "#8a8a8a", letterSpacing: 1 }}>TODAY'S MARKET SCORE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
          <div style={{ width: 112, height: 112, position: "relative", flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#252525" strokeWidth="9" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke={meta.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={\`\${dash} \${circumference - dash}\`} />
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
              <div style={{ width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: \`\${meta.color}18\`, border: \`1px solid \${meta.color}44\`, color: meta.color, fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#dddddd" }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#121212", border: \`1px solid \${eventMeta.color}44\`, borderLeft: \`4px solid \${eventMeta.color}\`, borderRadius: 14, padding: "11px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#8a8a8a" }}>今日は何の日？ / NEXT EVENT</div>
              {event ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#eeeeee", marginTop: 5 }}>{shortText(event.title || event.text, 34)}</div>
                  <div style={{ fontSize: 10, color: "#9a9a9a", marginTop: 4 }}>{event.date}{event.time ? \` \${event.time}\` : ""} ・ {event.region || "市場"}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 5 }}>直近の重要イベントを確認中</div>
              )}
            </div>
            <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: eventMeta.color, border: \`1px solid \${eventMeta.color}66\`, background: \`\${eventMeta.color}12\`, borderRadius: 999, padding: "5px 8px" }}>{eventMeta.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

`;

src = src.replace(componentAnchor, component + componentAnchor);

const usageAnchor = `      </div>\n\n      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>`;
if (!src.includes(usageAnchor)) {
  throw new Error('Usage anchor not found; refusing to patch.');
}

src = src.replace(
  usageAnchor,
  `      </div>\n\n      <MarketDashboard briefing={briefing} />\n\n      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>`
);

fs.writeFileSync(file, src);
console.log('MarketDashboard installed successfully.');
