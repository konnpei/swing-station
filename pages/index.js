import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const SYSTEM_PROMPT = `あなたはスイングトレード（数日〜1週間）専門のAIアナリストです。

銘柄コードや名前が来たら必ずweb_searchで調べてから以下の形式で回答：

🎯 銘柄名（コード）
📊 現在値・週間騰落率
📈 週足トレンド：[上昇/下降/横ばい]
📉 日足状況：[押し目/上昇中/調整中]
⏱️ 60分足エントリーゾーン：
⏱️ 30分足エントリーポイント：
🗓️ 最適エントリー曜日：
🎯 利確目標：+XX%（X〜X日後）
🛑 損切りライン：-XX%
💡 スイング戦略（3点）
⚠️ リスク

スイング（数日〜1週間・月〜金）に特化した口調で。株クラ向けウィット。
投資判断は自己責任。`;

const QUICK = [
  { label: "🗓️ 今週の戦略", text: "今週のスイングトレード戦略を教えて。日米の週足トレンドと最適エントリー曜日も。" },
  { label: "🇯🇵 日本株候補", text: "今週スイングに最適な日本株を3銘柄、週足→60分の分析で教えて。" },
  { label: "🇺🇸 米国株候補", text: "今週スイングに最適な米国株を3銘柄、週足→60分の分析で教えて。" },
  { label: "📉 押し目銘柄", text: "週足上昇トレンドで今日足が押し目になってる日本株を教えて。60分エントリーゾーンも。" },
  { label: "🔄 底値反転", text: "底値から反転上昇中のスイング向き銘柄を日米で教えて。" },
  { label: "📅 今日のエントリー", text: "今日エントリーするなら何曜日的にどの銘柄が狙い目？スイング視点で。" },
];

const TV_SYMBOLS = [
  { label: "日経平均", tv: "INDEX:NKY" },
  { label: "S&P500", tv: "SP:SPX" },
  { label: "トヨタ", tv: "TSE:7203", code: "7203" },
  { label: "SBG", tv: "TSE:9984", code: "9984" },
  { label: "NVDA", tv: "NASDAQ:NVDA" },
  { label: "AAPL", tv: "NASDAQ:AAPL" },
];

const TV_INTERVALS = [
  { label: "日足", val: "D" },
  { label: "60分", val: "60" },
  { label: "30分", val: "30" },
  { label: "週足", val: "W" },
];

