import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";

const QUICK = [
  { label: "🗓️ 今週の戦略", text: "今週のスイングトレード戦略を教えて。日米の週足トレンドと最適エントリー曜日も。" },
  { label: "🇯🇵 日本株候補", text: "今週スイングに最適な日本株を3銘柄、週足→60分の分析で教えて。" },
  { label: "🇺🇸 米国株候補", text: "今週スイングに最適な米国株を3銘柄、週足→60分の分析で教えて。" },
  { label: "📉 押し目銘柄", text: "週足上昇トレンドで日足が押し目になってる日本株を教えて。60分エントリーゾーンも。" },
  { label: "🔄 底値反転", text: "底値から反転上昇中のスイング向き銘柄を日米で教えて。" },
  { label: "📅 今日のエントリー", text: "今日エントリーするなら何曜日的にどの銘柄が狙い目？スイング視点で。" },
  { label: "📊 相場環境", text: "今の日米相場環境をスイング視点で分析して。リスクオン/オフの判断も。" },
  { label: "💹 決算銘柄", text: "今週決算発表予定の注目銘柄を教えて。スイングで狙えるか判断も。" },
];

const TV_SYMBOLS = [
  { label: "日経平均", tv: "TVC:NI225" },
  { label: "S&P500", tv: "SP:SPX" },
  { label: "トヨタ", tv: "TYO:7203", code: "7203" },
  { label: "SBG", tv: "TYO:9984", code: "9984" },
  { label: "NVDA", tv: "NASDAQ:NVDA" },
  { label: "AAPL", tv: "NASDAQ:AAPL" },
  { label: "ドル円", tv: "FX:USDJPY" },
];

const TV_INTERVALS = [
  { label: "日足", val: "D" },
  { label: "60分", val: "60" },
  { label: "30分", val: "30" },
  { label: "週足", val: "W" },
];

function getTodayInfo() {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const now = new Date();
  const day = days[now.getDay()];
  const hour = now.getHours();
  const isMarketOpen = now.getDay() >= 1 && now.getDay() <= 5 && hour >= 9 && hour < 16;
  const isUSMarket = now.getDay() >= 1 && now.getDay() <= 5 && (hour >= 23 || hour < 6);
  return { day, isMarketOpen, isUSMarket };
}

function renderContent(text) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
    const html = line
      .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#ffe08a'>$1</strong>")
      .replace(/`(.*?)`/g, "<code style='background:#1a1a3a;color:#7c83ff;padding:1px 4px;border-radius:3px;font-size:11px'>$1</code>");
    return <div key={i} style={{ lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

const Dots = () => (
  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: "50%", background: "#7c83ff",
        animation: `ssB 1.2s ${i*.2}s infinite`,
      }} />
    ))}
  </span>
);

