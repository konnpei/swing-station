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

// SpinningEarthが使うCSS。IntroSplashと朝刊ヒーロー側それぞれの<style>タグに
// 差し込んで使う共通定義。
// 【技術メモ】以前、mask-position(SVGマスクの位置)をCSS @keyframesで
// アニメーションさせた際に陸地レイヤーが描画されない現象が起きたことがあるが、
// 原因はページのコードではなく検証環境側の古いnextサーバープロセスが居座って
// いたことによる誤検知だった(サーバーを完全に再起動して解消済み)。そのため
// mask-positionのアニメーション自体は問題なく動く。
// オープニング画面(spinMode="continuous")は「地球表面が一方向へ回り続ける」
// 演出のため、CSSの@keyframes+animation:infiniteで実装している(GLOBE_MASK_TILE_PX
// ぶんだけmask-position-xを動かすとちょうど地図1周分になり、そこから先は
// 同じ絵の繰り返しになるので継ぎ目が出ない)。朝刊ヒーロー側(spinMode="once",
// 既定値)は従来どおり、初回マウント時に一度だけ・減速して停止する有限
// アニメーションのままで、Reactのstate + inline transitionで実装している
// (SpinningEarth内)。
// 陸地マスク群(land/dots/outline/japan)は全て同じviewBox(1600x800)・同じ
// mask-size・同じmask-positionで揃えて使うことで、常にピタリと重なる。
// アスペクト比を保ったサイズ指定でないとSVGマスクが描画されない
// (ブラウザの既知の挙動)ため、高さは明示せず"auto"にして幅だけ指定する。
const GLOBE_MASK_SIZE = "1400px auto";
const GLOBE_MASK_TILE_PX = 1400; // GLOBE_MASK_SIZEの幅(=経度360度・1タイル分)
// 日本列島が正面(円の中央)に来るよう置いた基準位置(x/y)。自転はこのx値から
// 経度方向(横)だけをずらして表現し、yは常に固定する。
const GLOBE_MASK_BASE_X = -1110;
const GLOBE_MASK_BASE_Y = -100;
// マスク画像の表示幅(1400px、GLOBE_MASK_SIZE参照)が経度360度分にあたるため、
// 「経度n度」を「px」に変換する係数。
const GLOBE_PX_PER_DEG = 1400 / 360;
// オープニング画面の連続自転:1周(GLOBE_MASK_TILE_PXぶん)にかかる秒数。
const GLOBE_CONTINUOUS_SPIN_S = 32;

const GLOBE_STYLE_CSS = `
  .globe-btn{transition:background .15s ease, transform .1s ease}
  .globe-btn:active{transform:scale(0.98)}
  @media (hover:hover) { .globe-btn:hover{background:rgba(0,229,200,0.06)} }

  /* 地球表面の連続自転(オープニング画面のみ)。地球の円盤自体(球体・光源・
     影・軌道線・HUD)は一切動かさず、内部の陸地レイヤーのmask-position-xだけを
     一方向に一定速度で動かし続ける。ちょうど1タイル分動かして元の見た目に
     戻すため、継ぎ目・逆回転・往復は発生しない。 */
  @keyframes globeSurfaceSpin {
    from { -webkit-mask-position-x: ${GLOBE_MASK_BASE_X}px; }
    to   { -webkit-mask-position-x: ${GLOBE_MASK_BASE_X - GLOBE_MASK_TILE_PX}px; }
  }
  .globe-continuous-spin { animation: globeSurfaceSpin ${GLOBE_CONTINUOUS_SPIN_S}s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .globe-continuous-spin { animation-duration: ${GLOBE_CONTINUOUS_SPIN_S * 8}s; }
  }
`;