function renderContent(text) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
    const html = line.replace(/\*\*(.*?)\*\*/g, "<strong style='color:#ffe08a'>$1</strong>");
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
  const [tvSymbol, setTvSymbol] = useState("INDEX:NKY");
  const [tvInterval, setTvInterval] = useState("D");
  const [customCode, setCustomCode] = useState("");
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "📈 スイングステーション起動！\n\n数日〜1週間の月〜金スイングに特化した分析ツールです。\n\n【分析手法】\n週足でトレンド確認\n→ 日足で押し目・サポート確認\n→ 60分足でエントリーゾーン絞り込み\n→ 30分足で具体的エントリーポイント\n\n銘柄コードを入力するか、下のボタンをタップ🎯",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const tvRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (tab !== "chart" || !tvRef.current) return;
    tvRef.current.innerHTML = "";
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
      studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies", "BB@tv-basicstudies"],
    });
    const container = document.createElement("div");
    container.style.cssText = "height:100%;width:100%;";
    tvRef.current.appendChild(container);
    tvRef.current.appendChild(script);
  }, [tab, tvSymbol, tvInterval]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  const send = async (text) => {
    const t = (text || input).trim();
    if (!t || loading) return;
    setInput("");
    setStreaming("");

    const codeMatch = t.match(/\b(\d{4})\b/);
    if (codeMatch) { setTvSymbol(`TSE:${codeMatch[1]}`); }

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "", buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.text) { full += evt.text; setStreaming(full); }
          } catch {}
        }
      }
      setStreaming("");
      setMsgs(p => [...p, { role: "assistant", content: full || "（応答取得失敗）" }]);
    } catch (e) {
      setStreaming("");
      setMsgs(p => [...p, { role: "assistant", content: `⚠️ エラー: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const B = ({ style, ...p }) => <button style={{ fontFamily: "inherit", cursor: "pointer", ...style }} {...p} />;

  return (
    <>
      <Head>
        <title>スイングステーション</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"#08090e", fontFamily:"'JetBrains Mono','Courier New',monospace", color:"#c0c8dc" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@800;900&display=swap');
          @keyframes ssB{0%,80%,100%{opacity:.15}40%{opacity:1}}
          @keyframes ssG{0%,100%{text-shadow:0 0 14px #7c83ff80}50%{text-shadow:0 0 5px #7c83ff30}}
          @keyframes ssP{0%,100%{opacity:1}50%{opacity:.2}}
          @keyframes ssSpin{to{transform:rotate(360deg)}}
          @keyframes ssFU{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          *{box-sizing:border-box}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#7c83ff25;border-radius:2px}
        `}</style>

        {/* Header */}
        <div style={{ background:"#060710", borderBottom:"1px solid #1a1d2e", padding:"9px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:900, color:"#7c83ff", animation:"ssG 3s infinite", letterSpacing:2 }}>
            📈 SWING STATION
          </div>
          <div style={{ fontSize:8, color:"#3a3a6a", marginLeft:4 }}>月〜金 数日〜1週間特化</div>
          {loading && <span style={{ marginLeft:"auto", width:9, height:9, border:"1.5px solid #7c83ff30", borderTop:"1.5px solid #7c83ff", borderRadius:"50%", display:"inline-block", animation:"ssSpin .8s linear infinite" }}/>}
          <div style={{ marginLeft: loading ? 0 : "auto", width:5, height:5, borderRadius:"50%", background:"#7c83ff", animation:"ssP 2s infinite" }}/>
        </div>

        {/* Symbol bar */}
        <div style={{ display:"flex", gap:5, padding:"6px 12px", overflowX:"auto", background:"#070810", borderBottom:"1px solid #141620", flexShrink:0, alignItems:"center" }}>
          {TV_SYMBOLS.map((s, i) => (
            <B key={i} onClick={() => { setTvSymbol(s.tv); setTab("chart"); }} style={{
              whiteSpace:"nowrap", padding:"4px 10px",
              background: tvSymbol===s.tv ? "#1a1a3a" : "#0e0f20",
              border:`1px solid ${tvSymbol===s.tv ? "#7c83ff44" : "#1a1d2e"}`,
              borderRadius:14, color: tvSymbol===s.tv ? "#7c83ff" : "#4a5070",
              fontSize:10, flexShrink:0,
            }}>{s.label}</B>
          ))}
          <input
            value={customCode} onChange={e => setCustomCode(e.target.value)}
            onKeyDown={e => {
              if (e.key==="Enter") {
                const c = customCode.trim().replace(/\D/g,"").slice(0,4);
                if (c.length===4) { setTvSymbol(`TSE:${c}`); setTab("chart"); }
              }
            }}
            placeholder="コード"
            maxLength={4}
            style={{ width:64, padding:"4px 8px", background:"#0e0f20", border:"1px solid #1a1d2e", borderRadius:14, color:"#7a8aaa", fontSize:10, outline:"none", fontFamily:"inherit" }}
            onFocus={e => e.target.style.borderColor="#7c83ff44"}
            onBlur={e => e.target.style.borderColor="#1a1d2e"}
          />
        </div>

        {/* Interval bar（チャート時のみ） */}
        <div style={{ display:"flex", gap:5, padding:"5px 12px", background:"#060710", borderBottom:"1px solid #141620", flexShrink:0 }}>
          {TV_INTERVALS.map(iv => (
            <B key={iv.val} onClick={() => { setTvInterval(iv.val); setTab("chart"); }} style={{
              padding:"3px 12px",
              background: tvInterval===iv.val ? "#1a1a3a" : "transparent",
              border:`1px solid ${tvInterval===iv.val ? "#7c83ff44" : "#1a1d2e"}`,
              borderRadius:10, color: tvInterval===iv.val ? "#7c83ff" : "#3a4060",
              fontSize:10,
            }}>{iv.label}</B>
          ))}
          <div style={{ marginLeft:"auto", fontSize:9, color:"#3a3a6a", alignSelf:"center" }}>RSI・MACD・BB表示</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#060710", borderBottom:"1px solid #141620", flexShrink:0 }}>
          {[{id:"chart",label:"📊 チャート"},{id:"chat",label:"💬 AI分析"}].map(t => (
            <B key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:"8px", fontSize:11,
              background: tab===t.id ? "#0c0e1e" : "transparent",
              border:"none", borderBottom: tab===t.id ? "2px solid #7c83ff" : "2px solid transparent",
              color: tab===t.id ? "#7c83ff" : "#3a4060",
            }}>{t.label}</B>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden" }}>

          {/* Chart */}
          <div style={{ display:tab==="chart"?"block":"none", height:"100%", padding:4 }}>
            <div ref={tvRef} style={{ height:"100%", borderRadius:8, overflow:"hidden" }}/>
          </div>

          {/* Chat */}
          <div style={{ display:tab==="chat"?"flex":"none", flexDirection:"column", height:"100%" }}>

            {/* Quick */}
            <div style={{ display:"flex", gap:5, padding:"6px 10px", overflowX:"auto", background:"#070810", borderBottom:"1px solid #141620", flexShrink:0 }}>
              {QUICK.map((q,i) => (
                <B key={i} onClick={() => send(q.text)} disabled={loading} style={{
                  whiteSpace:"nowrap", padding:"4px 10px",
                  background:"#0e0f20", border:"1px solid #1a1d2e",
                  borderRadius:14, color:"#4a5080", fontSize:10,
                  opacity:loading?.4:1, flexShrink:0,
                }}>{q.label}</B>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 10px", display:"flex", flexDirection:"column", gap:10 }}>
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
                    {streaming ? renderContent(streaming) : <Dots/>}
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:"8px 10px 16px", background:"#060710", borderTop:"1px solid #141620", display:"flex", gap:7, alignItems:"center", flexShrink:0 }}>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"){e.preventDefault();send();} }}
                placeholder="銘柄コード・質問…（スイング視点で分析）"
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