export default function SwingStation() {
  const [tab, setTab] = useState("chat");
  const [tvSymbol, setTvSymbol] = useState("TVC:NI225");
  const [tvInterval, setTvInterval] = useState("D");
  const [customCode, setCustomCode] = useState("");
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "📈 スイングステーション起動！\n\n数日〜1週間の月〜金スイングに特化した分析ツールです。\n\n【分析手法】\n週足でトレンド確認\n→ 日足で押し目・サポート確認\n→ 60分足でエントリーゾーン絞り込み\n→ 30分足で具体的エントリーポイント\n\n銘柄コードを入力するか、下のボタンをタップ🎯",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayInfo] = useState(getTodayInfo());
  const [chartReady, setChartReady] = useState(false);
  const tvRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (tab !== "chart" || !tvRef.current) return;
    const key = `${tvSymbol}_${tvInterval}`;
    if (tvRef.current.dataset.key === key) return;
    tvRef.current.dataset.key = key;
    tvRef.current.innerHTML = "";
    setChartReady(false);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
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
  }, [tab, tvSymbol, tvInterval]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const changeSymbol = useCallback((tv, code) => {
    setTvSymbol(tv);
    setTab("chart");
    if (code) setCustomCode(code);
  }, []);

  const send = async (text) => {
    const t = (text || input).trim();
    if (!t || loading) return;
    setInput("");

    const codeMatch = t.match(/\b(\d{4})\b/);
    if (codeMatch) setTvSymbol(`TYO:${codeMatch[1]}`);

    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setLoading(true);
    setTab("chat");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const data = await res.json();
      setMsgs(p => [...p, { role: "assistant", content: data.text || "（応答取得失敗）" }]);

    } catch (e) {
      setMsgs(p => [...p, { role: "assistant", content: `⚠️ エラー: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const B = ({ style, ...p }) => <button style={{ fontFamily: "inherit", cursor: "pointer", border: "none", ...style }} {...p} />;

  return (
    <>
      <Head>
        <title>スイングステーション</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"#08090e", fontFamily:"'JetBrains Mono','Courier New',monospace", color:"#c0c8dc" }}>
        <style>{`
          @keyframes ssB{0%,80%,100%{opacity:.15}40%{opacity:1}}
          @keyframes ssG{0%,100%{text-shadow:0 0 14px #7c83ff80}50%{text-shadow:0 0 5px #7c83ff30}}
          @keyframes ssP{0%,100%{opacity:1}50%{opacity:.2}}
          @keyframes ssSpin{to{transform:rotate(360deg)}}
          @keyframes ssFU{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          *{box-sizing:border-box}
          html,body{height:100%;margin:0;padding:0}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#7c83ff25;border-radius:2px}
          button{cursor:pointer}
        `}</style>

        {/* Header */}
        <div style={{ background:"#060710", borderBottom:"1px solid #1a1d2e", padding:"8px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:900, color:"#7c83ff", animation:"ssG 3s infinite", letterSpacing:2 }}>
            📈 SWING STATION
          </div>
          <div style={{ fontSize:8, color:"#3a3a6a", marginLeft:2 }}>月〜金 数日〜1週間特化</div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              padding:"2px 8px", borderRadius:8, fontSize:9,
              background: todayInfo.isMarketOpen ? "#0a2a0a" : "#1a1a2a",
              border: `1px solid ${todayInfo.isMarketOpen ? "#00ff9d33" : "#3a3a5a"}`,
              color: todayInfo.isMarketOpen ? "#00ff9d" : "#5a5a8a",
            }}>
              {todayInfo.isMarketOpen ? "🟢 東証OPEN" : todayInfo.isUSMarket ? "🟡 NY OPEN" : `⚫ ${todayInfo.day}曜`}
            </div>
            {loading && <span style={{ width:9, height:9, border:"1.5px solid #7c83ff30", borderTop:"1.5px solid #7c83ff", borderRadius:"50%", display:"inline-block", animation:"ssSpin .8s linear infinite" }}/>}
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#7c83ff", animation:"ssP 2s infinite" }}/>
          </div>
        </div>

        {/* Symbol bar */}
        <div style={{ display:"flex", gap:5, padding:"5px 10px", overflowX:"auto", background:"#070810", borderBottom:"1px solid #141620", flexShrink:0, alignItems:"center" }}>
          {TV_SYMBOLS.map((s, i) => (
            <B key={i} onClick={() => changeSymbol(s.tv, s.code)} style={{
              whiteSpace:"nowrap", padding:"4px 10px",
              background: tvSymbol===s.tv ? "#1a1a3a" : "#0e0f20",
              border:`1px solid ${tvSymbol===s.tv ? "#7c83ff44" : "#1a1d2e"}`,
              borderRadius:14, color: tvSymbol===s.tv ? "#7c83ff" : "#4a5070",
              fontSize:10, flexShrink:0,
            }}>{s.label}</B>
          ))}
          <input
            value={customCode}
            onChange={e => setCustomCode(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e => {
              if (e.key==="Enter" && customCode.length===4) {
                changeSymbol(`TYO:${customCode}`, customCode);
              }
            }}
            placeholder="コード"
            maxLength={4}
            style={{ width:60, padding:"4px 8px", background:"#0e0f20", border:"1px solid #1a1d2e", borderRadius:14, color:"#7a8aaa", fontSize:10, outline:"none", fontFamily:"inherit" }}
            onFocus={e => e.target.style.borderColor="#7c83ff44"}
            onBlur={e => e.target.style.borderColor="#1a1d2e"}
          />
        </div>

        {/* Interval bar */}
        <div style={{ display:"flex", gap:5, padding:"4px 10px", background:"#060710", borderBottom:"1px solid #141620", flexShrink:0, alignItems:"center" }}>
          {TV_INTERVALS.map(iv => (
            <B key={iv.val} onClick={() => { setTvInterval(iv.val); setTab("chart"); }} style={{
              padding:"3px 11px",
              background: tvInterval===iv.val ? "#1a1a3a" : "transparent",
              border:`1px solid ${tvInterval===iv.val ? "#7c83ff44" : "#1a1d2e"}`,
              borderRadius:10, color: tvInterval===iv.val ? "#7c83ff" : "#3a4060",
              fontSize:10,
            }}>{iv.label}</B>
          ))}
          <div style={{ marginLeft:"auto", fontSize:8, color:"#2a2a5a" }}>RSI・MACD・BB</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#060710", borderBottom:"1px solid #141620", flexShrink:0 }}>
          {[{id:"chart",label:"📊 チャート"},{id:"chat",label:"💬 AI分析"}].map(t => (
            <B key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:"8px", fontSize:11,
              background: tab===t.id ? "#0c0e1e" : "transparent",
              borderBottom: tab===t.id ? "2px solid #7c83ff" : "2px solid transparent",
              color: tab===t.id ? "#7c83ff" : "#3a4060",
            }}>{t.label}</B>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>

          {/* Chart */}
          <div style={{ display:tab==="chart"?"block":"none", height:"100%", padding:4 }}>
            {!chartReady && tab==="chart" && (
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"#3a3a6a", fontSize:11, zIndex:1 }}>
                チャート読み込み中...
              </div>
            )}
            <div ref={tvRef} style={{ height:"100%", borderRadius:8, overflow:"hidden" }}/>
          </div>

          {/* Chat */}
          <div style={{ display:tab==="chat"?"flex":"none", flexDirection:"column", height:"100%" }}>

            {/* Quick buttons */}
            <div style={{ display:"flex", gap:5, padding:"5px 10px", overflowX:"auto", background:"#070810", borderBottom:"1px solid #141620", flexShrink:0 }}>
              {QUICK.map((q,i) => (
                <B key={i} onClick={() => send(q.text)} disabled={loading} style={{
                  whiteSpace:"nowrap", padding:"4px 10px",
                  background:"#0e0f20", border:"1px solid #1a1d2e",
                  borderRadius:14, color:"#4a5080", fontSize:10,
                  opacity:loading ? .4 : 1, flexShrink:0,
                }}>{q.label}</B>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"10px 10px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgs.map((m,i) => (
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", animation:"ssFU .2s ease-out" }}>
                  {m.role==="assistant" && (
                    <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, background:"linear-gradient(135deg,#7c83ff18,#4a50ff18)", border:"1px solid #7c83ff28", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, marginRight:6, marginTop:2 }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth:"82%", padding:"8px 12px", fontSize:12, lineHeight:1.7,
                    borderRadius:m.role==="user"?"14px 14px 4px 14px":"4px 14px 14px 14px",
                    background:m.role==="user"?"linear-gradient(135deg,#1a1a3a,#0e0e28)":"#0c0e1e",
                    border:`1px solid ${m.role==="user"?"#7c83ff28":"#1a1d2e"}`,
                    color:m.role==="user"?"#9a9fff":"#a0aac0",
                  }}>
                    {m.role==="assistant" ? renderContent(m.content) : m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display:"flex", alignItems:"flex-start", animation:"ssFU .2s ease-out" }}>
                  <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, background:"linear-gradient(135deg,#7c83ff18,#4a50ff18)", border:"1px solid #7c83ff28", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, marginRight:6 }}>🤖</div>
                  <div style={{ padding:"8px 12px", borderRadius:"4px 14px 14px 14px", background:"#0c0e1e", border:"1px solid #1a1d2e", minWidth:60 }}>
                    <Dots/>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:"8px 10px 14px", background:"#060710", borderTop:"1px solid #141620", display:"flex", gap:7, alignItems:"center", flexShrink:0 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"){ e.preventDefault(); send(); } }}
                placeholder="銘柄コード（7203など）や質問…"
                style={{ flex:1, padding:"11px 14px", background:"#0c0e1e", border:"1px solid #1a1d2e", borderRadius:22, color:"#a0aac0", fontSize:12, outline:"none", fontFamily:"inherit" }}
                onFocus={e => e.target.style.borderColor="#7c83ff44"}
                onBlur={e => e.target.style.borderColor="#1a1d2e"}
              />
              <B onClick={() => send()} disabled={loading||!input.trim()} style={{
                width:44, height:44, borderRadius:"50%", flexShrink:0,
                background:(loading||!input.trim())?"#0c0e1e":"linear-gradient(135deg,#5c63df,#3a40af)",
                border:`2px solid ${(loading||!input.trim())?"#1a1d2e":"#7c83ff55"}`,
                color:(loading||!input.trim())?"#2a2a4a":"#fff",
                fontSize:18,
              }}>↑</B>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