// 世界地図(陸地シルエット)は、npm製の world-atlas(Natural Earthの
// TopoJSONを配布する静的データパッケージ。ネットワーク取得は一切不要で、
// このリポジトリの依存関係にも追加していない。SVGパス生成の作業用に
// ローカルで一度だけ使い、生成結果のSVGだけをこのファイルに埋め込んでいる)
// を d3-geo の正距円筒図法(equirectangular)で1600x800のviewBoxに投影し、
// topojson-simplifyで軽量化した実座標ベースの陸地シルエット。特定の地域の
// 手描き近似ではなく、全世界を同じ実データ・同じ精度で表現している。
// 経度180度/-180度の継ぎ目もこの投影が正確に一致するため、横に繰り返しても
// 継ぎ目が出ない。
// KabuBocchiは日本株を扱うため、基準位置(mask-position初期値)は
// 日本列島が画面中央に来るよう経度・緯度をシフトしてある。
//
// 陸地は「ドットで塗る」のではなく「正確な陸地シルエットをマスクにして、
// その内側だけにドットを敷き詰める」方式。同じマスクを陸地ベース(薄い
// 塗り)・ドット・アウトライン(細い縁取り)の3レイヤーで共有し、常に
// 同じ位置を指すよう揃えている。
const GLOBE_WORLD_MAP_FILL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAwIDgwMCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTUzNS4yMzcsNzU1LjczNkw1MzIuNjI5LDc2MC4wMDFMNTEzLjM4MSw3NTkuNjU1TDUwNS4zODEsNzU2LjY5MUw1MjQuOTY1LDc1Ny4zWk05Mi40MDEsNzUzLjMyMUw4My44NzMsNzUzLjkzTDcyLjM4NSw3NDkuMzExTDgzLjM2MSw3NDguMzU2Wk01OTkuMzE4LDc0Ni44NzRMNjA0Ljc5LDc0OC43OTJMNjA3LjQxNCw3NTUuNjY4TDU3NS42MzgsNzYwLjExNEw1NjUuMTEsNzU5Ljg1TDU2MC4wNTQsNzU2LjU0MUw1NzMuMzY2LDc1My44NEw1ODMuNzM0LDc0Ni44NzRaTTI2MS4yODMsNzI2LjY2OUwyNzIuMzM5LDcyNi41ODZMMjY1LjYzNSw3MjkuMjg3Wk0yNDEuOTU0LDcyNi41ODZMMjQxLjk1NCw3MjYuNTg2TDI0MS45NTQsNzI2LjU4NlpNMzYwLjA4NCw3MTkuNzAzTDM3Mi40MzYsNzIyLjMxM0wzNTIuMDY4LDcyMi4yMzFMMzQ1LjIwMyw3MTkuNTNaTTQ5NS43NjUsNzE1LjM2Mkw0OTQuMjkzLDcyMC43NTZMNDcwLjI2MSw3MjEuNjI5TDQ2Ni42MTMsNzE4LjQ5Mkw0NzkuNjY5LDcxNi40MDFMNDgxLjE0MSw3MDguOTE2TDQ4Ny43NjUsNzA2LjEyNVpNMCw3NzYuNTA1TDAuMDAxLDc3Ni41MDVMMCw3NzYuNTA1TDQuMTc2LDc3My45NTVMMjQuOTYsNzc1LjcwOEw0NC42NTYsNzcyLjgxOUw1Ny42ODEsNzc1Ljg2Nkw5Ny40NTcsNzc5LjQzOUwxMTAuMjU3LDc3OC4yMkwxMzkuODU3LDc4MC40ODVMMTYzLjk3LDc3Ny45NTdMMTY0LjkzLDc3NS44NjZMMTMzLjA1Nyw3NzQuNjQ3TDExNy4zOTMsNzcxLjk0N0wxMjAuNjA5LDc2NC42MzVMMTAyLjk0NSw3NjAuNDUyTDEyNC4wMTcsNzYwLjAxNkwxMzAuNDQ5LDc2MS40OThMMTQ1LjY4MSw3NTguNTQyTDE0Ny42ODEsNzU1LjIzMkwxMzUuNDA5LDc1Mi43MDRMMTA5LjY0OSw3NTEuMzk1TDk3LjU1Myw3NDYuNzg0TDk2LjE2MSw3NDEuNzI5TDEwMi4zMzcsNzQzLjU1N0wxMTYuNzA1LDc0Mi41MTFMMTI3LjQwOSw3NDMuOTkzTDE1MC42NDIsNzM5LjkwMUwxNTAuMjEsNzM1LjAyNkwxNTguNTYyLDczNS43MThMMTgyLjg1LDczMy4xOThMMTk5LjA0Miw3MzAuMjM0TDIxOC4xMTQsNzMxLjAxN0wyNjcuOTg3LDczMS4wMTdMMjkzLjU4Nyw3MjcuNjI0TDMwMC44OTksNzMyLjA2MkwzMDUuNTA3LDczMC43NTNMMzIxLjk1NSw3MzQuMTU0TDMzMy44OTEsNzMzLjEwOEwzNTIuNjkyLDczNC42NzNMMzU1LjA0NCw3MzIuNzYyTDM0NC4yNDMsNzI5LjM2MkwzMzkuMTg3LDcyMi43NDJMMzU0LjE2NCw3MjMuMzUxTDM3MS44NDQsNzI3LjE4OEw0MDcuMDEyLDcyNC40ODdMNDM3LjkwOCw3MjguMjMzTDQ0My4xMjQsNzI1LjAwNkw0NjEuMjM3LDcyOC43NTJMNDkzLjYyMSw3MjQuNDg3TDUwMC41ODEsNzIyLjEzM0w0OTUuNjIxLDcxMS41OTRMNTAwLjMyNSw3MDIuODlMNDk4LjkzMyw2OTkuMjI3TDUxOS45ODksNjg3LjI5Nkw1MzkuNTczLDY4MS43MjJMNTQ1LjY2OSw2ODIuMzM5TDUzNy41NzMsNjg2LjA3N0w1MjIuMTY1LDY4OS4zMDVMNTIzLjkwOSw2OTQuMTc5TDUwOC44NTMsNzAwLjM2M0w1MTkuMTI1LDcwNy42NzVMNTI2LjYxMyw3MTUuOTQ5TDUzMC4yNjEsNzI1LjE3OUw1MjQuNjEzLDczMC44NDRMNTEzLjk4OSw3MzQuNUw0ODkuNzgxLDczOC43NzJMNDg2LjIxMyw3NDAuNkw0NTYuNzA5LDc0MC45NDZMNDY5Ljg2MSw3NDQuNjkzTDQ2Ny42ODUsNzQ3LjY0OUw0NTMuNjY5LDc0OC4zNDlMNDUzLjIyMSw3NTEuOTIyTDQ2NS4wNjEsNzU2LjcwNkw0OTYuOTMzLDc2MS40MTVMNTE4Ljg2OSw3NjMuMzI2TDUzNC43MDksNzY2LjExN0w1NDEuMjM3LDc2OS44NjNMNTc4LjgzOCw3NjMuMjQzTDYwOS43MzQsNzY0LjgwOEw2MTguNzksNzYxLjU4OEw2MzAuMDIyLDc2MS40OThMNjczLjExMSw3NTcuMDZMNjY4LjA3MSw3NTIuMjY4TDY0MS42MDYsNzUzLjE0TDY0MC45OTgsNzQ4LjE3Nkw2NzEuNjM5LDc0MC43NzNMNzAwLjE4Myw3MzguMjQ2TDczMC4yMTUsNzMxLjEwN0w3MjYuODIzLDcyOC4zMTZMNzU0LjI0OCw3MTYuNzMyTDc2Ny4wMzIsNzE4LjY1TDc2OS40OCw3MTUuMjU3TDc4MC42OTYsNzE3LjYwNEw3OTIuMDI0LDcxNi4zMDNMNzk4Ljk4NCw3MTguMzg3TDgzMS43Miw3MTIuMjAzTDg0Mi4zMjgsNzExLjE2NUw4NDguMDcyLDcxNC44MjFMODU5LjY1Nyw3MTAuOTg0TDg4NS41OTMsNzEwLjYzOEw5MDAuMzEzLDcxNC4yMTJMOTI5LjU2MSw3MTIuMDNMOTQ1LjU3Nyw3MDguMzc0TDk1MC41MzgsNzA0LjQ1NUw5NzEuNzcsNzEwLjExOUw5NzcuODY2LDcwNy4xNTVMMTAwNi42ODIsNzAwLjQ1M0wxMDI1LjU3OCw2OTcuMjI2TDEwMzMuODM0LDY5My41N0wxMDUwLjQ3NSw2OTMuMjI0TDEwNjEuMDgzLDY5OS4wNTRMMTA3Ny4yNzUsNzAyLjI4MUwxMDg0LjY4Myw2OTkuNThMMTEwNi4xNzEsNzAxLjkyN0wxMTA5LjEzMSw3MDkuNjgzTDExMDEuMzg3LDcxMi40NjZMMTEwNi45NTUsNzE0LjEyMUwxMTAxLjk5NSw3MTkuMzQ5TDExMTUuNjU5LDcyMC4zOTVMMTEyOC4yODMsNzEwLjU1NkwxMTQ1LjA4Myw3MDguNzJMMTE1MS42MTIsNzAzLjY3M0wxMTY3LjksNjk4LjcwOEwxMTg1LjU2NCw2OTguNDQ0TDExOTEuMDUyLDY5NC4yNjlMMTIwMi43OTYsNjk4Ljc5OEwxMjQzLjE5Niw2OTguODgxTDEyNTcuMDM3LDY5MS4zOTZMMTI3MS45MTcsNjk3LjQ4OUwxMjg5LjkzMyw2OTYuNDQzTDEzMDQuOTA5LDY5Mi43ODhMMTMxMy43ODksNjk2LjQ0M0wxMzM3LjE5Nyw2OTguNjE3TDEzNDMuNjQ1LDY5NS44MzRMMTM3Mi40NjIsNjk2LjcwN0wxMzk4LjkyNiw2OTQuMjY5TDE0MDAuMzE4LDY5MC4yNkwxNDEwLjk0Miw2OTcuNTc5TDE0NDYuNjIyLDY5Ny4zOTlMMTQ1MS43NTksNzAxLjc1NEwxNDc3Ljc5MSw3MDYuMTFMMTQ4NS43MTEsNzA0LjcxOEwxNDk2Ljk0Myw3MDguMzc0TDE1MDcuNDcxLDcwOS4zMjlMMTUyMy4wNTUsNzE0LjM4NUwxNTQ4LjU1OSw3MTUuNDNMMTU2MC45MTIsNzE4LjY1TDE1NTIuMzg0LDcyNy4zNjFMMTUzOC4xOTEsNzMwLjU4TDE1MjkuOTM1LDczNS4zNzJMMTUyNi42MjMsNzQyLjUxMUwxNTMyLjE5MSw3NDcuNDc2TDE1NDIuMjA3LDc1MC4wMDRMMTUxOC45NTksNzUxLjgzMUwxNTEwLjE3NSw3NTkuNzZMMTUyNy41ODMsNzY2LjE5OUwxNTUwLjY0LDc3MC4zODJMMTU1Mi45MTIsNzcyLjU1NkwxNTY5Ljg4OCw3NzUuMTc0TDE1ODIuMTYsNzc0LjAzOEwxNTkyLjMzNiw3NzUuNDM3TDE2MDAsNzc2LjUwNUwxNjAwLDgwMEw4MDAsODAwTDAsODAwWk00OTguODg1LDYzOS4zMzNMNTEwLjg4NSw2NDMuMTA5TDQ5Ny4xMjUsNjQ3LjE2NEw0ODQuNDIxLDY0NC42ODFMNDY4LjE2NSw2MzQuODM0TDQ4My45NzMsNjQwLjMzM0w0ODcuNzAxLDYzNS4yNDhMNDk0Ljk2NSw2MzMuOTM5Wk01MzkuNzgxLDYyNy4xMDlMNTM2LjAwNSw2MzEuOTk4TDUyOC4wMDUsNjMwLjQ0MVpNMTExMi4zNjMsNjIwLjkzM0wxMTA1LjUzMSw2MjEuMjE5TDExMDYuMzc5LDYxNi4xMTFaTTE0NDYuMjA2LDU4MS4yOTdMMTQ1OS4wNTUsNTgxLjY2NUwxNDU3LjM5MSw1OTIuMDU0TDE0NDkuMTAyLDU5My41NTFMMTQ0My4xOTgsNTgyLjk0NFpNMTU2OC45NzYsNTgxLjg2MUwxNTc0LjQzMiw1ODUuNjQ1TDE1NjIuMDE2LDU5Ni42MzVMMTU1OC4zMDQsNjA0LjAzN0wxNTUyLjU5Miw2MDcuMjk0TDE1NDAuNzgzLDYwNS40MjFMMTU0Mi40MzEsNjAwLjQ5NEwxNTU3Ljg4OCw1OTEuMjQ5TDE1NjgsNTc5Ljk3M1pNMTU3Ni4wNDgsNTYwLjY5M0wxNTc5LjI4LDU2NS4zNzJMMTU5My40MDgsNTY3LjUzOEwxNTgyLjI3Miw1ODMuNTA4TDE1NzIuNTQ0LDU3NS41OTVMMTU3NS44ODgsNTcyLjQzNVpNMTU0Mi43NTEsNDk4LjQ4OUwxNTM1LjQzOSw0OTYuMzUzTDE1MjkuMDIzLDQ4OS4zNTdaTTE1OTIuNzY4LDQ3Ny4wNjVMMTU5Mi43NjgsNDc3LjA2NUwxNTkyLjc2OCw0NzcuMDY1Wk0xNjAwLDQ3My41ODNMMTU5Ny4xNjgsNDc0LjY3M0wxNTk3LjM5Miw0NzIuNzkzTDE2MDAsNDcxLjQwOUwxNjAwLDQ3My41ODNaTTAsNDcxLjQwOUwwLjAwMSw0NzEuNDA4TDAsNDczLjU4MkwwLDQ3My41ODJMMCw0NzMuNTgzTDAsNDcxLjQwOVpNMTU0NS45ODMsNDczLjE4NEwxNTQ1Ljk4Myw0NzMuMTg0TDE1NDUuOTgzLDQ3My4xODRaTTE1NDIuNzAzLDQ2Ni4zNzZMMTU0Mi43MDMsNDY2LjM3NkwxNTQyLjcwMyw0NjYuMzc2Wk0xMDIyLjQ3NCw0NjAuMjQ1TDEwMjQuMzQ2LDQ2Ny42N0wxMDA5LjMyMiw1MTAuODQ5TDEwMDEuODE4LDUxMy43ODNMOTk1LjczOCw1MTEuMDU5TDk5Mi4yMzQsNDk4LjAzTDk5Ny4yMjYsNDg5LjIxNEw5OTUuMzg2LDQ3Ny4zODFMOTk3LjU0Niw0NzIuMDdMMTAwNS44MzQsNDcwLjEzN0wxMDEyLjAyNiw0NjQuODY0TDEwMTguNjUsNDUzLjUxMlpNMTQzOC4wNDYsNDYxLjE3TDE0NDYuMTEsNDY2LjYwMUwxNDUwLjYwNyw0ODQuMjU3TDE0NjEuNTUxLDQ5MC42MjhMMTQ2NS4yMzEsNDk5LjMwMkwxNDc5LjM1OSw1MTIuMzAxTDE0ODIuNTI3LDUyNC45MzFMMTQ3OS41MTksNTQwLjYyM0wxNDc0LjI3MSw1NDYuODUxTDE0NjYuNjU1LDU2Ni4zMzVMMTQ1MC4zMDMsNTczLjQ5NkwxNDM4LjI3LDU3Mi40ODhMMTQyNS4wNTQsNTY4Ljk3NUwxNDIwLjMzNCw1NjAuNjE3TDE0MTMuODcsNTU4LjI3OEwxNDE0LjI1NCw1NTIuODI0TDE0MDguMTI2LDU1Ni43MTNMMTQxMi40OTQsNTQ2LjIxOUwxNDA0LjM5OCw1NTUuMDY2TDEzOTYuNzY2LDU0NC45NjNMMTM4My42NzgsNTM5Ljk4M0wxMzYwLjY1NCw1NDMuMThMMTM0OS41OTcsNTUwLjYyTDEzMzIuODYxLDU1MS4wMDRMMTMyNC41NTcsNTU1Ljg0MUwxMzExLjIyOSw1NTEuOTgyTDEzMTQuNjY5LDU0My4xMzVMMTMwNy40MzcsNTI0Ljk2OEwxMzAzLjk2NSw1MDguMzc0TDEzMDcuMzI1LDQ5Ni42OTFMMTMzNy4xMzMsNDg3LjQ4NEwxMzQ2LjcxNyw0NzIuOTEzTDEzNTguNjA2LDQ2My4yNDZMMTM2NC43MzQsNDYxLjQxMUwxMzcwLjQ5NCw0NjYuMDgyTDEzNzUuMTUsNDY0LjA4OUwxMzgwLjUyNiw0NTUuNzE2TDEzODkuMjMsNDUzLjg0M0wxMzg4LjI1NCw0NDkuNDU4TDE0MDEuMzI2LDQ1NC40MzhMMTQwOC42Nyw0NTQuODk3TDE0MDEuOTAyLDQ2NS40MDVMMTQxOC45NDIsNDc3LjIwOEwxNDI2LjExLDQ3Ny4xOTNMMTQyOS43OSw0NjYuODY1TDE0MjkuNzI2LDQ1NS4xNDVMMTQzMy40MDYsNDQ3LjQxMlpNMTUyMC41MjcsNDQ2LjU5MkwxNTIwLjUyNyw0NDYuNTkyTDE1MjAuNTI3LDQ0Ni41OTJaTTEzMzYuNTA5LDQ0NS41MDhMMTMzNi41MDksNDQ1LjUwOEwxMzM2LjUwOSw0NDUuNTA4Wk0xNTE0Ljg5NSw0NDMuODc2TDE1MTQuODk1LDQ0My44NzZMMTUxNC44OTUsNDQzLjg3NlpNMTUxOC41NzUsNDQyLjY2NUwxNTE4LjU3NSw0NDIuNjY1TDE1MTguNTc1LDQ0Mi42NjVaTTEzNTMuMDU0LDQ0NS4wNjVMMTM1MS4wMjIsNDQxLjI4OEwxMzY0LjMwMiw0MzguNTI4Wk0xMzIzLjk5Nyw0MzUuOTc3TDEzMjkuNDUzLDQzOC42OTNMMTMxOC44NDUsNDQwLjE0NVpNMTM0Ni4yMzcsNDM1Ljk3N0wxMzQ1LjU4MSw0MzguNDQ1TDEzMzIuOTg5LDQzOS4xNTlaTTE1MTAuNTU5LDQzNy4wNTNMMTUxMC41NTksNDM3LjA1M0wxNTEwLjU1OSw0MzcuMDUzWk0xNTAwLjE3NSw0MzIuNjZMMTUwMC4xNzUsNDMyLjY2TDE1MDAuMTc1LDQzMi42NlpNMTI4Mi43NjUsNDMwLjEyNUwxMjkyLjI2OSw0MjguNzMzTDEzMTQuMjUzLDQzNy4yMDRMMTMwOS4xODEsNDM4Ljg5NkwxMjgxLjIyOSw0MzQuNTE4TDEyNjguMjg1LDQzMC40NDhMMTI3MS4zNDEsNDI2LjIwNlpNMTM5OC43ODIsNDI3LjYyTDEzOTguNzgyLDQyNy42MkwxMzk4Ljc4Miw0MjcuNjJaTTE0OTIuNzk5LDQzMC4zMTNMMTQ5Mi43OTksNDMwLjMxM0wxNDkyLjc5OSw0MzAuMzEzWk0xNDc1LjQ4Nyw0MjQuMzQ4TDE0NjcuNzQzLDQyOC4wNzlMMTQ1OS41NjcsNDI0LjE2N1pNMTM2NS41NSw0MTUuMzczTDEzNjUuNTUsNDE1LjM3M0wxMzY1LjU1LDQxNS4zNzNaTTEzNzkuODcsNDEzLjc0OUwxMzc5Ljg3LDQxMy43NDlMMTM3OS44Nyw0MTMuNzQ5Wk0xNDgwLjYyMyw0MjBMMTQ2OS42MTUsNDEyLjE4NEwxNDc2LjYyMyw0MTQuNDAzWk0xMzk2LjE5LDQwNS4xMkwxMzk3LjQzOCw0MTIuMzA0TDE0MDIuMDMsNDE0Ljk2N0wxNDA1Ljc0Miw0MTAuMjUxTDE0MTQuNzk4LDQwNy41NjVMMTQ0Mi41OSw0MTcuMTY0TDE0NDguODE0LDQyNC4yOTVMMTQ1Ni4yMDcsNDI3LjA0MUwxNDUzLjE5OSw0MjkuODc3TDE0NjEuMDM5LDQ0MC40NjhMMTQ3MC4yMjMsNDQ1Ljc0OUwxNDU3LjM5MSw0NDUuMDI3TDE0NDkuMTAyLDQzNS44NTdMMTQ0My4zMSw0MzMuOTA5TDE0MzMuOTAyLDQ0MS40NTRMMTQyMi44NjIsNDM2Ljg3M0wxNDExLjYxNCw0MzcuMzg0TDE0MTYuMzAyLDQzMi41MzJMMTQxMy4wMDYsNDIzLjk3MkwxMzk0LjA2Miw0MTUuNzI3TDEzOTEuMDM4LDQxOC4yNzdMMTM4Ny42OTQsNDA5LjgzN0wxMzgwLjA5NCw0MDQuMTY1TDEzODguMzUsNDAxLjY0NVpNMTM1Ni42MjIsMzkzLjY4NkwxMzUzLjA1NCwzOTguMTAyTDEzMzQuMTQxLDM5OC45NDRMMTMzNy40ODUsNDA2LjI2NEwxMzQ4LjE3Myw0MDIuNzM2TDEzNDAuMDI5LDQwOC40NjhMMTM0Ny4zODksNDIzLjczOEwxMzQzLjI3Nyw0MjMuNDgzTDEzMzQuNjg1LDQxMy4wMjZMMTMzNS4yNDUsNDI0LjU3M0wxMzMwLjUyNSw0MjMuOTExTDEzMzEuMTAxLDQxNS41MzFMMTMyNy44NTMsNDEyLjQ1NUwxMzMzLjQ4NSwzOTcuNDg1TDEzMzcuMjc3LDM5NC4xODNMMTM1MS40NTQsMzk1LjkyWk0xMzcxLjk1LDM5NC45NjVMMTM2OS4zMjYsNDAzLjk5OUwxMzY2LjIyMiwzOTUuNTA3TDEzNjguNTksMzkwLjMzOVpNMTI3MC4zMDEsNDI2LjAxTDEyNjUuMzczLDQyNi4xTDEyNTUuOTMzLDQxOC43NTlMMTIzOC4yMiwzOTEuODk2TDEyMjMuOTE2LDM3Ny45MDRMMTIzMy4yNiwzNzYuNjg1TDEyNDcuMjkyLDM5MC42N0wxMjUxLjgyMSwzOTAuNzM3TDEyNjEuNTAxLDM5OS41MzlMMTI2Ni4xNzMsNDEwLjQwMUwxMjcxLjU5Nyw0MTMuNjA2Wk0xMzIzLjg4NSwzOTEuODgxTDEzMjIuMzE3LDQwMy41NzFMMTMxOC4wNDUsNDA2LjYxTDEzMTYuMjIxLDQxNy44MzNMMTMxMC41MDksNDE4LjI1NUwxMzAzLjM1Nyw0MTMuODYxTDEyODkuODg1LDQxMy4wNDFMMTI4NC44NDUsNDAyLjA0NEwxMjg3LjM4OSwzOTEuMDgzTDEyOTQuMDc3LDM5MS43NzVMMTMwMi4yMDUsMzg2LjIwOUwxMzIwLjU3MywzNjkuMjA4TDEzMjkuNjkzLDM3NS45NjNMMTMyMS4zODksMzg1LjYyMlpNMTM2MS42NzgsMzYyLjYwM0wxMzU3LjMyNiwzNzUuMTk2TDEzNTIuMDk0LDM3Mi42MTZMMTM0OS4zNzMsMzY1LjE4M0wxMzQyLjYwNSwzNjkuMzM2TDEzNDMuNjEzLDM2NC4yODhMMTM2MC45OSwzNTguNzI5Wk0xMTYwLjk3MiwzNzIuNDU4TDExNTcuMSwzNzMuNDczTDExNTQuMjA0LDM2My41NTFMMTE1Ni4yMiwzNTYuMzM3TDExNjMuNSwzNjYuNTY4Wk01MjkuMTczLDM1NS4wNjZMNTI5LjE3MywzNTUuMDY2TDUyOS4xNzMsMzU1LjA2NlpNMTM1MS4wMzgsMzU0LjMxM0wxMzQ2LjY1MywzNTkuOTAzTDEzNDYuNDI5LDM1MS42MzVaTTEzMjYuNjg1LDM1OC41OTRMMTMyNi42ODUsMzU4LjU5NEwxMzI2LjY4NSwzNTguNTk0Wk0xMzQxLjcwOSwzNDcuMTQ0TDEzNDcuMTk3LDM0OC41MTRMMTM0Mi4yMzcsMzUzLjU5OVpNMTM1Ny43OSwzNDUuOTQxTDEzNTQuNjcsMzU0Ljk2TDEzNTIuMzAyLDM0NC4xODhaTTEzNDAuMTI1LDM0MS45MTZMMTM0MC4xMjUsMzQxLjkxNkwxMzQwLjEyNSwzNDEuOTE2Wk0xMzM5LjIxMywzMTcuNzYyTDEzNDQuNTA5LDMyNC4wMjhMMTM0MC43MTcsMzI5LjE5NkwxMzQxLjAyMSwzMzYuMzJMMTM1MC44OTQsMzM4Ljc0OUwxMzM2LjEyNSwzMzguNDExTDEzMzMuNjQ1LDMzMy40NjFMMTMzNi41MDksMzE3Ljc1NFpNNTA4LjQ4NSwzMTguOTg4TDUwOC40ODUsMzE4Ljk4OEw1MDguNDg1LDMxOC45ODhaTTQ1OC4yMTMsMzIwLjU4M0w0NTguMjEzLDMyMC41ODNMNDU4LjIxMywzMjAuNTgzWk00NzcuNDI5LDMxMS42ODNMNDg1LjMwMSwzMTEuNjQ2TDQ5Ni4zNTcsMzE3LjI4TDQ4MS4zMDEsMzE5LjhaTTEyOTAuMzk3LDMxNi45ODdMMTI4Mi45MDksMzE3Ljc0N0wxMjg0Ljk3MywzMTEuOTA5TDEyOTIuMzgxLDMxMC43NjZaTTEwOC43MDUsMzE1LjE4MUwxMDguNzA1LDMxNS4xODFMMTA4LjcwNSwzMTUuMTgxWk0xMDYuMzIxLDMwOC4yNDZMMTA2LjMyMSwzMDguMjQ2TDEwNi4zMjEsMzA4LjI0NlpNMTAzLjI5NywzMDUuODg0TDEwMy4yOTcsMzA1Ljg4NEwxMDMuMjk3LDMwNS44ODRaTTk5LjMxMywzMDUuMjM3TDk5LjMxMywzMDUuMjM3TDk5LjMxMywzMDUuMjM3Wk05MS43OTMsMzAyLjMwM0w5MS43OTMsMzAyLjMwM0w5MS43OTMsMzAyLjMwM1pNNDQ1Ljg3NiwyOTguODJMNDcwLjMyNSwzMDkuODQ4TDQ1NC40MjEsMzExLjc1MUw0NTcuMzk3LDMwOS4yNzZMNDUwLjEzMywzMDQuMDExTDQzMi4xLDI5OS4xNjZMNDM0LjM1NiwyOTYuOTM5Wk00NTUuMzk3LDI5NC40MDRMNDU1LjM5NywyOTQuNDA0TDQ1NS4zOTcsMjk0LjQwNFpNMTMzOC41NTcsMjk4LjcwN0wxMzMzLjgwNSwyOTUuMzA3TDEzNDIuMDEzLDI4OC44OThaTTQ1NC4xMzMsMjgxLjg2NEw0NTQuMTMzLDI4MS44NjRMNDU0LjEzMywyODEuODY0Wk00NTcuNzgxLDI4MS44MTlMNDU3Ljc4MSwyODEuODE5TDQ1Ny43ODEsMjgxLjgxOVpNMTM5OC4zOTgsMjQ4LjIyNEwxMzkxLjE4MiwyNTQuNjQ4TDEzOTAuNzgyLDI0OC42MjNaTTk1My42NzQsMjQxLjQ2MUw5NDYuNTY5LDI0Ni4zNTFMOTQzLjM2OSwyNDMuOTg5Wk05MDUuMzM3LDI0MS4zMTFMOTE2Ljg0MSwyNDMuMTA5TDkwOS44ODEsMjQ0LjgwMVpNODY4Ljk4NSwyMzAuMDg3TDg2Ny4xMTMsMjM3LjI0MUw4NTUuMjU3LDIzMi44MzNMODU1Ljg2NSwyMzAuNTQ2Wk04NDAuOTM2LDIxNi44NDhMODQyLjk2OCwyMjUuODgyTDgzNy40NjQsMjI1LjkwNUw4MzYuMjY0LDIxNy45OThaTTE0MjYuNTU4LDIzNC45MjRMMTQyMy4zNDIsMjQzLjgzMUwxNDA5Ljg1NCwyNDYuMTkzTDE0MDMuNTE4LDI1MS4yN0wxNDAwLjM1LDI0Ni4yMzhMMTM4Mi4xNTgsMjQ5LjM5N0wxMzg2LjY3LDI1Mi42N0wxMzgzLjY5NCwyNjAuMjIyTDEzNzUuMTUsMjUyLjAxNUwxMzg5LjQwNiwyNDIuNTIyTDE0MDMuMDA2LDI0Mi4xMDFMMTQwNy42NjIsMjM0LjIwMkwxNDEwLjYyMiwyMzYuMzIzTDE0MTkuNjc4LDIzMC4xNTVMMTQyMy41ODIsMjE2LjkwOEwxNDI4LjMwMiwyMTYuMDk1TDE0MzAuNTksMjI1Ljg1OVpNODQyLjQ4OCwyMTIuNjU4TDg0Mi40ODgsMjEyLjY1OEw4NDIuNDg4LDIxMi42NThaTTE0MzkuNTk4LDIwMy42NjhMMTQ0NS44NywyMDIuNzM1TDE0NDYuODYyLDIwNy43MjNMMTQzNi4zNjYsMjEzLjM1N0wxNDI5LjM5LDIxMC4zMThMMTQyMi4wMywyMTUuMjQ1TDE0MjMuNjE0LDIwNy40MDdMMTQyOC4zNSwyMDcuMTU5TDE0MzAuOTc0LDE5Ny41NTJaTTUxNy4wNDUsMTkzLjExNEw1MTcuMDQ1LDE5My4xMTRMNTE3LjA0NSwxOTMuMTE0Wk01MjUuMzAxLDE4MS43NTVMNTI1LjMwMSwxODEuNzU1TDUyNS4zMDEsMTgxLjc1NVpNMjUxLjA3NSwxODQuNDAzTDI0MS41MzgsMTgyLjk5NkwyMjkuNTIyLDE3NC4zNTNMMjQxLjA5LDE3Ni40NjdaTTU1MC41MTgsMTc0LjcyMkw1NTEuODk0LDE3OS42MTFMNTYyLjMyNiwxODEuMTE2TDU2Ni4wMDYsMTg4LjcyOUw1NTkuMjA2LDE5MS45NzFMNTU4LjkzNCwxODcuNzY2TDUzNi41OTcsMTg4LjQyOEw1NDcuODI5LDE3Mi4wNTlaTTIxMC4xNzgsMTU5LjgyTDIxMC4xNzgsMTU5LjgyTDIxMC4xNzgsMTU5LjgyWk0xNDM4LjQzLDE3NC40NThMMTQ0Mi45MSwxODIuMzI3TDE0MzYuMzM0LDE4MC44NkwxNDMzLjU5OCwxODcuMjg0TDE0MzcuOTM0LDE5MS44MzVMMTQzMS41MTgsMTk1LjcwMkwxNDMxLjkxOCwxNzMuNTQ4TDE0MjkuNjk0LDE2My4wOTlMMTQzMy44MDYsMTYxLjA2MVpNNzY5LjgzMiwxNjcuNzMzTDc1NS42NTYsMTY5LjY4OUw3NTYuOTM2LDE2MC41MjdMNzY2LjM0NCwxNTQuOTY4TDc3NC44NCwxNTcuNTMzWk04NTYuMzkzLDE1Mi44NDZMODUzLjczNywxNTYuNDQyTDg0OC40NTYsMTUyLjA4NlpNMTE5Ljk2OSwxNDYuMTUxTDExOS45NjksMTQ2LjE1MUwxMTkuOTY5LDE0Ni4xNTFaTTc4Ni42NDgsMTM5LjQwNEw3ODEuODk2LDE0NC4yMUw3OTEuMjg4LDE0My42MjRMNzg2LjEzNiwxNTEuMjI5TDc5MC43MjgsMTUxLjUxNUw4MDIuMDg4LDE2NC43NTRMODA3LjQ4LDE2NS42MDRMODAyLjQ0LDE3NC4zNzZMNzc0LjMyOCwxNzcuMDY5TDc4MC44NCwxNzIuMzk3TDc3OS42NCwxNjIuMjQyTDc4Ni4yNjQsMTYyLjY0OEw3ODMuODY0LDE1Ny4yNjlMNzc1LjE3NiwxNTQuMTdMNzcyLjY2NCwxNDcuNjI2TDc3Ny43MzYsMTM5LjQxOVpNNjQuMDk3LDEzMy43MzJMNjQuMDk3LDEzMy43MzJMNjQuMDk3LDEzMy43MzJaTTQ0Ny43LDEyMy43NDJMNDQ3LjcsMTIzLjc0Mkw0NDcuNywxMjMuNzQyWk00MzYuMDA0LDEyMS4yODJMNDM2LjAwNCwxMjEuMjgyTDQzNi4wMDQsMTIxLjI4MlpNMzYuNzUyLDExNi41MkwzNi43NTIsMTE2LjUyTDM2Ljc1MiwxMTYuNTJaTTQyMS41MDgsMTA4LjE5M0w0NDMuOTg4LDExNi43NzZMNDMwLjYyOCwxMTUuMTA2TDQxOS44OTIsMTE5Ljc3TDQxNi4yMTIsMTE1LjM5OVpNNzM1LjUxMSwxMDQuNjQyTDczOS41MTEsMTEwLjU0N0w3MzMuNzM1LDExMy45NEw3MTcuMDc5LDExNy43OTJMNjk4LjgzOSwxMTUuNzNMNzAzLjIwNywxMTMuNzY3TDY5My41MjcsMTExLjU5M0w3MDEuMjA3LDEwOS40MjZMNjkxLjg3OSwxMDguMzk2TDcwMS42MjMsMTA0Ljg0NUw3MDguNTUxLDEwNy44NTRaTTQ2Mi44MjEsMTAxLjU1OEw0NTguNjEzLDk3LjEyTDQ2Ni4xNjUsOTcuNzI5Wk0xMDE4LjI2NiwyMTYuNTI0TDEwMjAuNTIyLDIxOS42NzZMMTAxNy4xNDYsMjI3LjQ4NEwxMDE4LjY2NiwyMzIuOTY4TDEwMjUuOTYyLDIzNi4xMkwxMDM5LjIyNiwyMzUuNzE0TDEwMzkuNDY2LDIyNi44ODNMMTAzNS4xNzgsMjE4LjMyOUwxMDQzLjI3NCwyMTcuOTk4TDEwMzguNzYyLDIxMi43ODVMMTAyOC4xODYsMjA4LjI5NEwxMDIzLjU3OCwyMDEuNzM1TDEwMzUuNzM4LDE5OC44NDZMMTAzNS43MzgsMTkxLjc2OEwxMDI3LjUxNCwxOTAuODk1TDEwMTEuODk4LDE5Ny4xNDZMMTAwNy40ODIsMjAxLjczNVpNMTYwMCwxMTEuMjAyTDE1OTkuOTY4LDExMS4yMjRMMTU4OC40OTYsMTEyLjg0OUwxNTk3LjIsMTIwLjA3OEwxNTcxLjkwNCwxMjUuOTkxTDE1NTcuMDI0LDEzMy44NkwxNTUwLjY3MiwxMzAuNzgzTDE1MzkuMDg3LDEzNC4yNzNMMTUyNi44NDcsMTMzLjkyTDE1MjAuMDc5LDE0MS4xNDFMMTUyNS4yOTUsMTQzLjkzMkwxNTIwLjUyNywxNTYuMjAxTDE1MTIuNzUxLDE1OC40NjZMMTUxMS4yMTUsMTYzLjU0M0wxNTA0LjU3NSwxNjQuNjI2TDE0OTYuODQ3LDE3My4yODVMMTQ5MC44MTUsMTUzLjg2MkwxNDk2Ljk0MywxNDIuOTY5TDE1MDMuODM5LDE0MS45NzZMMTUyNy40MjMsMTI4LjI2M0wxNTMwLjk5MSwxMjEuOTk3TDE1MTEuNjQ3LDEzMC45MTFMMTUwOC4wMTUsMTI1LjQ0OUwxNDk2LjU0MywxMjYuOTYxTDE0ODUuNDA3LDEzNC40MDlMMTQ4OS4wODcsMTM3LjEzMkwxNDcyLjI4NywxMzguNzQ5TDE0NzIuNjA3LDEzNS41MzdMMTQ2MC4yMDcsMTM3LjA0OUwxNDQ2LjYwNiwxMzYuMjgyTDE0MzEuOTk4LDEzNy41OThMMTQwMC41NTgsMTU2Ljc1OEwxNDE0LjA2MiwxNjEuMDkxTDE0MjEuNzksMTU5LjE1OEwxNDI4LjIwNiwxNjQuMDQ3TDE0MjIuNDk0LDE4NC42ODFMMTQxNC4zMDIsMTk0LjE5TDEzOTkuNDIyLDIwNy4xMjFMMTM4Ny45MDIsMjA3LjYyNUwxMzc2LjMwMiwyMTUuMTFMMTM3Ni40NjIsMjE4LjI5OUwxMzY2LjgxNCwyMjMuMzAyTDEzNzUuMzc0LDIzNi41MTFMMTM3My43NDIsMjQ0LjA3OUwxMzYyLjE1OCwyNDcuMTU2TDEzNjAuNzgyLDIzMi4yMjRMMTM1NC4yNywyMzAuNjI5TDEzNTcuMjc4LDIyNC45NDJMMTM1Mi4yODYsMjIyLjU0MkwxMzM4LjAxMywyMjcuMTIzTDEzNDAuNjIxLDIxOC4wMTRMMTMyMi4zNjUsMjI3LjgzTDEzMzIuMDEzLDIzNC44NTZMMTMzNi45ODksMjMxLjY4OUwxMzQ0LjU0MSwyMzUuODY0TDEzMzguMjM3LDIzNy4xMDZMMTMyOS41NjUsMjQ0Ljg0NkwxMzM0LjM0OSwyNDcuMjg0TDEzNDEuODIxLDI1OS4xNDZMMTM0Mi42MzcsMjY3LjQxNEwxMzI3LjM1NywyOTAuODk5TDEzMTUuMDY5LDI5OC43NDVMMTMwNS44MDUsMjk5Ljc4M0wxMjkyLjM4MSwzMDQuODk4TDEyODIuMzE3LDMwMy40ODRMMTI3NC4yODUsMzA4LjAxM0wxMjY5LjYxMywzMTUuMjk0TDEyODMuOTAxLDMzMi4xMDdMMTI4NS4zNDEsMzQ4LjE0NUwxMjY3LjM3MywzNjEuNzc2TDEyNjcuMDA1LDM1NS45MTZMMTI1OS45ODEsMzUyLjc0MUwxMjU1LjkzMywzNDUuODM2TDEyNDQuODc2LDM0MC40MTJMMTI0MC42ODQsMzU1LjcyTDEyNDYuNDkyLDM2Ni45ODFMMTI1OS40NjksMzc4LjQyM0wxMjYwLjA5MywzOTQuNTUxTDEyNTAuNjIxLDM4Ny43MjhMMTI0Mi4zMTYsMzY3LjM2NUwxMjM2LjIyLDM2Mi44ODlMMTIzOC45NTYsMzQ5LjE1M0wxMjMxLjgzNiwzMjQuNzU4TDEyMjMuODY4LDMzMC4xNTlMMTIxOC42MiwzMjguNzIyTDEyMTkuMjI4LDMxOS4wNDhMMTIwOS4yNiwzMDUuODA4TDEyMDYuMywyOTguODJMMTIwMS4yMTIsMzAyLjk1TDExODYuNTU2LDMwNC40NjJMMTE4NC40NDQsMzEwLjQzNUwxMTc4LjA0NCwzMTMuNDI5TDExNTcuMDA0LDMyOS4zMzlMMTE1NC45MjQsMzUzLjk2N0wxMTQ0LjYxOSwzNjQuNTk3TDExNDAuNDExLDM2MC40NDRMMTEyNi44MTEsMzI4LjkzM0wxMTIyLjc5NSwzMDUuMDg2TDExMTMuMTk1LDMwNy4yMTVMMTEwOS41MzEsMzAwLjIxOUwxMDk5Ljc1NSwyOTMuNTc3TDEwOTQuOTg3LDI4Ny4wMDJMMTA3My4zMjMsMjg4LjU0NEwxMDU1LjA5OSwyODUuNjAzTDEwNTEuMDgzLDI3OS4zNTlMMTA0My4xNzgsMjgyLjMwOEwxMDI4Ljk4NiwyNzYuMTU1TDEwMjIuNzMsMjY2LjAwN0wxMDEzLjIyNiwyNjYuNzc0TDEwMTYuOTIyLDI3Ni45MzdMMTAyNS41MywyODYuNzQ2TDEwMjkuMjksMjg1LjMzMkwxMDMwLjIwMiwyOTMuMjQ2TDEwNDAuMDQyLDI5Mi43OTVMMTA1MC40OTEsMjgyLjY4NEwxMDUwLjY1MSwyODkuMjIxTDEwNjEuMDE5LDI5NS4yNjJMMTA2NS44MDMsMzAwLjg0NEwxMDU2Ljg0MywzMTUuMjU3TDEwNDUuNjU4LDMyMy40MzRMMTAzMi44MjYsMzI3LjE4N0wxMDMxLjg2NiwzMzAuNjc4TDEwMTYuMzQ2LDMzNy43NjRMOTkzLjI1OCwzNDMuODM1TDk4OS41NjIsMzI1LjQ0Mkw5ODEuOTQ2LDMxMy4zOTFMOTczLjk0NiwzMDUuMzcyTDk3My42MjYsMjk5LjY0OEw5NTYuMTM4LDI3NS4yNzVMOTU1LjM1NCwyNjkuNTI3TDk1MC43NjIsMjc3LjExOEw5NDUuNDgxLDI3Mi40MjRMOTYzLjg1LDMwMi4yMkw5NjYuNTg2LDMxNy4yNzNMOTc0LjUyMiwzMjkuMjMzTDk5Mi41MjIsMzQ0LjkzM0w5ODkuODUsMzQ3Ljg0NEw5OTYuMDc0LDM1My41NzZMMTAyNy4xNjIsMzQ2LjU1OEwxMDI2Ljg3NCwzNTIuNzA0TDEwMTkuNzg2LDM2OS43NTdMMTAwNi45NTQsMzg3LjMwN0w5OTEuNzIyLDM5OC43MDRMOTc4Ljk1NCw0MTEuNDM5TDk3Mi40NDIsNDI4Ljc3OEw5NzQuMTcsNDM3LjcxNUw5NzkuODk4LDQ0Ny44NDhMOTgxLjIyNiw0NjUuM0w5NzUuMzM4LDQ3NC4zMTJMOTY2LjI2Niw0NzguMTY0TDk1NC42MDIsNDg3LjkyOEw5NTguMDU4LDQ5OC4xODFMOTU1LjczOCw1MDguNzk1TDk0Ni43MjksNTEyLjY5OUw5NDQuMjgxLDUyNS43ODFMOTI1LjQxNyw1NDUuNjU1TDkxNC41ODUsNTUwLjg2OEw5MDAuMzI5LDU1MC41MDdMODg3LjE3Nyw1NTQuNzVMODgxLjA4MSw1NTAuNTIyTDg4MC45ODUsNTQwLjcyMUw4NjcuNjA5LDUyMC40MDJMODYzLjM2OSw0OTguMjcxTDg1Mi40MjUsNDgwLjMwN0w4NTEuNzM3LDQ3NC4xMDFMODU2LjYxNyw0NTguMzg3TDg2MC42MDEsNDUzLjUwNUw4NTguODI1LDQzOC4wNTRMODUyLjk1Myw0MjIuMzkyTDgzOS4wOTYsNDA0Ljk0TDg0My41MjgsMzg2LjMzN0w4MzcuNzg0LDM3OC43OTJMODI2LjIxNiwzODEuMDU2TDgxOS4yMjQsMzcyLjEyN0w4MDQuNzEyLDM3My42NDZMNzkxLjI3MiwzNzkuMDYyTDc4Mi4xODQsMzc2Ljk3OUw3NjYuNTg0LDM4MC43MTdMNzU5Ljk3NiwzNzguNTIxTDc0Mi40NTUsMzY1LjM0MUw3MzQuMDM5LDM1MS42NThMNzI2LjE2NywzNDUuOTExTDcyMS42NzEsMzM0LjUzN0w3MjYuODIzLDMyOC4yODZMNzI3LjY1NSwzMTAuNjk4TDcyNC4xNjcsMzA2LjY2Nkw3MjguOTY3LDI5NC41NjJMNzM1LjgxNSwyODMuMzE2TDc0My45MTEsMjc1LjM4OEw3NDguMDU1LDI3NC44OTFMNzU3LjQ5NiwyNjYuOTYyTDc1Ni4zNzYsMjYxLjQzM0w3NjEuNTI4LDI1Mi4yNjNMNzY5LjI3MiwyNDguMzk3TDc3My42NCwyNDEuMDdMNzkwLjM2LDI0My42OTVMODA2LjUyLDIzNy4zMDlMODQyLjI2NCwyMzMuOTk5TDg0Ny4xMTIsMjM4LjE3NEw4NDUuMTEyLDI0Ny40MTlMODQ5LjM2OCwyNTIuMDNMODY3Ljc1MywyNTYuNTk2TDg2OS44MzMsMjYwLjU1M0w4ODQuODI1LDI2NS40OEw4OTIuNjgxLDI1NC42MzNMOTI4LjUwNSwyNjIuODAyTDkzMy43NTMsMjYwLjExN0w5NTIuMjk4LDI2MS4yNDVMOTU5Ljk5NCwyNDYuMDJMOTYwLjY2NiwyNDAuNzkyTDk1NC4yODIsMjM2LjQ2Nkw5NDQuNDg5LDIzOS41Mkw5MzYuMDg5LDIzNi45ODVMOTMxLjk5MywyMzkuMzYyTDkyMi44NTcsMjM3LjA2OEw5MTYuOTY5LDIzMC4xODVMOTE2LjMxMywyMjQuNjAzTDkyOS45NjEsMjE2LjgwMkw5MzguNDI1LDIxNy4zODlMOTQ4Ljk1MywyMTMuMjUyTDk1Ni4yOTgsMjEzLjE1NEw5NzAuNDQyLDIxOC4wMDZMOTg0LjY4MiwyMTUuMzk2TDk4NC4yMzQsMjEwLjQ2OEw5NjMuMDAyLDE5OC45MTRMOTczLjg2NiwxODkuOTRMOTU5LjIxLDE5Mi42ODVMOTU1LjY0MiwxOTcuMTA5TDk2Mi4zNjIsMTk3LjkxM0w5NTAuNTg2LDIwMi44NDFMOTQ0LjIzMywxOTguNTQ1TDk0OS4yNzMsMTk2LjIxM0w5MzYuNjY1LDE5Mi45NjRMOTI4LjE2OSwyMDAuMzgxTDkyMy4wMDEsMjEwLjc2Mkw5MjguMDI1LDIxNy41MzJMOTE3LjE0NSwyMjEuNTQ5TDkxNS44MDEsMjE4LjU2M0w5MDEuNDAxLDIyMC4xMDVMOTAyLjEwNSwyMjYuOEw5MDYuNzc3LDIzMC4xMzJMODk2LjMxMywyMzYuMjQxTDg5My44NjUsMjI5LjczNEw4ODYuMjQ5LDIyMS4xMDVMODg2Ljg0MSwyMTQuNTc2TDg3MS4xNzcsMjA2LjYzMkw4NjYuMjMzLDE5OS42NTlMODU4LjQwOSwxOTYuNzI1TDg1NS45NDUsMjA0LjAzN0w4NzAuNjE3LDIxNS4zNzNMODgxLjY3MywyMjAuNjM5TDg3NC45NjksMjIwLjI1NUw4NzYuMzEzLDIyNC43NzZMODcxLjU2MSwyMzEuMTdMODY4LjUwNSwyMjIuMDA4TDg1Ny4yNzMsMjE2LjY1Mkw4MzkuNTEyLDIwMi44MThMODI5LjAxNiwyMDguMzE3TDgxMy43ODQsMjA4LjU1OEw4MTMuNTEyLDIxMy44MTZMODAzLjYwOCwyMTcuNzEzTDgwMC40ODgsMjI3LjgzTDc5MC40NTYsMjM3LjAwOEw3ODAuNTg0LDIzNi45ODVMNzc2LjEwNCwyNDAuMjM1TDc3MS4wMTYsMjM1LjgxMkw3NjAuNDU2LDIzNi4xMzVMNzU3LjY1NiwyMjcuODNMNzYxLjAzMiwyMTguODQxTDc1OC4yNDgsMjA4Ljc2OEw3NjQuNTM2LDIwNS41NjRMNzkxLjU0NCwyMDcuMDA4TDc5NC42OTYsMTk1LjQ5MUw3NzkuNTkyLDE4My42MjhMNzkyLjgwOCwxODMuODAxTDgwNS45NDQsMTc3LjIxMkw4MDcuMjg4LDE3My41NzFMODE3LjAxNiwxNzAuNTc3TDgyMC45MiwxNjQuMDMyTDgzOS4xMTIsMTU5LjkxTDgzNi4wODgsMTUzLjI1Mkw4MzcuOTc2LDE0Ni4xNzRMODQ3LjAxNiwxNDMuNDIxTDg0OC41MDQsMTQ5LjA3TDg0Mi44ODgsMTUzLjQ2M0w4NDguNjE2LDE1OS45NjNMODU1LjY0MSwxNTcuOTA5TDg2Mi43NjEsMTYxLjA4M0w4NzguMzI5LDE1Ni4yMTZMODg3LjM4NSwxNTguMTA0TDg5NC41MjEsMTU0LjcxMkw4OTMuNzM3LDE0Ny42MjZMOTAwLjEwNSwxNDMuMzE1TDkwNy4yMDksMTQ2LjU1TDkwOC41NjksMTQwLjUxN0w5MDMuNzM3LDEzNi45NDRMOTI0LjM2MSwxMzUuNjY1TDkyNC43NjEsMTMxLjA5OUw5MDEuNjQxLDEzNC4wMTdMODk0Ljc2MSwxMzAuMTI4TDg5My41OTMsMTIxLjc0MUw4OTkuNzUzLDExNi4zNjJMOTEyLjg3MywxMTAuNjE1TDkwNi4yMzMsMTA2LjYzNkw4OTguNTg1LDEwNy44OTJMODk0Ljk2OSwxMTMuNzE0TDg3OS4zMjEsMTIxLjExNkw4NzYuMDg5LDEyNy4zNzVMODgzLjQ5NywxMzIuOTcyTDg3NC43OTMsMTM5LjAyTDg3MC41ODUsMTUwLjY1TDg1Ny41MjksMTUzLjk0NUw4NDYuMDI0LDEzNS42ODdMODM3LjI1NiwxNDAuODMzTDgyNS4xNzYsMTM5LjYwN0w4MjIuMTg0LDEyNC41NjlMODQ2Ljc5MiwxMTMuMzk4TDg2NS42MDksOTguNjE3TDg4NS4yNTcsODkuNzAzTDkwMi4zMjksODcuOTg3TDkwOS4wOTcsODQuMzA5TDkyNS4xNzcsODMuNjE3TDkzOS4wODEsODYuODc0TDkzMy4zNTMsODguMDYzTDk1MC4xMDYsOTEuOTk3TDk2Mi4yODIsOTMuMDVMOTc5LjA4Miw5OC4wNzVMOTgyLjc3OCwxMDMuMTQ1TDk3MC41ODYsMTA2LjY2Nkw5NTAuNzQ2LDEwMy4yODhMOTU1LjMwNiwxMTMuNzE0TDk2NC41MDYsMTE2LjIxOUw5NjUuMjI2LDExMC40NzJMOTc1Ljk3OCwxMTMuMjRMOTc2LjczLDEwOC45TDk4Ny4wODIsMTA0LjU1Mkw5OTUuMzM4LDEwNi4zNTdMOTk3LjkxNCwxMDMuMzAzTDk5My4xMyw5NS4yMzlMMTAwNS41NjIsOTYuNjY4TDEwMDUuOTk0LDEwMy43MDJMMTAxMy45NDYsOTkuOTAzTDEwMzguNzQ2LDkzLjk2OEwxMDM3LjcyMiw5Ni44ODdMMTA2MS4zMzksOTMuODYyTDEwNjYuNDExLDk2LjU0TDEwNjkuMTE1LDg5LjU1MkwxMDgyLjIzNSw5MC44OTlMMTEwNC40OTEsOTcuMzY4TDExMDcuNDY3LDk1LjA0NEwxMDk2LjQyNyw4NC4zMTZMMTExMC44NDMsNzUuMzhMMTEyMi42MDMsNzYuNTUzTDExMTkuMzIzLDgyLjYyNEwxMTIzLjUxNSw4Ny4xNTJMMTEyMi41MDcsOTMuMjM4TDExMjcuNDE5LDk1Ljk2MUwxMTE2Ljc5NSwxMDUuMjQ0TDExMjEuODgzLDEwNS44OThMMTEzMy41NjMsOTguODQyTDExMzMuMDUxLDkzLjM4MUwxMTI3LjExNSw5MC41NDVMMTEzMC42NjcsODYuMDc3TDExMjQuODkxLDgyLjQ1OEwxMTU0LjAxMiw3OC41NzdMMTE2Mi4yMiw4MS4xMTJMMTE1Ny44Miw3Mi42NzJMMTE4NS44ODQsNzEuMzkzTDExODcuNDA0LDY2LjE1TDEyMTQuMzgsNjIuMDEyTDEyMjkuNjc2LDYyLjU5OUwxMjQ3LjgyLDYwLjMxMkwxMjUzLjI5Myw1Ni40OThMMTI2My43ODksNTQuNjc4TDEyNjUuMzU3LDU3LjIxM0wxMjkzLjY3Nyw1OS4wNjNMMTMwNy4yNjEsNjIuOUwxMzA2LjE1Nyw2NS4yMDlMMTI4Ni4yMjEsNzAuMzFMMTMwNC41NzMsNzQuMDYzTDEzMTMuNjI5LDcyLjIxM0wxMzI3LjkwMSw3Mi45NDJMMTMyOC45NzMsNzUuMDE5TDEzNDcuNTY1LDc1LjY4MUwxMzQ3LjgwNSw3Mi4yODhMMTM2NC4zMzQsNzMuMDRMMTM3MS41MTgsNzUuMzg3TDEzNzAuOTI2LDgwLjA4OUwxMzgzLjUwMiw4NS4zOTJMMTM4Ny43OSw4MC43MjhMMTQyMS42NDYsODIuMjc4TDE0MTguNDMsNzguMTQ4TDE0MjQuMzAyLDc2LjIyMkwxNDY0LjQ0Nyw3OS4xMTFMMTQ3OS44NTUsODUuMTQ0TDE1MDYuNjU1LDg1LjAzOUwxNTE1LjI5NSw5MS4zODhMMTU0NS45MzUsOTAuNzQxTDE1NTMuNjgsOTQuNjk3TDE1NTkuMTg0LDkzLjI3NkwxNTU3LjU2OCw4OC40NTRMMTU4MC45OTIsODkuNDMyTDE1OTMuNzc2LDkxLjU1M0wxNjAwLDkzLjQ5NEwxNjAwLDExMS4yMDJaTTAsOTMuNDk0TDAuMDAxLDkzLjQ5NEwwLDkzLjQ5NEwyNC4xMjgsMTAxLjk0OUwzNi4xOTIsMTAyLjYxMUw0NC44OTYsMTA2Ljc3MUwzMy4yLDEwOS4xNjNMMjcuMTUyLDExNC4zMDFMMTYuODY0LDEwOS41MjRMMC41MTIsMTA3LjIyMkwwLDExMS4yMDJMMCwxMTEuMjAyTDAsOTMuNDk0Wk0zNzQuOSw5Mi44NTRMMzcyLjEzMiw5NC40MTJMMzU2LjQ1Miw5MS41NTNMMzYzLjQ3Niw4OC4yNTFaTTE2MDAsODMuNjQzTDE1OTkuOTk5LDg1LjE4OUwxNTk0LjMzNiw4NC4wMDhMMTYwMCw4Mi4xNUwxNjAwLDgzLjY0M1pNMCw4Mi4xNUwwLjAwMSw4Mi4xNUwwLDgyLjE1TDAsODMuNjQzTDAsODIuMTVaTTAsODIuMTVMMTAuNzY4LDgzLjI0OEwwLDg1LjE4OVpNMzk3LjU3Miw5MS4xMjRMNDAzLjQ5Miw5Mi4xODVMNDExLjc4LDEwMS4zNEw0MTkuNjUyLDk0LjI5MUw0MTkuOTA4LDg5LjQxN0w0MzguNzU2LDkyLjYxNEw0MzguMjc2LDEwMS43MzFMNDI5LjU3MiwxMDQuODM4TDQxOC44MDQsMTA0LjE4M0w0MTEuODkyLDExMi4xMDVMNDAwLjM4OCwxMTUuNDA3TDM4MS4xNTYsMTI5LjMzOUwzNzkuMTg4LDEzOC4wMDRMMzg1LjcxNiwxMzguNzQ5TDM4OS43OTYsMTQ2LjI3OUw0MDQuMjc2LDE0Ny4zMjVMNDIyLjE2NCwxNTQuMjA4TDQzNC4zNCwxNTQuOUw0MzguMjEyLDE2OC4xODVMNDQ0LjgzNiwxNzIuNDA1TDQ1MC42NjEsMTY2LjM5NEw0NDUuMjA0LDE1Ny4wMjlMNDUyLjMyNSwxNTQuOTUzTDQ1OS44MTMsMTQ4LjczOUw0NTEuMDI5LDEzOC42NDRMNDU2LjI3NywxMzMuOTg3TDQ1Mi44NTMsMTIzLjAyN0w0NzEuODI5LDEyMi40N0w0ODIuNzg5LDEyOC4yNzhMNDkwLjcwOSwxMjguNjE2TDQ5Mi4wNTMsMTM3Ljk2N0w0OTkuMzMzLDE0MS4yNzdMNTEyLjk2NSwxMzEuODQzTDUyNy4xMjUsMTQ2LjgxM0w1MjUuMzMzLDE0OS42MDRMNTQ1LjE4OSwxNTcuMjE3TDU1Mi4xOTgsMTYzLjI0Mkw1NTIuNTE4LDE2OC4yMzdMNTMzLjE4OSwxNzYuN0w1MDQuOTAxLDE3Ni43Nkw0OTUuNTA5LDE4MS45MjFMNDgzLjk3MywxOTEuOTAzTDUwNC4yMTMsMTgxLjYyN0w1MTQuNzg5LDE4My4zNjVMNTEwLjU5NywxODYuMzUxTDUxMy40NjEsMTk0LjQ5OEw1MjYuNTgxLDE5Ni4wN0w1MzEuMDI5LDE5MS4wNzZMNTM0LjIxMywxOTUuOTEyTDUwOS40OTMsMjA2LjQ2N0w1MDIuMzczLDIwMC44NDdMNDg4LjM3MywyMDUuODVMNDg1LjI2OSwyMDkuNDkxTDQ4OS4wNDUsMjE0Ljk0NEw0NzYuMTAxLDIxNi43OTVMNDYzLjQ2MSwyMzEuMzg5TDQ1OS44MTMsMjI3LjkyMUw0NjMuNDI5LDI0MS45OTVMNDUwLjg2OSwyNDkuNTAzTDQzOC41LDI2MC4yNjdMNDM3LjgxMiwyNjMuNDE5TDQ0NC4xOTYsMjgwLjUzM0w0MzkuMjM2LDI4Ny45OTVMNDI3Ljk1NiwyNjYuOTQ3TDQyMS43MzIsMjY4LjI4Nkw0MTYuMDA0LDI2NC44ODZMNDAxLjc0OCwyNjUuODg3TDQwMi42MjgsMjcwLjRMMzkyLjc3MiwyNjguMDk4TDM3OS4xNTYsMjY4Ljk3OEwzNjcuMjUyLDI3OC4zMTRMMzY4LjI2LDI4NS4wMzlMMzY1LjAxMiwzMDAuMjQ5TDM3My43OCwzMTYuMzE3TDM4MC4zMjQsMzE5LjM1NkwzOTYuNTY0LDMxNC4yOTRMMzk4Ljc1NiwzMDYuNjY2TDQxMy4xMDgsMzA0LjI1MUw0MDcuMzE2LDMyNi41MzNMNDA0Ljc1NiwzMjkuMzkxTDQyNS4wMjgsMzI5LjYyNUw0MzAuNDUyLDMzMy4zNDhMNDI3LjMxNiwzNDkuNDU0TDQzOC4wNTIsMzYwLjk0OEw0NDYuMzQsMzU3LjI4NUw0NTguNTAxLDM2MS42MDNMNDY0LjUzMywzNTIuODAxTDQ3My43MTcsMzUwLjEwMUw0ODEuMDkzLDM0NC43MjJMNDgyLjY2MSwzNTEuMjUyTDQ5My44NjEsMzQ5LjEzOEw0OTYuOTE3LDM1My4wODdMNTI0Ljk4MSwzNTIuMzczTDUyMi43MjUsMzU1Ljc4OEw1MzcuMzMzLDM2NC40NDZMNTQ2LjAwNSwzNzMuNDUxTDU1NS40MTQsMzczLjIxN0w1NjQuOTY2LDM3NS45NTZMNTcxLjkyNiwzODEuMzE5TDU3OC4wMDYsMzk1LjM0OUw1NzYuMDU0LDQwMC4zNTFMNTgzLjkxLDQwMS4wNDNMNjAwLjQyMiw0MDYuODk2TDYwMS44NjIsNDExLjk1OEw2MDcuMDMsNDEwLjU4OUw2MjIuMzEsNDEyLjc3MUw2MzQuNTY2LDQyMS40MjlMNjQzLjM5OCw0MjQuMjg4TDY0NS42MzgsNDMyLjYzN0w2NDMuODc4LDQzOS45ODdMNjI2Ljg3LDQ2MS4zMDZMNjI3LjE5LDQ2OS42MzNMNjIzLjI4Niw0ODcuMTA4TDYxMy4zODIsNTAyLjA5M0w1OTMuNDYyLDUwNy4wNjVMNTg0LjQ3LDUxNS4wMDlMNTgyLjcyNiw1MjcuNDQzTDU2Ny43NSw1NDMuMzE2TDU2MC44NTQsNTUyLjg3N0w1NTUuODQ2LDU1NS4zNDRMNTQwLjAyMSw1NTMuMDI3TDU0NS42NjksNTU2LjgzNEw1NDcuNjA1LDU2NC4wMUw1MzYuNzQxLDU3Mi4wODlMNTIyLjk0OSw1NzIuNTcxTDUyMy43OTcsNTgwLjc4NUw1MTAuNTgxLDU4Mi41MDhMNTExLjIwNSw1ODYuOTI0TDUxNy45NTcsNTg5LjE3M0w1MTAuMzA5LDU5My4zMUw1MDguNTk3LDYwMC4xNjNMNDk5LjYzNyw2MDUuNzgyTDUwOC4yNjEsNjA5LjkzNUw0OTguNTk3LDYyMS42NEw0OTIuNzI1LDYyNS40NzZMNDk3LjEwOSw2MzIuNjY4TDQ4NS4xNDEsNjM1LjEwNUw0ODQuNDIxLDYzOS4yNThMNDY2LjkwMSw2MzIuMjc3TDQ2My45NTcsNjE2LjMyOUw0NzAuNTQ5LDYwOC42MThMNDYzLjc5Nyw2MDcuMzI1TDQ2OS41NDEsNTk2LjAxMUw0NzQuNDg1LDU5Ny41NzVMNDc2LjgwNSw1ODguMzY4TDQ2OS42MzcsNTkyLjExNEw0NzQuODIxLDU2NC45OTZMNDgyLjUwMSw1NDQuMDgzTDQ4Mi4yNjEsNTI4LjI3MUw0ODQuODY5LDUyMi44NDdMNDg4LjQ4NSw0OTUuMDgyTDQ4Ny4yMzcsNDgxLjU0OUw0ODIuMzg5LDQ3Ny4xNzFMNDYyLjE4MSw0NjUuMTA1TDQ0NS41MDgsNDMxLjk3Nkw0MzguODg0LDQyNy4yNzRMNDM4LjE4LDQyMS4wNTNMNDQ1LjQ2LDQxMS44MDhMNDQwLjE0OCw0MDkuOTg3TDQ0NC4wMzYsMzk2LjU4Mkw0NDkuNTI0LDM5My44NTlMNDU3LjIwNSwzODIuODkxTDQ1NS42NTMsMzcwLjI2MUw0NDguMzU2LDM2MC4wMTVMNDQ0LjQyLDM2Ni40NTVMNDMxLjI2OCwzNjMuNDQ2TDQxOC42NzYsMzU0Ljk1M0w0MTkuMDYsMzUwLjcxOEw0MTAuMzU2LDM0Mi42MjNMMzk0LjUxNiwzMzguMDk1TDM3OS4xNTYsMzI3Ljk5MkwzNzAuODUyLDMzMC40M0wzNDAuMDAzLDMxOC43MDJMMzMwLjA4MywzMDkuMTc5TDMyOC43NTUsMjk4Ljc4MkwzMTQuMjU5LDI4Mi40NzRMMzAxLjIwMywyNzEuMzFMMjk3LjEyMywyNjEuNDYzTDI4OS44NzUsMjU4LjY2NUwyOTAuMzM5LDI2NS45NDdMMzAzLjkyMywyODEuNDk2TDMxMy43MzEsMjk2LjE1N0wzMDEuNDExLDI5MC4wNDlMMzAwLjg4MywyODQuMzkyTDI5MS4yNjcsMjc5LjM2N0wyOTIuNjExLDI3My4wNEwyODYuNTc5LDI2OC42NEwyNzguNjkxLDI1My4xMjhMMjY1LjAyNywyNDYuOUwyNTAuMDk5LDIyNi44ODNMMjQ3LjEyMiwyMjAuODI3TDI0Ni41MTQsMjA5LjkyN0wyNDkuMzMsMTk3LjY3M0wyNDYuMzcsMTg0Ljk4MkwyNTIuODAzLDE4Ni40ODdMMjUzLjQ0MywxODIuMjE0TDI0MS42NjYsMTc1LjkyNUwyMzMuNjE4LDE3NC4wODJMMjMxLjc3OCwxNjcuNDI1TDIyNi4wODIsMTY1LjUyOUwyMTkuODQyLDE1Ni40MzRMMjA0LjA5OCwxNDEuNjc1TDE5Mi43NywxNDEuMjc3TDE3OC4zNywxMzUuMzg3TDE2MC4xNzgsMTMzLjMzM0wxNDYuMTYxLDEyOS4zOTlMMTQyLjE0NSwxMzMuNDMxTDEyNS43MTMsMTM3LjA4N0wxMjcuMDczLDEzMC4xMDZMMTE1LjQ3MywxMzYuMjIyTDExOC43MjEsMTM4LjM4MUw5NS44NTcsMTUxLjEzOUw3NS4yNDksMTU2LjkzMUw2Ni45MjksMTU3LjQ1OEw4Ni4zODUsMTUxLjA3OEw5OS4wMDksMTQ0LjEzNUwxMDIuMDMzLDEzOC4xNEw5My4wNzMsMTQwLjMzNkw4Ny4zMTMsMTM3LjQ2M0w4MC4xNDUsMTM5LjIzOEw4MC41NjEsMTM0Ljk1OEw3MS45MjEsMTM0LjIyOEw2MS42ODEsMTI2LjY2OEw2OC42MDksMTE5LjM0OUw4NS40NTcsMTE2LjU5NUw4NS40MjUsMTEyLjA1Mkw2Ni44NDksMTEzLjU3MUw1Mi44NDksMTA4LjEzM0w2OS4wMDksMTA0LjEwMUw4MS40MjUsMTA2LjE1NEw2NC45MjksOTcuNTg2TDYxLjMxMyw5My44NTVMNjkuMjAxLDkzLjcxMkw4MC40MDEsODcuNDA4TDEwNC4wODEsODIuODU3TDEyMy4yNDksODYuMjJMMTU1LjkwNiw4OC45MzVMMTYxLjgyNiw4OC4yMTNMMTkzLjMxNCw5My43ODdMMjMwLjQ5OCw4Ni43MzlMMjQxLjA5LDkxLjJMMjU0LjczOSw4OS41M0wyOTMuNzk1LDk2LjAwNkwyOTUuNTcxLDk5LjE2NkwzMTEuMzQ3LDk3Ljg2NEwzMjguMjI3LDk0LjIyNEwzMzYuMjc1LDk3LjY5OUwzNDkuMDkxLDk5LjM0NkwzNjIuNDY4LDk4Ljc0NUwzNjEuOTU2LDk1Ljk4NEwzNzkuMTcyLDk3LjQ5NkwzODEuMTg4LDkzLjAyN0wzNzEuMjM2LDg4LjQ5MUwzNzYuODUyLDgwLjM1MkwzODcuMjA0LDgzLjAzWk0yOTIuNTk1LDc1LjAxOUwzMDYuNDM1LDc3Ljk5OEwzMTEuNDU5LDc1LjcyNkwzMTkuMTU1LDgxLjU0OEwzMTguMjQzLDc1LjE1NEwzMzEuNTM5LDc3LjAxMkwzMzUuNzE1LDg0LjQ3NEwzNTEuMjA0LDg4Ljc3N0wzNDMuNDExLDkxLjA5NEwzNDQuNzU1LDk0LjQzNEwzMjkuMDU5LDkyLjUzMUwyOTYuMzg3LDk1LjM5N0wyODMuOTcxLDkyLjU4NEwyNzguNDgzLDg5LjA2M0wzMDAuMzcxLDg3LjI1OEwyNzUuOTcxLDg2LjQ4M0wyODMuOTM5LDgzLjA2OEwyNjkuMzMxLDgxLjk2MkwyNzYuMTQ3LDc2Ljg2MlpNMzM1LjU1NSw3My42ODdMMzMxLjY1MSw3Ni42MjFMMzI0LjcwNyw3My41MTRaTTQ2MC43MDksNzUuMTAxTDQ0Ni43MjQsNzYuNzA0TDQ0Mi44NjgsNzIuMTgzWk00MTUuMjg0LDc0Ljg1M0w0MzQuMTQ4LDcyLjIyTDQ0MS4xMDgsNzkuNzI4TDQ1NC4xMTcsNzYuNjY2TDQ4My41NTcsODQuNzk4TDQ5NC4yNzcsODYuNTU4TDUwMi4zNTcsOTIuNTA4TDQ5NC4xOTcsOTQuNTc3TDUyNS4xMDksMTAyLjgzN0w1MTUuOTI1LDExMS4xMTlMNTAzLjQ2MSwxMDQuOTQzTDQ5Ny4xNTcsMTA4LjA0Mkw1MDkuNjg1LDExMy44NTdMNTExLjA0NSwxMjEuNDQ3TDQ5NC4yOTMsMTE2LjY4Nkw1MDUuOTI1LDEyNC43NUw0OTMuODc3LDEyMi45NzRMNDY3LjQ3NywxMTMuODI3TDQ1NC42MjksMTE0LjUzNEw0NTMuNzk3LDEwOS43MzVMNDcxLjI4NSwxMDkuMDg4TDQ3Ny4xMDksMTAwLjk1Nkw0NzQuMTY1LDk3LjQ2Nkw0NTguMzU3LDkzLjgwMkw0NDkuMDc2LDg4LjE0NUw0MzguNjQ0LDkwLjAzNEw0MDUuODYsODcuMDYyTDM5OS4wOTIsNzguOTUzTDQwNy4wNzYsNzMuMTY4TDQxOC41NDgsNzEuOThaTTM1My45NzIsNzEuODA3TDM2Ny4yMDQsNzIuMTc1TDM2NC4yMTIsNzUuNTk4TDM3MC45MzIsNzcuNTA5TDM3MC4xMzIsODEuNTExTDM2Mi44NTIsODMuMjMzTDM0NC40NTEsNzcuNzM0TDM1My42MDQsNzYuODYyWk0xNDM4LjIzOCw3NC42MTJMMTQyMS42MTQsNzMuOTEzTDE0MzEuMzksNzEuNzQ2Wk0zODUuNzk2LDc2LjU2OEwzNzUuOTU2LDc5LjcyOEwzNzMuMTg4LDc1LjgyNEwzNzkuOTg4LDcwLjUxM0wzOTcuNzMyLDcxLjc0NlpNMjY0LjYyNyw4Mi42NjlMMjUyLjkzMSw4NC44ODFMMjQwLjMyMiw4MC41ODVMMjQ5LjE1NCw3Mi41MzZMMjQ0LjgwMiw2OS44MTNMMjU5LjgyNyw2OS4xMTRMMjc3LjUyMyw3MC4yODdMMjg2LjYxMSw3My40NDZMMjcwLjEzMSw3Ny42ODlaTTE0NjkuOTE5LDY2LjI5M0wxNDY0Ljc4Myw2OC4wNTNMMTQ1MC40NzksNjQuNDU3Wk0zODMuOTQsNjYuNzU5TDM2OS42ODQsNjYuOTg1TDM3OC40MzYsNjMuNzg4Wk0xNDQ0LjgzLDY0LjE2NEwxNDQxLjMyNiw2Ny40NjZMMTQxNy41ODIsNjguMzkxTDE0MDguNzgyLDY1LjUwM0wxNDExLjE2Niw2Mi40NDlMMTQyOC43NjYsNjEuODA5Wk0zNjIuMjI4LDU5LjAyNkwzNjMuNzMyLDY2LjY2OUwzNTEuNjM2LDY2LjQxM0wzNDQuMTQ3LDYwLjcyNlpNMzE5LjA1OSw2MS4zMjhMMzI5LjQxMSw2Mi4zNThMMzI3LjQ5MSw2Ni42NDZMMzAxLjIzNSw2OS4yNTZMMzAzLjEzOSw2NS45NDdMMjc2LjgzNSw2NS42NzZMMjg3LjA5MSw2MC4wOTRMMzE1LjI1MSw2NC41NjJMMzA4Ljg5OSw2MC4zMTJaTTEwNTUuNzA3LDg1LjY4NkwxMDM4LjU3LDg1LjQ5N0wxMDI5LjMzOCw4Mi4zMzhMMTAzNy44MTgsNzIuMjJMMTA0Ny4yNTgsNjYuMzA4TDEwNzEuODY3LDYxLjEwMkwxMTAyLjkyMyw1OC4wNDhMMTEwMy4wMTksNjEuMTg1TDEwNzMuNzA3LDY1LjUxTDEwNTkuODk5LDY5LjczOEwxMDQ2LjMxNCw3OC4zNTFMMTA0Ny4yMSw4Mi4wNDVaTTM3OS4xODgsNTcuMzQxTDM5Mi44NjgsNTguNzYzTDQwMy42Miw2My45NTNMNDM5LjQyOCw2My40OTRMNDQ1LjE4OCw2Ny4wMDdMNDM1Ljc4LDY5LjE0NEw0MDguMjI4LDY5LjM2OUwzODkuMjM2LDY3LjM5MUwzODIuNjkyLDYwLjgwMUwzNjguMzU2LDU4Ljg4M1pNMjgzLjU1NSw1NC45MTFMMjgyLjk0Nyw1OC4zMjZMMjY3LjEwNyw2MS45ODJMMjUzLjk3MSw2MS43MDRMMjcwLjY0Myw1NS40OThaTTM4Mi45MzIsNTUuNDY4TDM4Mi45MzIsNTUuNDY4TDM4Mi45MzIsNTUuNDY4Wk0zMTAuMjc1LDU0LjY3OEwzMTAuMjc1LDU0LjY3OEwzMTAuMjc1LDU0LjY3OFpNOTA5Ljg4MSw1My45ODZMODk5Ljk2MSw1NS43OTlMODkyLjUwNSw1Mi4yMDNMOTAxLjcwNSw1MS4zMDhaTTMxMi42MTEsNTAuNjYxTDMxMi42MTEsNTAuNjYxTDMxMi42MTEsNTAuNjYxWk0zNzQuMDg0LDUzLjA4M0wzNjMuODkyLDUyLjk2M0wzNjEuNjM2LDQ5LjQ1N1pNMzU1LjI4NCw1MS44ODdMMzQyLjQ1MSw1MS44MDRMMzMxLjEzOSw0Ny41NDdMMzUxLjg5Miw0OS43NzNaTTEyNjcuMDA1LDUxLjk3TDEyNDEuOTQ4LDUzLjY4NUwxMjUwLjA2MSw0Ny44NDdMMTI2OC4zMTcsNTAuMTY0Wk04ODEuMTEzLDQ1Ljc3MUw4OTUuNzUzLDQ5LjA4MUw4ODQuNTY5LDUwLjgzNEw4NzYuMDg5LDU4LjYyN0w4NjEuMTYxLDU2LjA4NUw4NjUuMTkzLDU0LjUwNUw4NDkuODgsNDkuNDcyTDg0Ni40MjQsNDUuOTg5TDg3NS41MTMsNDQuMjIyWk05MTMuMDk3LDQyLjYzNEw5MjEuODE3LDQ0LjE5Mkw5MTUuMjI1LDQ2LjU4NEw4ODkuMjI1LDQ2LjM3M0w4NzcuMTkzLDQzLjAyNkw5MDEuODY1LDQxLjUyMVpNMTAyNy4yNzQsNDIuMDFMMTAxMS40OTgsNDQuNDAyTDEwMDkuMjEsNDEuOTU3TDEwMjIuMzk0LDQwLjM2M1pNMTI0NC4xNzIsNDkuNDJMMTIzNC40NzYsNDkuOTY5TDEyMTQuNzE2LDQ2Ljk5TDEyMDUuMjQ0LDQyLjkyOEwxMjI2LjM5NiwzOC44ODhMMTI0NS4yNzYsNDUuNDI1Wk00MTMuMjUyLDQ1Ljk1OUw0MTguNTk2LDQ3LjM4OUw0MDQuMjkyLDUyLjA2TDM4Ny4yMiw1MS44MDRMMzg2LjAyLDQ3LjIwMUwzNzcuODkyLDQ3LjIzMUwzNzAuMTgsNDMuNzRMMzc4Ljk0OCwzOS4wODRMMzg5LjI4NCwzOC44NThMNDA5LjczMiw0My4wMjZaTTQ5NS41NTcsMzAuNjM2TDUxNi45ODEsMzEuNTU0TDUyNC45MTcsMzMuOTQ2TDQ5OS4zMDEsMzcuNzc1TDUwOC45ODEsMzcuNzUyTDQ5MS4yNTMsNDEuNzAyTDQ4My42MzcsNDUuMzM1TDQ1OC4xODEsNDcuNDU2TDQ2NC45MTcsNTAuOTk5TDQ0Ni4xMzIsNTcuODUyTDQ1My44MjksNTguNzYzTDQ0MS45NTYsNjEuNDMzTDQzMC4zNCw2MC4yMDdMNDAyLjI2LDYwLjEyNEw0MDkuOTI0LDU2Ljk4N0w0MDcuNzMyLDUzLjc3NUw0MjIuMzI0LDU1LjM4NUw0MDkuMDYsNTEuNjg0TDQyMS43OTYsNDcuMzUxTDQxMy42MzYsNDMuMzI2TDQyOS4zLDQ0LjAwM0w0MzYuMjI4LDQyLjM3OUw0MTAuNjc2LDQyLjE1M0wzOTIuOTQ4LDM2LjAyMkw0MjAuMDA0LDMyLjY2TDQzMC4zMDgsMzQuMTM0TDQzMy42ODQsMzEuNzM0TDQ0Ny41MjQsMzAuNTMxWk02NzkuNTU5LDI4LjgwMUw3MDcuMzUxLDMyLjMyOUw2OTkuMTQzLDM0LjAzNkw2NTguMjE1LDM0LjY2OEw2ODkuNTc1LDM2LjUwNEw2OTguMjE1LDM1LjE0Mkw2OTcuMDMxLDM5LjMyNEw3MjkuOTExLDM1Ljk0N0w3NDUuNzM1LDM4LjcwOEw3MjEuMTkxLDQzLjg2OEw3MTIuNDIzLDQ5Ljk5MUw3MTcuODk1LDU3Ljg0NUw3MDMuNjM5LDU5LjQzMkw3MTEuODQ3LDYxLjc4N0w3MDguMTM1LDY1Ljk3N0w3MTMuODk1LDY5Ljc5OEw3MDQuMDIzLDcwLjExNEw3MDcuNzE5LDczLjQ5Mkw2OTUuMjU1LDc0LjE5MUw3MDAuODg3LDc5LjE3OUw2OTIuMTAzLDc3LjM0M0w3MDMuMzE5LDg1Ljk0MUw2OTUuMzk5LDg2Ljc5OUw2ODYuNDcxLDgyLjUyNkw2ODIuODM5LDg3Ljg4Mkw3MDAuNjc5LDg4LjMxMUw2NzYuNjc5LDk1LjY5TDY1OC43NzUsOTcuMjRMNjQ3Ljk5LDEwMy42NDlMNjIzLjA2MiwxMDkuMDczTDYxNi45MzQsMTE3Ljg1OUw2MDkuNjg2LDEyMS40MUw2MTEuNDc4LDEyNC44ODVMNjA3LjIwNiwxMzIuODk3TDU5NC4zOSwxMjkuNTQyTDU4NS40OTQsMTI5LjUxOUw1NzAuNTE4LDExNy4yMTJMNTYwLjEzNCwxMDEuMzg1TDU3MS4yMjIsOTQuNTMyTDU3My45MSw4OS4yMDZMNTYyLjQyMiw5Mi4wNzJMNTU2Ljk2Niw5MC42Mkw1NTguNDA2LDg1LjI0Mkw1NzEuNjA2LDg2LjM1NUw1NTkuOTc0LDgyLjAxNUw1NTEuODQ2LDgxLjUzM0w1NTYuODA2LDc3LjM5Nkw1MzkuNjIxLDY0LjM2N0w1MjcuNzAxLDYxLjc2NEw0OTUuNTQxLDYxLjk1Mkw0ODIuNjYxLDU3Ljc0TDUwMy4yNjksNTYuMTA3TDQ4NC4yNjEsNTQuOTQ5TDQ3NC44NTMsNTEuNDEzTDUwNy45NTcsNDcuMTMzTDQ5Ny42NjksNDMuOTIxTDUyMy4zOTcsMzguNTcyTDUyMS41NTcsMzYuNTc5TDU0NS43NDksMzQuNzA2TDU2NC4yNDYsMzYuMDUyTDU3Ni4wMzgsMzMuNjA3TDYwMi4xMTgsMzcuMDZMNTkyLjE2NiwzMi43NjVMNjA3LjA3OCwzMC4xMDlMNjIyLjY3OCwzMC4zMTNMNjQ0LjA1NCwyOC4yNDRaIi8+PC9zdmc+";
const GLOBE_WORLD_MAP_OUTLINE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAwIDgwMCI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEuNiIgZD0iTTUzNS4yMzcsNzU1LjczNkw1MzIuNjI5LDc2MC4wMDFMNTEzLjM4MSw3NTkuNjU1TDUwNS4zODEsNzU2LjY5MUw1MjQuOTY1LDc1Ny4zWk05Mi40MDEsNzUzLjMyMUw4My44NzMsNzUzLjkzTDcyLjM4NSw3NDkuMzExTDgzLjM2MSw3NDguMzU2Wk01OTkuMzE4LDc0Ni44NzRMNjA0Ljc5LDc0OC43OTJMNjA3LjQxNCw3NTUuNjY4TDU3NS42MzgsNzYwLjExNEw1NjUuMTEsNzU5Ljg1TDU2MC4wNTQsNzU2LjU0MUw1NzMuMzY2LDc1My44NEw1ODMuNzM0LDc0Ni44NzRaTTI2MS4yODMsNzI2LjY2OUwyNzIuMzM5LDcyNi41ODZMMjY1LjYzNSw3MjkuMjg3Wk0yNDEuOTU0LDcyNi41ODZMMjQxLjk1NCw3MjYuNTg2TDI0MS45NTQsNzI2LjU4NlpNMzYwLjA4NCw3MTkuNzAzTDM3Mi40MzYsNzIyLjMxM0wzNTIuMDY4LDcyMi4yMzFMMzQ1LjIwMyw3MTkuNTNaTTQ5NS43NjUsNzE1LjM2Mkw0OTQuMjkzLDcyMC43NTZMNDcwLjI2MSw3MjEuNjI5TDQ2Ni42MTMsNzE4LjQ5Mkw0NzkuNjY5LDcxNi40MDFMNDgxLjE0MSw3MDguOTE2TDQ4Ny43NjUsNzA2LjEyNVpNMCw3NzYuNTA1TDAuMDAxLDc3Ni41MDVMMCw3NzYuNTA1TDQuMTc2LDc3My45NTVMMjQuOTYsNzc1LjcwOEw0NC42NTYsNzcyLjgxOUw1Ny42ODEsNzc1Ljg2Nkw5Ny40NTcsNzc5LjQzOUwxMTAuMjU3LDc3OC4yMkwxMzkuODU3LDc4MC40ODVMMTYzLjk3LDc3Ny45NTdMMTY0LjkzLDc3NS44NjZMMTMzLjA1Nyw3NzQuNjQ3TDExNy4zOTMsNzcxLjk0N0wxMjAuNjA5LDc2NC42MzVMMTAyLjk0NSw3NjAuNDUyTDEyNC4wMTcsNzYwLjAxNkwxMzAuNDQ5LDc2MS40OThMMTQ1LjY4MSw3NTguNTQyTDE0Ny42ODEsNzU1LjIzMkwxMzUuNDA5LDc1Mi43MDRMMTA5LjY0OSw3NTEuMzk1TDk3LjU1Myw3NDYuNzg0TDk2LjE2MSw3NDEuNzI5TDEwMi4zMzcsNzQzLjU1N0wxMTYuNzA1LDc0Mi41MTFMMTI3LjQwOSw3NDMuOTkzTDE1MC42NDIsNzM5LjkwMUwxNTAuMjEsNzM1LjAyNkwxNTguNTYyLDczNS43MThMMTgyLjg1LDczMy4xOThMMTk5LjA0Miw3MzAuMjM0TDIxOC4xMTQsNzMxLjAxN0wyNjcuOTg3LDczMS4wMTdMMjkzLjU4Nyw3MjcuNjI0TDMwMC44OTksNzMyLjA2MkwzMDUuNTA3LDczMC43NTNMMzIxLjk1NSw3MzQuMTU0TDMzMy44OTEsNzMzLjEwOEwzNTIuNjkyLDczNC42NzNMMzU1LjA0NCw3MzIuNzYyTDM0NC4yNDMsNzI5LjM2MkwzMzkuMTg3LDcyMi43NDJMMzU0LjE2NCw3MjMuMzUxTDM3MS44NDQsNzI3LjE4OEw0MDcuMDEyLDcyNC40ODdMNDM3LjkwOCw3MjguMjMzTDQ0My4xMjQsNzI1LjAwNkw0NjEuMjM3LDcyOC43NTJMNDkzLjYyMSw3MjQuNDg3TDUwMC41ODEsNzIyLjEzM0w0OTUuNjIxLDcxMS41OTRMNTAwLjMyNSw3MDIuODlMNDk4LjkzMyw2OTkuMjI3TDUxOS45ODksNjg3LjI5Nkw1MzkuNTczLDY4MS43MjJMNTQ1LjY2OSw2ODIuMzM5TDUzNy41NzMsNjg2LjA3N0w1MjIuMTY1LDY4OS4zMDVMNTIzLjkwOSw2OTQuMTc5TDUwOC44NTMsNzAwLjM2M0w1MTkuMTI1LDcwNy42NzVMNTI2LjYxMyw3MTUuOTQ5TDUzMC4yNjEsNzI1LjE3OUw1MjQuNjEzLDczMC44NDRMNTEzLjk4OSw3MzQuNUw0ODkuNzgxLDczOC43NzJMNDg2LjIxMyw3NDAuNkw0NTYuNzA5LDc0MC45NDZMNDY5Ljg2MSw3NDQuNjkzTDQ2Ny42ODUsNzQ3LjY0OUw0NTMuNjY5LDc0OC4zNDlMNDUzLjIyMSw3NTEuOTIyTDQ2NS4wNjEsNzU2LjcwNkw0OTYuOTMzLDc2MS40MTVMNTE4Ljg2OSw3NjMuMzI2TDUzNC43MDksNzY2LjExN0w1NDEuMjM3LDc2OS44NjNMNTc4LjgzOCw3NjMuMjQzTDYwOS43MzQsNzY0LjgwOEw2MTguNzksNzYxLjU4OEw2MzAuMDIyLDc2MS40OThMNjczLjExMSw3NTcuMDZMNjY4LjA3MSw3NTIuMjY4TDY0MS42MDYsNzUzLjE0TDY0MC45OTgsNzQ4LjE3Nkw2NzEuNjM5LDc0MC43NzNMNzAwLjE4Myw3MzguMjQ2TDczMC4yMTUsNzMxLjEwN0w3MjYuODIzLDcyOC4zMTZMNzU0LjI0OCw3MTYuNzMyTDc2Ny4wMzIsNzE4LjY1TDc2OS40OCw3MTUuMjU3TDc4MC42OTYsNzE3LjYwNEw3OTIuMDI0LDcxNi4zMDNMNzk4Ljk4NCw3MTguMzg3TDgzMS43Miw3MTIuMjAzTDg0Mi4zMjgsNzExLjE2NUw4NDguMDcyLDcxNC44MjFMODU5LjY1Nyw3MTAuOTg0TDg4NS41OTMsNzEwLjYzOEw5MDAuMzEzLDcxNC4yMTJMOTI5LjU2MSw3MTIuMDNMOTQ1LjU3Nyw3MDguMzc0TDk1MC41MzgsNzA0LjQ1NUw5NzEuNzcsNzEwLjExOUw5NzcuODY2LDcwNy4xNTVMMTAwNi42ODIsNzAwLjQ1M0wxMDI1LjU3OCw2OTcuMjI2TDEwMzMuODM0LDY5My41N0wxMDUwLjQ3NSw2OTMuMjI0TDEwNjEuMDgzLDY5OS4wNTRMMTA3Ny4yNzUsNzAyLjI4MUwxMDg0LjY4Myw2OTkuNThMMTEwNi4xNzEsNzAxLjkyN0wxMTA5LjEzMSw3MDkuNjgzTDExMDEuMzg3LDcxMi40NjZMMTEwNi45NTUsNzE0LjEyMUwxMTAxLjk5NSw3MTkuMzQ5TDExMTUuNjU5LDcyMC4zOTVMMTEyOC4yODMsNzEwLjU1NkwxMTQ1LjA4Myw3MDguNzJMMTE1MS42MTIsNzAzLjY3M0wxMTY3LjksNjk4LjcwOEwxMTg1LjU2NCw2OTguNDQ0TDExOTEuMDUyLDY5NC4yNjlMMTIwMi43OTYsNjk4Ljc5OEwxMjQzLjE5Niw2OTguODgxTDEyNTcuMDM3LDY5MS4zOTZMMTI3MS45MTcsNjk3LjQ4OUwxMjg5LjkzMyw2OTYuNDQzTDEzMDQuOTA5LDY5Mi43ODhMMTMxMy43ODksNjk2LjQ0M0wxMzM3LjE5Nyw2OTguNjE3TDEzNDMuNjQ1LDY5NS44MzRMMTM3Mi40NjIsNjk2LjcwN0wxMzk4LjkyNiw2OTQuMjY5TDE0MDAuMzE4LDY5MC4yNkwxNDEwLjk0Miw2OTcuNTc5TDE0NDYuNjIyLDY5Ny4zOTlMMTQ1MS43NTksNzAxLjc1NEwxNDc3Ljc5MSw3MDYuMTFMMTQ4NS43MTEsNzA0LjcxOEwxNDk2Ljk0Myw3MDguMzc0TDE1MDcuNDcxLDcwOS4zMjlMMTUyMy4wNTUsNzE0LjM4NUwxNTQ4LjU1OSw3MTUuNDNMMTU2MC45MTIsNzE4LjY1TDE1NTIuMzg0LDcyNy4zNjFMMTUzOC4xOTEsNzMwLjU4TDE1MjkuOTM1LDczNS4zNzJMMTUyNi42MjMsNzQyLjUxMUwxNTMyLjE5MSw3NDcuNDc2TDE1NDIuMjA3LDc1MC4wMDRMMTUxOC45NTksNzUxLjgzMUwxNTEwLjE3NSw3NTkuNzZMMTUyNy41ODMsNzY2LjE5OUwxNTUwLjY0LDc3MC4zODJMMTU1Mi45MTIsNzcyLjU1NkwxNTY5Ljg4OCw3NzUuMTc0TDE1ODIuMTYsNzc0LjAzOEwxNTkyLjMzNiw3NzUuNDM3TDE2MDAsNzc2LjUwNUwxNjAwLDgwMEw4MDAsODAwTDAsODAwWk00OTguODg1LDYzOS4zMzNMNTEwLjg4NSw2NDMuMTA5TDQ5Ny4xMjUsNjQ3LjE2NEw0ODQuNDIxLDY0NC42ODFMNDY4LjE2NSw2MzQuODM0TDQ4My45NzMsNjQwLjMzM0w0ODcuNzAxLDYzNS4yNDhMNDk0Ljk2NSw2MzMuOTM5Wk01MzkuNzgxLDYyNy4xMDlMNTM2LjAwNSw2MzEuOTk4TDUyOC4wMDUsNjMwLjQ0MVpNMTExMi4zNjMsNjIwLjkzM0wxMTA1LjUzMSw2MjEuMjE5TDExMDYuMzc5LDYxNi4xMTFaTTE0NDYuMjA2LDU4MS4yOTdMMTQ1OS4wNTUsNTgxLjY2NUwxNDU3LjM5MSw1OTIuMDU0TDE0NDkuMTAyLDU5My41NTFMMTQ0My4xOTgsNTgyLjk0NFpNMTU2OC45NzYsNTgxLjg2MUwxNTc0LjQzMiw1ODUuNjQ1TDE1NjIuMDE2LDU5Ni42MzVMMTU1OC4zMDQsNjA0LjAzN0wxNTUyLjU5Miw2MDcuMjk0TDE1NDAuNzgzLDYwNS40MjFMMTU0Mi40MzEsNjAwLjQ5NEwxNTU3Ljg4OCw1OTEuMjQ5TDE1NjgsNTc5Ljk3M1pNMTU3Ni4wNDgsNTYwLjY5M0wxNTc5LjI4LDU2NS4zNzJMMTU5My40MDgsNTY3LjUzOEwxNTgyLjI3Miw1ODMuNTA4TDE1NzIuNTQ0LDU3NS41OTVMMTU3NS44ODgsNTcyLjQzNVpNMTU0Mi43NTEsNDk4LjQ4OUwxNTM1LjQzOSw0OTYuMzUzTDE1MjkuMDIzLDQ4OS4zNTdaTTE1OTIuNzY4LDQ3Ny4wNjVMMTU5Mi43NjgsNDc3LjA2NUwxNTkyLjc2OCw0NzcuMDY1Wk0xNjAwLDQ3My41ODNMMTU5Ny4xNjgsNDc0LjY3M0wxNTk3LjM5Miw0NzIuNzkzTDE2MDAsNDcxLjQwOUwxNjAwLDQ3My41ODNaTTAsNDcxLjQwOUwwLjAwMSw0NzEuNDA4TDAsNDczLjU4MkwwLDQ3My41ODJMMCw0NzMuNTgzTDAsNDcxLjQwOVpNMTU0NS45ODMsNDczLjE4NEwxNTQ1Ljk4Myw0NzMuMTg0TDE1NDUuOTgzLDQ3My4xODRaTTE1NDIuNzAzLDQ2Ni4zNzZMMTU0Mi43MDMsNDY2LjM3NkwxNTQyLjcwMyw0NjYuMzc2Wk0xMDIyLjQ3NCw0NjAuMjQ1TDEwMjQuMzQ2LDQ2Ny42N0wxMDA5LjMyMiw1MTAuODQ5TDEwMDEuODE4LDUxMy43ODNMOTk1LjczOCw1MTEuMDU5TDk5Mi4yMzQsNDk4LjAzTDk5Ny4yMjYsNDg5LjIxNEw5OTUuMzg2LDQ3Ny4zODFMOTk3LjU0Niw0NzIuMDdMMTAwNS44MzQsNDcwLjEzN0wxMDEyLjAyNiw0NjQuODY0TDEwMTguNjUsNDUzLjUxMlpNMTQzOC4wNDYsNDYxLjE3TDE0NDYuMTEsNDY2LjYwMUwxNDUwLjYwNyw0ODQuMjU3TDE0NjEuNTUxLDQ5MC42MjhMMTQ2NS4yMzEsNDk5LjMwMkwxNDc5LjM1OSw1MTIuMzAxTDE0ODIuNTI3LDUyNC45MzFMMTQ3OS41MTksNTQwLjYyM0wxNDc0LjI3MSw1NDYuODUxTDE0NjYuNjU1LDU2Ni4zMzVMMTQ1MC4zMDMsNTczLjQ5NkwxNDM4LjI3LDU3Mi40ODhMMTQyNS4wNTQsNTY4Ljk3NUwxNDIwLjMzNCw1NjAuNjE3TDE0MTMuODcsNTU4LjI3OEwxNDE0LjI1NCw1NTIuODI0TDE0MDguMTI2LDU1Ni43MTNMMTQxMi40OTQsNTQ2LjIxOUwxNDA0LjM5OCw1NTUuMDY2TDEzOTYuNzY2LDU0NC45NjNMMTM4My42NzgsNTM5Ljk4M0wxMzYwLjY1NCw1NDMuMThMMTM0OS41OTcsNTUwLjYyTDEzMzIuODYxLDU1MS4wMDRMMTMyNC41NTcsNTU1Ljg0MUwxMzExLjIyOSw1NTEuOTgyTDEzMTQuNjY5LDU0My4xMzVMMTMwNy40MzcsNTI0Ljk2OEwxMzAzLjk2NSw1MDguMzc0TDEzMDcuMzI1LDQ5Ni42OTFMMTMzNy4xMzMsNDg3LjQ4NEwxMzQ2LjcxNyw0NzIuOTEzTDEzNTguNjA2LDQ2My4yNDZMMTM2NC43MzQsNDYxLjQxMUwxMzcwLjQ5NCw0NjYuMDgyTDEzNzUuMTUsNDY0LjA4OUwxMzgwLjUyNiw0NTUuNzE2TDEzODkuMjMsNDUzLjg0M0wxMzg4LjI1NCw0NDkuNDU4TDE0MDEuMzI2LDQ1NC40MzhMMTQwOC42Nyw0NTQuODk3TDE0MDEuOTAyLDQ2NS40MDVMMTQxOC45NDIsNDc3LjIwOEwxNDI2LjExLDQ3Ny4xOTNMMTQyOS43OSw0NjYuODY1TDE0MjkuNzI2LDQ1NS4xNDVMMTQzMy40MDYsNDQ3LjQxMlpNMTUyMC41MjcsNDQ2LjU5MkwxNTIwLjUyNyw0NDYuNTkyTDE1MjAuNTI3LDQ0Ni41OTJaTTEzMzYuNTA5LDQ0NS41MDhMMTMzNi41MDksNDQ1LjUwOEwxMzM2LjUwOSw0NDUuNTA4Wk0xNTE0Ljg5NSw0NDMuODc2TDE1MTQuODk1LDQ0My44NzZMMTUxNC44OTUsNDQzLjg3NlpNMTUxOC41NzUsNDQyLjY2NUwxNTE4LjU3NSw0NDIuNjY1TDE1MTguNTc1LDQ0Mi42NjVaTTEzNTMuMDU0LDQ0NS4wNjVMMTM1MS4wMjIsNDQxLjI4OEwxMzY0LjMwMiw0MzguNTI4Wk0xMzIzLjk5Nyw0MzUuOTc3TDEzMjkuNDUzLDQzOC42OTNMMTMxOC44NDUsNDQwLjE0NVpNMTM0Ni4yMzcsNDM1Ljk3N0wxMzQ1LjU4MSw0MzguNDQ1TDEzMzIuOTg5LDQzOS4xNTlaTTE1MTAuNTU5LDQzNy4wNTNMMTUxMC41NTksNDM3LjA1M0wxNTEwLjU1OSw0MzcuMDUzWk0xNTAwLjE3NSw0MzIuNjZMMTUwMC4xNzUsNDMyLjY2TDE1MDAuMTc1LDQzMi42NlpNMTI4Mi43NjUsNDMwLjEyNUwxMjkyLjI2OSw0MjguNzMzTDEzMTQuMjUzLDQzNy4yMDRMMTMwOS4xODEsNDM4Ljg5NkwxMjgxLjIyOSw0MzQuNTE4TDEyNjguMjg1LDQzMC40NDhMMTI3MS4zNDEsNDI2LjIwNlpNMTM5OC43ODIsNDI3LjYyTDEzOTguNzgyLDQyNy42MkwxMzk4Ljc4Miw0MjcuNjJaTTE0OTIuNzk5LDQzMC4zMTNMMTQ5Mi43OTksNDMwLjMxM0wxNDkyLjc5OSw0MzAuMzEzWk0xNDc1LjQ4Nyw0MjQuMzQ4TDE0NjcuNzQzLDQyOC4wNzlMMTQ1OS41NjcsNDI0LjE2N1pNMTM2NS41NSw0MTUuMzczTDEzNjUuNTUsNDE1LjM3M0wxMzY1LjU1LDQxNS4zNzNaTTEzNzkuODcsNDEzLjc0OUwxMzc5Ljg3LDQxMy43NDlMMTM3OS44Nyw0MTMuNzQ5Wk0xNDgwLjYyMyw0MjBMMTQ2OS42MTUsNDEyLjE4NEwxNDc2LjYyMyw0MTQuNDAzWk0xMzk2LjE5LDQwNS4xMkwxMzk3LjQzOCw0MTIuMzA0TDE0MDIuMDMsNDE0Ljk2N0wxNDA1Ljc0Miw0MTAuMjUxTDE0MTQuNzk4LDQwNy41NjVMMTQ0Mi41OSw0MTcuMTY0TDE0NDguODE0LDQyNC4yOTVMMTQ1Ni4yMDcsNDI3LjA0MUwxNDUzLjE5OSw0MjkuODc3TDE0NjEuMDM5LDQ0MC40NjhMMTQ3MC4yMjMsNDQ1Ljc0OUwxNDU3LjM5MSw0NDUuMDI3TDE0NDkuMTAyLDQzNS44NTdMMTQ0My4zMSw0MzMuOTA5TDE0MzMuOTAyLDQ0MS40NTRMMTQyMi44NjIsNDM2Ljg3M0wxNDExLjYxNCw0MzcuMzg0TDE0MTYuMzAyLDQzMi41MzJMMTQxMy4wMDYsNDIzLjk3MkwxMzk0LjA2Miw0MTUuNzI3TDEzOTEuMDM4LDQxOC4yNzdMMTM4Ny42OTQsNDA5LjgzN0wxMzgwLjA5NCw0MDQuMTY1TDEzODguMzUsNDAxLjY0NVpNMTM1Ni42MjIsMzkzLjY4NkwxMzUzLjA1NCwzOTguMTAyTDEzMzQuMTQxLDM5OC45NDRMMTMzNy40ODUsNDA2LjI2NEwxMzQ4LjE3Myw0MDIuNzM2TDEzNDAuMDI5LDQwOC40NjhMMTM0Ny4zODksNDIzLjczOEwxMzQzLjI3Nyw0MjMuNDgzTDEzMzQuNjg1LDQxMy4wMjZMMTMzNS4yNDUsNDI0LjU3M0wxMzMwLjUyNSw0MjMuOTExTDEzMzEuMTAxLDQxNS41MzFMMTMyNy44NTMsNDEyLjQ1NUwxMzMzLjQ4NSwzOTcuNDg1TDEzMzcuMjc3LDM5NC4xODNMMTM1MS40NTQsMzk1LjkyWk0xMzcxLjk1LDM5NC45NjVMMTM2OS4zMjYsNDAzLjk5OUwxMzY2LjIyMiwzOTUuNTA3TDEzNjguNTksMzkwLjMzOVpNMTI3MC4zMDEsNDI2LjAxTDEyNjUuMzczLDQyNi4xTDEyNTUuOTMzLDQxOC43NTlMMTIzOC4yMiwzOTEuODk2TDEyMjMuOTE2LDM3Ny45MDRMMTIzMy4yNiwzNzYuNjg1TDEyNDcuMjkyLDM5MC42N0wxMjUxLjgyMSwzOTAuNzM3TDEyNjEuNTAxLDM5OS41MzlMMTI2Ni4xNzMsNDEwLjQwMUwxMjcxLjU5Nyw0MTMuNjA2Wk0xMzIzLjg4NSwzOTEuODgxTDEzMjIuMzE3LDQwMy41NzFMMTMxOC4wNDUsNDA2LjYxTDEzMTYuMjIxLDQxNy44MzNMMTMxMC41MDksNDE4LjI1NUwxMzAzLjM1Nyw0MTMuODYxTDEyODkuODg1LDQxMy4wNDFMMTI4NC44NDUsNDAyLjA0NEwxMjg3LjM4OSwzOTEuMDgzTDEyOTQuMDc3LDM5MS43NzVMMTMwMi4yMDUsMzg2LjIwOUwxMzIwLjU3MywzNjkuMjA4TDEzMjkuNjkzLDM3NS45NjNMMTMyMS4zODksMzg1LjYyMlpNMTM2MS42NzgsMzYyLjYwM0wxMzU3LjMyNiwzNzUuMTk2TDEzNTIuMDk0LDM3Mi42MTZMMTM0OS4zNzMsMzY1LjE4M0wxMzQyLjYwNSwzNjkuMzM2TDEzNDMuNjEzLDM2NC4yODhMMTM2MC45OSwzNTguNzI5Wk0xMTYwLjk3MiwzNzIuNDU4TDExNTcuMSwzNzMuNDczTDExNTQuMjA0LDM2My41NTFMMTE1Ni4yMiwzNTYuMzM3TDExNjMuNSwzNjYuNTY4Wk01MjkuMTczLDM1NS4wNjZMNTI5LjE3MywzNTUuMDY2TDUyOS4xNzMsMzU1LjA2NlpNMTM1MS4wMzgsMzU0LjMxM0wxMzQ2LjY1MywzNTkuOTAzTDEzNDYuNDI5LDM1MS42MzVaTTEzMjYuNjg1LDM1OC41OTRMMTMyNi42ODUsMzU4LjU5NEwxMzI2LjY4NSwzNTguNTk0Wk0xMzQxLjcwOSwzNDcuMTQ0TDEzNDcuMTk3LDM0OC41MTRMMTM0Mi4yMzcsMzUzLjU5OVpNMTM1Ny43OSwzNDUuOTQxTDEzNTQuNjcsMzU0Ljk2TDEzNTIuMzAyLDM0NC4xODhaTTEzNDAuMTI1LDM0MS45MTZMMTM0MC4xMjUsMzQxLjkxNkwxMzQwLjEyNSwzNDEuOTE2Wk0xMzM5LjIxMywzMTcuNzYyTDEzNDQuNTA5LDMyNC4wMjhMMTM0MC43MTcsMzI5LjE5NkwxMzQxLjAyMSwzMzYuMzJMMTM1MC44OTQsMzM4Ljc0OUwxMzM2LjEyNSwzMzguNDExTDEzMzMuNjQ1LDMzMy40NjFMMTMzNi41MDksMzE3Ljc1NFpNNTA4LjQ4NSwzMTguOTg4TDUwOC40ODUsMzE4Ljk4OEw1MDguNDg1LDMxOC45ODhaTTQ1OC4yMTMsMzIwLjU4M0w0NTguMjEzLDMyMC41ODNMNDU4LjIxMywzMjAuNTgzWk00NzcuNDI5LDMxMS42ODNMNDg1LjMwMSwzMTEuNjQ2TDQ5Ni4zNTcsMzE3LjI4TDQ4MS4zMDEsMzE5LjhaTTEyOTAuMzk3LDMxNi45ODdMMTI4Mi45MDksMzE3Ljc0N0wxMjg0Ljk3MywzMTEuOTA5TDEyOTIuMzgxLDMxMC43NjZaTTEwOC43MDUsMzE1LjE4MUwxMDguNzA1LDMxNS4xODFMMTA4LjcwNSwzMTUuMTgxWk0xMDYuMzIxLDMwOC4yNDZMMTA2LjMyMSwzMDguMjQ2TDEwNi4zMjEsMzA4LjI0NlpNMTAzLjI5NywzMDUuODg0TDEwMy4yOTcsMzA1Ljg4NEwxMDMuMjk3LDMwNS44ODRaTTk5LjMxMywzMDUuMjM3TDk5LjMxMywzMDUuMjM3TDk5LjMxMywzMDUuMjM3Wk05MS43OTMsMzAyLjMwM0w5MS43OTMsMzAyLjMwM0w5MS43OTMsMzAyLjMwM1pNNDQ1Ljg3NiwyOTguODJMNDcwLjMyNSwzMDkuODQ4TDQ1NC40MjEsMzExLjc1MUw0NTcuMzk3LDMwOS4yNzZMNDUwLjEzMywzMDQuMDExTDQzMi4xLDI5OS4xNjZMNDM0LjM1NiwyOTYuOTM5Wk00NTUuMzk3LDI5NC40MDRMNDU1LjM5NywyOTQuNDA0TDQ1NS4zOTcsMjk0LjQwNFpNMTMzOC41NTcsMjk4LjcwN0wxMzMzLjgwNSwyOTUuMzA3TDEzNDIuMDEzLDI4OC44OThaTTQ1NC4xMzMsMjgxLjg2NEw0NTQuMTMzLDI4MS44NjRMNDU0LjEzMywyODEuODY0Wk00NTcuNzgxLDI4MS44MTlMNDU3Ljc4MSwyODEuODE5TDQ1Ny43ODEsMjgxLjgxOVpNMTM5OC4zOTgsMjQ4LjIyNEwxMzkxLjE4MiwyNTQuNjQ4TDEzOTAuNzgyLDI0OC42MjNaTTk1My42NzQsMjQxLjQ2MUw5NDYuNTY5LDI0Ni4zNTFMOTQzLjM2OSwyNDMuOTg5Wk05MDUuMzM3LDI0MS4zMTFMOTE2Ljg0MSwyNDMuMTA5TDkwOS44ODEsMjQ0LjgwMVpNODY4Ljk4NSwyMzAuMDg3TDg2Ny4xMTMsMjM3LjI0MUw4NTUuMjU3LDIzMi44MzNMODU1Ljg2NSwyMzAuNTQ2Wk04NDAuOTM2LDIxNi44NDhMODQyLjk2OCwyMjUuODgyTDgzNy40NjQsMjI1LjkwNUw4MzYuMjY0LDIxNy45OThaTTE0MjYuNTU4LDIzNC45MjRMMTQyMy4zNDIsMjQzLjgzMUwxNDA5Ljg1NCwyNDYuMTkzTDE0MDMuNTE4LDI1MS4yN0wxNDAwLjM1LDI0Ni4yMzhMMTM4Mi4xNTgsMjQ5LjM5N0wxMzg2LjY3LDI1Mi42N0wxMzgzLjY5NCwyNjAuMjIyTDEzNzUuMTUsMjUyLjAxNUwxMzg5LjQwNiwyNDIuNTIyTDE0MDMuMDA2LDI0Mi4xMDFMMTQwNy42NjIsMjM0LjIwMkwxNDEwLjYyMiwyMzYuMzIzTDE0MTkuNjc4LDIzMC4xNTVMMTQyMy41ODIsMjE2LjkwOEwxNDI4LjMwMiwyMTYuMDk1TDE0MzAuNTksMjI1Ljg1OVpNODQyLjQ4OCwyMTIuNjU4TDg0Mi40ODgsMjEyLjY1OEw4NDIuNDg4LDIxMi42NThaTTE0MzkuNTk4LDIwMy42NjhMMTQ0NS44NywyMDIuNzM1TDE0NDYuODYyLDIwNy43MjNMMTQzNi4zNjYsMjEzLjM1N0wxNDI5LjM5LDIxMC4zMThMMTQyMi4wMywyMTUuMjQ1TDE0MjMuNjE0LDIwNy40MDdMMTQyOC4zNSwyMDcuMTU5TDE0MzAuOTc0LDE5Ny41NTJaTTUxNy4wNDUsMTkzLjExNEw1MTcuMDQ1LDE5My4xMTRMNTE3LjA0NSwxOTMuMTE0Wk01MjUuMzAxLDE4MS43NTVMNTI1LjMwMSwxODEuNzU1TDUyNS4zMDEsMTgxLjc1NVpNMjUxLjA3NSwxODQuNDAzTDI0MS41MzgsMTgyLjk5NkwyMjkuNTIyLDE3NC4zNTNMMjQxLjA5LDE3Ni40NjdaTTU1MC41MTgsMTc0LjcyMkw1NTEuODk0LDE3OS42MTFMNTYyLjMyNiwxODEuMTE2TDU2Ni4wMDYsMTg4LjcyOUw1NTkuMjA2LDE5MS45NzFMNTU4LjkzNCwxODcuNzY2TDUzNi41OTcsMTg4LjQyOEw1NDcuODI5LDE3Mi4wNTlaTTIxMC4xNzgsMTU5LjgyTDIxMC4xNzgsMTU5LjgyTDIxMC4xNzgsMTU5LjgyWk0xNDM4LjQzLDE3NC40NThMMTQ0Mi45MSwxODIuMzI3TDE0MzYuMzM0LDE4MC44NkwxNDMzLjU5OCwxODcuMjg0TDE0MzcuOTM0LDE5MS44MzVMMTQzMS41MTgsMTk1LjcwMkwxNDMxLjkxOCwxNzMuNTQ4TDE0MjkuNjk0LDE2My4wOTlMMTQzMy44MDYsMTYxLjA2MVpNNzY5LjgzMiwxNjcuNzMzTDc1NS42NTYsMTY5LjY4OUw3NTYuOTM2LDE2MC41MjdMNzY2LjM0NCwxNTQuOTY4TDc3NC44NCwxNTcuNTMzWk04NTYuMzkzLDE1Mi44NDZMODUzLjczNywxNTYuNDQyTDg0OC40NTYsMTUyLjA4NlpNMTE5Ljk2OSwxNDYuMTUxTDExOS45NjksMTQ2LjE1MUwxMTkuOTY5LDE0Ni4xNTFaTTc4Ni42NDgsMTM5LjQwNEw3ODEuODk2LDE0NC4yMUw3OTEuMjg4LDE0My42MjRMNzg2LjEzNiwxNTEuMjI5TDc5MC43MjgsMTUxLjUxNUw4MDIuMDg4LDE2NC43NTRMODA3LjQ4LDE2NS42MDRMODAyLjQ0LDE3NC4zNzZMNzc0LjMyOCwxNzcuMDY5TDc4MC44NCwxNzIuMzk3TDc3OS42NCwxNjIuMjQyTDc4Ni4yNjQsMTYyLjY0OEw3ODMuODY0LDE1Ny4yNjlMNzc1LjE3NiwxNTQuMTdMNzcyLjY2NCwxNDcuNjI2TDc3Ny43MzYsMTM5LjQxOVpNNjQuMDk3LDEzMy43MzJMNjQuMDk3LDEzMy43MzJMNjQuMDk3LDEzMy43MzJaTTQ0Ny43LDEyMy43NDJMNDQ3LjcsMTIzLjc0Mkw0NDcuNywxMjMuNzQyWk00MzYuMDA0LDEyMS4yODJMNDM2LjAwNCwxMjEuMjgyTDQzNi4wMDQsMTIxLjI4MlpNMzYuNzUyLDExNi41MkwzNi43NTIsMTE2LjUyTDM2Ljc1MiwxMTYuNTJaTTQyMS41MDgsMTA4LjE5M0w0NDMuOTg4LDExNi43NzZMNDMwLjYyOCwxMTUuMTA2TDQxOS44OTIsMTE5Ljc3TDQxNi4yMTIsMTE1LjM5OVpNNzM1LjUxMSwxMDQuNjQyTDczOS41MTEsMTEwLjU0N0w3MzMuNzM1LDExMy45NEw3MTcuMDc5LDExNy43OTJMNjk4LjgzOSwxMTUuNzNMNzAzLjIwNywxMTMuNzY3TDY5My41MjcsMTExLjU5M0w3MDEuMjA3LDEwOS40MjZMNjkxLjg3OSwxMDguMzk2TDcwMS42MjMsMTA0Ljg0NUw3MDguNTUxLDEwNy44NTRaTTQ2Mi44MjEsMTAxLjU1OEw0NTguNjEzLDk3LjEyTDQ2Ni4xNjUsOTcuNzI5Wk0xMDE4LjI2NiwyMTYuNTI0TDEwMjAuNTIyLDIxOS42NzZMMTAxNy4xNDYsMjI3LjQ4NEwxMDE4LjY2NiwyMzIuOTY4TDEwMjUuOTYyLDIzNi4xMkwxMDM5LjIyNiwyMzUuNzE0TDEwMzkuNDY2LDIyNi44ODNMMTAzNS4xNzgsMjE4LjMyOUwxMDQzLjI3NCwyMTcuOTk4TDEwMzguNzYyLDIxMi43ODVMMTAyOC4xODYsMjA4LjI5NEwxMDIzLjU3OCwyMDEuNzM1TDEwMzUuNzM4LDE5OC44NDZMMTAzNS43MzgsMTkxLjc2OEwxMDI3LjUxNCwxOTAuODk1TDEwMTEuODk4LDE5Ny4xNDZMMTAwNy40ODIsMjAxLjczNVpNMTYwMCwxMTEuMjAyTDE1OTkuOTY4LDExMS4yMjRMMTU4OC40OTYsMTEyLjg0OUwxNTk3LjIsMTIwLjA3OEwxNTcxLjkwNCwxMjUuOTkxTDE1NTcuMDI0LDEzMy44NkwxNTUwLjY3MiwxMzAuNzgzTDE1MzkuMDg3LDEzNC4yNzNMMTUyNi44NDcsMTMzLjkyTDE1MjAuMDc5LDE0MS4xNDFMMTUyNS4yOTUsMTQzLjkzMkwxNTIwLjUyNywxNTYuMjAxTDE1MTIuNzUxLDE1OC40NjZMMTUxMS4yMTUsMTYzLjU0M0wxNTA0LjU3NSwxNjQuNjI2TDE0OTYuODQ3LDE3My4yODVMMTQ5MC44MTUsMTUzLjg2MkwxNDk2Ljk0MywxNDIuOTY5TDE1MDMuODM5LDE0MS45NzZMMTUyNy40MjMsMTI4LjI2M0wxNTMwLjk5MSwxMjEuOTk3TDE1MTEuNjQ3LDEzMC45MTFMMTUwOC4wMTUsMTI1LjQ0OUwxNDk2LjU0MywxMjYuOTYxTDE0ODUuNDA3LDEzNC40MDlMMTQ4OS4wODcsMTM3LjEzMkwxNDcyLjI4NywxMzguNzQ5TDE0NzIuNjA3LDEzNS41MzdMMTQ2MC4yMDcsMTM3LjA0OUwxNDQ2LjYwNiwxMzYuMjgyTDE0MzEuOTk4LDEzNy41OThMMTQwMC41NTgsMTU2Ljc1OEwxNDE0LjA2MiwxNjEuMDkxTDE0MjEuNzksMTU5LjE1OEwxNDI4LjIwNiwxNjQuMDQ3TDE0MjIuNDk0LDE4NC42ODFMMTQxNC4zMDIsMTk0LjE5TDEzOTkuNDIyLDIwNy4xMjFMMTM4Ny45MDIsMjA3LjYyNUwxMzc2LjMwMiwyMTUuMTFMMTM3Ni40NjIsMjE4LjI5OUwxMzY2LjgxNCwyMjMuMzAyTDEzNzUuMzc0LDIzNi41MTFMMTM3My43NDIsMjQ0LjA3OUwxMzYyLjE1OCwyNDcuMTU2TDEzNjAuNzgyLDIzMi4yMjRMMTM1NC4yNywyMzAuNjI5TDEzNTcuMjc4LDIyNC45NDJMMTM1Mi4yODYsMjIyLjU0MkwxMzM4LjAxMywyMjcuMTIzTDEzNDAuNjIxLDIxOC4wMTRMMTMyMi4zNjUsMjI3LjgzTDEzMzIuMDEzLDIzNC44NTZMMTMzNi45ODksMjMxLjY4OUwxMzQ0LjU0MSwyMzUuODY0TDEzMzguMjM3LDIzNy4xMDZMMTMyOS41NjUsMjQ0Ljg0NkwxMzM0LjM0OSwyNDcuMjg0TDEzNDEuODIxLDI1OS4xNDZMMTM0Mi42MzcsMjY3LjQxNEwxMzI3LjM1NywyOTAuODk5TDEzMTUuMDY5LDI5OC43NDVMMTMwNS44MDUsMjk5Ljc4M0wxMjkyLjM4MSwzMDQuODk4TDEyODIuMzE3LDMwMy40ODRMMTI3NC4yODUsMzA4LjAxM0wxMjY5LjYxMywzMTUuMjk0TDEyODMuOTAxLDMzMi4xMDdMMTI4NS4zNDEsMzQ4LjE0NUwxMjY3LjM3MywzNjEuNzc2TDEyNjcuMDA1LDM1NS45MTZMMTI1OS45ODEsMzUyLjc0MUwxMjU1LjkzMywzNDUuODM2TDEyNDQuODc2LDM0MC40MTJMMTI0MC42ODQsMzU1LjcyTDEyNDYuNDkyLDM2Ni45ODFMMTI1OS40NjksMzc4LjQyM0wxMjYwLjA5MywzOTQuNTUxTDEyNTAuNjIxLDM4Ny43MjhMMTI0Mi4zMTYsMzY3LjM2NUwxMjM2LjIyLDM2Mi44ODlMMTIzOC45NTYsMzQ5LjE1M0wxMjMxLjgzNiwzMjQuNzU4TDEyMjMuODY4LDMzMC4xNTlMMTIxOC42MiwzMjguNzIyTDEyMTkuMjI4LDMxOS4wNDhMMTIwOS4yNiwzMDUuODA4TDEyMDYuMywyOTguODJMMTIwMS4yMTIsMzAyLjk1TDExODYuNTU2LDMwNC40NjJMMTE4NC40NDQsMzEwLjQzNUwxMTc4LjA0NCwzMTMuNDI5TDExNTcuMDA0LDMyOS4zMzlMMTE1NC45MjQsMzUzLjk2N0wxMTQ0LjYxOSwzNjQuNTk3TDExNDAuNDExLDM2MC40NDRMMTEyNi44MTEsMzI4LjkzM0wxMTIyLjc5NSwzMDUuMDg2TDExMTMuMTk1LDMwNy4yMTVMMTEwOS41MzEsMzAwLjIxOUwxMDk5Ljc1NSwyOTMuNTc3TDEwOTQuOTg3LDI4Ny4wMDJMMTA3My4zMjMsMjg4LjU0NEwxMDU1LjA5OSwyODUuNjAzTDEwNTEuMDgzLDI3OS4zNTlMMTA0My4xNzgsMjgyLjMwOEwxMDI4Ljk4NiwyNzYuMTU1TDEwMjIuNzMsMjY2LjAwN0wxMDEzLjIyNiwyNjYuNzc0TDEwMTYuOTIyLDI3Ni45MzdMMTAyNS41MywyODYuNzQ2TDEwMjkuMjksMjg1LjMzMkwxMDMwLjIwMiwyOTMuMjQ2TDEwNDAuMDQyLDI5Mi43OTVMMTA1MC40OTEsMjgyLjY4NEwxMDUwLjY1MSwyODkuMjIxTDEwNjEuMDE5LDI5NS4yNjJMMTA2NS44MDMsMzAwLjg0NEwxMDU2Ljg0MywzMTUuMjU3TDEwNDUuNjU4LDMyMy40MzRMMTAzMi44MjYsMzI3LjE4N0wxMDMxLjg2NiwzMzAuNjc4TDEwMTYuMzQ2LDMzNy43NjRMOTkzLjI1OCwzNDMuODM1TDk4OS41NjIsMzI1LjQ0Mkw5ODEuOTQ2LDMxMy4zOTFMOTczLjk0NiwzMDUuMzcyTDk3My42MjYsMjk5LjY0OEw5NTYuMTM4LDI3NS4yNzVMOTU1LjM1NCwyNjkuNTI3TDk1MC43NjIsMjc3LjExOEw5NDUuNDgxLDI3Mi40MjRMOTYzLjg1LDMwMi4yMkw5NjYuNTg2LDMxNy4yNzNMOTc0LjUyMiwzMjkuMjMzTDk5Mi41MjIsMzQ0LjkzM0w5ODkuODUsMzQ3Ljg0NEw5OTYuMDc0LDM1My41NzZMMTAyNy4xNjIsMzQ2LjU1OEwxMDI2Ljg3NCwzNTIuNzA0TDEwMTkuNzg2LDM2OS43NTdMMTAwNi45NTQsMzg3LjMwN0w5OTEuNzIyLDM5OC43MDRMOTc4Ljk1NCw0MTEuNDM5TDk3Mi40NDIsNDI4Ljc3OEw5NzQuMTcsNDM3LjcxNUw5NzkuODk4LDQ0Ny44NDhMOTgxLjIyNiw0NjUuM0w5NzUuMzM4LDQ3NC4zMTJMOTY2LjI2Niw0NzguMTY0TDk1NC42MDIsNDg3LjkyOEw5NTguMDU4LDQ5OC4xODFMOTU1LjczOCw1MDguNzk1TDk0Ni43MjksNTEyLjY5OUw5NDQuMjgxLDUyNS43ODFMOTI1LjQxNyw1NDUuNjU1TDkxNC41ODUsNTUwLjg2OEw5MDAuMzI5LDU1MC41MDdMODg3LjE3Nyw1NTQuNzVMODgxLjA4MSw1NTAuNTIyTDg4MC45ODUsNTQwLjcyMUw4NjcuNjA5LDUyMC40MDJMODYzLjM2OSw0OTguMjcxTDg1Mi40MjUsNDgwLjMwN0w4NTEuNzM3LDQ3NC4xMDFMODU2LjYxNyw0NTguMzg3TDg2MC42MDEsNDUzLjUwNUw4NTguODI1LDQzOC4wNTRMODUyLjk1Myw0MjIuMzkyTDgzOS4wOTYsNDA0Ljk0TDg0My41MjgsMzg2LjMzN0w4MzcuNzg0LDM3OC43OTJMODI2LjIxNiwzODEuMDU2TDgxOS4yMjQsMzcyLjEyN0w4MDQuNzEyLDM3My42NDZMNzkxLjI3MiwzNzkuMDYyTDc4Mi4xODQsMzc2Ljk3OUw3NjYuNTg0LDM4MC43MTdMNzU5Ljk3NiwzNzguNTIxTDc0Mi40NTUsMzY1LjM0MUw3MzQuMDM5LDM1MS42NThMNzI2LjE2NywzNDUuOTExTDcyMS42NzEsMzM0LjUzN0w3MjYuODIzLDMyOC4yODZMNzI3LjY1NSwzMTAuNjk4TDcyNC4xNjcsMzA2LjY2Nkw3MjguOTY3LDI5NC41NjJMNzM1LjgxNSwyODMuMzE2TDc0My45MTEsMjc1LjM4OEw3NDguMDU1LDI3NC44OTFMNzU3LjQ5NiwyNjYuOTYyTDc1Ni4zNzYsMjYxLjQzM0w3NjEuNTI4LDI1Mi4yNjNMNzY5LjI3MiwyNDguMzk3TDc3My42NCwyNDEuMDdMNzkwLjM2LDI0My42OTVMODA2LjUyLDIzNy4zMDlMODQyLjI2NCwyMzMuOTk5TDg0Ny4xMTIsMjM4LjE3NEw4NDUuMTEyLDI0Ny40MTlMODQ5LjM2OCwyNTIuMDNMODY3Ljc1MywyNTYuNTk2TDg2OS44MzMsMjYwLjU1M0w4ODQuODI1LDI2NS40OEw4OTIuNjgxLDI1NC42MzNMOTI4LjUwNSwyNjIuODAyTDkzMy43NTMsMjYwLjExN0w5NTIuMjk4LDI2MS4yNDVMOTU5Ljk5NCwyNDYuMDJMOTYwLjY2NiwyNDAuNzkyTDk1NC4yODIsMjM2LjQ2Nkw5NDQuNDg5LDIzOS41Mkw5MzYuMDg5LDIzNi45ODVMOTMxLjk5MywyMzkuMzYyTDkyMi44NTcsMjM3LjA2OEw5MTYuOTY5LDIzMC4xODVMOTE2LjMxMywyMjQuNjAzTDkyOS45NjEsMjE2LjgwMkw5MzguNDI1LDIxNy4zODlMOTQ4Ljk1MywyMTMuMjUyTDk1Ni4yOTgsMjEzLjE1NEw5NzAuNDQyLDIxOC4wMDZMOTg0LjY4MiwyMTUuMzk2TDk4NC4yMzQsMjEwLjQ2OEw5NjMuMDAyLDE5OC45MTRMOTczLjg2NiwxODkuOTRMOTU5LjIxLDE5Mi42ODVMOTU1LjY0MiwxOTcuMTA5TDk2Mi4zNjIsMTk3LjkxM0w5NTAuNTg2LDIwMi44NDFMOTQ0LjIzMywxOTguNTQ1TDk0OS4yNzMsMTk2LjIxM0w5MzYuNjY1LDE5Mi45NjRMOTI4LjE2OSwyMDAuMzgxTDkyMy4wMDEsMjEwLjc2Mkw5MjguMDI1LDIxNy41MzJMOTE3LjE0NSwyMjEuNTQ5TDkxNS44MDEsMjE4LjU2M0w5MDEuNDAxLDIyMC4xMDVMOTAyLjEwNSwyMjYuOEw5MDYuNzc3LDIzMC4xMzJMODk2LjMxMywyMzYuMjQxTDg5My44NjUsMjI5LjczNEw4ODYuMjQ5LDIyMS4xMDVMODg2Ljg0MSwyMTQuNTc2TDg3MS4xNzcsMjA2LjYzMkw4NjYuMjMzLDE5OS42NTlMODU4LjQwOSwxOTYuNzI1TDg1NS45NDUsMjA0LjAzN0w4NzAuNjE3LDIxNS4zNzNMODgxLjY3MywyMjAuNjM5TDg3NC45NjksMjIwLjI1NUw4NzYuMzEzLDIyNC43NzZMODcxLjU2MSwyMzEuMTdMODY4LjUwNSwyMjIuMDA4TDg1Ny4yNzMsMjE2LjY1Mkw4MzkuNTEyLDIwMi44MThMODI5LjAxNiwyMDguMzE3TDgxMy43ODQsMjA4LjU1OEw4MTMuNTEyLDIxMy44MTZMODAzLjYwOCwyMTcuNzEzTDgwMC40ODgsMjI3LjgzTDc5MC40NTYsMjM3LjAwOEw3ODAuNTg0LDIzNi45ODVMNzc2LjEwNCwyNDAuMjM1TDc3MS4wMTYsMjM1LjgxMkw3NjAuNDU2LDIzNi4xMzVMNzU3LjY1NiwyMjcuODNMNzYxLjAzMiwyMTguODQxTDc1OC4yNDgsMjA4Ljc2OEw3NjQuNTM2LDIwNS41NjRMNzkxLjU0NCwyMDcuMDA4TDc5NC42OTYsMTk1LjQ5MUw3NzkuNTkyLDE4My42MjhMNzkyLjgwOCwxODMuODAxTDgwNS45NDQsMTc3LjIxMkw4MDcuMjg4LDE3My41NzFMODE3LjAxNiwxNzAuNTc3TDgyMC45MiwxNjQuMDMyTDgzOS4xMTIsMTU5LjkxTDgzNi4wODgsMTUzLjI1Mkw4MzcuOTc2LDE0Ni4xNzRMODQ3LjAxNiwxNDMuNDIxTDg0OC41MDQsMTQ5LjA3TDg0Mi44ODgsMTUzLjQ2M0w4NDguNjE2LDE1OS45NjNMODU1LjY0MSwxNTcuOTA5TDg2Mi43NjEsMTYxLjA4M0w4NzguMzI5LDE1Ni4yMTZMODg3LjM4NSwxNTguMTA0TDg5NC41MjEsMTU0LjcxMkw4OTMuNzM3LDE0Ny42MjZMOTAwLjEwNSwxNDMuMzE1TDkwNy4yMDksMTQ2LjU1TDkwOC41NjksMTQwLjUxN0w5MDMuNzM3LDEzNi45NDRMOTI0LjM2MSwxMzUuNjY1TDkyNC43NjEsMTMxLjA5OUw5MDEuNjQxLDEzNC4wMTdMODk0Ljc2MSwxMzAuMTI4TDg5My41OTMsMTIxLjc0MUw4OTkuNzUzLDExNi4zNjJMOTEyLjg3MywxMTAuNjE1TDkwNi4yMzMsMTA2LjYzNkw4OTguNTg1LDEwNy44OTJMODk0Ljk2OSwxMTMuNzE0TDg3OS4zMjEsMTIxLjExNkw4NzYuMDg5LDEyNy4zNzVMODgzLjQ5NywxMzIuOTcyTDg3NC43OTMsMTM5LjAyTDg3MC41ODUsMTUwLjY1TDg1Ny41MjksMTUzLjk0NUw4NDYuMDI0LDEzNS42ODdMODM3LjI1NiwxNDAuODMzTDgyNS4xNzYsMTM5LjYwN0w4MjIuMTg0LDEyNC41NjlMODQ2Ljc5MiwxMTMuMzk4TDg2NS42MDksOTguNjE3TDg4NS4yNTcsODkuNzAzTDkwMi4zMjksODcuOTg3TDkwOS4wOTcsODQuMzA5TDkyNS4xNzcsODMuNjE3TDkzOS4wODEsODYuODc0TDkzMy4zNTMsODguMDYzTDk1MC4xMDYsOTEuOTk3TDk2Mi4yODIsOTMuMDVMOTc5LjA4Miw5OC4wNzVMOTgyLjc3OCwxMDMuMTQ1TDk3MC41ODYsMTA2LjY2Nkw5NTAuNzQ2LDEwMy4yODhMOTU1LjMwNiwxMTMuNzE0TDk2NC41MDYsMTE2LjIxOUw5NjUuMjI2LDExMC40NzJMOTc1Ljk3OCwxMTMuMjRMOTc2LjczLDEwOC45TDk4Ny4wODIsMTA0LjU1Mkw5OTUuMzM4LDEwNi4zNTdMOTk3LjkxNCwxMDMuMzAzTDk5My4xMyw5NS4yMzlMMTAwNS41NjIsOTYuNjY4TDEwMDUuOTk0LDEwMy43MDJMMTAxMy45NDYsOTkuOTAzTDEwMzguNzQ2LDkzLjk2OEwxMDM3LjcyMiw5Ni44ODdMMTA2MS4zMzksOTMuODYyTDEwNjYuNDExLDk2LjU0TDEwNjkuMTE1LDg5LjU1MkwxMDgyLjIzNSw5MC44OTlMMTEwNC40OTEsOTcuMzY4TDExMDcuNDY3LDk1LjA0NEwxMDk2LjQyNyw4NC4zMTZMMTExMC44NDMsNzUuMzhMMTEyMi42MDMsNzYuNTUzTDExMTkuMzIzLDgyLjYyNEwxMTIzLjUxNSw4Ny4xNTJMMTEyMi41MDcsOTMuMjM4TDExMjcuNDE5LDk1Ljk2MUwxMTE2Ljc5NSwxMDUuMjQ0TDExMjEuODgzLDEwNS44OThMMTEzMy41NjMsOTguODQyTDExMzMuMDUxLDkzLjM4MUwxMTI3LjExNSw5MC41NDVMMTEzMC42NjcsODYuMDc3TDExMjQuODkxLDgyLjQ1OEwxMTU0LjAxMiw3OC41NzdMMTE2Mi4yMiw4MS4xMTJMMTE1Ny44Miw3Mi42NzJMMTE4NS44ODQsNzEuMzkzTDExODcuNDA0LDY2LjE1TDEyMTQuMzgsNjIuMDEyTDEyMjkuNjc2LDYyLjU5OUwxMjQ3LjgyLDYwLjMxMkwxMjUzLjI5Myw1Ni40OThMMTI2My43ODksNTQuNjc4TDEyNjUuMzU3LDU3LjIxM0wxMjkzLjY3Nyw1OS4wNjNMMTMwNy4yNjEsNjIuOUwxMzA2LjE1Nyw2NS4yMDlMMTI4Ni4yMjEsNzAuMzFMMTMwNC41NzMsNzQuMDYzTDEzMTMuNjI5LDcyLjIxM0wxMzI3LjkwMSw3Mi45NDJMMTMyOC45NzMsNzUuMDE5TDEzNDcuNTY1LDc1LjY4MUwxMzQ3LjgwNSw3Mi4yODhMMTM2NC4zMzQsNzMuMDRMMTM3MS41MTgsNzUuMzg3TDEzNzAuOTI2LDgwLjA4OUwxMzgzLjUwMiw4NS4zOTJMMTM4Ny43OSw4MC43MjhMMTQyMS42NDYsODIuMjc4TDE0MTguNDMsNzguMTQ4TDE0MjQuMzAyLDc2LjIyMkwxNDY0LjQ0Nyw3OS4xMTFMMTQ3OS44NTUsODUuMTQ0TDE1MDYuNjU1LDg1LjAzOUwxNTE1LjI5NSw5MS4zODhMMTU0NS45MzUsOTAuNzQxTDE1NTMuNjgsOTQuNjk3TDE1NTkuMTg0LDkzLjI3NkwxNTU3LjU2OCw4OC40NTRMMTU4MC45OTIsODkuNDMyTDE1OTMuNzc2LDkxLjU1M0wxNjAwLDkzLjQ5NEwxNjAwLDExMS4yMDJaTTAsOTMuNDk0TDAuMDAxLDkzLjQ5NEwwLDkzLjQ5NEwyNC4xMjgsMTAxLjk0OUwzNi4xOTIsMTAyLjYxMUw0NC44OTYsMTA2Ljc3MUwzMy4yLDEwOS4xNjNMMjcuMTUyLDExNC4zMDFMMTYuODY0LDEwOS41MjRMMC41MTIsMTA3LjIyMkwwLDExMS4yMDJMMCwxMTEuMjAyTDAsOTMuNDk0Wk0zNzQuOSw5Mi44NTRMMzcyLjEzMiw5NC40MTJMMzU2LjQ1Miw5MS41NTNMMzYzLjQ3Niw4OC4yNTFaTTE2MDAsODMuNjQzTDE1OTkuOTk5LDg1LjE4OUwxNTk0LjMzNiw4NC4wMDhMMTYwMCw4Mi4xNUwxNjAwLDgzLjY0M1pNMCw4Mi4xNUwwLjAwMSw4Mi4xNUwwLDgyLjE1TDAsODMuNjQzTDAsODIuMTVaTTAsODIuMTVMMTAuNzY4LDgzLjI0OEwwLDg1LjE4OVpNMzk3LjU3Miw5MS4xMjRMNDAzLjQ5Miw5Mi4xODVMNDExLjc4LDEwMS4zNEw0MTkuNjUyLDk0LjI5MUw0MTkuOTA4LDg5LjQxN0w0MzguNzU2LDkyLjYxNEw0MzguMjc2LDEwMS43MzFMNDI5LjU3MiwxMDQuODM4TDQxOC44MDQsMTA0LjE4M0w0MTEuODkyLDExMi4xMDVMNDAwLjM4OCwxMTUuNDA3TDM4MS4xNTYsMTI5LjMzOUwzNzkuMTg4LDEzOC4wMDRMMzg1LjcxNiwxMzguNzQ5TDM4OS43OTYsMTQ2LjI3OUw0MDQuMjc2LDE0Ny4zMjVMNDIyLjE2NCwxNTQuMjA4TDQzNC4zNCwxNTQuOUw0MzguMjEyLDE2OC4xODVMNDQ0LjgzNiwxNzIuNDA1TDQ1MC42NjEsMTY2LjM5NEw0NDUuMjA0LDE1Ny4wMjlMNDUyLjMyNSwxNTQuOTUzTDQ1OS44MTMsMTQ4LjczOUw0NTEuMDI5LDEzOC42NDRMNDU2LjI3NywxMzMuOTg3TDQ1Mi44NTMsMTIzLjAyN0w0NzEuODI5LDEyMi40N0w0ODIuNzg5LDEyOC4yNzhMNDkwLjcwOSwxMjguNjE2TDQ5Mi4wNTMsMTM3Ljk2N0w0OTkuMzMzLDE0MS4yNzdMNTEyLjk2NSwxMzEuODQzTDUyNy4xMjUsMTQ2LjgxM0w1MjUuMzMzLDE0OS42MDRMNTQ1LjE4OSwxNTcuMjE3TDU1Mi4xOTgsMTYzLjI0Mkw1NTIuNTE4LDE2OC4yMzdMNTMzLjE4OSwxNzYuN0w1MDQuOTAxLDE3Ni43Nkw0OTUuNTA5LDE4MS45MjFMNDgzLjk3MywxOTEuOTAzTDUwNC4yMTMsMTgxLjYyN0w1MTQuNzg5LDE4My4zNjVMNTEwLjU5NywxODYuMzUxTDUxMy40NjEsMTk0LjQ5OEw1MjYuNTgxLDE5Ni4wN0w1MzEuMDI5LDE5MS4wNzZMNTM0LjIxMywxOTUuOTEyTDUwOS40OTMsMjA2LjQ2N0w1MDIuMzczLDIwMC44NDdMNDg4LjM3MywyMDUuODVMNDg1LjI2OSwyMDkuNDkxTDQ4OS4wNDUsMjE0Ljk0NEw0NzYuMTAxLDIxNi43OTVMNDYzLjQ2MSwyMzEuMzg5TDQ1OS44MTMsMjI3LjkyMUw0NjMuNDI5LDI0MS45OTVMNDUwLjg2OSwyNDkuNTAzTDQzOC41LDI2MC4yNjdMNDM3LjgxMiwyNjMuNDE5TDQ0NC4xOTYsMjgwLjUzM0w0MzkuMjM2LDI4Ny45OTVMNDI3Ljk1NiwyNjYuOTQ3TDQyMS43MzIsMjY4LjI4Nkw0MTYuMDA0LDI2NC44ODZMNDAxLjc0OCwyNjUuODg3TDQwMi42MjgsMjcwLjRMMzkyLjc3MiwyNjguMDk4TDM3OS4xNTYsMjY4Ljk3OEwzNjcuMjUyLDI3OC4zMTRMMzY4LjI2LDI4NS4wMzlMMzY1LjAxMiwzMDAuMjQ5TDM3My43OCwzMTYuMzE3TDM4MC4zMjQsMzE5LjM1NkwzOTYuNTY0LDMxNC4yOTRMMzk4Ljc1NiwzMDYuNjY2TDQxMy4xMDgsMzA0LjI1MUw0MDcuMzE2LDMyNi41MzNMNDA0Ljc1NiwzMjkuMzkxTDQyNS4wMjgsMzI5LjYyNUw0MzAuNDUyLDMzMy4zNDhMNDI3LjMxNiwzNDkuNDU0TDQzOC4wNTIsMzYwLjk0OEw0NDYuMzQsMzU3LjI4NUw0NTguNTAxLDM2MS42MDNMNDY0LjUzMywzNTIuODAxTDQ3My43MTcsMzUwLjEwMUw0ODEuMDkzLDM0NC43MjJMNDgyLjY2MSwzNTEuMjUyTDQ5My44NjEsMzQ5LjEzOEw0OTYuOTE3LDM1My4wODdMNTI0Ljk4MSwzNTIuMzczTDUyMi43MjUsMzU1Ljc4OEw1MzcuMzMzLDM2NC40NDZMNTQ2LjAwNSwzNzMuNDUxTDU1NS40MTQsMzczLjIxN0w1NjQuOTY2LDM3NS45NTZMNTcxLjkyNiwzODEuMzE5TDU3OC4wMDYsMzk1LjM0OUw1NzYuMDU0LDQwMC4zNTFMNTgzLjkxLDQwMS4wNDNMNjAwLjQyMiw0MDYuODk2TDYwMS44NjIsNDExLjk1OEw2MDcuMDMsNDEwLjU4OUw2MjIuMzEsNDEyLjc3MUw2MzQuNTY2LDQyMS40MjlMNjQzLjM5OCw0MjQuMjg4TDY0NS42MzgsNDMyLjYzN0w2NDMuODc4LDQzOS45ODdMNjI2Ljg3LDQ2MS4zMDZMNjI3LjE5LDQ2OS42MzNMNjIzLjI4Niw0ODcuMTA4TDYxMy4zODIsNTAyLjA5M0w1OTMuNDYyLDUwNy4wNjVMNTg0LjQ3LDUxNS4wMDlMNTgyLjcyNiw1MjcuNDQzTDU2Ny43NSw1NDMuMzE2TDU2MC44NTQsNTUyLjg3N0w1NTUuODQ2LDU1NS4zNDRMNTQwLjAyMSw1NTMuMDI3TDU0NS42NjksNTU2LjgzNEw1NDcuNjA1LDU2NC4wMUw1MzYuNzQxLDU3Mi4wODlMNTIyLjk0OSw1NzIuNTcxTDUyMy43OTcsNTgwLjc4NUw1MTAuNTgxLDU4Mi41MDhMNTExLjIwNSw1ODYuOTI0TDUxNy45NTcsNTg5LjE3M0w1MTAuMzA5LDU5My4zMUw1MDguNTk3LDYwMC4xNjNMNDk5LjYzNyw2MDUuNzgyTDUwOC4yNjEsNjA5LjkzNUw0OTguNTk3LDYyMS42NEw0OTIuNzI1LDYyNS40NzZMNDk3LjEwOSw2MzIuNjY4TDQ4NS4xNDEsNjM1LjEwNUw0ODQuNDIxLDYzOS4yNThMNDY2LjkwMSw2MzIuMjc3TDQ2My45NTcsNjE2LjMyOUw0NzAuNTQ5LDYwOC42MThMNDYzLjc5Nyw2MDcuMzI1TDQ2OS41NDEsNTk2LjAxMUw0NzQuNDg1LDU5Ny41NzVMNDc2LjgwNSw1ODguMzY4TDQ2OS42MzcsNTkyLjExNEw0NzQuODIxLDU2NC45OTZMNDgyLjUwMSw1NDQuMDgzTDQ4Mi4yNjEsNTI4LjI3MUw0ODQuODY5LDUyMi44NDdMNDg4LjQ4NSw0OTUuMDgyTDQ4Ny4yMzcsNDgxLjU0OUw0ODIuMzg5LDQ3Ny4xNzFMNDYyLjE4MSw0NjUuMTA1TDQ0NS41MDgsNDMxLjk3Nkw0MzguODg0LDQyNy4yNzRMNDM4LjE4LDQyMS4wNTNMNDQ1LjQ2LDQxMS44MDhMNDQwLjE0OCw0MDkuOTg3TDQ0NC4wMzYsMzk2LjU4Mkw0NDkuNTI0LDM5My44NTlMNDU3LjIwNSwzODIuODkxTDQ1NS42NTMsMzcwLjI2MUw0NDguMzU2LDM2MC4wMTVMNDQ0LjQyLDM2Ni40NTVMNDMxLjI2OCwzNjMuNDQ2TDQxOC42NzYsMzU0Ljk1M0w0MTkuMDYsMzUwLjcxOEw0MTAuMzU2LDM0Mi42MjNMMzk0LjUxNiwzMzguMDk1TDM3OS4xNTYsMzI3Ljk5MkwzNzAuODUyLDMzMC40M0wzNDAuMDAzLDMxOC43MDJMMzMwLjA4MywzMDkuMTc5TDMyOC43NTUsMjk4Ljc4MkwzMTQuMjU5LDI4Mi40NzRMMzAxLjIwMywyNzEuMzFMMjk3LjEyMywyNjEuNDYzTDI4OS44NzUsMjU4LjY2NUwyOTAuMzM5LDI2NS45NDdMMzAzLjkyMywyODEuNDk2TDMxMy43MzEsMjk2LjE1N0wzMDEuNDExLDI5MC4wNDlMMzAwLjg4MywyODQuMzkyTDI5MS4yNjcsMjc5LjM2N0wyOTIuNjExLDI3My4wNEwyODYuNTc5LDI2OC42NEwyNzguNjkxLDI1My4xMjhMMjY1LjAyNywyNDYuOUwyNTAuMDk5LDIyNi44ODNMMjQ3LjEyMiwyMjAuODI3TDI0Ni41MTQsMjA5LjkyN0wyNDkuMzMsMTk3LjY3M0wyNDYuMzcsMTg0Ljk4MkwyNTIuODAzLDE4Ni40ODdMMjUzLjQ0MywxODIuMjE0TDI0MS42NjYsMTc1LjkyNUwyMzMuNjE4LDE3NC4wODJMMjMxLjc3OCwxNjcuNDI1TDIyNi4wODIsMTY1LjUyOUwyMTkuODQyLDE1Ni40MzRMMjA0LjA5OCwxNDEuNjc1TDE5Mi43NywxNDEuMjc3TDE3OC4zNywxMzUuMzg3TDE2MC4xNzgsMTMzLjMzM0wxNDYuMTYxLDEyOS4zOTlMMTQyLjE0NSwxMzMuNDMxTDEyNS43MTMsMTM3LjA4N0wxMjcuMDczLDEzMC4xMDZMMTE1LjQ3MywxMzYuMjIyTDExOC43MjEsMTM4LjM4MUw5NS44NTcsMTUxLjEzOUw3NS4yNDksMTU2LjkzMUw2Ni45MjksMTU3LjQ1OEw4Ni4zODUsMTUxLjA3OEw5OS4wMDksMTQ0LjEzNUwxMDIuMDMzLDEzOC4xNEw5My4wNzMsMTQwLjMzNkw4Ny4zMTMsMTM3LjQ2M0w4MC4xNDUsMTM5LjIzOEw4MC41NjEsMTM0Ljk1OEw3MS45MjEsMTM0LjIyOEw2MS42ODEsMTI2LjY2OEw2OC42MDksMTE5LjM0OUw4NS40NTcsMTE2LjU5NUw4NS40MjUsMTEyLjA1Mkw2Ni44NDksMTEzLjU3MUw1Mi44NDksMTA4LjEzM0w2OS4wMDksMTA0LjEwMUw4MS40MjUsMTA2LjE1NEw2NC45MjksOTcuNTg2TDYxLjMxMyw5My44NTVMNjkuMjAxLDkzLjcxMkw4MC40MDEsODcuNDA4TDEwNC4wODEsODIuODU3TDEyMy4yNDksODYuMjJMMTU1LjkwNiw4OC45MzVMMTYxLjgyNiw4OC4yMTNMMTkzLjMxNCw5My43ODdMMjMwLjQ5OCw4Ni43MzlMMjQxLjA5LDkxLjJMMjU0LjczOSw4OS41M0wyOTMuNzk1LDk2LjAwNkwyOTUuNTcxLDk5LjE2NkwzMTEuMzQ3LDk3Ljg2NEwzMjguMjI3LDk0LjIyNEwzMzYuMjc1LDk3LjY5OUwzNDkuMDkxLDk5LjM0NkwzNjIuNDY4LDk4Ljc0NUwzNjEuOTU2LDk1Ljk4NEwzNzkuMTcyLDk3LjQ5NkwzODEuMTg4LDkzLjAyN0wzNzEuMjM2LDg4LjQ5MUwzNzYuODUyLDgwLjM1MkwzODcuMjA0LDgzLjAzWk0yOTIuNTk1LDc1LjAxOUwzMDYuNDM1LDc3Ljk5OEwzMTEuNDU5LDc1LjcyNkwzMTkuMTU1LDgxLjU0OEwzMTguMjQzLDc1LjE1NEwzMzEuNTM5LDc3LjAxMkwzMzUuNzE1LDg0LjQ3NEwzNTEuMjA0LDg4Ljc3N0wzNDMuNDExLDkxLjA5NEwzNDQuNzU1LDk0LjQzNEwzMjkuMDU5LDkyLjUzMUwyOTYuMzg3LDk1LjM5N0wyODMuOTcxLDkyLjU4NEwyNzguNDgzLDg5LjA2M0wzMDAuMzcxLDg3LjI1OEwyNzUuOTcxLDg2LjQ4M0wyODMuOTM5LDgzLjA2OEwyNjkuMzMxLDgxLjk2MkwyNzYuMTQ3LDc2Ljg2MlpNMzM1LjU1NSw3My42ODdMMzMxLjY1MSw3Ni42MjFMMzI0LjcwNyw3My41MTRaTTQ2MC43MDksNzUuMTAxTDQ0Ni43MjQsNzYuNzA0TDQ0Mi44NjgsNzIuMTgzWk00MTUuMjg0LDc0Ljg1M0w0MzQuMTQ4LDcyLjIyTDQ0MS4xMDgsNzkuNzI4TDQ1NC4xMTcsNzYuNjY2TDQ4My41NTcsODQuNzk4TDQ5NC4yNzcsODYuNTU4TDUwMi4zNTcsOTIuNTA4TDQ5NC4xOTcsOTQuNTc3TDUyNS4xMDksMTAyLjgzN0w1MTUuOTI1LDExMS4xMTlMNTAzLjQ2MSwxMDQuOTQzTDQ5Ny4xNTcsMTA4LjA0Mkw1MDkuNjg1LDExMy44NTdMNTExLjA0NSwxMjEuNDQ3TDQ5NC4yOTMsMTE2LjY4Nkw1MDUuOTI1LDEyNC43NUw0OTMuODc3LDEyMi45NzRMNDY3LjQ3NywxMTMuODI3TDQ1NC42MjksMTE0LjUzNEw0NTMuNzk3LDEwOS43MzVMNDcxLjI4NSwxMDkuMDg4TDQ3Ny4xMDksMTAwLjk1Nkw0NzQuMTY1LDk3LjQ2Nkw0NTguMzU3LDkzLjgwMkw0NDkuMDc2LDg4LjE0NUw0MzguNjQ0LDkwLjAzNEw0MDUuODYsODcuMDYyTDM5OS4wOTIsNzguOTUzTDQwNy4wNzYsNzMuMTY4TDQxOC41NDgsNzEuOThaTTM1My45NzIsNzEuODA3TDM2Ny4yMDQsNzIuMTc1TDM2NC4yMTIsNzUuNTk4TDM3MC45MzIsNzcuNTA5TDM3MC4xMzIsODEuNTExTDM2Mi44NTIsODMuMjMzTDM0NC40NTEsNzcuNzM0TDM1My42MDQsNzYuODYyWk0xNDM4LjIzOCw3NC42MTJMMTQyMS42MTQsNzMuOTEzTDE0MzEuMzksNzEuNzQ2Wk0zODUuNzk2LDc2LjU2OEwzNzUuOTU2LDc5LjcyOEwzNzMuMTg4LDc1LjgyNEwzNzkuOTg4LDcwLjUxM0wzOTcuNzMyLDcxLjc0NlpNMjY0LjYyNyw4Mi42NjlMMjUyLjkzMSw4NC44ODFMMjQwLjMyMiw4MC41ODVMMjQ5LjE1NCw3Mi41MzZMMjQ0LjgwMiw2OS44MTNMMjU5LjgyNyw2OS4xMTRMMjc3LjUyMyw3MC4yODdMMjg2LjYxMSw3My40NDZMMjcwLjEzMSw3Ny42ODlaTTE0NjkuOTE5LDY2LjI5M0wxNDY0Ljc4Myw2OC4wNTNMMTQ1MC40NzksNjQuNDU3Wk0zODMuOTQsNjYuNzU5TDM2OS42ODQsNjYuOTg1TDM3OC40MzYsNjMuNzg4Wk0xNDQ0LjgzLDY0LjE2NEwxNDQxLjMyNiw2Ny40NjZMMTQxNy41ODIsNjguMzkxTDE0MDguNzgyLDY1LjUwM0wxNDExLjE2Niw2Mi40NDlMMTQyOC43NjYsNjEuODA5Wk0zNjIuMjI4LDU5LjAyNkwzNjMuNzMyLDY2LjY2OUwzNTEuNjM2LDY2LjQxM0wzNDQuMTQ3LDYwLjcyNlpNMzE5LjA1OSw2MS4zMjhMMzI5LjQxMSw2Mi4zNThMMzI3LjQ5MSw2Ni42NDZMMzAxLjIzNSw2OS4yNTZMMzAzLjEzOSw2NS45NDdMMjc2LjgzNSw2NS42NzZMMjg3LjA5MSw2MC4wOTRMMzE1LjI1MSw2NC41NjJMMzA4Ljg5OSw2MC4zMTJaTTEwNTUuNzA3LDg1LjY4NkwxMDM4LjU3LDg1LjQ5N0wxMDI5LjMzOCw4Mi4zMzhMMTAzNy44MTgsNzIuMjJMMTA0Ny4yNTgsNjYuMzA4TDEwNzEuODY3LDYxLjEwMkwxMTAyLjkyMyw1OC4wNDhMMTEwMy4wMTksNjEuMTg1TDEwNzMuNzA3LDY1LjUxTDEwNTkuODk5LDY5LjczOEwxMDQ2LjMxNCw3OC4zNTFMMTA0Ny4yMSw4Mi4wNDVaTTM3OS4xODgsNTcuMzQxTDM5Mi44NjgsNTguNzYzTDQwMy42Miw2My45NTNMNDM5LjQyOCw2My40OTRMNDQ1LjE4OCw2Ny4wMDdMNDM1Ljc4LDY5LjE0NEw0MDguMjI4LDY5LjM2OUwzODkuMjM2LDY3LjM5MUwzODIuNjkyLDYwLjgwMUwzNjguMzU2LDU4Ljg4M1pNMjgzLjU1NSw1NC45MTFMMjgyLjk0Nyw1OC4zMjZMMjY3LjEwNyw2MS45ODJMMjUzLjk3MSw2MS43MDRMMjcwLjY0Myw1NS40OThaTTM4Mi45MzIsNTUuNDY4TDM4Mi45MzIsNTUuNDY4TDM4Mi45MzIsNTUuNDY4Wk0zMTAuMjc1LDU0LjY3OEwzMTAuMjc1LDU0LjY3OEwzMTAuMjc1LDU0LjY3OFpNOTA5Ljg4MSw1My45ODZMODk5Ljk2MSw1NS43OTlMODkyLjUwNSw1Mi4yMDNMOTAxLjcwNSw1MS4zMDhaTTMxMi42MTEsNTAuNjYxTDMxMi42MTEsNTAuNjYxTDMxMi42MTEsNTAuNjYxWk0zNzQuMDg0LDUzLjA4M0wzNjMuODkyLDUyLjk2M0wzNjEuNjM2LDQ5LjQ1N1pNMzU1LjI4NCw1MS44ODdMMzQyLjQ1MSw1MS44MDRMMzMxLjEzOSw0Ny41NDdMMzUxLjg5Miw0OS43NzNaTTEyNjcuMDA1LDUxLjk3TDEyNDEuOTQ4LDUzLjY4NUwxMjUwLjA2MSw0Ny44NDdMMTI2OC4zMTcsNTAuMTY0Wk04ODEuMTEzLDQ1Ljc3MUw4OTUuNzUzLDQ5LjA4MUw4ODQuNTY5LDUwLjgzNEw4NzYuMDg5LDU4LjYyN0w4NjEuMTYxLDU2LjA4NUw4NjUuMTkzLDU0LjUwNUw4NDkuODgsNDkuNDcyTDg0Ni40MjQsNDUuOTg5TDg3NS41MTMsNDQuMjIyWk05MTMuMDk3LDQyLjYzNEw5MjEuODE3LDQ0LjE5Mkw5MTUuMjI1LDQ2LjU4NEw4ODkuMjI1LDQ2LjM3M0w4NzcuMTkzLDQzLjAyNkw5MDEuODY1LDQxLjUyMVpNMTAyNy4yNzQsNDIuMDFMMTAxMS40OTgsNDQuNDAyTDEwMDkuMjEsNDEuOTU3TDEwMjIuMzk0LDQwLjM2M1pNMTI0NC4xNzIsNDkuNDJMMTIzNC40NzYsNDkuOTY5TDEyMTQuNzE2LDQ2Ljk5TDEyMDUuMjQ0LDQyLjkyOEwxMjI2LjM5NiwzOC44ODhMMTI0NS4yNzYsNDUuNDI1Wk00MTMuMjUyLDQ1Ljk1OUw0MTguNTk2LDQ3LjM4OUw0MDQuMjkyLDUyLjA2TDM4Ny4yMiw1MS44MDRMMzg2LjAyLDQ3LjIwMUwzNzcuODkyLDQ3LjIzMUwzNzAuMTgsNDMuNzRMMzc4Ljk0OCwzOS4wODRMMzg5LjI4NCwzOC44NThMNDA5LjczMiw0My4wMjZaTTQ5NS41NTcsMzAuNjM2TDUxNi45ODEsMzEuNTU0TDUyNC45MTcsMzMuOTQ2TDQ5OS4zMDEsMzcuNzc1TDUwOC45ODEsMzcuNzUyTDQ5MS4yNTMsNDEuNzAyTDQ4My42MzcsNDUuMzM1TDQ1OC4xODEsNDcuNDU2TDQ2NC45MTcsNTAuOTk5TDQ0Ni4xMzIsNTcuODUyTDQ1My44MjksNTguNzYzTDQ0MS45NTYsNjEuNDMzTDQzMC4zNCw2MC4yMDdMNDAyLjI2LDYwLjEyNEw0MDkuOTI0LDU2Ljk4N0w0MDcuNzMyLDUzLjc3NUw0MjIuMzI0LDU1LjM4NUw0MDkuMDYsNTEuNjg0TDQyMS43OTYsNDcuMzUxTDQxMy42MzYsNDMuMzI2TDQyOS4zLDQ0LjAwM0w0MzYuMjI4LDQyLjM3OUw0MTAuNjc2LDQyLjE1M0wzOTIuOTQ4LDM2LjAyMkw0MjAuMDA0LDMyLjY2TDQzMC4zMDgsMzQuMTM0TDQzMy42ODQsMzEuNzM0TDQ0Ny41MjQsMzAuNTMxWk02NzkuNTU5LDI4LjgwMUw3MDcuMzUxLDMyLjMyOUw2OTkuMTQzLDM0LjAzNkw2NTguMjE1LDM0LjY2OEw2ODkuNTc1LDM2LjUwNEw2OTguMjE1LDM1LjE0Mkw2OTcuMDMxLDM5LjMyNEw3MjkuOTExLDM1Ljk0N0w3NDUuNzM1LDM4LjcwOEw3MjEuMTkxLDQzLjg2OEw3MTIuNDIzLDQ5Ljk5MUw3MTcuODk1LDU3Ljg0NUw3MDMuNjM5LDU5LjQzMkw3MTEuODQ3LDYxLjc4N0w3MDguMTM1LDY1Ljk3N0w3MTMuODk1LDY5Ljc5OEw3MDQuMDIzLDcwLjExNEw3MDcuNzE5LDczLjQ5Mkw2OTUuMjU1LDc0LjE5MUw3MDAuODg3LDc5LjE3OUw2OTIuMTAzLDc3LjM0M0w3MDMuMzE5LDg1Ljk0MUw2OTUuMzk5LDg2Ljc5OUw2ODYuNDcxLDgyLjUyNkw2ODIuODM5LDg3Ljg4Mkw3MDAuNjc5LDg4LjMxMUw2NzYuNjc5LDk1LjY5TDY1OC43NzUsOTcuMjRMNjQ3Ljk5LDEwMy42NDlMNjIzLjA2MiwxMDkuMDczTDYxNi45MzQsMTE3Ljg1OUw2MDkuNjg2LDEyMS40MUw2MTEuNDc4LDEyNC44ODVMNjA3LjIwNiwxMzIuODk3TDU5NC4zOSwxMjkuNTQyTDU4NS40OTQsMTI5LjUxOUw1NzAuNTE4LDExNy4yMTJMNTYwLjEzNCwxMDEuMzg1TDU3MS4yMjIsOTQuNTMyTDU3My45MSw4OS4yMDZMNTYyLjQyMiw5Mi4wNzJMNTU2Ljk2Niw5MC42Mkw1NTguNDA2LDg1LjI0Mkw1NzEuNjA2LDg2LjM1NUw1NTkuOTc0LDgyLjAxNUw1NTEuODQ2LDgxLjUzM0w1NTYuODA2LDc3LjM5Nkw1MzkuNjIxLDY0LjM2N0w1MjcuNzAxLDYxLjc2NEw0OTUuNTQxLDYxLjk1Mkw0ODIuNjYxLDU3Ljc0TDUwMy4yNjksNTYuMTA3TDQ4NC4yNjEsNTQuOTQ5TDQ3NC44NTMsNTEuNDEzTDUwNy45NTcsNDcuMTMzTDQ5Ny42NjksNDMuOTIxTDUyMy4zOTcsMzguNTcyTDUyMS41NTcsMzYuNTc5TDU0NS43NDksMzQuNzA2TDU2NC4yNDYsMzYuMDUyTDU3Ni4wMzgsMzMuNjA3TDYwMi4xMTgsMzcuMDZMNTkyLjE2NiwzMi43NjVMNjA3LjA3OCwzMC4xMDlMNjIyLjY3OCwzMC4zMTNMNjQ0LjA1NCwyOC4yNDRaIi8+PC9zdmc+";
const GLOBE_EDGE_MASK = "radial-gradient(circle, #000 65%, rgba(0,0,0,.85) 78%, rgba(0,0,0,.25) 92%, transparent 100%)";
// 日本列島だけを抜き出したマスク(world-atlasのcountries-50mから日本=ISO392を
// 抽出し、同じ投影・簡略化手順で生成)。日本株サイトとして、周辺よりわずかに
// 明るく見せるための専用ハイライトに使う。
const GLOBE_JAPAN_MASK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAwIDgwMCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEzOTIuNzUsMjM5LjA5N0wxMzkyLjc1LDIzOS4wOTdMMTM5Mi43NSwyMzkuMDk3Wk0xNDE0Ljg2MiwyMzEuODk4TDE0MTQuNDMsMjMxLjEzNEwxNDE1LjU2NiwyMjkuNzA3TDE0MTUuODg2LDIzMC44MThaTTEzOTkuNjk0LDI0Ny42MDdMMTM5OC41MjYsMjQ3LjU4NEwxNDAwLjAxNCwyNDYuNDczWk0xMzgwLjU0MiwyNjUuNDk5TDEzODAuNTQyLDI2NS40OTlMMTM4MC41NDIsMjY1LjQ5OVpNMTM4Mi4wNDYsMjY0LjkwNUwxMzgyLjA0NiwyNjQuOTA1TDEzODIuMDQ2LDI2NC45MDVaTTEzNzguMTQyLDI1Ni43NThMMTM3OC4xNDIsMjU2Ljc1OEwxMzc4LjE0MiwyNTYuNzU4Wk0xMzc0LjU3NCwyNDguMzRMMTM3NC41NzQsMjQ4LjM0TDEzNzQuNTc0LDI0OC4zNFpNMTM3NS4wNTQsMjQ3LjMxNEwxMzc1LjA1NCwyNDcuMzE0TDEzNzUuMDU0LDI0Ny4zMTRaTTEzNzEuODU0LDI1NC4yOTZMMTM3MS44NTQsMjU0LjI5NkwxMzcxLjg1NCwyNTQuMjk2Wk0xMzc5LjQ3LDI1NS44OTNMMTM3OS40NywyNTUuODkzTDEzNzkuNDcsMjU1Ljg5M1pNMTQyNi45OSwxOTguNTIxTDE0MjYuOTksMTk4LjUyMUwxNDI2Ljk5LDE5OC41MjFaTTE0MjcuOTgyLDE5OS40N0wxNDI3Ljk4MiwxOTkuNDdMMTQyNy45ODIsMTk5LjQ3Wk0xNDE5LjkxOCwyMTIuOTcyTDE0MTkuOTE4LDIxMi45NzJMMTQxOS45MTgsMjEyLjk3MlpNMTM5Ny4xMTgsMjQ2Ljc0M0wxMzk3LjExOCwyNDYuNzQzTDEzOTcuMTE4LDI0Ni43NDNaTTE0MTkuODA2LDI0NS42NjNMMTQxOS44MDYsMjQ1LjY2M0wxNDE5LjgwNiwyNDUuNjYzWk0xMzczLjY3OCwyNTQuMDQyTDEzNzMuNjc4LDI1NC4wNDJMMTM3My42NzgsMjU0LjA0MlpNMTM3NS41MTgsMjUyLjM0NEwxMzc1LjUxOCwyNTIuMzQ0TDEzNzUuNTE4LDI1Mi4zNDRaTTEzNzYuODc4LDI1MC4wMDdMMTM3Ni44NzgsMjUwLjAwN0wxMzc2Ljg3OCwyNTAuMDA3Wk0xMzg5LjIzLDI0OC4zNzlMMTM4OS4yMywyNDguMzc5TDEzODkuMjMsMjQ4LjM3OVpNMTM4Ny44NTQsMjQ5LjEzNUwxMzg3Ljg1NCwyNDkuMTM1TDEzODcuODU0LDI0OS4xMzVaTTEzNzYuNTI2LDI1OS4zMDRMMTM3Ni41MjYsMjU5LjMwNEwxMzc2LjUyNiwyNTkuMzA0Wk0xNDMxLjk1LDI4MS43MDJMMTQzMS45NSwyODEuNzAyTDE0MzEuOTUsMjgxLjcwMlpNMTQzOS4yMTQsMjAzLjkyMUwxNDQzLjU1LDIwNC43MDhMMTQ0NS45NjYsMjAyLjk1N0wxNDQ0Ljg5NCwyMDUuNDg4TDE0NDUuOTY2LDIwNy41NDhMMTQ0OC4xNDIsMjA3LjE3N0wxNDQ2LjY4NiwyMDguMTExTDE0NDIuNzk4LDIwOS4xMjJMMTQ0MC44NzgsMjA5LjAwNkwxNDM4LjE0MiwyMTAuNjczTDE0MzYuNjA2LDIxMy4zMzRMMTQzMy4zNzQsMjEyLjE4NUwxNDMwLjQ0NiwyMTAuNzU3TDE0MjguNDc4LDIxMC45MDRMMTQyNi42MDYsMjExLjgxNEwxNDI0LjM1LDIxMC44NUwxNDIzLjYzLDIxMS44NDVMMTQyNy4zNDIsMjE0LjE5OUwxNDI1LjE1LDIxNC4xNTJMMTQyMi44NzgsMjE1Ljg5NkwxNDIyLjIwNiwyMTUuMjE3TDE0MjIuNzAyLDIxMy43MkwxNDIxLjQyMiwyMTEuNjE0TDE0MjEuNzQyLDIxMC40NDlMMTQyNC4zODIsMjA4LjY2NkwxNDIzLjk2NiwyMDcuNTRMMTQyNy45ODIsMjA4LjAwM0wxNDI4LjQzLDIwNi4wMzVMMTQyOS41MzQsMjA0LjM2MUwxNDMwLjE0MiwyMDEuMjZMMTQyOS4yNjIsMTk5LjMwN0wxNDMwLjgzLDE5Ny43MzRMMTQzNC4yMzgsMjAwLjgwNEwxNDM2LjgzLDIwMi42NzlaTTEzODMuMDA2LDI1MC42NTVMMTM4NC44MTQsMjUwLjQzMUwxMzg0LjYwNiwyNTIuMTEzTDEzODYuMjA2LDI1Mi4yMDVMMTM4Ni41NTgsMjU0LjAyNkwxMzg1LjQ3LDI1NS4xNDVMMTM4My43MjYsMjYwLjQyM0wxMzgwLjgzLDI2Mi4xNTlMMTM4MS4yOTQsMjYxLjAyNEwxMzgwLjY4NiwyNTkuMDI2TDEzODAuMzk4LDI2MS40MjZMMTM3OC42NywyNjAuOTI0TDEzNzkuMjE0LDI1OS41NTFMMTM3OC42MzgsMjU3LjM3NUwxMzgwLjYyMiwyNTUuMDI5TDEzNzkuNDcsMjUyLjkyM0wxMzc4LjMzNCwyNTIuODY5TDEzNzguNTU4LDI1My45OTVMMTM3Ny4wMDYsMjU0LjU1MUwxMzc1LjkxOCwyNTIuMjgzTDEzNzYuMjcsMjUxLjcxMkwxMzc5LjQwNiwyNTAuNTE2TDEzNzkuOTM0LDI0OS42MjFMMTM4Mi4wMTQsMjQ5LjQ1OVpNMTM5Ny4xNSwyNDcuNzQ2TDEzOTguMzgyLDI0Ny44ODVMMTM5OC44NDYsMjQ5LjY5TDEzOTcuMjMsMjUwLjYzMUwxMzk2LjM2NiwyNTIuMjM2TDEzOTMuOTE4LDI1MS4wNjRMMTM5Mi4zODIsMjUxLjczNUwxMzkxLjAwNiwyNTQuMDM0TDEzODkuNTE4LDI1NC4zODlMMTM4OC44NjIsMjUzLjcwMkwxMzg4LjQ5NCwyNTEuNDE4TDEzODcuMDU0LDI1MS44MkwxMzg5LjUxOCwyNTAuMjY5TDEzOTAuMTU4LDI0OC45MjZMMTM5MS43MSwyNDkuMjEyTDEzOTMuNjk0LDI0OC44MTFMMTM5NC4yNTQsMjQ3LjgzMUwxMzk1Ljg4NiwyNDcuMjk4Wk0xNDI3LjY3OCwyMTYuMTJMMTQyOC42ODYsMjE1Ljk4MUwxNDI4LjcxOCwyMTkuNTA3TDE0MzAuMjA2LDIyMC45MjdMMTQzMS4wNywyMjMuMTQ5TDE0MzAuNjcsMjI2LjE3M0wxNDI5LjU5OCwyMjYuNzc1TDE0MjguNzUsMjI5LjMxM0wxNDI3LjE1LDIyOS42MDdMMTQyNi4zNSwyMzEuMzM1TDE0MjYuODMsMjMzLjQ4TDE0MjYuNTI2LDIzNS41NDhMMTQyNS4wMDYsMjM3Ljc2MkwxNDI0Ljk5LDIzOS43MzdMMTQyNi4xMSwyNDEuMjI2TDE0MjQuMjU0LDI0Mi4xNzVMMTQyMy44MDYsMjQzLjY0MUwxNDIxLjg3LDI0NC44OTFMMTQyMS40NTQsMjQzLjEyNEwxNDIyLjYwNiwyNDIuMDQ0TDE0MjEuNDg2LDI0MS41MTlMMTQyMC42MDYsMjQzLjgxMUwxNDE4Ljg5NCwyNDMuMjA5TDE0MTcuMzI2LDI0Ni4wOTVMMTQxNi44OTQsMjQ0LjU1OUwxNDE1LjkwMiwyNDQuMDU4TDE0MTQuMTc0LDI0Ni4yNDFMMTQxMS4zMSwyNDUuOTRMMTQwOS4xNjYsMjQ2LjI5NUwxNDEwLjExLDI0NS40NTRMMTQwOC4zODIsMjQ1LjMwOEwxNDA4LjIzOCwyNDQuMTgxTDE0MDYuODE0LDI0NS44NzFMMTQwOC4yMzgsMjQ3LjQ0NUwxNDA1LjkxOCwyNDguMTAxTDE0MDQuMDc4LDI1MC44NEwxNDAyLjAxNCwyNTAuODcxTDE0MDAuNzgyLDI0OS4zNDNMMTQwMC40NDYsMjQ3LjYwN0wxNDAxLjcxLDI0Ni42NjZMMTM5OC44NDYsMjQ1LjQ4NUwxMzk2LjQ3OCwyNDUuNzg2TDEzOTUuNDIyLDI0Ni41NDJMMTM5MS43NDIsMjQ3LjU0NUwxMzg3LjcyNiwyNDcuODc3TDEzODcuMzEsMjQ5LjYwNUwxMzg1LjUxOCwyNDguNjU2TDEzODEuODU0LDI0OC45OTZMMTM4Mi4yMzgsMjQ3LjE0NEwxMzgzLjc5LDI0Ny4wNTFMMTM4Ni4wMywyNDUuNjYzTDEzOTAuNzY2LDI0Mi4xNzVMMTM5Mi43ODIsMjQyLjQwN0wxMzk2LjUxLDI0Mi4wNDRMMTQwMC43ODIsMjQxLjEyNkwxNDAxLjQ1NCwyNDIuMTA2TDE0MDMuMDIyLDI0Mi4yMDZMMTQwNC44NjIsMjQxLjAzM0wxNDA0LjQ3OCwyNDAuMDQ2TDE0MDcuNTUsMjM2LjcwNUwxNDA4LjE5LDIzMy44NThMMTQxMC4zMTgsMjMzLjIzM0wxNDA4LjU1OCwyMzQuNzkxTDE0MDguOTU4LDIzNi4yODFMMTQxMC40MTQsMjM2LjU3NEwxNDExLjE2NiwyMzUuNzcxTDE0MTQuNzUsMjM0LjU4M0wxNDE3LjI2MiwyMzEuODA1TDE0MTkuNTY2LDIzMC40NzhMMTQyMC4zNSwyMjguNDQ5TDE0MjIuMzgyLDIyNC44MzhMMTQyMi40NjIsMjIzLjMzNEwxNDIxLjA3LDIyMi41NzhMMTQyMi4yODYsMjIwLjgyNkwxNDIxLjg4NiwyMTkuNTYxTDE0MjMuNDcsMjE4LjQ2NUwxNDIzLjkzNCwyMTYuNzZMMTQyNS4wMDYsMjE2LjkwN0wxNDI1LjI0NiwyMTguMjQ5TDE0MjcuMTk4LDIxOC4zMDNMMTQyNy41NSwyMTYuNjk4TDE0MjUuNzc0LDIxNy4xNjFMMTQyNi4zODIsMjE1LjUzM1pNMTM1Mi40MTQsMjkxLjAzOEwxMzUyLjQxNCwyOTEuMDM4TDEzNTIuNDE0LDI5MS4wMzhaTTEzNTAuNjIyLDI5Mi4wODdMMTM1MC42MjIsMjkyLjA4N0wxMzUwLjYyMiwyOTIuMDg3Wk0xMzU3LjUzNCwyOTAuMDI3TDEzNTcuNTM0LDI5MC4wMjdMMTM1Ny41MzQsMjkwLjAyN1pNMTM3MC4wNDYsMjgxLjU0TDEzNjcuNjc4LDI4Mi41MTJMMTM3MC4wMywyODAuNTIyWk0xMzczLjMyNiwyNzYuNzk1TDEzNzMuMzI2LDI3Ni43OTVMMTM3My4zMjYsMjc2Ljc5NVpNMTM3NS4zNDIsMjc0LjYyN0wxMzc0LjA2MiwyNzQuNDQyTDEzNzYuMzk4LDI3My4yNTRaTTEzNzQuNzY2LDI3NS4wOUwxMzc0Ljc2NiwyNzUuMDlMMTM3NC43NjYsMjc1LjA5Wk0xNDIxLjUxOCwyNTMuMDg1TDE0MjEuNTE4LDI1My4wODVMMTQyMS41MTgsMjUzLjA4NVoiLz48L3N2Zz4=";
// 初回オープニング時の自転パラメータ(朝刊ヒーロー側=spinMode既定値"once"用。
// 無限ループではなく一度きり)。
// 開始まで少し間を置いてから、ゆっくり減速しながら一方向にだけ回って止まる。
const GLOBE_INTRO_DELAY_MS = 700;
const GLOBE_INTRO_DURATION_MS = 8000;
const GLOBE_INTRO_DEGREES = 45;
// タップ時に追加でほんの少しだけ回る量(こちらも一方向・減速して停止・無限ループなし)。
const GLOBE_TAP_DURATION_MS = 3000;
const GLOBE_TAP_DEGREES = 25;
// 減速して止まる見え方のイージング(ease-out寄り)。
const GLOBE_ROTATE_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

