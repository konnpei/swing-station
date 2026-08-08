import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Head from "next/head";
import { track } from "@vercel/analytics";

const MODE_LABELS = {
  normal: { label: "通常モード", color: "#888888" },
  surge: { label: "爆騰モード", color: "#00E0A3" },
  crash: { label: "暴落モード", color: "#ff5566" },
  ai: { label: "AIバブルモード", color: "#cccccc" },
};

const DISCLAIMER_TEXT = "本サイトは一般的な市場情報およびAIによる機械的な分析結果を提供するものであり、特定の金融商品の売買を推奨・勧誘するものではありません。掲載情報の正確性・完全性・将来の成果を保証するものではありません。投資に関する最終判断は、ご自身の責任で行ってください。";

function ComplianceNote() {
  return (
    <div style={{ fontSize: 9, color: "#6B7280", lineHeight: 1.5, marginBottom: 12 }}>
      ※{DISCLAIMER_TEXT}
    </div>
  );
}

function getTodayInfo(isTradingDay) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const now = new Date();
  const dayIdx = now.getDay();
  const day = days[dayIdx];
  const hour = now.getHours();
  const isRealWeekend = dayIdx === 0 || dayIdx === 6;
  const isWeekday = !isRealWeekend;
  // is_trading_day はサーバー側で日本の祝日も加味して判定済み（backend: is_business_day）。
  // ただし朝刊が数日間更新されないままだと生成当時の値が残り続けるため、
  // 実際の曜日(isWeekday)を必ず優先し、平日の祝日判定にのみ isTradingDay を使う。
  const tradingDay = isWeekday && isTradingDay !== false;
  const isMarketOpen = tradingDay && hour >= 9 && hour < 16;
  const isUSMarket = tradingDay && (hour >= 23 || hour < 6);
  const isWeekend = !tradingDay;
  return { day, isMarketOpen, isUSMarket, isWeekend, isRealWeekend };
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
  const headline = todayInfo.isRealWeekend
    ? `東証・NY証券とも休場中（${todayInfo.day}曜日）`
    : `東証休場中（${todayInfo.day}曜日・祝日、NY市場は開いている場合があります）`;
  return (
    <div style={{
      background: "#12141a", border: "1px solid #3a3f52", borderRadius: 10,
      padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>🌙</span>
      <div style={{ fontSize: 11, color: "#b8bcd0" }}>
        {headline} — 表示中のデータは{briefingDate || "直近営業日"}の朝刊です。次回更新は{nextTradingDay || nextMondayLabel()} 6:30
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

function WeeklyContentCard({ icon, label, data, ignoreStaleness }) {
  if (!data || (!ignoreStaleness && daysSince(data.date) > 1)) return null;
  return (
    <div style={{ background: "#13161C", border: "1px solid #3a3f52", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#A1A7B3", marginBottom: 4 }}>{icon} {label} <span style={{ color: "#6B7280" }}>{data.date}</span></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>{data.title}</div>
      <div style={{ fontSize: 11, color: "#c8c8c8", lineHeight: 1.7 }}>{renderMarkdownLite(data.note_body)}</div>
    </div>
  );
}

function LastUpdatedBanner({ briefing }) {
  if (!briefing) return null;
  const iso = briefing.generated_at;
  const gen = iso ? new Date(iso) : (briefing.date ? new Date(briefing.date.replace(/\//g, "-")) : null);
  if (!gen || isNaN(gen.getTime())) return null;
  const label = iso
    ? `${gen.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })} ${gen.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
    : gen.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
  const hoursSince = (Date.now() - gen.getTime()) / (1000 * 60 * 60);
  const isStale = hoursSince >= 24;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 10, flexWrap: "wrap" }}>
      <span style={{ color: isStale ? "#FFB020" : "#00E0A3" }}>{isStale ? "⚠" : "🟢"}</span>
      <span style={{ color: "#A1A7B3" }}>最終更新 {label}</span>
      {isStale && <span style={{ color: "#FFB020" }}>データが古い可能性があります</span>}
    </div>
  );
}

function NextActionsCard({ onNavigate }) {
  if (!onNavigate) return null;
  const items = [
    { label: "🔍 AIスクリーニングを見る", tab: "jp", anchor: "jp-screener-panel", event: "click_ai_screener" },
    { label: "🇯🇵 日本株を見る", tab: "jp", event: "click_jp_stocks" },
    { label: "🇺🇸 米国株を見る", tab: "us", event: "click_us_stocks" },
    { label: "📅 今週の注目を見る", tab: "events", event: "click_weekly_focus" },
    { label: "🗂️ 過去の朝刊を見る", tab: "history", event: "click_history" },
  ];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>次に見る</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => { track(it.event); onNavigate(it.tab, it.anchor); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", background: "#13161C", border: "1px solid #1B1F26",
              borderRadius: 10, color: "#FFFFFF", fontSize: 12, fontFamily: "inherit",
              cursor: "pointer", width: "100%", textAlign: "left",
            }}
          >
            <span>{it.label}</span>
            <span style={{ color: "#6B7280" }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TodayFocusPoints({ briefing }) {
  if (!briefing) return null;
  const points = [];

  const macroEvents = [
    ...(briefing.events_jp || []).map(e => ({ ...e, region: "日本" })),
    ...(briefing.events_us || []).map(e => ({ ...e, region: "米国" })),
  ]
    .filter(e => e.date && getImportance(e) === "high")
    .map(e => ({ ...e, daysUntil: daysUntilFromDate(e.date) }))
    .filter(e => e.daysUntil !== null && e.daysUntil >= 0 && e.daysUntil <= 3)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  macroEvents.slice(0, 2).forEach(e => points.push(`📢 ${e.text}（${daysUntilLabel(e.daysUntil)}）`));

  const earningsUpcoming = [
    ...(briefing.jp_earnings_calendar || []).map(e => ({ ...e, marketLabel: "日本株" })),
    ...(briefing.us_earnings_calendar || []).map(e => ({ ...e, marketLabel: "米国株" })),
  ]
    .map(e => ({ ...e, daysUntil: daysUntilFromDate(e.next_earnings_date) }))
    .filter(e => e.daysUntil !== null && e.daysUntil >= 0 && e.daysUntil <= 3);
  if (earningsUpcoming.length > 0) {
    const names = earningsUpcoming.slice(0, 2).map(e => e.name).join("・");
    const extra = earningsUpcoming.length > 2 ? `など${earningsUpcoming.length}銘柄` : "";
    points.push(`📊 決算注目: ${names}${extra}が3営業日以内に決算`);
  }

  if (typeof briefing.sox_pct === "number" && Math.abs(briefing.sox_pct) >= 3) {
    points.push(`💻 半導体に注目: SOX指数が前日比${briefing.sox_pct >= 0 ? "+" : ""}${briefing.sox_pct.toFixed(1)}%`);
  }

  if (briefing.mode === "crash") points.push("⚠️ 本日は「暴落」モード。値動きに注意");
  else if (briefing.mode === "surge") points.push("🚀 本日は「急騰」モード。過熱感に注意");

  const shown = points.slice(0, 4);

  return (
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>🎯 今日の注目ポイント</div>
      {shown.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shown.map((p, i) => (
            <div key={i} style={{ fontSize: 11, color: "#c8c8c8", lineHeight: 1.6 }}>・{p}</div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#A1A7B3" }}>本日は特筆すべき注目イベントなし。通常運転です。</div>
      )}
    </div>
  );
}

function InfoHubLinks({ code, name, market }) {
  if (!code) return null;
  const isJp = market !== "us";
  const encName = encodeURIComponent(name || "");
  const links = isJp
    ? [
        { label: "📊 株探", url: `https://kabutan.jp/stock/?code=${code}` },
        { label: "📈 TradingView", url: `https://jp.tradingview.com/symbols/TSE-${code}/` },
        { label: "🏢 IR BANK", url: `https://irbank.net/${code}` },
        { label: "📑 TDnet", url: `https://www.google.com/search?q=site:release.tdnet.info+${code}+${encName}` },
        { label: "💬 Yahoo!掲示板", url: `https://m.finance.yahoo.co.jp/stock/bbs?code=${code}.T` },
        { label: "📰 Googleニュース", url: `https://news.google.com/search?q=${encName}%20株価&hl=ja&gl=JP&ceid=JP:ja` },
      ]
    : [
        { label: "📈 TradingView", url: `https://jp.tradingview.com/symbols/${code}/` },
        { label: "💬 Yahoo!掲示板", url: `https://finance.yahoo.co.jp/quote/${code}/forum` },
        { label: "📰 Googleニュース", url: `https://news.google.com/search?q=${encName}%20stock&hl=ja&gl=JP&ceid=JP:ja` },
      ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8, marginBottom: 2 }}>
      {links.map((l, i) => (
        <a
          key={i} href={l.url} target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 9, color: "#A1A7B3", background: "#080D10", border: "1px solid #1B1F26",
            borderRadius: 6, padding: "3px 7px", textDecoration: "none",
          }}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

function StockCard({ s, highlighted, market }) {
  return (
    <div
      id={`stock-${s.code}`}
      style={{
        background: "#13161C", border: `1px solid ${highlighted ? "#FFB020" : "#1B1F26"}`,
        boxShadow: highlighted ? "0 0 0 2px #FFB02055" : "none",
        borderRadius: 10, padding: "12px 14px", marginBottom: 10, scrollMarginTop: 60,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 9, color: "#FFFFFF", background: "#FFFFFF18", padding: "2px 7px", borderRadius: 8 }}>{s.pattern}</span>
          <div style={{ fontSize: 14, color: "#FFFFFF", marginTop: 5, fontWeight: 500 }}>{s.name}<span style={{ color: "#A1A7B3", fontSize: 11 }}> ({s.code})</span></div>
          <InfoHubLinks code={s.code} name={s.name} market={market} />
        </div>
        <div style={{ textAlign: "right" }}>
          {typeof s.ai_score === "number" ? (() => {
            const combined = Math.round((s.score * 10 + s.ai_score) / 2);
            const color = combined >= 60 ? "#00E0A3" : combined <= 40 ? "#ff5566" : "#FFB020";
            return (
              <>
                <div style={{ fontSize: 9, color: "#A1A7B3" }}>統合スコア</div>
                <div style={{ fontSize: 18, color, fontWeight: 700 }}>{combined}<span style={{ fontSize: 10, color: "#A1A7B3" }}>/100</span></div>
                <div style={{ fontSize: 9, color: "#6B7280", marginTop: 3 }}>総合{s.score}/10 ・ AI{s.ai_score}/100</div>
              </>
            );
          })() : (
            <>
              <div style={{ fontSize: 9, color: "#A1A7B3" }}>総合スコア</div>
              <div style={{ fontSize: 15, color: "#FFB020", fontWeight: 500 }}>{s.score}<span style={{ fontSize: 10, color: "#A1A7B3" }}>/10</span></div>
            </>
          )}
        </div>
      </div>

      {s.fundamental && (
        <div style={{ marginBottom: 8, padding: "8px 10px", background: "#080D10", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: "#A1A7B3", marginBottom: 3 }}>ファンダメンタル</div>
          <div style={{ fontSize: 11, color: "#A1A7B3", lineHeight: 1.6 }}>{s.fundamental}</div>
        </div>
      )}

      <div style={{ marginBottom: 8, padding: "8px 10px", background: "#080D10", borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: "#A1A7B3", marginBottom: 3 }}>チャート分析</div>
        <div style={{ fontSize: 11, color: "#A1A7B3", lineHeight: 1.6 }}>{s.reason}</div>
        <div style={{ fontSize: 10, color: "#A1A7B3", marginTop: 6 }}>注目価格帯: {s.entry}</div>
      </div>

      <div style={{ fontSize: 10, color: "#A1A7B3", marginBottom: 6, display: "flex", gap: 14 }}>
        <span>参考上昇幅 <strong style={{ color: "#00E0A3" }}>{s.target}</strong></span>
        <span>参考下落幅 <strong style={{ color: "#ff5566" }}>{s.stop}</strong></span>
      </div>
      <div style={{ fontSize: 10, color: "#787878", fontStyle: "italic" }}>{s.comment}</div>
      {typeof s.ai_score === "number" && (
        <div style={{ fontSize: 9, color: "#6B7280", marginTop: 6 }}>
          ※統合スコアは、Claudeによる主観的な総合スコア（物語性・材料重視）とテクニカル指標のみで
          機械的に算出したAIスコアの平均値です。内訳の乖離が大きい場合は材料とチャートの評価が
          ズレている状態なので参考にしてください。
        </div>
      )}
      <div style={{ fontSize: 8, color: "#4a4a4a", marginTop: 6 }}>
        ※AIが公開データを基に一定条件で抽出した参考情報です。売買を推奨するものではありません。
      </div>
    </div>
  );
}

const FG_LABEL_JP = {
  "extreme fear": "極度の恐怖", "fear": "恐怖", "neutral": "中立", "greed": "強欲", "extreme greed": "極度の強欲",
};

function FearGreedGauge({ value, label, diff }) {
  if (typeof value !== "number") {
    return (
      <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px", marginBottom: 14, textAlign: "center", color: "#6B7280", fontSize: 11 }}>
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
  const diffColor = typeof diff === "number" ? (diff >= 0 ? "#00E0A3" : "#ff5566") : "#A1A7B3";

  return (
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 14px 6px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>Fear &amp; Greed指数</div>
      <svg viewBox="0 0 200 112" style={{ width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5566" />
            <stop offset="25%" stopColor="#FFB020" />
            <stop offset="50%" stopColor="#FFB020" />
            <stop offset="75%" stopColor="#a8e063" />
            <stop offset="100%" stopColor="#00E0A3" />
          </linearGradient>
        </defs>
        <path d={`M 20 ${cy} A ${r} ${r} 0 0 1 180 ${cy}`} fill="none" stroke="url(#fgGrad)" strokeWidth="14" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#FFFFFF" />
        <text x={14} y={cy + 18} fontSize="9" fill="#6B7280">恐怖</text>
        <text x={162} y={cy + 18} fontSize="9" fill="#6B7280">強欲</text>
      </svg>
      <div style={{ textAlign: "center", marginTop: -8, paddingBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>{Math.round(value)}</span>
        <span style={{ fontSize: 12, color: "#A1A7B3", marginLeft: 6 }}>{labelJp}</span>
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
  score = clampScore(score);
  // 暴落/爆騰モードの日は、他指数の相殺でスコアがモードと矛盾したラベル
  // （例:「暴落モード」なのに「選別して攻める」）にならないよう、モード判定を
  // 優先してスコアを強制的にキャップ/引き上げる。
  if (briefing.mode === "crash") return Math.min(score, 44);
  if (briefing.mode === "surge" || briefing.mode === "ai") return Math.max(score, 75);
  return score;
}

function marketScoreMeta(score) {
  if (score >= 75) return { label: "攻めの日", sub: "強気", color: "#00E0A3" };
  if (score >= 60) return { label: "選別して攻める", sub: "やや強気", color: "#8ee8b8" };
  if (score >= 45) return { label: "様子見", sub: "中立", color: "#FFB020" };
  if (score >= 30) return { label: "守る日", sub: "警戒", color: "#FFB020" };
  return { label: "無理をしない", sub: "強い警戒", color: "#ff5566" };
}

function mtfColor(score) {
  if (score < 30) return "#ff5566";
  if (score < 50) return "#FFB020";
  if (score < 70) return "#FFB020";
  return "#00E0A3";
}

function MtfMiniScore({ label, score, sublabel }) {
  if (typeof score !== "number") return null;
  const color = mtfColor(score);
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: "#A1A7B3" }}>{label}</span>
        <span style={{ fontSize: 10 }}>
          <span style={{ color, fontWeight: 700 }}>{score}</span>
          <span style={{ color: "#A1A7B3", marginLeft: 4 }}>{sublabel}</span>
        </span>
      </div>
      <div style={{ width: "100%", height: 6, background: "#13161C", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
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

function MarketDashboard({ briefing, todayInfo }) {
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
      <div style={{ background: "linear-gradient(145deg,#151B20,#0B0F12)", border: `1px solid ${meta.color}55`, boxShadow: `0 0 28px ${meta.color}16`, borderRadius: 20, padding: "14px 14px 12px" }}>
        <div style={{ fontSize: 10, color: "#A1A7B3", letterSpacing: 1 }}>TODAY'S MARKET SCORE</div>
        {todayInfo?.isWeekend && (
          <div style={{ fontSize: 9, color: "#FFB020", marginTop: 3 }}>
            休場中のため{briefing.date || "直近営業日"}時点のスコアです
          </div>
        )}
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
              <span style={{ fontSize: 9, color: (briefing.nikkei_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>日経 {(briefing.nikkei_pct || 0).toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: (briefing.sox_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>SOX {(briefing.sox_pct || 0).toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: "#aaa" }}>VIX {briefing.vix ?? "—"}</span>
            </div>
          </div>
        </div>
        {(typeof briefing.market_score_weekly === "number" || typeof briefing.market_score_monthly === "number") && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1B1F26" }}>
            <MtfMiniScore label="日足" score={score} sublabel={meta.sub} />
            <MtfMiniScore label="週足" score={briefing.market_score_weekly} sublabel={briefing.market_score_weekly_label} />
            <MtfMiniScore label="月足" score={briefing.market_score_monthly} sublabel={briefing.market_score_monthly_label} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "12px 14px" }}>
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

        <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: `1px solid ${eventMeta.color}44`, borderLeft: `4px solid ${eventMeta.color}`, borderRadius: 20, padding: "11px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#A1A7B3" }}>今日は何の日？ / NEXT EVENT</div>
              {event ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", marginTop: 5 }}>{shortText(event.title || event.text, 34)}</div>
                  <div style={{ fontSize: 10, color: "#A1A7B3", marginTop: 4 }}>{event.date}{event.time ? ` ${event.time}` : ""} ・ {event.region || "市場"}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#A1A7B3", marginTop: 5 }}>直近の重要イベントを確認中</div>
              )}
            </div>
            <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: eventMeta.color, border: `1px solid ${eventMeta.color}66`, background: `${eventMeta.color}12`, borderRadius: 999, padding: "5px 8px" }}>{eventMeta.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EarningsStraddleWarning({ briefing, onJump }) {
  if (!onJump) return null;
  const jpCal = briefing?.jp_earnings_calendar || [];
  const usCal = briefing?.us_earnings_calendar || [];
  const upcoming = [
    ...jpCal.map(e => ({ ...e, market: "jp", marketLabel: "日本" })),
    ...usCal.map(e => ({ ...e, market: "us", marketLabel: "米国" })),
  ]
    .map(e => ({ ...e, daysUntil: daysUntilFromDate(e.next_earnings_date) }))
    .filter(e => e.daysUntil !== null && e.daysUntil >= 0 && e.daysUntil <= 3)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcoming.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(155deg, #1c1608, #151008)", border: "1px solid #FFB02040", borderRadius: 18,
      padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFB020", marginBottom: 6 }}>
        ⚠️ 決算またぎ警告（3営業日以内に決算予定の監視銘柄）
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {upcoming.map((e, i) => (
          <button
            key={i}
            onClick={() => onJump(e.market, e.code)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
              background: "rgba(255,255,255,0.03)", border: "1px solid #FFB02030", borderRadius: 12,
              textAlign: "left", fontFamily: "inherit", color: "inherit", cursor: "pointer", width: "100%",
            }}
          >
            <span style={{ fontSize: 9, color: "#A1A7B3", width: 32, flexShrink: 0 }}>{e.marketLabel}</span>
            <span style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>
              {e.name}<span style={{ color: "#6B7280", fontSize: 9 }}> ({e.code})</span>
            </span>
            <span style={{ fontSize: 9, color: "#FFB020", flexShrink: 0 }}>{daysUntilLabel(e.daysUntil)}（{e.next_earnings_date}）</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatVolume(v) {
  if (v === null || v === undefined) return "—";
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
  return v.toLocaleString();
}

function VolumeMiniBars({ history }) {
  if (!history || history.length < 2) return null;
  const W = 90, H = 24, PAD = 1;
  const max = Math.max(1, ...history);
  const barW = (W - PAD * 2) / history.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 76, height: 20, display: "block", marginTop: 4 }}>
      {history.map((v, i) => {
        const h = Math.max(1, (v / max) * (H - 2));
        const isLast = i === history.length - 1;
        return (
          <rect
            key={i}
            x={PAD + i * barW}
            y={H - h}
            width={Math.max(1, barW - 1)}
            height={h}
            fill={isLast ? "#FFB020" : "#ffffff"}
            opacity={isLast ? 1 : 0.25}
          />
        );
      })}
    </svg>
  );
}

function VolumeMonitor({ items, refreshedAt }) {
  if (!items || items.length === 0) return null;
  const judgeColor = (j) => (
    j === "商い活発" ? "#00E0A3" : j === "通常" ? "#FFB020" : j === "薄商い" ? "#FFB020" : "#6B7280"
  );
  return (
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>主要指数 出来高モニター（先物・代替ETF）</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: "#080D10", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#A1A7B3" }}>
              {it.label}<span style={{ color: "#6B7280", fontSize: 8 }}> ({it.symbol})</span>
            </div>
            <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>
              {formatVolume(it.volume)}
              {typeof it.volume === "number" && it.volume >= 10000 && (
                <span style={{ fontSize: 9, color: "#6B7280", marginLeft: 5 }}>({it.volume.toLocaleString()})</span>
              )}
            </div>
            {it.volume !== null && it.volume !== undefined ? (
              <>
                <div style={{ fontSize: 9, color: (it.volume_prev_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>
                  前日比 {typeof it.volume_prev_pct === "number" ? (it.volume_prev_pct >= 0 ? "+" : "") + it.volume_prev_pct + "%" : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#A1A7B3" }}>
                  20日平均比 {typeof it.avg20d_pct === "number" ? `${it.avg20d_pct}%` : "—"}
                </div>
              </>
            ) : null}
            <div style={{ fontSize: 9, color: judgeColor(it.judgement), fontWeight: 700, marginTop: 3 }}>
              {it.judgement}
            </div>
            <VolumeMiniBars history={it.history} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: "#6B7280", marginTop: 8 }}>
        ※指数そのものには出来高がないため、先物または代替ETF/構成銘柄の出来高で代用しています（データ元: Yahoo Finance）。
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
      </div>
    </div>
  );
}

function MacroEventWarning({ briefing, days = 3 }) {
  const all = [
    ...(briefing?.events_jp || []).map(e => ({ ...e, region: "日本" })),
    ...(briefing?.events_us || []).map(e => ({ ...e, region: "米国" })),
  ].filter(e => e.date && getImportance(e) === "high");

  const upcoming = all
    .map(e => ({ ...e, daysUntil: daysUntilFromDate(e.date) }))
    .filter(e => e.daysUntil !== null && e.daysUntil >= 0 && e.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcoming.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(155deg, #1c0e0e, #150a0a)", border: "1px solid #ff556645", borderRadius: 18,
      padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#ff5566", marginBottom: 6 }}>
        📢 マクロイベント注意（3営業日以内・最重要）
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {upcoming.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            background: "rgba(255,255,255,0.03)", border: "1px solid #ff556630", borderRadius: 12,
          }}>
            <span style={{ fontSize: 9, color: "#A1A7B3", width: 32, flexShrink: 0 }}>{e.region}</span>
            <span style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{e.text}</span>
            <span style={{ fontSize: 9, color: "#ff5566", flexShrink: 0 }}>{daysUntilLabel(e.daysUntil)}（{e.date}）</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopHeadlines({ headlines }) {
  if (!headlines || headlines.length === 0) return null;
  return (
    <div style={{
      background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
      padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>📡 経済ニュース速報（Yahoo!ニュース）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {headlines.map((h, i) => {
          const line = (
            <>
              <span style={{ color: "#6B7280" }}>[{h.source}]</span> {h.title}
            </>
          );
          return h.link ? (
            <a key={i} href={h.link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: "#A1A7B3", textDecoration: "none" }}>
              {line}
            </a>
          ) : (
            <div key={i} style={{ fontSize: 10, color: "#A1A7B3" }}>{line}</div>
          );
        })}
      </div>
    </div>
  );
}

function MorningHero({ briefing, todayInfo }) {
  const statusLabel = todayInfo.isMarketOpen ? "東証OPEN" : todayInfo.isUSMarket ? "NY OPEN" : todayInfo.isRealWeekend ? "休場中" : `${todayInfo.day}曜`;
  const statusOn = todayInfo.isMarketOpen || todayInfo.isUSMarket;
  return (
    <div style={{
      position: "relative", overflow: "hidden", minHeight: 168, borderRadius: 28,
      padding: "22px 22px 20px", marginBottom: 14,
      background: "linear-gradient(155deg, #151B20 0%, #101519 55%, #0B0F12 100%)",
      border: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "0 24px 48px -24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      <div style={{
        position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,224,163,0.16) 0%, transparent 70%)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -70, left: -30, width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#00E0A3", letterSpacing: "0.16em", textTransform: "uppercase" }}>Morning Brief</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", marginTop: 8, lineHeight: 1.3, textWrap: "balance" }}>日米マーケット朝刊</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: "#A1A7B3" }}>
            <span>🇯🇵 JAPAN</span><span style={{ color: "#00E0A3" }}>×</span><span>🇺🇸 USA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "#68747C", fontVariantNumeric: "tabular-nums" }}>{briefing.date}</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700,
              padding: "3px 10px", borderRadius: 20,
              background: statusOn ? "#00E0A31c" : "#68747C1c",
              border: `1px solid ${statusOn ? "#00E0A355" : "#68747C40"}`,
              color: statusOn ? "#00E0A3" : "#9AA5AD",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
              {statusLabel}
            </div>
          </div>
        </div>
        <div style={{ position: "relative", flex: "0 0 auto", width: 124, height: 124 }}>
          <div style={{
            position: "absolute", inset: -14, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,224,163,0.28) 0%, transparent 68%)",
            filter: "blur(6px)", pointerEvents: "none",
          }} />
          <SpinningEarth size={124} opacity={0.85} ringPower={0.8} glowPower={0.8} />
        </div>
      </div>
    </div>
  );
}

function MarketPulse({ briefing }) {
  const items = [
    { label: "日経平均", value: briefing.nikkei?.toLocaleString(), pct: briefing.nikkei_pct, icon: "🇯🇵" },
    { label: "SOX", value: briefing.sox?.toLocaleString(), pct: briefing.sox_pct, icon: "💾" },
    { label: "NASDAQ", value: briefing.nasdaq?.toLocaleString(), pct: briefing.nasdaq_pct, icon: "🇺🇸" },
    { label: "VIX", value: briefing.vix, pct: briefing.vix_pct, invert: true, icon: "🌊" },
    { label: "USD/JPY", value: briefing.usd_jpy, pct: briefing.usd_jpy_pct, icon: "💱" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
      {items.map((it, i) => {
        const hasPct = typeof it.pct === "number";
        const positive = it.invert ? it.pct < 0 : it.pct >= 0;
        const color = hasPct ? (positive ? "#00E0A3" : "#FF5A67") : "#68747C";
        return (
          <div key={i} style={{
            flex: "0 0 auto", minWidth: 108, background: "#101519", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 14 }}>{it.icon}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9AA5AD", marginTop: 6, letterSpacing: "0.02em" }}>{it.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F7F8", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{it.value ?? "—"}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {hasPct ? `${it.pct >= 0 ? "+" : ""}${it.pct.toFixed(2)}%` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BriefingView({ briefing, onJump, ignoreStaleness, onNavigate }) {
  if (!briefing) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6B7280", fontSize: 12 }}>
        朝刊データがまだありません。
      </div>
    );
  }

  const mode = MODE_LABELS[briefing.mode] || MODE_LABELS.normal;
  const todayInfo = getTodayInfo(briefing.is_trading_day);
  const [isChartOpen, setIsChartOpen] = useState(false);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <MorningHero briefing={briefing} todayInfo={todayInfo} />
      <MarketPulse briefing={briefing} />
      <TodayFocusPoints briefing={briefing} />
      <LastUpdatedBanner briefing={briefing} />
      <WeekendBanner todayInfo={todayInfo} briefingDate={briefing.date} nextTradingDay={briefing.next_trading_day} />
      <EarningsStraddleWarning briefing={briefing} onJump={onJump} />
      <MacroEventWarning briefing={briefing} />
      <TopHeadlines headlines={briefing.top_news_headlines} />
      <div style={{
        background: `linear-gradient(155deg, ${mode.color}14, #101519)`, border: `1px solid ${mode.color}44`,
        borderRadius: 18, padding: "12px 16px", marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: mode.color }}>
          {mode.label} <span style={{ color: "#A1A7B3", fontWeight: 400, fontSize: 10 }}>
            {briefing.date}
            {briefing.market_data_refreshed_at && ` ${new Date(briefing.market_data_refreshed_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新`}
          </span>
        </div>
      </div>

      <MarketDashboard briefing={briefing} todayInfo={todayInfo} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>TOPIX</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.topix ? briefing.topix.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.topix_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>{briefing.topix_pct ? (briefing.topix_pct >= 0 ? "+" : "") + briefing.topix_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>S&P500</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.sp500 ? briefing.sp500.toLocaleString() : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.sp500_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>{briefing.sp500_pct ? briefing.sp500_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>米10年債利回り</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.us10y ? `${briefing.us10y}%` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.us10y_diff || 0) >= 0 ? "#ff5566" : "#00E0A3" }}>{typeof briefing.us10y_diff === "number" ? (briefing.us10y_diff >= 0 ? "+" : "") + briefing.us10y_diff.toFixed(2) + "pt" : "—"}</div>
        </div>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>ビットコイン</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.btc ? `$${briefing.btc.toLocaleString()}` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.btc_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>{briefing.btc_pct ? (briefing.btc_pct >= 0 ? "+" : "") + briefing.btc_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>ドル指数(DXY)</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.dxy || "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.dxy_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>{briefing.dxy_pct ? (briefing.dxy_pct >= 0 ? "+" : "") + briefing.dxy_pct.toFixed(2) + "%" : "—"}</div>
        </div>
        <div style={{ background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#A1A7B3" }}>金（ゴールド）</div>
          <div style={{ fontSize: 15, color: "#FFFFFF", marginTop: 2 }}>{briefing.gold ? `$${briefing.gold.toLocaleString()}` : "—"}</div>
          <div style={{ fontSize: 10, color: (briefing.gold_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>{briefing.gold_pct ? (briefing.gold_pct >= 0 ? "+" : "") + briefing.gold_pct.toFixed(2) + "%" : "—"}</div>
        </div>
      </div>

      <VolumeMonitor items={briefing.market_volume} refreshedAt={briefing.market_volume_refreshed_at} />

      <FearGreedGauge value={briefing.fear_greed_value} label={briefing.fear_greed_label} diff={briefing.fear_greed_diff} />
      {briefing.market_summary && (
        <div style={{ fontSize: 11.5, lineHeight: 1.8, color: "#A1A7B3", marginBottom: 16, padding: "0 2px" }}>
          {briefing.market_summary}
        </div>
      )}

      {briefing.date && (
        <div style={{ marginBottom: 16, background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 8 }}>
          <img
            src={`/api/chart?d=${encodeURIComponent(briefing.date)}`}
            alt="日経225チャート（ローソク足・MA・MACD）タップで拡大"
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, cursor: "zoom-in" }}
            onError={(ev) => { ev.target.style.display = "none"; }}
            onClick={() => setIsChartOpen(true)}
          />
        </div>
      )}
      {isChartOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setIsChartOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.9)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 16, cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setIsChartOpen(false)}
            style={{
              position: "absolute", top: 14, right: 14, background: "none", border: "1px solid #444",
              borderRadius: 6, color: "#ccc", fontSize: 12, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            閉じる ✕
          </button>
          <img
            src={`/api/chart?d=${encodeURIComponent(briefing.date)}`}
            alt="日経225チャート（ローソク足・MA・MACD）拡大表示"
            style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", borderRadius: 8 }}
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>,
        document.body
      )}

      <WeeklyContentCard icon="📅" label="今週の振り返り" data={briefing.weekly_review} ignoreStaleness={ignoreStaleness} />
      <WeeklyContentCard icon="🔭" label="来週の注目ポイント" data={briefing.weekly_preview} ignoreStaleness={ignoreStaleness} />

      <NextActionsCard onNavigate={onNavigate} />

      {(briefing.surges?.length > 0 || briefing.drops?.length > 0) && (
        <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>本日の急騰・急落</div>
          {briefing.surges?.map((s, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize: 11, color: "#00E0A3", marginBottom: 4 }}>
              <span>▲ {s.name || s.code}<span style={{color:"#A1A7B3", fontSize:10}}> ({s.code})</span></span>
              <span>+{s.pct}%</span>
            </div>
          ))}
          {briefing.drops?.map((s, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize: 11, color: "#ff5566", marginBottom: 4 }}>
              <span>▼ {s.name || s.code}<span style={{color:"#A1A7B3", fontSize:10}}> ({s.code})</span></span>
              <span>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {briefing.consideration?.main && (
        <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>かぶぼっちの考察</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "#A1A7B3" }}>{briefing.consideration.main}</div>
        </div>
      )}

      {briefing.evening_review?.date === briefing.date && (
        <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>🌙 夜のふりかえり</div>
          {briefing.evening_review.reflection && (
            <div style={{ marginBottom: briefing.evening_review.earnings_recap ? 12 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#A1A7B3", marginBottom: 4 }}>反省点</div>
              <div style={{ fontSize: 11, lineHeight: 1.7, color: "#A1A7B3" }}>{briefing.evening_review.reflection}</div>
            </div>
          )}
          {briefing.evening_review.earnings_recap && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#A1A7B3", marginBottom: 4 }}>決算振り返り</div>
              <div style={{ fontSize: 11, lineHeight: 1.7, color: "#A1A7B3" }}>{briefing.evening_review.earnings_recap}</div>
              {briefing.evening_review.earnings_today?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {briefing.evening_review.earnings_today.map((e, i) => (
                    <div key={i} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 6,
                      background: "#080D10", border: "1px solid #1B1F26",
                      color: e.pct >= 0 ? "#00E0A3" : "#ff5566",
                    }}>
                      {e.name} {e.pct >= 0 ? "+" : ""}{e.pct}%
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
    return { bg, border, text: t > 0.4 ? "#00E0A3" : "#A1A7B3" };
  }
  const t = -clamped / 3;
  const bg = `rgba(255,85,102,${0.08 + t * 0.35})`;
  const border = `rgba(255,85,102,${0.25 + t * 0.5})`;
  return { bg, border, text: t > 0.4 ? "#ff5566" : "#A1A7B3" };
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
  const lineColor = trendUp ? "#00E0A3" : "#ff5566";

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
    return <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 10 }}>日足データがまだ十分にありません（複数日分たまると表示されます）。</div>;
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
  const lineColor = trendUp ? "#00E0A3" : "#ff5566";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: "#A1A7B3", marginBottom: 4 }}>📈 セクター日足（平均騰落率）</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={PAD_L} x2={W - PAD_R} y1={zeroY} y2={zeroY} stroke="#333" strokeWidth="1" />
        <path d={areaPath} fill={lineColor} opacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2" fill={lineColor} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#6B7280", marginTop: 2 }}>
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
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>セクター別ヒートマップ（前日比・タップで日足チャート＋銘柄一覧）</div>
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
              <div style={{ fontSize: 10, color: "#FFFFFF", fontWeight: 600, marginBottom: 3 }}>{h.sector}</div>
              <div style={{ fontSize: 14, color: c.text, fontWeight: 700 }}>
                {formatSignedPct(avgPct)}
              </div>
              <div style={{ fontSize: 9, color: "#A1A7B3", marginTop: 2 }}>
                {h.up}銘柄↑ / {h.down}銘柄↓ ({h.count}銘柄)
              </div>
              {h.top_mover && (
                <div style={{ fontSize: 9, color: "#6B7280", marginTop: 2 }}>
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
          <div style={{ marginTop: 10, background: "#080D10", border: "1px solid #1B1F26", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{openSector} 上位銘柄</div>
              <button onClick={() => setOpenSector(null)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#A1A7B3", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
            </div>
            <SectorDailyChart series={series} />
            {list.length === 0 ? (
              <div style={{ fontSize: 10, color: "#6B7280" }}>この日はこのセクターの銘柄データがありません。</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {list.map((s, i) => {
                  const up = s.pct >= 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", background: "#13161C", borderRadius: 6, border: `1px solid ${up ? "#00E0A3" : "#ff5566"}22` }}>
                      <div style={{ fontSize: 9, color: "#6B7280", width: 16 }}>{i + 1}</div>
                      <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{s.name}<span style={{ color: "#6B7280", fontSize: 9 }}> ({s.code})</span></div>
                      <div style={{ fontSize: 9, color: "#6B7280" }}>{currency === "$" ? `$${s.price}` : `${s.price?.toLocaleString()}円`}</div>
                      <div style={{ fontSize: 11, color: up ? "#00E0A3" : "#ff5566", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
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

      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>
        ※監視銘柄を業種で分類し、各セクターの平均騰落率を表示（個別銘柄の分散にご注意）
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
        {stale && <span style={{ color: "#FFB020" }}>（取得失敗のため前回値を表示中）</span>}
      </div>
    </div>
  );
}

function TopMovers({ movers, currency }) {
  if (!movers || movers.length === 0) return null;
  return (
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>値動き上位10銘柄</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {movers.map((m, i) => {
          const up = m.pct >= 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", background: "#080D10", borderRadius: 6, border: `1px solid ${up ? "#00E0A3" : "#ff5566"}22` }}>
              <div style={{ fontSize: 9, color: "#6B7280", width: 16 }}>{i + 1}</div>
              <div style={{ fontSize: 10, color: "#A1A7B3", width: 48 }}>{m.sector}</div>
              <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{m.name}</div>
              <div style={{ fontSize: 9, color: "#6B7280" }}>{currency === "$" ? `$${m.price}` : `${m.price?.toLocaleString()}円`}</div>
              <div style={{ fontSize: 11, color: up ? "#00E0A3" : "#ff5566", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
                {up ? "+" : ""}{m.pct}%
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>※監視銘柄内での前日比の値動き（絶対値）が大きい順</div>
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

function earningsScore(pct, reactionPct) {
  // サプライズ%（実績が市場予想=コンセンサスをどれだけ上回った/下回ったか）は理論上
  // ±数千%まで振れうる（特に予想が赤字→黒字転換等で符号が変わると計算上意味のない
  // 極端な値になる）ので、tanhで0-100に滑らかに収める。株価反応%（決算発表前後の
  // 値動き=上昇幅）は通常一桁%の範囲に収まるため、より感度の高いスケールで正規化する。
  const surpriseScore = typeof pct === "number" ? 50 + 50 * Math.tanh(pct / 50) : null;
  const reactionScore = typeof reactionPct === "number" ? 50 + 50 * Math.tanh(reactionPct / 10) : null;
  if (surpriseScore === null && reactionScore === null) return null;
  if (surpriseScore !== null && reactionScore !== null) {
    return Math.round((surpriseScore + reactionScore) / 2);
  }
  return Math.round(surpriseScore !== null ? surpriseScore : reactionScore);
}

function EarningsScoreBadge({ pct, reactionPct }) {
  const score = earningsScore(pct, reactionPct);
  if (score === null) return null;
  const extreme = typeof pct === "number" && Math.abs(pct) > 300;
  const color = score >= 60 ? "#00E0A3" : score <= 40 ? "#ff5566" : "#FFB020";
  return (
    <div style={{ textAlign: "right", minWidth: 48 }}>
      <div style={{ fontSize: 13, color, fontWeight: 700 }}>{score}</div>
      <div style={{ fontSize: 8, color: "#6B7280" }}>{extreme ? "予想転換※" : "決算スコア"}</div>
      {typeof reactionPct === "number" && (
        <div style={{ fontSize: 7, color: "#6B7280" }}>反応{reactionPct >= 0 ? "+" : ""}{reactionPct}%</div>
      )}
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
        background: soon ? "#1a1408" : "#13161C", borderRadius: 6, textAlign: "left", fontFamily: "inherit", color: "inherit",
        border: `1px solid ${soon ? "#FFB02044" : "#1B1F26"}`, marginBottom: 5, cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 9, color: "#6B7280", width: 40 }}>{market}</div>
      <div style={{ fontSize: 10, color: "#A1A7B3", width: 72 }}>{e.next_earnings_date}</div>
      <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>
        {e.name}<span style={{ color: "#6B7280", fontSize: 9 }}> ({e.code})</span>
        {soon && <span style={{ color: "#FFB020", fontSize: 9, marginLeft: 6 }}>{daysUntilLabel(daysUntil)}</span>}
      </div>
      <EarningsScoreBadge pct={e.last_surprise_pct} reactionPct={e.last_earnings_reaction_pct} />
    </button>
  );
}

function EarningsView({ briefing, onJump, marketFilter = "all" }) {
  const jpCal = briefing?.jp_earnings_calendar || [];
  const usCal = briefing?.us_earnings_calendar || [];

  let calendar = [
    ...jpCal.map(e => ({ ...e, market: "日本" })),
    ...usCal.map(e => ({ ...e, market: "米国" })),
  ].sort((a, b) => (a.next_earnings_date || "").localeCompare(b.next_earnings_date || ""));

  if (marketFilter === "jp") calendar = calendar.filter(e => e.market === "日本");
  if (marketFilter === "us") calendar = calendar.filter(e => e.market === "米国");

  const hasAny = calendar.length > 0;
  const hasExtreme = calendar.some(e => typeof e.last_surprise_pct === "number" && Math.abs(e.last_surprise_pct) > 300);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>決算</div>

      {!hasAny && (
        <div style={{ color: "#6B7280", fontSize: 11, marginBottom: 14 }}>
          決算データはまだありません。「Refresh Earnings Data Only」ワークフローの実行後に表示されます。
        </div>
      )}

      {calendar.length > 0 && (
        <div style={{ background: "#080D10", border: "1px solid #1B1F26", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>決算カレンダー（日付順・タップで銘柄詳細へ）</div>
          {calendar.map((e, i) => <EarningsCalendarRow key={i} e={e} market={e.market} onJump={onJump} />)}
        </div>
      )}

      <div style={{ fontSize: 9, color: "#6B7280" }}>
        ※決算スコアは前回決算のサプライズ%（EPS実績が市場予想=コンセンサスをどれだけ上回った/下回ったか）と、決算発表前後の株価反応%（上昇幅）を組み合わせて0〜100に換算した参考値です（反応%が取得できない場合はサプライズ%のみで算出）。日本株は決算データ提供元(J-Quants)の仕様上、サプライズ%・反応%とも取得できないため決算スコアは表示されません。
        {hasExtreme && " 「予想転換※」は、予想が赤字→黒字（またはその逆）に転換したことでサプライズ%の計算が数学的に極端な値になっているケースです。スコア自体は参考程度に。"}
        {" "}銘柄名をタップすると日本株/米国株タブの詳細に移動します（その日の注目銘柄に選ばれていない場合は一覧のみの表示になります）。
      </div>
    </div>
  );
}

function ScreenerRow({ t, currency }) {
  const color = t.ai_score >= 60 ? "#00E0A3" : t.ai_score <= 40 ? "#ff5566" : "#FFB020";
  const up = t.change_pct >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#080D10", borderRadius: 6, border: `1px solid ${color}33`, marginBottom: 5 }}>
      <div style={{ fontSize: 9, color: "#6B7280", width: 44 }}>{t.sector}</div>
      <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{t.name}<span style={{ color: "#6B7280", fontSize: 9 }}> ({t.code})</span></div>
      <div style={{ fontSize: 9, color: up ? "#00E0A3" : "#ff5566" }}>{up ? "+" : ""}{t.change_pct}%</div>
      <div style={{ fontSize: 13, color, fontWeight: 700, minWidth: 26, textAlign: "right" }}>{t.ai_score}</div>
    </div>
  );
}

function HighConvictionPanel({ screener, currency, refreshedAt }) {
  const hc = screener?.high_conviction || [];
  return (
    <div style={{ background: "#151008", border: "1px solid #FFB02055", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFB020", marginBottom: 8 }}>🎯 高確度候補（AIスコア90以上のみ）</div>
      {hc.length === 0 ? (
        <div style={{ fontSize: 11, color: "#A1A7B3", lineHeight: 1.6 }}>
          本日は90点以上の高確度候補はありません。複数の強気シグナル（売られすぎ・バンド下限・出来高急増・トレンド）がほぼ同時に揃う日は稀なので、これは正常な状態です。
        </div>
      ) : (
        hc.map((t, i) => <ScreenerRow key={i} t={t} currency={currency} />)
      )}
      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>
        ※MA25乖離・RSI売られすぎ・BB下限・出来高急増がほぼ全て重なった、極めて限定的な高確度シグナルのみを表示します。投資助言ではありません。
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
      </div>
    </div>
  );
}

const CUP_HANDLE_FORMING_LIMIT = 4;

function CupHandleBreakoutRow({ t, currency }) {
  const ch = t.cup_handle || {};
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      background: "linear-gradient(90deg, #00E0A322, #080D10)", borderRadius: 8,
      border: "1px solid #00E0A388", marginBottom: 6,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: "#00170e", background: "#00E0A3", borderRadius: 999,
        padding: "4px 10px", whiteSpace: "nowrap",
      }}>
        🚀 ブレイク
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", flex: 1 }}>{t.name}<span style={{ color: "#A1A7B3", fontSize: 10 }}> ({t.code})</span></div>
      <div style={{ fontSize: 10, color: "#A1A7B3", textAlign: "right" }}>
        <div>ピボット {currency}{ch.pivot?.toLocaleString()}</div>
        <div>カップ{ch.cup_weeks}週・深さ{ch.cup_depth_pct}%</div>
      </div>
    </div>
  );
}

function CupHandleFormingRow({ t, currency }) {
  const ch = t.cup_handle || {};
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#080D10", borderRadius: 6, border: "1px solid #FFB02033", marginBottom: 5 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "#FFB020", border: "1px solid #FFB02055", borderRadius: 999,
        padding: "2px 7px", whiteSpace: "nowrap",
      }}>
        🫖 ハンドル形成中
      </div>
      <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{t.name}<span style={{ color: "#6B7280", fontSize: 9 }}> ({t.code})</span></div>
      <div style={{ fontSize: 9, color: "#A1A7B3", textAlign: "right" }}>
        <div>ピボット {currency}{ch.pivot?.toLocaleString()}</div>
        <div>カップ{ch.cup_weeks}週・深さ{ch.cup_depth_pct}%</div>
      </div>
    </div>
  );
}

function CupHandlePanel({ screener, currency, refreshedAt }) {
  const list = screener?.cup_handle || [];
  if (list.length === 0) return null;
  const breakouts = list.filter(t => t.cup_handle?.stage === "breakout");
  const forming = list.filter(t => t.cup_handle?.stage !== "breakout");
  const formingShown = forming.slice(0, CUP_HANDLE_FORMING_LIMIT);
  const formingHidden = forming.length - formingShown.length;
  return (
    <div style={{ background: "#0d1410", border: "1px solid #00E0A333", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#00E0A3", marginBottom: 8 }}>🫖 カップウィズハンドル候補</div>
      {breakouts.map((t, i) => <CupHandleBreakoutRow key={`b-${i}`} t={t} currency={currency} />)}
      {formingShown.map((t, i) => <CupHandleFormingRow key={`f-${i}`} t={t} currency={currency} />)}
      {formingHidden > 0 && (
        <div style={{ fontSize: 9, color: "#6B7280", marginTop: 4 }}>他{formingHidden}件が形成中(ブレイクまでは非表示)</div>
      )}
      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>
        ※週足でカップ形状（深さ10〜50%・7〜65週）、日足でハンドル（右リムから15%以内の浅い調整）を機械的に検出した参考値です。ピボット＝ハンドル高値（出来高を伴って上抜けるとブレイク）。パターンの成立や今後の値動きを保証するものではありません。
        {refreshedAt && ` 最終更新: ${new Date(refreshedAt).toLocaleString("ja-JP")}`}
      </div>
    </div>
  );
}

function ScreenerPanel({ screener, currency, refreshedAt }) {
  const top = screener?.top || [];
  if (top.length === 0) {
    return (
      <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px", marginBottom: 14, color: "#6B7280", fontSize: 11 }}>
        スクリーナーデータはまだありません。「Refresh Screener Only」ワークフローの実行後に表示されます。
      </div>
    );
  }
  return (
    <>
      <HighConvictionPanel screener={screener} currency={currency} refreshedAt={refreshedAt} />
      <CupHandlePanel screener={screener} currency={currency} refreshedAt={refreshedAt} />
      <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>テクニカルスクリーナー（AIスコア上位・参考値）</div>
        {top.map((t, i) => <ScreenerRow key={i} t={t} currency={currency} />)}
        <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>
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
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>日本株 注目銘柄</div>
      <ComplianceNote />
      {stocks.length > 0 ? (
        stocks.map((s, i) => <StockCard key={i} s={s} highlighted={highlightCode === String(s.code)} market="jp" />)
      ) : (
        <div style={{ color: "#6B7280", fontSize: 11, marginBottom: 14 }}>本日分の銘柄情報はまだありません。</div>
      )}
      <SectorHeatmap heatmap={briefing?.sector_heatmap} allChanges={briefing?.jp_all_changes} currency="¥" history={history} heatmapKey="sector_heatmap" refreshedAt={briefing?.jp_sector_heatmap_refreshed_at} stale={briefing?.jp_sector_heatmap_stale} />
      <TopMovers movers={briefing?.jp_top_movers} currency="¥" />
      <div id="jp-screener-panel">
        <ScreenerPanel screener={briefing?.jp_screener} currency="¥" refreshedAt={briefing?.screener_refreshed_at} />
      </div>
    </div>
  );
}

function UsStocksView({ briefing, history, highlightCode }) {
  const s = briefing?.stock_us;
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 10 }}>米国株 注目銘柄</div>
      <ComplianceNote />
      {s ? (
        <StockCard s={{ ...s, code: s.ticker }} highlighted={highlightCode === String(s.ticker)} market="us" />
      ) : (
        <div style={{ color: "#6B7280", fontSize: 11, marginBottom: 14 }}>本日分の銘柄情報はまだありません。</div>
      )}
      <SectorHeatmap heatmap={briefing?.us_sector_heatmap} allChanges={briefing?.us_all_changes} currency="$" history={history} heatmapKey="us_sector_heatmap" refreshedAt={briefing?.us_sector_heatmap_refreshed_at} stale={briefing?.us_sector_heatmap_stale} />
      <TopMovers movers={briefing?.us_top_movers} currency="$" />
      <ScreenerPanel screener={briefing?.us_screener} currency="$" refreshedAt={briefing?.screener_refreshed_at} />
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
  medium: { label: "重要",   color: "#FFB020", dot: "#FFB020", order: 1 },
  low:    { label: "参考",   color: "#A1A7B3", dot: "#4a4a4a", order: 2 },
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
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>{title}</div>
        <div style={{ color: "#6B7280", fontSize: 11 }}>イベント情報はまだありません。</div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>{title}</div>
      {months.map(month => {
        const sorted = [...groups[month]].sort((a, b) => {
          const ia = IMPORTANCE_META[getImportance(a)].order;
          const ib = IMPORTANCE_META[getImportance(b)].order;
          if (ia !== ib) return ia - ib;
          return (a.date || "").localeCompare(b.date || "");
        });
        return (
          <div key={month} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#A1A7B3", marginBottom: 6 }}>{month}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sorted.map((e, i) => {
                const imp = IMPORTANCE_META[getImportance(e)];
                return (
                  <div key={i} style={{
                    background: "#13161C", border: `1px solid ${imp.color}33`, borderLeft: `3px solid ${imp.color}`,
                    borderRadius: 8, padding: "8px 10px", display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <div style={{ fontSize: 10, color: "#A1A7B3", minWidth: 70 }}>{e.date}</div>
                    <div style={{ fontSize: 11, color: "#FFFFFF", flex: 1 }}>{e.text}</div>
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
  normal: "#888888", surge: "#00E0A3", crash: "#ff5566", ai: "#a78bfa"
};

function DayDetailView({ briefing, onClose }) {
  const mode = MODE_LABELS[briefing.mode] || MODE_LABELS.normal;
  return (
    <div style={{ background: "#080D10", border: `1px solid ${mode.color}44`, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #13161C" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{briefing.date} の朝刊</div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#A1A7B3", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>閉じる</button>
      </div>
      <div style={{ padding: "4px 4px 4px" }}>
        <BriefingView briefing={briefing} ignoreStaleness={true} />
      </div>
      {briefing.stocks_jp?.length > 0 && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", margin: "4px 0 8px" }}>この日の注目銘柄</div>
          {briefing.stocks_jp.map((s, i) => <StockCard key={i} s={s} market="jp" />)}
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
    { key: "nikkei", label: "日経225", color: "#FFFFFF", data: normalizeSeries(history, "nikkei") },
    { key: "nasdaq", label: "NASDAQ", color: "#00E0A3", data: normalizeSeries(history, "nasdaq") },
    { key: "sp500", label: "S&P500", color: "#FFB020", data: normalizeSeries(history, "sp500") },
    { key: "sox", label: "SOX", color: "#ff5566", data: normalizeSeries(history, "sox") },
  ];

  const allDates = [...new Set(history.filter(h => h.fileDate).map(h => h.fileDate))].sort();

  if (allDates.length < 2 || series.every(s => s.data.length < 2)) {
    return (
      <div style={{ marginBottom: 16, background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>年間チャート：日経225 / NASDAQ / S&P500 / SOX</div>
        <div style={{ fontSize: 10, color: "#6B7280" }}>データ蓄積中です。数日分たまるとチャートが表示されます。</div>
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
    <div style={{ marginBottom: 16, background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>年間チャート：日経225 / NASDAQ / S&P500 / SOX</div>
        <div style={{ display: "flex", gap: 10 }}>
          {series.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ fontSize: 9, color: "#A1A7B3" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {gridYs.map((gv, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yOf(gv)} y2={yOf(gv)} stroke="#1B1F26" strokeWidth="1" />
            <text x={2} y={yOf(gv) + 3} fontSize="7" fill="#6B7280">{gv.toFixed(0)}</text>
          </g>
        ))}
        {series.map(s => s.data.length > 1 && (
          <path key={s.key} d={buildPath(s.data)} fill="none" stroke={s.color} strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6B7280", marginTop: 4 }}>
        <span>{allDates[0]}</span>
        <span>{allDates[allDates.length - 1]}</span>
      </div>
      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 6 }}>
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
  const [rankMarket, setRankMarket] = useState("jp"); // 'jp' | 'us' — 出現ランキングの市場切り替え

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
    return <div style={{ padding: 20, color: "#6B7280", fontSize: 12 }}>履歴データがまだありません。明日以降蓄積されます。</div>;
  }

  const fileDates = history.map(h => h.fileDate).filter(Boolean).sort();

  // 銘柄出現頻度ランキング(日本株: 複数銘柄/日、米国株: 1銘柄/日)
  const stockCount = {};
  history.forEach(h => {
    (h.stocks_jp || []).forEach(s => {
      const key = `${s.name}（${s.code}）`;
      stockCount[key] = (stockCount[key] || 0) + 1;
    });
  });
  const topStocks = Object.entries(stockCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  const usStockCount = {};
  history.forEach(h => {
    const s = h.stock_us;
    if (s?.name) {
      const key = `${s.name}（${s.ticker || s.code || ""}）`;
      usStockCount[key] = (usStockCount[key] || 0) + 1;
    }
  });
  const topUsStocks = Object.entries(usStockCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // モード統計
  const modeStat = {};
  history.forEach(h => { modeStat[h.mode] = (modeStat[h.mode] || 0) + 1; });

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>

      {/* 日付ピッカー */}
      <div style={{ marginBottom: 16, background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>過去の朝刊を呼び出す</div>
        <input
          type="date"
          value={selectedDate}
          min={fileDates[0]}
          max={fileDates[fileDates.length - 1]}
          onChange={(e) => loadDay(e.target.value)}
          style={{ background: "#080D10", color: "#FFFFFF", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", fontSize: 12, colorScheme: "dark" }}
        />
        <div style={{ fontSize: 9, color: "#6B7280", marginTop: 6 }}>
          保存期間: {fileDates[0]} 〜 {fileDates[fileDates.length - 1]}
        </div>
        {dayLoading && <div style={{ fontSize: 11, color: "#A1A7B3", marginTop: 8 }}>読み込み中...</div>}
        {dayError && <div style={{ fontSize: 11, color: "#ff5566", marginTop: 8 }}>{dayError}</div>}
      </div>

      {dayData && <DayDetailView briefing={dayData} onClose={() => { setDayData(null); setSelectedDate(""); }} />}

      <IndexCompareChart history={history} />

      {/* 相場モード統計 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>直近の相場モード統計</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(modeStat).map(([mode, count]) => (
            <div key={mode} style={{ background: "#13161C", border: `1px solid ${MODE_COLORS[mode] || "#1B1F26"}44`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: MODE_COLORS[mode] || "#FFFFFF" }}>{mode}</div>
              <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700 }}>{count}日</div>
            </div>
          ))}
        </div>
      </div>

      {/* 日経平均推移 */}
      <div style={{ marginBottom: 16, background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>日経平均 直近推移</div>
        {[...history].reverse().map((h, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #13161C" }}>
            <div style={{ fontSize: 10, color: "#A1A7B3" }}>{h.date}</div>
            <div style={{ fontSize: 11, color: "#FFFFFF" }}>{h.nikkei?.toLocaleString()}円</div>
            <div style={{ fontSize: 10, color: (h.nikkei_pct || 0) >= 0 ? "#00E0A3" : "#ff5566" }}>
              {h.nikkei_pct >= 0 ? "+" : ""}{h.nikkei_pct?.toFixed(2)}%
            </div>
            <div style={{ fontSize: 9, color: MODE_COLORS[h.mode] || "#888" }}>{h.mode}</div>
          </div>
        ))}
      </div>

      {/* 注目銘柄ランキング */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>注目銘柄 出現ランキング</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "jp", label: "🇯🇵 日本株" }, { id: "us", label: "🇺🇸 米国株" }].map(m => (
              <button
                key={m.id}
                onClick={() => setRankMarket(m.id)}
                style={{
                  padding: "3px 9px", fontSize: 10, borderRadius: 20, fontFamily: "inherit", cursor: "pointer", fontWeight: 700,
                  background: rankMarket === m.id ? "#00E0A322" : "transparent",
                  border: `1px solid ${rankMarket === m.id ? "#00E0A388" : "#1B1F26"}`,
                  color: rankMarket === m.id ? "#00E0A3" : "#6B7280",
                }}
              >{m.label}</button>
            ))}
          </div>
        </div>
        {(rankMarket === "jp" ? topStocks : topUsStocks).length === 0 ? (
          <div style={{ color: "#6B7280", fontSize: 11 }}>データ蓄積中...</div>
        ) : (
          (rankMarket === "jp" ? topStocks : topUsStocks).map(([name, count], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#13161C", border: "1px solid #1B1F26", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#FFFFFF" }}>{i+1}. {name}</div>
              <div style={{ fontSize: 11, color: "#FFB020" }}>{count}回</div>
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
    <div style={{ background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "10px 12px", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>
          {showAll ? "年間の値動きが起こりやすい月（参考・タップで日程を表示）" : "直近の値動きが起こりやすい月（参考・タップで日程を表示）"}
        </div>
        <button
          onClick={() => { setShowAll(!showAll); setOpenMonth(null); }}
          style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#A1A7B3", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
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
                background: isOpen ? `${imp.color}28` : isNow ? `${imp.color}18` : "#080D10",
                border: `1px solid ${isOpen ? imp.color : isNow ? imp.color : "#1B1F26"}`,
                borderRadius: 8, padding: "7px 8px", textAlign: "left",
                fontFamily: "inherit", color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: isNow ? 700 : 500 }}>{mo.label}</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: imp.dot, display: "inline-block" }} />
              </div>
              <div style={{ fontSize: 9, color: "#A1A7B3", lineHeight: 1.4 }}>{mo.desc}</div>
            </button>
          );
        })}
      </div>

      {openMonth && (() => {
        const dayEvents = eventsForMonth(openMonth);
        const mo = MONTHLY_FLOW.find(x => x.m === openMonth);
        return (
          <div style={{ marginTop: 10, background: "#080D10", border: "1px solid #1B1F26", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{mo.label}の予定日</div>
              <button onClick={() => setOpenMonth(null)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#A1A7B3", fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>閉じる</button>
            </div>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.6 }}>
                この月の具体的な日程データはまだありません。朝刊配信が近づくと下の「日本」「米国」欄に個別の日付が追加されます。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dayEvents.map((e, i) => {
                  const imp = IMPORTANCE_META[getImportance(e)];
                  return (
                    <div key={i} style={{ background: "#13161C", border: `1px solid ${imp.color}33`, borderLeft: `3px solid ${imp.color}`, borderRadius: 6, padding: "6px 8px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 9, color: "#A1A7B3", minWidth: 62 }}>{e.date}</div>
                      <div style={{ fontSize: 10, color: "#6B7280", minWidth: 26 }}>{e.source}</div>
                      <div style={{ fontSize: 10, color: "#FFFFFF", flex: 1 }}>{e.text}</div>
                      <div style={{ fontSize: 9, color: imp.color, whiteSpace: "nowrap" }}>{imp.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: "#6B7280", marginTop: 8 }}>
        ※日本・米国の決算シーズンや金融政策イベントなど、例年起こりやすい傾向を示す一般的な参考情報です。特定の値動きを保証するものではありません。
      </div>
    </div>
  );
}

function CalendarView({ briefing, marketFilter = "all" }) {
  if (!briefing) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6B7280", fontSize: 12 }}>
        カレンダーデータがまだありません。
      </div>
    );
  }
  const showJp = marketFilter !== "us";
  const showUs = marketFilter !== "jp";
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px 24px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 14 }}>月次イベントカレンダー</div>
      <YearlyFlowView eventsJp={showJp ? briefing.events_jp : []} eventsUs={showUs ? briefing.events_us : []} />
      {showJp && <CalendarSection title="日本" events={briefing.events_jp} />}
      {showUs && <CalendarSection title="米国" events={briefing.events_us} />}
    </div>
  );
}

function EventsView({ briefing, onJump }) {
  const [sub, setSub] = useState("earnings");
  const [marketFilter, setMarketFilter] = useState("all"); // 'all' | 'jp' | 'us'
  const subTabs = [
    { id: "earnings", label: "決算" },
    { id: "calendar", label: "予定" },
  ];
  const filters = [
    { id: "all", label: "すべて" },
    { id: "jp", label: "🇯🇵 日本" },
    { id: "us", label: "🇺🇸 米国" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: "10px 14px 0", flexShrink: 0 }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              flex: 1, padding: "6px 0", fontSize: 11, borderRadius: 6, fontFamily: "inherit", cursor: "pointer",
              background: sub === t.id ? "#13161C" : "transparent",
              border: `1px solid ${sub === t.id ? "#444444" : "#1B1F26"}`,
              color: sub === t.id ? "#FFFFFF" : "#6B7280",
            }}
          >{t.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 14px 0", flexShrink: 0 }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setMarketFilter(f.id)}
            style={{
              padding: "4px 10px", fontSize: 10, borderRadius: 20, fontFamily: "inherit", cursor: "pointer", fontWeight: 700,
              background: marketFilter === f.id ? "#00E0A322" : "transparent",
              border: `1px solid ${marketFilter === f.id ? "#00E0A388" : "#1B1F26"}`,
              color: marketFilter === f.id ? "#00E0A3" : "#6B7280",
            }}
          >{f.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ display: sub === "earnings" ? "block" : "none", height: "100%" }}>
          <EarningsView briefing={briefing} onJump={onJump} marketFilter={marketFilter} />
        </div>
        <div style={{ display: sub === "calendar" ? "block" : "none", height: "100%" }}>
          <CalendarView briefing={briefing} marketFilter={marketFilter} />
        </div>
      </div>
    </div>
  );
}

// SpinningEarthが使うCSS(キーフレーム+reduced-motion対応)。IntroSplashと
// 朝刊ヒーロー側それぞれの<style>タグに差し込んで使う共通定義。
const GLOBE_STYLE_CSS = `
  .globe-surface-spin{animation:globeSpin 30s linear infinite}
  .globe-surface-boost{animation:globeSpin 8s linear infinite}
  @keyframes globeSpin{
    from{background-position:0 0,0 0; -webkit-mask-position-x:0; mask-position-x:0}
    to{background-position:-16px 0,-15px 0; -webkit-mask-position-x:-700px; mask-position-x:-700px}
  }
  .globe-btn{transition:background .15s ease, transform .1s ease}
  .globe-btn:active{transform:scale(0.98)}
  @media (hover:hover) { .globe-btn:hover{background:rgba(0,229,200,0.06)} }
  @media (prefers-reduced-motion: reduce) {
    .globe-surface-spin, .globe-surface-boost { animation: none; }
  }
`;

// 簡略化した世界地図(北米/グリーンランド/南米/ヨーロッパ/アフリカ/アジア/
// インド亜大陸/オーストラリア)をSVGパスで表現し、ドット層のマスクに使う。
// 正距円筒図法のviewBox(800x400、経度0〜360degをx0〜800にマッピング)で
// 描いていて、両端(x=0付近とx=800付近)はどちらも太平洋にあたり陸地が
// ないため、横に繰り返しても継ぎ目が目立たない。厳密な海岸線の再現では
// なく「大陸の輪郭として認識できる」レベルの簡略ポリゴン。
const GLOBE_WORLD_MAP_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNDAwIj4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNNTgsNzIgTDg4LDU0IEwxMjgsNDggTDE2NSw1OCBMMTk4LDcyIEwyMjIsNTggTDI0OCw2NCBMMjUyLDg4IEwyMzYsMTA4IEwyMjIsMTI4IEwyMDQsMTQ4IEwxODYsMTc4IEwxNzAsMjA4IEwxNTQsMjI4IEwxMzMsMjM2IEwxMTUsMjIyIEwxMDAsMjAwIEw4NCwxNzYgTDY4LDE1MCBMNTQsMTIwIEw1MCw5NSBaIi8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTI4MCw0NCBMMzA2LDM2IEwzMjgsNDQgTDMyMiw2NiBMMzAwLDc0IEwyODAsNjMgWiIvPgogIDxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0xOTYsMjM2IEwyMjIsMjMwIEwyMzYsMjQ2IEwyNDYsMjcyIEwyNDksMzAyIEwyNDAsMzMyIEwyMjQsMzU3IEwyMDgsMzcxIEwxOTgsMzYwIEwxOTQsMzMwIEwxODcsMzAwIEwxODQsMjcwIEwxODgsMjUwIFoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzk2LDkwIEw0MjIsODAgTDQ0Nyw4NSBMNDU3LDEwMSBMNDUxLDExNiBMNDM1LDEyNiBMNDE0LDEzMSBMMzk5LDEyMCBMMzkyLDEwNSBaIi8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTM5NiwxNjIgTDQyMiwxNTEgTDQ0NywxNTYgTDQ2MiwxNzEgTDQ3MiwxOTEgTDQ2NiwyMTEgTDQ3MSwyMzEgTDQ2MSwyNTEgTDQ1MSwyNzEgTDQ0MSwyOTIgTDQyOSwzMTIgTDQxNywzMjYgTDQwNCwzMTYgTDM5NywyOTYgTDM5MSwyNzEgTDM4NywyNDYgTDM4NCwyMjEgTDM4OCwxOTYgTDM5MiwxNzYgWiIvPgogIDxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik00NTYsODAgTDQ5Miw2MCBMNTMyLDU1IEw1NzIsNjAgTDYxMiw1NSBMNjUyLDY2IEw2ODIsODEgTDY5NywxMDEgTDY4NiwxMjEgTDY3MSwxMzYgTDY0MSwxNDYgTDYxMCwxNTEgTDU5MCwxNjYgTDU3NSwxODYgTDU2MCwyMTEgTDU0NSwyMzEgTDUyNSwyMjYgTDUxNSwyMDYgTDUwNCwxOTEgTDQ5NCwxNzYgTDQ3OSwxNjEgTDQ2NCwxNDEgTDQ1NSwxMTYgWiIvPgogIDxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01MjgsMjMyIEw1NDgsMjI2IEw1NjMsMjQwIEw1NjgsMjYyIEw1NTYsMjc4IEw1MzgsMjcwIEw1MjgsMjUwIFoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNNjMxLDI5MSBMNjYxLDI4NSBMNjg2LDI5NiBMNjk2LDMxMSBMNjkwLDMyNiBMNjcwLDMzMyBMNjQ0LDMyOSBMNjI4LDMxNiBMNjIyLDMwMSBaIi8+Cjwvc3ZnPgo=";
const GLOBE_EDGE_MASK = "radial-gradient(circle, #000 55%, rgba(0,0,0,.85) 68%, rgba(0,0,0,.25) 88%, transparent 100%)";

// KabuBocchi独自の抽象デジタル地球。写真を回すのではなく、
// 「球体そのものは固定し、内部の表面テクスチャ(ドット+グリッド)だけを
// 一方向へゆっくり流す」ことで自転しているように見せる。光源(ハイライト/影)
// は表面と別レイヤーにして固定し、地形と一緒に動かさない。
// opacity/ringPower/glowPowerで、オープニング(主役)と朝刊ヒーロー(脇役)の
// 見せ方だけを調整できる。自転ロジック自体は完全に共通。
function SpinningEarth({ size = 108, boost = false, onClick, title, opacity = 1, ringPower = 1, glowPower = 1 }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        position: "relative", width: size, height: size, flexShrink: 0,
        cursor: onClick ? "pointer" : "default", opacity,
      }}
    >
      {/* 軌道リング(最奥・かなり暗い) */}
      <div style={{
        position: "absolute", left: "50%", top: "51%", width: size * 1.52, height: size * 0.4,
        transform: "translate(-50%, -50%) rotate(-8deg)", borderRadius: "50%",
        border: `1px solid rgba(120,195,255,${0.07 * ringPower})`, zIndex: 0, pointerEvents: "none",
      }} />
      {/* 軌道リング(横・中程度) */}
      <div style={{
        position: "absolute", left: "50%", top: "53%", width: size * 1.4, height: size * 0.34,
        transform: "translate(-50%, -50%) rotate(-8deg)", borderRadius: "50%",
        border: `1px solid rgba(140,205,255,${0.16 * ringPower})`, zIndex: 0, pointerEvents: "none",
      }} />

      {/* 球体本体(固定。ここ自体は動かない。縁はここでフェードさせて球面感を出す) */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: "radial-gradient(circle at 32% 26%, #1c4468 0%, #0c2038 34%, #061527 64%, #030a15 100%)",
        boxShadow: "inset -9px -9px 20px rgba(0,0,0,0.6)",
        WebkitMaskImage: GLOBE_EDGE_MASK,
        maskImage: GLOBE_EDGE_MASK,
      }}>
        {/* 緯度経度グリッド(海陸問わず全面、ごく薄く) */}
        <div
          className={boost ? "globe-surface-boost" : "globe-surface-spin"}
          style={{
            position: "absolute", inset: "-2px -6px",
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(150,205,255,0.10) 0px, rgba(150,205,255,0.10) 1px, transparent 1px, transparent 15px), " +
              "repeating-linear-gradient(0deg, rgba(150,205,255,0.06) 0px, rgba(150,205,255,0.06) 1px, transparent 1px, transparent 19px)",
            backgroundSize: "15px 100%, 100% 19px",
            backgroundRepeat: "repeat",
          }}
        />
        {/* 陸地ドット(大陸の塊の形にだけ集まる。ここが「地球っぽさ」の要) */}
        <div
          className={boost ? "globe-surface-boost" : "globe-surface-spin"}
          style={{
            position: "absolute", inset: "-2px -6px",
            backgroundImage: "radial-gradient(circle, rgba(170,220,255,0.9) 0.9px, transparent 1.4px)",
            backgroundSize: "6px 6px",
            backgroundRepeat: "repeat",
            WebkitMaskImage: `url("${GLOBE_WORLD_MAP_SVG}")`,
            maskImage: `url("${GLOBE_WORLD_MAP_SVG}")`,
            WebkitMaskSize: "700px 100%",
            maskSize: "700px 100%",
            WebkitMaskRepeat: "repeat-x",
            maskRepeat: "repeat-x",
          }}
        />
        {/* 左右端を暗く落として球面のカーブを強調 */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to right, rgba(0,0,0,.5) 0%, transparent 22%, transparent 78%, rgba(0,0,0,.55) 100%)",
        }} />
        {/* 影(固定・地形と一緒に動かさない。下側がより深くなるよう2枚重ね) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 32% 28%, transparent 14%, rgba(0,0,0,.18) 44%, rgba(0,0,0,.8) 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.3) 100%)",
        }} />
        {/* ハイライト(固定・左上寄りの強い光) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 30% 22%, rgba(255,255,255,.75) 0%, rgba(170,225,255,.28) 10%, transparent 28%)",
        }} />
        {/* 弱いリムライト(球の輪郭にごく細く沿う縁取り) */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
          boxShadow: "inset 0 0 0 1px rgba(140,210,255,0.18)",
        }} />
      </div>

      {/* 大気光(固定、最小限のグロー) */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none", zIndex: 2,
        boxShadow: `inset 0 0 ${Math.round(size * 0.16)}px rgba(80,170,255,${0.22 * glowPower}), 0 0 ${Math.round(size * 0.2)}px rgba(41,163,255,${0.16 * glowPower})`,
      }} />

      {/* 軌道リング(最前面・teal寄りの明るいアクセント、球を貫通しているように見せる) */}
      <div style={{
        position: "absolute", left: "50%", top: "60%", width: size * 1.3, height: size * 0.28,
        transform: "translate(-50%, -50%) rotate(6deg)", borderRadius: "50%",
        border: `1px solid rgba(0,229,200,${0.42 * ringPower})`, zIndex: 3, pointerEvents: "none",
      }} />
    </div>
  );
}

// 東京/NYの現在時刻を軽量に表示するミニウィジェット。setIntervalは30秒に
// 1回のテキスト更新のみ(アニメーションループではない)なので負荷は無視できる。
function useWorldClocks() {
  const [clocks, setClocks] = useState(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClocks({
        tokyo: now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }),
        ny: now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }),
      });
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);
  return clocks;
}

function MarketStatRow({ label, value, pct, align = "right" }) {
  const hasPct = typeof pct === "number";
  const positive = hasPct && pct >= 0;
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hasPct && (
        <div style={{ fontSize: 9.5, color: positive ? "#00E5C8" : "#ff5566", fontVariantNumeric: "tabular-nums" }}>
          {positive ? "+" : ""}{pct.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function IntroSplash({ onSelect, briefing }) {
  const [boost, setBoost] = useState(false);
  const boostTimer = useRef(null);
  const clocks = useWorldClocks();
  const handleTap = () => {
    setBoost(true);
    clearTimeout(boostTimer.current);
    boostTimer.current = setTimeout(() => setBoost(false), 650);
  };
  useEffect(() => () => clearTimeout(boostTimer.current), []);
  const flagBtnStyle = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 56, borderRadius: 17, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
    color: "#FFFFFF", background: "linear-gradient(155deg, rgba(0,229,200,0.09), #101820 55%)",
    border: "1px solid rgba(0,229,200,0.32)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px rgba(0,229,200,0.08), 0 4px 14px rgba(0,0,0,0.35)",
    cursor: "pointer",
  };
  // 実データが既に読み込まれている場合のみ表示する(架空データ・API変更は禁止)
  const hasMarketData = briefing && (briefing.nikkei != null || briefing.sp500 != null || briefing.usd_jpy != null);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, maxWidth: 600, margin: "0 auto",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "calc(22px + env(safe-area-inset-top, 0px)) 20px calc(16px + env(safe-area-inset-bottom, 0px))",
      background: "radial-gradient(ellipse 120% 60% at 50% 0%, #0B2133 0%, #071520 42%, #040A10 78%)",
      overflow: "hidden",
      fontFamily: "'JetBrains Mono','Courier New',monospace",
    }}>
      <style>{`
        ${GLOBE_STYLE_CSS}
      `}</style>
      {/* 背景の奥行き(大小2種類の極薄い星、静止画像のみでアニメーションなし) */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.45) 0.7px, transparent 1.1px), " +
          "radial-gradient(circle, rgba(255,255,255,0.22) 0.5px, transparent 1px)",
        backgroundSize: "130px 130px, 87px 87px",
        backgroundPosition: "14px 20px, 60px 70px",
      }} />
      <div style={{
        position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,229,200,0.12) 0%, transparent 68%)", pointerEvents: "none",
      }} />

      {/* 地球エリア: 画面上部を大胆に使うヒーロービジュアル。左にGLOBAL MARKETS、
          右に主要指数(データが揃っている時だけ、実データのみ)を添える。
          地球のリング/ドットが数字に重なって視認性を落とさないよう、テキスト側は
          背景チップ+高いz-indexで確実に前面・可読に出す。 */}
      <div style={{ position: "relative", width: "100%", flexShrink: 0, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              position: "absolute", inset: -22, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,229,200,0.24) 0%, transparent 68%)",
              filter: "blur(10px)", pointerEvents: "none",
            }} />
            <SpinningEarth size={224} boost={boost} onClick={handleTap} title="タップで自転を加速" />
          </div>
        </div>
        <div style={{
          position: "absolute", left: 0, top: "42%", zIndex: 5, pointerEvents: "none",
          background: "rgba(4,10,16,0.5)", borderRadius: 8, padding: "5px 8px",
        }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.16em", lineHeight: 1.6 }}>GLOBAL</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.16em", lineHeight: 1.6 }}>MARKETS</div>
        </div>
        {hasMarketData && (
          <div style={{
            position: "absolute", right: 0, top: "6%", zIndex: 5,
            display: "flex", flexDirection: "column", gap: 10,
            background: "rgba(4,10,16,0.5)", borderRadius: 10, padding: "8px 10px",
          }}>
            <MarketStatRow label="NIKKEI 225" value={briefing.nikkei?.toLocaleString()} pct={briefing.nikkei_pct} />
            <MarketStatRow label="S&P 500" value={briefing.sp500?.toLocaleString()} pct={briefing.sp500_pct} />
            <MarketStatRow label="USD/JPY" value={briefing.usd_jpy} pct={briefing.usd_jpy_pct} />
          </div>
        )}
      </div>

      {/* コンテンツ本体 */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26 }}>
          <span style={{ width: 20, height: 1, background: "rgba(0,229,200,0.4)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#00E5C8", letterSpacing: "0.26em" }}>SWING STATION</span>
          <span style={{ width: 20, height: 1, background: "rgba(0,229,200,0.4)" }} />
        </div>
        <div style={{ fontSize: 25, fontWeight: 700, color: "#FFFFFF", marginTop: 12, textAlign: "center", letterSpacing: "0.01em" }}>日米マーケット朝刊</div>
        <div style={{ fontSize: 13, color: "#8892A3", marginTop: 10, textAlign: "center" }}>見たい市場を選んでね</div>

        <div style={{ display: "flex", gap: 10, marginTop: 26, width: "100%", maxWidth: 320 }}>
          <button className="globe-btn" onClick={() => onSelect("jp")} style={flagBtnStyle}><span style={{ fontSize: 17 }}>🇯🇵</span>日本株</button>
          <button className="globe-btn" onClick={() => onSelect("us")} style={flagBtnStyle}><span style={{ fontSize: 17 }}>🇺🇸</span>米国株</button>
        </div>
        <button
          onClick={() => onSelect(null)}
          style={{ marginTop: 22, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
        >
          あとで選ぶ
        </button>

        {/* 東京/NYのミニ時計。「世界市場が動いている」空気を静かに添える */}
        {clocks && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>🇯🇵</span>
              <div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em" }}>TOKYO</div>
                <div style={{ fontSize: 12.5, color: "#00E5C8", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{clocks.tokyo}</div>
              </div>
            </div>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>🇺🇸</span>
              <div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em" }}>NEW YORK</div>
                <div style={{ fontSize: 12.5, color: "#00E5C8", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{clocks.ny}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.24em", flexShrink: 0, paddingTop: 12 }}>
        KABUBOCCHI
      </div>
    </div>
  );
}

export default function SwingStation() {
  const [tab, setTab] = useState("briefing");
  const [highlightTarget, setHighlightTarget] = useState(null); // { market: 'jp'|'us', code: string }
  const [flagSide, setFlagSide] = useState("jp"); // 'jp' | 'us' — which flag is currently up front
  const [showIntro, setShowIntro] = useState(false); // 初回セッションのみ地球オープニングを表示

  // タブが「日本株」「米国株」タブ自体のクリックやジャンプなど、国旗ボタン以外の
  // 経路で切り替わったときも国旗の表示を実際のタブと一致させる。
  useEffect(() => {
    if (tab === "jp" || tab === "us") setFlagSide(tab);
  }, [tab]);

  // セッション内で未表示なら初回だけオープニング画面を出す(SSRと初回描画は
  // 常にfalseで揃え、マウント後にsessionStorageを見て切り替えるのでハイドレーション
  // ミスマッチにならない)。
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("kb_intro_seen")) {
      setShowIntro(true);
    }
  }, []);

  const flipFlag = () => {
    setTab(flagSide === "jp" ? "us" : "jp");
  };

  const jumpToStock = (market, code) => {
    setTab(market);
    setHighlightTarget({ market, code: String(code) });
  };

  const goToTab = (tabId, anchorId) => {
    setTab(tabId);
    if (anchorId) {
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
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

  // 「日本株」「米国株」は別々のタブではなく、ヘッダーの国旗と連動する1つの
  // タブにまとめる（旗がJP/US切り替えの唯一の主役）。朝刊・履歴は元々
  // 日本株/米国株を横断した内容なので旗の影響を受けず今まで通り。
  const TABS = [
    { id: "briefing", label: "朝刊" },
    { id: "stocks", label: flagSide === "jp" ? "日本株" : "米国株", isActive: tab === "jp" || tab === "us", onSelect: () => setTab(flagSide) },
    { id: "events", label: "イベント" },
    { id: "history", label: "履歴" },
  ];

  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })} ${lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
    : "--:--";

  // ブラウザセッション最初の1回だけ、地球ビジュアルで日本株/米国株を選ぶ
  // オープニング画面を挟む。データ取得(loadData等)はこの間も裏で進むので、
  // 選択後はすぐいつもの画面に切り替わる。
  if (showIntro) {
    return (
      <IntroSplash
        briefing={briefing}
        onSelect={(side) => {
          if (side) setFlagSide(side);
          if (typeof window !== "undefined") sessionStorage.setItem("kb_intro_seen", "1");
          setShowIntro(false);
        }}
      />
    );
  }

  return (
    <>
      <Head>
        <title>KabuBocchi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"#080D10", fontFamily:"'JetBrains Mono','Courier New',monospace", color:"#d0d0d0", maxWidth:600, margin:"0 auto", borderLeft:"1px solid #13161C", borderRight:"1px solid #13161C" }}>
        <style>{`
          @keyframes ssP{0%,100%{opacity:1}50%{opacity:.2}}
          @keyframes ssSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes orbSpin{from{background-position:0 0}to{background-position:-60px 0}}
          ${GLOBE_STYLE_CSS}
          *{box-sizing:border-box}
          html,body{height:100%;margin:0;padding:0;background:#080D10}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#FFFFFF25;border-radius:2px}
          button{cursor:pointer}
          @media (max-width: 480px) { .kb-subtitle { display:none; } }
        `}</style>

        {/* Header */}
        <div style={{ background:"#080D10", borderBottom:"1px solid #1B1F26", padding:"8px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <img src="/logo.png" alt="かぶぼっち" style={{ width:30, height:30, borderRadius:"50%" }} />
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:900, color:"#FFFFFF", letterSpacing:2 }}>
            KabuBocchi
          </div>
          <button
            onClick={flipFlag}
            title={flagSide === "jp" ? "日本株を表示中（タップで米国株へ）" : "米国株を表示中（タップで日本株へ）"}
            style={{
              position:"relative", display:"flex", alignItems:"center", gap:3,
              flexShrink:0, marginLeft:2, padding:0, background:"none", border:"none", cursor:"pointer",
            }}
          >
            <span style={{
              fontSize:15, lineHeight:1,
              opacity: flagSide === "jp" ? 1 : 0.4,
              filter: flagSide === "jp" ? "none" : "grayscale(40%)",
              transform: flagSide === "jp" ? "scale(1.1)" : "scale(0.85)",
              transition: "all 0.32s cubic-bezier(.34,1.3,.64,1)",
            }}>🇯🇵</span>
            <span style={{
              width:20, height:20, borderRadius:"50%", flexShrink:0,
              background:
                "radial-gradient(circle at 35% 30%, #2a6b52 0%, #0d3a2c 45%, #061f18 75%)," +
                "repeating-linear-gradient(100deg, transparent 0 5px, rgba(255,255,255,0.08) 5px 6px)",
              boxShadow:"0 0 8px rgba(0,224,163,0.45), inset -3px -3px 5px rgba(0,0,0,0.6)",
              animation:"orbSpin 5s linear infinite",
            }} />
            <span style={{
              fontSize:15, lineHeight:1,
              opacity: flagSide === "us" ? 1 : 0.4,
              filter: flagSide === "us" ? "none" : "grayscale(40%)",
              transform: flagSide === "us" ? "scale(1.1)" : "scale(0.85)",
              transition: "all 0.32s cubic-bezier(.34,1.3,.64,1)",
            }}>🇺🇸</span>
          </button>
          <div className="kb-subtitle" style={{ fontSize:8, color:"#6B7280", marginLeft:2, whiteSpace:"nowrap" }}>数日〜1週間の押し目スイング特化</div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <button
              onClick={() => { loadData(); loadHistory(); }}
              disabled={isRefreshing}
              title={`最終更新日: ${lastUpdatedLabel}（5分ごとに自動更新）`}
              style={{
                display:"flex", alignItems:"center", gap:5, background:"#13161C", border:"1px solid #1B1F26",
                borderRadius:8, padding:"3px 9px", fontFamily:"inherit", cursor: isRefreshing ? "default" : "pointer",
              }}
            >
              <span style={{
                display:"inline-block", width:9, height:9, fontSize:9, lineHeight:"9px", color:"#A1A7B3",
                animation: isRefreshing ? "ssSpin 0.7s linear infinite" : "none",
              }}>⟳</span>
              <span style={{ fontSize:9, color:"#A1A7B3" }}>{isRefreshing ? "更新中" : `最終更新日: ${lastUpdatedLabel}`}</span>
            </button>
            <div style={{
              padding:"2px 8px", borderRadius:8, fontSize:9,
              background: todayInfo.isMarketOpen ? "#0a2a0a" : "#161616",
              border: `1px solid ${todayInfo.isMarketOpen ? "#00E0A333" : "#6B7280"}`,
              color: todayInfo.isMarketOpen ? "#00E0A3" : "#A1A7B3",
            }}>
              {todayInfo.isMarketOpen ? "東証OPEN" : todayInfo.isUSMarket ? "NY OPEN" : todayInfo.isRealWeekend ? "休場中" : `${todayInfo.day}曜`}
            </div>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#FFFFFF", animation:"ssP 2s infinite" }}/>
          </div>
        </div>

        {/* Tabs — 選択中は前面に大きく浮き上がり、非選択は奥へ小さく沈む
            (ヘッダーの国旗トグルと同じ「前面/奥」の立体表現に揃えている) */}
        <div style={{ display:"flex", background:"#080D10", borderBottom:"1px solid #1f1f1f", flexShrink:0 }}>
          {TABS.map(t => {
            const active = t.isActive ?? tab === t.id;
            return (
              <B key={t.id} onClick={() => (t.onSelect ? t.onSelect() : setTab(t.id))} style={{
                flex:1, padding:"9px 4px", position:"relative", background:"transparent", overflow:"visible",
              }}>
                <span style={{
                  display:"inline-block",
                  fontSize: active ? 12 : 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#FFFFFF" : "#6B7280",
                  transform: active ? "translateY(-1px) scale(1.08)" : "translateY(1px) scale(0.92)",
                  textShadow: active ? "0 2px 8px rgba(0,255,157,0.2)" : "none",
                  transition: "transform 0.24s cubic-bezier(.34,1.35,.64,1), color 0.24s ease",
                }}>{t.label}</span>
                <span style={{
                  position:"absolute", left:"22%", right:"22%", bottom:0, height:2, borderRadius:"2px 2px 0 0",
                  background: active ? "#00E0A3" : "transparent",
                  boxShadow: active ? "0 0 8px rgba(0,255,157,0.55)" : "none",
                  transition: "background 0.24s ease, box-shadow 0.24s ease",
                }} />
              </B>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
          <div style={{ display:tab==="briefing"?"block":"none", height:"100%" }}>
            <BriefingView briefing={briefing} onJump={jumpToStock} onNavigate={goToTab} />
          </div>
          <div style={{ display:tab==="jp"?"block":"none", height:"100%" }}>
            <JpStocksView briefing={briefing} history={history} highlightCode={highlightTarget?.market === "jp" ? highlightTarget.code : null} />
          </div>
          <div style={{ display:tab==="us"?"block":"none", height:"100%" }}>
            <UsStocksView briefing={briefing} history={history} highlightCode={highlightTarget?.market === "us" ? highlightTarget.code : null} />
          </div>
          <div style={{ display:tab==="events"?"block":"none", height:"100%" }}>
            <EventsView briefing={briefing} onJump={jumpToStock} />
          </div>
          <div style={{ display:tab==="history"?"block":"none", height:"100%" }}>
            <HistoryView history={history} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background:"#080D10", borderTop:"1px solid #1B1F26", padding:"6px 14px",
          flexShrink:0, fontSize:8, color:"#6B7280", lineHeight:1.4,
        }}>
          <div style={{ display:"flex", gap:12, justifyContent:"center", marginBottom:4 }}>
            <a href="https://note.com/kabubocchi" target="_blank" rel="noreferrer" onClick={() => track("click_note")} style={{ color:"#A1A7B3", fontSize:9, textDecoration:"none" }}>note</a>
            <a href="https://x.com/kabubocchi" target="_blank" rel="noreferrer" onClick={() => track("click_x")} style={{ color:"#A1A7B3", fontSize:9, textDecoration:"none" }}>X</a>
          </div>
          ※{DISCLAIMER_TEXT}
        </div>
      </div>
    </>
  );
}


