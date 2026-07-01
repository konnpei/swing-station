import { useState } from "react";
import Head from "next/head";
import fs from "fs";
import path from "path";

const MODE_LABELS = {
  normal: { label: "通常モード", color: "#888888" },
  surge: { label: "爆騰モード", color: "#00ff9d" },
  crash: { label: "暴落モード", color: "#ff5566" },
  ai: { label: "AIバブルモード", color: "#cccccc" },
};

function getTodayInfo() {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const now = new Date();
  const day = days[now.getDay()];
  const hour = now.getHours();
  const isMarketOpen = now.getDay() >= 1 && now.getDay() <= 5 && hour >= 9 && hour < 16;
  const isUSMarket = now.getDay() >= 1 && now.getDay() <= 5 && (hour >= 23 || hour < 6);
  return { day, isMarketOpen, isUSMarket };
}

function StockCard({ s }) {
  return (
    <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 9, color: "#e8e8e8", background: "#e8e8e818", padding: "2px 7px", borderRadius: 8 }}>{s.pattern}</span>
          <div style={{ fontSize: 14, color: "#eeeeee", marginTop: 5, fontWeight: 500 }}>{s.name}<span style={{ color: "#8a8a8a", fontSize: 11 }}> ({s.code})</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>総合スコア</div>
          <div style={{ fontSize: 15, color: "#ffd166", fontWeight: 500 }}>{s.score}<span style={{ fontSize: 10, color: "#8a8a8a" }}>/10</span></div>
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

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{
        background: "#121212", border: `1px solid ${mode.color}44`,
        borderRadius: 10, padding: "10px 14px", marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: mode.color }}>
          {mode.label} <span style={{ color: "#8a8a8a", fontWeight: 400, fontSize: 10 }}>{briefing.date}</span>
        </div>
      </div>

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
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>SOX指数</div>
          <div style={{ fontSize: 15, color: briefing.sox_pct >= 0 ? "#00ff9d" : "#ff5566", marginTop: 2 }}>{briefing.sox_pct?.toFixed(1)}%</div>
        </div>
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#8a8a8a" }}>VIX</div>
          <div style={{ fontSize: 15, color: "#eeeeee", marginTop: 2 }}>{briefing.vix}</div>
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
      </div>

      {briefing.market_summary && (
        <div style={{ fontSize: 11.5, lineHeight: 1.8, color: "#b8b8b8", marginBottom: 16, padding: "0 2px" }}>
          {briefing.market_summary}
        </div>
      )}

      {(briefing.surges?.length > 0 || briefing.drops?.length > 0) && (
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>本日の急騰・急落</div>
          {briefing.surges?.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "#00ff9d", marginBottom: 2 }}>
              ▲ {s.code}  +{s.pct}%
            </div>
          ))}
          {briefing.drops?.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "#ff5566", marginBottom: 2 }}>
              ▼ {s.code}  {s.pct}%
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

      {briefing.note_body && (
        <div style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8e8", marginBottom: 6 }}>note本文（コピペ用）</div>
          <div style={{ fontSize: 10, color: "#b8b8b8", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{briefing.note_body.slice(0, 500)}...</div>
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

function JpStocksView({ briefing }) {
  const stocks = briefing?.stocks_jp || [];
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>日本株 注目銘柄</div>
      {stocks.length > 0 ? (
        stocks.map((s, i) => <StockCard key={i} s={s} />)
      ) : (
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>本日分の銘柄情報はまだありません。</div>
      )}
    </div>
  );
}

function UsStocksView({ briefing }) {
  const s = briefing?.stock_us;
  const xPosts = briefing?.x_posts || [];
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>米国株 注目銘柄</div>
      {s ? (
        <StockCard s={{ ...s, code: s.ticker }} />
      ) : (
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>本日分の銘柄情報はまだありません。</div>
      )}
      {xPosts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>X投稿文</div>
          {xPosts.map((x, i) => (
            <div key={i} style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 4 }}>投稿{i+1}</div>
              <div style={{ fontSize: 11, color: "#e8e8e8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{x}</div>
            </div>
          ))}
        </div>
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
      {months.map(month => (
        <div key={month} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 6 }}>{month}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups[month].map((e, i) => (
              <div key={i} style={{ background: "#121212", border: "1px solid #262626", borderRadius: 8, padding: "8px 10px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 10, color: "#9a9a9a", minWidth: 70 }}>{e.date}</div>
                <div style={{ fontSize: 11, color: "#eeeeee", flex: 1 }}>{e.text}</div>
                {e.urgent && <div style={{ fontSize: 9, color: "#ff5566" }}>重要</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
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
      <CalendarSection title="日本" events={briefing.events_jp} />
      <CalendarSection title="米国" events={briefing.events_us} />
    </div>
  );
}

export default function SwingStation({ briefing }) {
  const [tab, setTab] = useState("briefing");
  const [todayInfo] = useState(getTodayInfo());

  const B = ({ style, ...p }) => <button style={{ fontFamily: "inherit", cursor: "pointer", border: "none", ...style }} {...p} />;

  const TABS = [
    { id: "briefing", label: "朝刊" },
    { id: "jp", label: "日本株" },
    { id: "us", label: "米国株" },
    { id: "calendar", label: "カレンダー" },
  ];

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
          <div style={{ fontSize:8, color:"#6a6a6a", marginLeft:2 }}>月〜金 数日〜1週間特化</div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
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
            <JpStocksView briefing={briefing} />
          </div>
          <div style={{ display:tab==="us"?"block":"none", height:"100%" }}>
            <UsStocksView briefing={briefing} />
          </div>
          <div style={{ display:tab==="calendar"?"block":"none", height:"100%" }}>
            <CalendarView briefing={briefing} />
          </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  let briefing = null;
  try {
    const filePath = path.join(process.cwd(), "data", "latest.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    briefing = JSON.parse(raw);
    console.log("latest.json loaded:", briefing?.date, Object.keys(briefing || {}));
  } catch (e) {
    console.error("latest.json read error:", e.message);
    briefing = null;
  }
  return {
    props: { briefing: briefing ?? null },
    revalidate: 1,
  };
}