// KabuBocchi独自の抽象デジタル地球。実際の海岸線ベースの世界地図(日本列島が
// 正面に来る位置を基準)を、ドット+輪郭線+薄いシルエットの3レイヤーで表現。
// 光源(ハイライト/影)・グリッド・リング・HUDは別レイヤーで完全に固定し、
// 地形と一緒には動かさない(円盤自体をtransform:rotate()することは一切ない)。
//
// spinMode:
//   "once"(既定値。朝刊ヒーロー側で使用) … 初回マウント時に一度だけ・タップ時に
//     一度だけ、減速しながら目標角度まで動いて完全に止まる有限アニメーション。
//     経度(mask-position-x)をReact stateで動かし、CSSのtransitionで実現。
//   "continuous"(オープニング画面で使用) … 地球表面が途切れなく一方向へ流れ
//     続ける演出。CSSの@keyframes+animation:infiniteで実現(GLOBE_MASK_TILE_PX
//     ぶんだけ動かすとちょうど1周分になり継ぎ目が出ない)。
// opacity/ringPower/glowPowerで、オープニング(主役)と朝刊ヒーロー(脇役)の
// 見せ方だけを調整できる。
function SpinningEarth({
  size = 108, onClick, title, opacity = 1, ringPower = 1, glowPower = 1,
  spinMode = "once",
}) {
  const continuous = spinMode === "continuous";

  // rotationDeg: 基準位置からの累積回転量(度)。常に加算のみ(一方向・往復しない)。
  // spinMode="once"のときだけ使う(continuousはCSSの@keyframes任せ)。
  const [rotationDeg, setRotationDeg] = useState(0);
  const [transitionMs, setTransitionMs] = useState(GLOBE_INTRO_DURATION_MS);
  const introTimer = useRef(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (continuous) return undefined; // continuousはCSS側(@media prefers-reduced-motion)で減速する
    if (reducedMotionRef.current) return undefined; // 動きを減らす設定の場合は自転させない
    introTimer.current = setTimeout(() => {
      setTransitionMs(GLOBE_INTRO_DURATION_MS);
      setRotationDeg((deg) => deg + GLOBE_INTRO_DEGREES);
    }, GLOBE_INTRO_DELAY_MS);
    return () => clearTimeout(introTimer.current);
  }, [continuous]);

  const handleTap = () => {
    if (!continuous && !reducedMotionRef.current) {
      setTransitionMs(GLOBE_TAP_DURATION_MS);
      setRotationDeg((deg) => deg + GLOBE_TAP_DEGREES);
    }
    if (onClick) onClick();
  };

  // +方向にずらすと、日本列島の西隣(中国大陸・朝鮮半島・インド方面)へ
  // 自転していく。この向きに固定することで、停止位置が必ず陸地の多い
  // アジア〜インド方面になるようにしている(太平洋側は陸地が少なく、
  // 自転後に何もない海だけが見える構図になってしまうため避けている)。
  // ※continuousモードではこの値は使わず、CSSの@keyframesが動かす。
  const maskPositionX = `${GLOBE_MASK_BASE_X + rotationDeg * GLOBE_PX_PER_DEG}px`;
  const maskTransition = reducedMotionRef.current
    ? "none"
    : `-webkit-mask-position-x ${transitionMs}ms ${GLOBE_ROTATE_EASING}`;
  // 陸地4レイヤー共通のmask-position関連props。continuousモードではCSS
  // クラス(.globe-continuous-spin)にx方向のアニメーションを任せ、inline
  // styleのx/transitionは指定しない(二重に競合させない)。
  const surfaceMaskProps = continuous
    ? { className: "globe-continuous-spin", style: { WebkitMaskPositionY: `${GLOBE_MASK_BASE_Y}px` } }
    : { style: { WebkitMaskPositionX: maskPositionX, WebkitMaskPositionY: `${GLOBE_MASK_BASE_Y}px`, transition: maskTransition } };

  return (
    <div
      onClick={onClick ? handleTap : undefined}
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

      {/* 球体本体(球そのものは動かない。縁はここでフェードさせて球面感を出す)。
          内部の陸地レイヤーだけがmask-position-xで一方向に自転する。 */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: "radial-gradient(circle at 32% 26%, #1c4468 0%, #0c2038 34%, #061527 64%, #030a15 100%)",
        boxShadow: "inset -9px -9px 20px rgba(0,0,0,0.6)",
        WebkitMaskImage: GLOBE_EDGE_MASK,
      }}>
        {/* 緯度経度グリッド(海陸問わず全面、陸地より確実に薄く、固定) */}
        <div style={{
          position: "absolute", inset: "-2px -6px",
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(150,205,255,0.05) 0px, rgba(150,205,255,0.05) 1px, transparent 1px, transparent 15px), " +
            "repeating-linear-gradient(0deg, rgba(150,205,255,0.03) 0px, rgba(150,205,255,0.03) 1px, transparent 1px, transparent 19px)",
          backgroundSize: "15px 100%, 100% 19px",
          backgroundRepeat: "repeat",
        }} />
        {/* 陸地ベース(薄いシルエット。ドットだけに頼らず輪郭そのものを見せる)。
            spinMode="once"なら初回マウント時とタップ時に一度だけ、
            "continuous"ならCSSの@keyframesで途切れずx位置が動き続ける。 */}
        <div
          className={surfaceMaskProps.className}
          style={{
            position: "absolute", inset: "-2px -6px",
            background: "rgba(150,205,255,0.22)",
            WebkitMaskImage: `url("${GLOBE_WORLD_MAP_FILL}")`,
            WebkitMaskSize: GLOBE_MASK_SIZE,
            WebkitMaskRepeat: "repeat-x",
            ...surfaceMaskProps.style,
          }}
        />
        {/* 陸地ドット(輪郭の内側だけに極小ドットを高密度配置。ランダムな点群ではない) */}
        <div
          className={surfaceMaskProps.className}
          style={{
            position: "absolute", inset: "-2px -6px",
            backgroundImage: "radial-gradient(circle, rgba(200,230,255,0.85) 0.5px, transparent 0.9px)",
            backgroundSize: "4px 4px",
            backgroundRepeat: "repeat",
            WebkitMaskImage: `url("${GLOBE_WORLD_MAP_FILL}")`,
            WebkitMaskSize: GLOBE_MASK_SIZE,
            WebkitMaskRepeat: "repeat-x",
            ...surfaceMaskProps.style,
          }}
        />
        {/* 日本列島のみ、周辺よりわずかに明るく(日本株サイトとしての手がかり) */}
        <div
          className={surfaceMaskProps.className}
          style={{
            position: "absolute", inset: "-2px -6px",
            background: "rgba(210,235,255,0.16)",
            WebkitMaskImage: `url("${GLOBE_JAPAN_MASK}")`,
            WebkitMaskSize: GLOBE_MASK_SIZE,
            WebkitMaskRepeat: "repeat-x",
            ...surfaceMaskProps.style,
          }}
        />
        {/* 陸地アウトライン(輪郭をシャープに保つための極細の縁取り) */}
        <div
          className={surfaceMaskProps.className}
          style={{
            position: "absolute", inset: "-2px -6px",
            background: "rgba(130,215,255,0.4)",
            WebkitMaskImage: `url("${GLOBE_WORLD_MAP_OUTLINE}")`,
            WebkitMaskSize: GLOBE_MASK_SIZE,
            WebkitMaskRepeat: "repeat-x",
            ...surfaceMaskProps.style,
          }}
        />
        {/* 左右端を暗く落として球面のカーブを強調(中央70%は輪郭をシャープに保つ) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to right, rgba(0,0,0,.55) 0%, transparent 16%, transparent 84%, rgba(0,0,0,.6) 100%)",
        }} />
        {/* ハイライト(固定・左上寄りの強い光) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 30% 22%, rgba(255,255,255,.75) 0%, rgba(170,225,255,.28) 10%, transparent 28%)",
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
  const clocks = useWorldClocks();
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
            <SpinningEarth size={224} spinMode="continuous" />
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


