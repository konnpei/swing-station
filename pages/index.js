import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import fs from "fs";
import path from "path";

const TV_SYMBOLS_JP = [
  { label: "日経平均", tv: "CURRENCYCOM:JP225" },
  { label: "トヨタ", tv: "TYO:7203", code: "7203" },
  { label: "SBG", tv: "TYO:9984", code: "9984" },
  { label: "ドル円", tv: "FX:USDJPY" },
];

const TV_SYMBOLS_US = [
  { label: "S&P500", tv: "SP:SPX" },
  { label: "NASDAQ", tv: "NASDAQ:IXIC" },
  { label: "NVDA", tv: "NASDAQ:NVDA" },
  { label: "AAPL", tv: "NASDAQ:AAPL" },
];

const TV_INTERVALS = [
  { label: "日足", val: "D" },
  { label: "60分", val: "60" },
  { label: "30分", val: "30" },
  { label: "週足", val: "W" },
];

const MODE_LABELS = {
  normal: { label: "通常モード", color: "#888888", emoji: "" },
  surge: { label: "爆騰モード", color: "#00ff9d", emoji: "" },
  crash: { label: "暴落モード", color: "#ff5566", emoji: "" },
  ai: { label: "AIバブルモード", color: "#cccccc", emoji: "" },
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
      </div>

      {briefing.market_summary && (
        <div style={{ fontSize: 11.5, lineHeight: 1.8, color: "#b8b8b8", marginBottom: 16, padding: "0 2px" }}>
          {briefing.market_summary}
        </div>
      )}

      {briefing.stocks_jp?.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>
            本日の注目銘柄
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {briefing.stocks_jp.map((s, i) => (
              <div key={i} style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 9, color: "#e8e8e8", background: "#e8e8e818", padding: "2px 7px", borderRadius: 8 }}>{s.pattern}</span>
                    <div style={{ fontSize: 13, color: "#eeeeee", marginTop: 4 }}>{s.name}<span style={{ color: "#8a8a8a", fontSize: 10 }}> ({s.code})</span></div>
                  </div>
                  <div style={{ textAlign:"right" }}><div style={{ fontSize: 9, color:"#8a8a8a" }}>総合スコア</div><div style={{ fontSize: 14, color: "#ffd166", fontWeight:500 }}>{s.score}<span style={{fontSize:10,color:"#8a8a8a"}}>/10</span></div></div>
                </div>
                <div style={{ fontSize: 10, color: "#9a9a9a", marginBottom: 4 }}>エントリー: {s.entry}</div>
                <div style={{ fontSize: 10, color: "#9a9a9a", marginBottom: 4, display: "flex", gap: 12 }}>
                  <span>目標 <strong style={{color:"#00ff9d"}}>{s.target}</strong></span>
                  <span>損切 <strong style={{color:"#ff5566"}}>{s.stop}</strong></span>
                </div>
                <div style={{ fontSize: 10, color: "#787878", fontStyle: "italic" }}>{s.comment}</div>
              </div>
            ))}
          </div>
        </>
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
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", marginBottom: 10 }}>今週のイベントカレンダー</div>
      {briefing.events?.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {briefing.events.map((e, i) => (
            <div key={i} style={{ background: "#121212", border: "1px solid #262626", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#8a8a8a", marginBottom: 4 }}>{e.date}</div>
              <div style={{ fontSize: 12, color: "#eeeeee" }}>{e.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#6a6a6a", fontSize: 11 }}>本日分のイベント情報はまだありません。</div>
      )}
    </div>
  );
}

export default function SwingStation({ briefing }) {
  const [tab, setTab] = useState("briefing");
  const [tvSymbolJp, setTvSymbolJp] = useState("CURRENCYCOM:JP225");
  const [tvSymbolUs, setTvSymbolUs] = useState("SP:SPX");
  const [tvInterval, setTvInterval] = useState("D");
  const [customCode, setCustomCode] = useState("");
  const [todayInfo] = useState(getTodayInfo());
  const [chartReady, setChartReady] = useState(false);
  const tvRef = useRef(null);

  const activeSymbol = tab === "jp" ? tvSymbolJp : tab === "us" ? tvSymbolUs : null;

  useEffect(() => {
    if ((tab !== "jp" && tab !== "us") || !tvRef.current) return;
    const key = `${activeSymbol}_${tvInterval}`;
    if (tvRef.current.dataset.key === key) return;
    tvRef.current.dataset.key = key;
    tvRef.current.innerHTML = "";
    setChartReady(false);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: activeSymbol,
      interval: tvInterval,
      timezone: "Asia/Tokyo",
      theme: "dark",
      style: "1",
      locale: "ja",
      allow_symbol_change: true,
      save_image: false,
      studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies", "BB@tv-basicstudies"],
      disabled_features: ["popup_hints"],
    });
    script.onload = () => setChartReady(true);
    tvRef.current.appendChild(script);
    setTimeout(() => setChartReady(true), 3000);
  }, [tab, activeSymbol, tvInterval]);

  const changeSymbolJp = useCallback((tv, code) => {
    setTvSymbolJp(tv);
    if (code) setCustomCode(code);
  }, []);

  const changeSymbolUs = useCallback((tv) => {
    setTvSymbolUs(tv);
  }, []);

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
          @keyframes ssSpin{to{transform:rotate(360deg)}}
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

        {/* Symbol bar (JP) */}
        {tab === "jp" && (
          <div style={{ display:"flex", gap:5, padding:"5px 10px", overflowX:"auto", background:"#0d0d0d", borderBottom:"1px solid #1f1f1f", flexShrink:0, alignItems:"center" }}>
            {TV_SYMBOLS_JP.map((s, i) => (
              <B key={i} onClick={() => changeSymbolJp(s.tv, s.code)} style={{
                whiteSpace:"nowrap", padding:"4px 10px",
                background: tvSymbolJp===s.tv ? "#2a2a2a" : "#161616",
                border:`1px solid ${tvSymbolJp===s.tv ? "#e8e8e855" : "#262626"}`,
                borderRadius:14, color: tvSymbolJp===s.tv ? "#e8e8e8" : "#707070",
                fontSize:10, flexShrink:0,
              }}>{s.label}</B>
            ))}
            <input
              value={customCode}
              onChange={e => setCustomCode(e.target.value.replace(/\D/g,"").slice(0,4))}
              onKeyDown={e => {
                if (e.key==="Enter" && customCode.length===4) {
                  changeSymbolJp(`TYO:${customCode}`, customCode);
                }
              }}
              placeholder="コード"
              maxLength={4}
              style={{ width:60, padding:"4px 8px", background:"#161616", border:"1px solid #262626", borderRadius:14, color:"#9a9a9a", fontSize:10, outline:"none", fontFamily:"inherit" }}
            />
          </div>
        )}

        {/* Symbol bar (US) */}
        {tab === "us" && (
          <div style={{ display:"flex", gap:5, padding:"5px 10px", overflowX:"auto", background:"#0d0d0d", borderBottom:"1px solid #1f1f1f", flexShrink:0, alignItems:"center" }}>
            {TV_SYMBOLS_US.map((s, i) => (
              <B key={i} onClick={() => changeSymbolUs(s.tv)} style={{
                whiteSpace:"nowrap", padding:"4px 10px",
                background: tvSymbolUs===s.tv ? "#2a2a2a" : "#161616",
                border:`1px solid ${tvSymbolUs===s.tv ? "#e8e8e855" : "#262626"}`,
                borderRadius:14, color: tvSymbolUs===s.tv ? "#e8e8e8" : "#707070",
                fontSize:10, flexShrink:0,
              }}>{s.label}</B>
            ))}
          </div>
        )}

        {(tab === "jp" || tab === "us") && (
          <div style={{ display:"flex", gap:5, padding:"4px 10px", background:"#080808", borderBottom:"1px solid #1f1f1f", flexShrink:0, alignItems:"center" }}>
            {TV_INTERVALS.map(iv => (
              <B key={iv.val} onClick={() => setTvInterval(iv.val)} style={{
                padding:"3px 11px",
                background: tvInterval===iv.val ? "#2a2a2a" : "transparent",
                border:`1px solid ${tvInterval===iv.val ? "#e8e8e855" : "#262626"}`,
                borderRadius:10, color: tvInterval===iv.val ? "#e8e8e8" : "#5a5a5a",
                fontSize:10,
              }}>{iv.label}</B>
            ))}
            <div style={{ marginLeft:"auto", fontSize:8, color:"#5a5a5a" }}>RSI・MACD・BB</div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>

          <div style={{ display:tab==="briefing"?"block":"none", height:"100%" }}>
            <BriefingView briefing={briefing} />
          </div>

          <div style={{ display:(tab==="jp"||tab==="us")?"block":"none", height:"100%", padding:4 }}>
            {!chartReady && (tab==="jp"||tab==="us") && (
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"#6a6a6a", fontSize:11, zIndex:1 }}>
                チャート読み込み中...
              </div>
            )}
            <div ref={tvRef} style={{ height:"100%", borderRadius:8, overflow:"hidden" }}/>
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
  } catch (e) {
    briefing = null;
  }
  return {
    props: { briefing },
    revalidate: 600,
  };
}
