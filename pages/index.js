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

function TodayTrend({ themes }) {
  // AI情報収集・テーマ検出 Phase 1: ニュース言及量ベースの参考指標。
  // news_countが0のテーマ（その日話題に上らなかったテーマ）は表示しない。
  const active = (themes || []).filter((t) => t.news_count > 0).slice(0, 6);
  if (active.length === 0) return null;
  return (
    <div style={{
      background: "linear-gradient(155deg, #151B20, #101519)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
      padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
        🔥 TODAY'S TREND
        <span style={{ fontWeight: 400, color: "#68747C", fontSize: 9, marginLeft: 6 }}>ニュース言及量ベースの参考指標</span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        {active.map((t) => {
          const arrow = t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→";
          const color = t.direction === "up" ? "#00E0A3" : t.direction === "down" ? "#FF5A67" : "#68747C";
          const stockNames = (t.related_stocks || []).slice(0, 2).map((s) => s.name).join("・");
          return (
            <div key={t.id} style={{
              flex: "0 0 auto", minWidth: 96, background: "#0D1013", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "8px 10px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F5F7F8" }}>{t.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{t.score}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{arrow}</span>
              </div>
              <div style={{ fontSize: 9, color: "#68747C", marginTop: 2 }}>{t.news_count}件</div>
              {stockNames && (
                <div style={{ fontSize: 9, color: "#4A5568", marginTop: 3 }}>{stockNames}</div>
              )}
            </div>
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
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 6, marginTop: 16 }}>
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
      <TodayTrend themes={briefing.trend_themes} />
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

// 地球は「正距円筒図法の1枚地図を横にパンする」方式をやめ、正射図法
// (geoOrthographic、実際に宇宙から見た地球と同じ見え方になる投影)で
// 経度10度刻み・36方向から見た陸地シルエットを事前に生成し、それを
// 一定間隔で切り替える「フリップブック」方式に置き換えた。これにより、
// 陸地は球面に沿って回り込み、両端(球の輪郭付近)に来た陸地は自然に
// 細くなって裏側へ消えていく(平面パンでは出せなかった見え方)。
// 生成にはnpm製のworld-atlas(Natural EarthのTopoJSON)+d3-geo+
// topojson-simplifyをローカルで一度だけ使用(ネットワーク取得なし、
// package.jsonへの依存追加もなし)。GLOBE_FRAMES[0]が経度135°(日本・
// 東アジア)を正面にした状態で、以後10°刻みで経度が下がっていく方向
// (=日本から見てアジア大陸・インド方面)に回る。frames_final/manifest.json
// が生成時の各フレームの中心経度の記録。
const GLOBE_FRAME_COUNT = 36;
const GLOBE_FRAME_STEP_DEG = 360 / GLOBE_FRAME_COUNT;
const GLOBE_FRAMES = [
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjE0LjE4Miw1ODMuMjg2TDIxMy4yODMsNTgyLjUyNkwyMTIuNjU4LDU4MC44NzJMMjMzLjg4MSw1ODUuMDQ4TDI0NC44MDcsNTg1LjY3N0wyNTUuODY5LDU4NS42MDZMMjcxLjk4NCw1ODguMDI5TDI5OS40OTYsNTg3LjQ2OUwzMjEuMTMxLDU4Ny45NzdMMzMzLjMyLDU4OS42NjhMMzQ1LjM3NSw1OTAuMTk4TDM1NC45MSw1ODkuNzhMMzM2LjI5Nyw1OTMuNDI3TDMzMS4zNjcsNTk0LjMzM0wzMzEuMzY3LDU5NC4zMzNMMzIxLjA3NSw1OTUuMjQ5TDMxMC43NTksNTk1LjgwNEwzMDAuNDI5LDU5NkwyOTAuMDk4LDU5NS44MzRMMjc5Ljc4LDU5NS4zMDlMMjY5LjQ4Niw1OTQuNDIzTDI1OS4yMjksNTkzLjE3OUwyNDkuMDIyLDU5MS41NzdMMjM4Ljg3Nyw1ODkuNjJMMjI4LjgwNyw1ODcuMzExTDIxOC44MjMsNTg0LjY1MVpNNDM3Ljc2NSw1MjEuNTI5TDQyNi4zODMsNTMxLjY1N0w0MTQuNjE4LDU0MS4wODRMNDEwLjg0NCw1MzcuMjdMNDI0LjQ3OCw1MjkuNzJaTTQ1Mi4zNzYsNTAzLjk1NEw0NjEuMjcyLDUwNy43NEw0NDUuOTQ3LDUyMS40OTVaTTUwMC42MjYsNDE3LjkwM0w0OTguMTI4LDQxOS40MzlMNDk4Ljc0Myw0MTcuNDIzTDUwMS4xMjgsNDE1LjYwMlpNMTQuMDIxLDM3Ni4zNjhMMTMuMzY1LDM3Mi43MjdMMTMuMzY1LDM3Mi43MjdMMTcuMDE2LDM4Ni41N0wyMS40NjQsNDAwLjE2OUwyMS40NjQsNDAwLjE2OEwxOC4xMzgsMzkwLjM4N0wxNS4xNTUsMzgwLjQ5NVpNMzQyLjc5NSw0MTguNzJMMzU1LjI2OCw0NDIuMzU2TDM4Mi4wNzYsNDY4LjY3TDM3Ny40Miw0OTQuNTYxTDM2MC44MjksNTE2LjU4M0wzNDUuMTIyLDUyMi43NDJMMzIyLjkwNiw1MTkuODQyTDMwMy4zODMsNTA4LjczOEwyODMuODM0LDQ5Ni4wMzFMMjU2LjMyNCw1MDIuOTE5TDIyOS4yNjcsNTA3LjcwNUwyMTQuNTcxLDQ4Ni43MTNMMjAwLjcyMSw0NjMuODczTDIwMi4xNDMsNDUyLjY1N0wyMzEuODkxLDQ0NS4xMTZMMjQxLjAxOSw0MzAuNTYyTDI2Ni45MjUsNDI0LjE0NkwyODYuNjA4LDQwNi42NEwzMDkuODQzLDQxMi41MzdMMzAyLjEzOCw0MjMuNzYzTDMyOC45MTYsNDM1LjgxN0wzMzguMDUxLDQwNC4wMzhaTTI5NS41NzIsMzU3LjI0NUwzNDkuMTY0LDM3MC4yMDFMMzY5LjM4OCwzOTUuNDMyTDMzOC43NzIsMzk3LjUxNkwzMDcuODk1LDM3Ny4zOTRMMjc2Ljg4OCwzNTYuMDA0Wk0yNDkuODM2LDM0My40MTNMMjI0LjI5OCwzNDguNDgxTDIzOS41NDQsMzc3LjIyM0wyMTcuMzU0LDM2My41NDNMMjI3Ljg0NiwzNDMuMTc3Wk0xNTYuNDI1LDM3NC4zNjVMMTQxLjc1OSwzNjQuNzI3TDEyNS45NTYsMzM5LjY2TDExMS45NTgsMzE0LjE4MkwxMjAuNDk0LDMxMy45NDdMMTMzLjIzOSwzMjguNzc0TDE0Ni44MzEsMzQzLjQ1NVpNMjEyLjg4MSwzMzkuODAzTDIwNC41OTgsMzY4LjkyMUwxNzYuMTE4LDM2MS41M0wxNzAuNjY1LDM0OC41NzFMMjA5LjgyOCwzMTMuNFpNMzI0LjU2NCwxNjQuNzQzTDMyMi4xNTcsMTc0LjA4MkwyODIuNzk3LDE4MC4wNDFMMzE3Ljk1NCwxNTkuOTM1Wk03OC4xMzcsMTEwLjQ0NEw2Ni4wNTYsMTI1LjE5Nkw2Ni4yOTQsMTMxLjAxNUw3Ny42ODEsMTE0LjM3OUw5MC4xNzgsOTguNjY5TDg5LjM2Niw5Ni4zNlpNMTAuNTM5LDIzOC4xMjVMOC45NCwyNDYuMzcyTDkuOTkzLDI0NS4zOTVMMTIuMTQsMjQ0LjYyM0w3LjE0NiwyNjUuNjE0TDQuNDc4LDI4Ni44NzhMNC4wOCwyOTMuMTI5TDQuMDgsMjkzLjEyOUw0LjUsMjgyLjgwNUw1LjI4LDI3Mi41MDNMNi40MTksMjYyLjIzNEw3LjkxNiwyNTIuMDExTDkuNzY5LDI0MS44NDdaTTgxLjk3MSw5OS44MDFMODIuNjg4LDEwMC4xODJMOTUuMTAxLDg2LjM4M0w5NS4xMDEsODYuMzgzTDEwMi42ODEsNzkuMzYyTDExMC41MDEsNzIuNjFMMTE4LjU1Miw2Ni4xMzVMMTI2LjgyNSw1OS45NDVMMTM1LjMwOCw1NC4wNDhMMTQzLjk5Miw0OC40NUwxNTIuODY2LDQzLjE1OEwxNjEuOTE5LDM4LjE4TDE3MS4xNDEsMzMuNTIxTDE4MC41MTksMjkuMTg2TDE5MC4wNDMsMjUuMTgxTDE5OS43MDEsMjEuNTExTDIwNi41NzYsMTkuMTNMMjA4LjA2NywxOC42NzNMMjA4LjYzMywxOS4yNzFMMTg5LjE3MSwyOC4yNjZMMTc0LjEzMywzMy4yMDZMMTg3LjQxMywzMC44NTZMMjAxLjc3LDMxLjA4NEwxOTguNzI2LDM3LjE5OEwyMTAuNTg5LDMwLjUwOEwyMjYuMDUyLDMxLjE0MUwyNDMuNjQ2LDI3LjE0TDI1Ny45NywyNi43NDhMMjcyLjQwOSwyNy4xMDNMMjY1LjEzMywzMi4xNzRMMjg2LjUxMiwzNS4xNDJMMzA3Ljk3OSwzOS44NDJMMzA4LjMxNywzNi41NDZMMzIzLjkyMSwzNy45MDFMMzM5LjQ1OCwzOS45OTJMMzQ1LjQ3OSw0My4zMDJMMzU4LjQ0NSw0MC4xNkwzNzEuODE4LDQwLjIzMUwzNzUuMTMxLDQwLjk3MUwzNzUuMTMxLDQwLjk3MUwzOTguODM0LDQ1LjcxOUwzOTkuOTc1LDUxLjM3NkwzODguNTIzLDUxLjIyNEwzODguNTI5LDUxLjI0TDM5NC4wMjgsNTdMMzg1Ljg5Myw2OC44OTRMMzcwLjk5NCw3MC41NTRMMzc3LjY3MSw4Ny45NzVMMzY5LjEzMywxMDMuNDUzTDM1OC43MDgsODcuNDcyTDM2OC41NDMsNjYuNDY2TDM1Mi4zODUsNjYuODE2TDM0OS4wNjgsNzIuNjE0TDMxOS4wODQsNzYuMjYxTDMwMC4zNzUsOTEuNjg3TDMxOS42NSw5Ny42MDJMMzE3LjMyMSwxMTUuODE4TDI5OS41MTIsMTM3LjA2N0wyNzAuNDI5LDE1Mi43NTNMMjc3LjExLDE2Ni40MTdMMjYzLjgzNCwxNzcuMzAxTDI1Ny43MTcsMTUxLjYzMkwyMzAuNjk1LDE1NS44MzJMMjQyLjY0NiwxOTguNDUyTDIxMC42NTgsMjMxLjg5OUwxNzcuMzksMjM0Ljg4NEwxNjIuOTI1LDI0Ny4xNjVMMTczLjg0MSwyODYuMzdMMTU0LjU0OCwyOTMuNjY5TDEzNS4yNDksMjczLjQxNEwxMjkuMjc0LDI5MC42MDNMMTQ1LjM3MSwzMTguOTQyTDE0NS40NjgsMzM3LjU4OEwxMzQuNDE1LDMxOC4wM0wxMjQuMzYyLDI5OC4zNjNMMTI0LjgzMywyNzYuMDg4TDEyNi4yOTgsMjUzLjk1TDExMS44MzUsMjIxLjUzMkw5NS4yNSwyMjUuMTY4TDgwLjkwMiwyMzYuNzc4TDY3LjczOCwyNDguNzNMNTkuNjYyLDI2Ny43N0w1Mi44NzMsMjg2Ljk4M0w1MC42ODYsMjY1LjAzNkw1MC4wMTIsMjQzLjMwMUw1NS43NTksMjE2LjA0N0w1Mi45MzksMjAzLjcyN0w1MS4wNTEsMTkxLjc2OUw0Mi45NCwxODkuNjY4TDQxLjk1NiwxODAuODIyTDQxLjc5NSwxNzIuMzU0TDQyLjQ1NywxNjQuMjk0TDQzLjk0LDE1Ni42NjdMMzcuMjY1LDE3MS41NTNMMzEuNTMxLDE4Ni44OTlMMzYuODYyLDE4Ni4zNjFMMzUuMjUsMjAxLjQ5MUwyNy4xODEsMjE1LjUyN0wxOS4xOTYsMjIzLjc5OUwxMy4zODgsMjMyLjY2M0wxMS4yNzIsMjM0Ljg5OEwxNi44MzUsMjEzLjg0OUwxOS42NzEsMjA0Ljk2NkwxOS42NzEsMjA0Ljk2NkwyMy4xNTgsMTk1LjI0TDI2Ljk4MywxODUuNjQzTDMxLjE0LDE3Ni4xODRMMzUuNjI1LDE2Ni44NzZMNDAuNDMyLDE1Ny43MzFMNDUuNTU1LDE0OC43NTlMNTAuOTg5LDEzOS45NzFMNTYuNzI1LDEzMS4zNzhMNjIuNzU4LDEyMi45OTFMNjkuMDgsMTE0LjgxOUw3NS42ODQsMTA2Ljg3M1pNMzY2LjM1NywzNS4wNTdMMzY4LjcyMSwzNi41OUwzNjYuMjc5LDM2LjI0OVpNNTAwLjkxLDgyLjYyN0w0OTMuMzUzLDc1LjkwM0w0ODQuNzM1LDY5LjA4M0w0NzUuNjcyLDYyLjgxOUw0NjYuMTg1LDU3LjEyOEw0NTYuMjk2LDUyLjAyM0w0NDguODQ2LDUwLjgxNUw0NDAuODE1LDUwLjU3N0w0NDYuNjgzLDU5LjY0Mkw0NTEuODk1LDY5Ljc4Mkw0NDYuNDE3LDY0LjYwNkw0MjAuOTEyLDU2LjQ5OUw0MTMuNTM3LDQ1Ljc4N0w0MDIuMTQ4LDQ1Ljk1M0wzODguODMyLDMzLjMzMUwzODcuOTg4LDI5LjgzNkwzOTcuNDUzLDI4LjY0Nkw0MDYuNTMzLDI4LjUzMUwzOTguMTc3LDIzLjE5M0w0MDEuNjYzLDIyLjE1N0wzOTYuODQ0LDIwLjI5MUwzOTYuODQ1LDIwLjI5MUw0MDYuNTQ3LDIzLjg0MUw0MTYuMTIsMjcuNzI4TDQyNS41NTIsMzEuOTQ2TDQzNC44MywzNi40OTFMNDQzLjk0NCw0MS4zNTdMNDUyLjg4Myw0Ni41MzhMNDYxLjYzNiw1Mi4wMjhMNDcwLjE5MSw1Ny44Mkw0NzguNTQsNjMuOTA4TDQ4Ni42Nyw3MC4yODJMNDk0LjU3NCw3Ni45MzdaTTM5MS43NjMsMTguNTgzTDQwMC42NDYsMjEuNzY0TDM5MC4xODYsMTkuMDk0TDM4MC4zMjYsMTUuNzQ3TDM4MC4zMjYsMTUuNzQ3TDM3Ni42NTcsMTQuMTY1TDM3OS45MzksMTQuOTk5TDM3OS45NCwxNC45OTlMMzg5LjgzNywxNy45NjJaTTM5MS4zOSwxOS42MDdMMzkwLjk2MywyMC40NUwzNzguOSwxNi45NDhMMzc5LjM3MiwxNS42NjFaTTM2My4wMjMsMTEuMzg1TDM2Ny4xODgsMTIuMDRMMzcyLjA4NywxNC4yNDJaTTIwNC41OTgsMjguNTI3TDIwNi41NzQsMjUuNDhMMjI1LjEwMSwyMC43NjVMMjM4LjQ5OCwyMC42MDZMMjExLjgzNCwyNS4wMDJaTTM1NS43MDUsOS4yODlMMzUwLjM5Miw4LjQzTDM1MC4zOTIsOC40M0wzNDkuNDAzLDguMTUyTDM0OS40MDQsOC4xNTJaTTI1Mi43NDUsOS4wNTdMMjQwLjI5MywxMC43MDNMMjU2LjIxMiw4LjAwMVpNMjY3LjIwNywyMi4wODNMMjY1LjYxNCwxOC44NTFMMjcxLjYyNiwxNy45NjFaTTMzNS41NjYsNi4zNzdMMzQ0LjM1NSw3LjU0M0wzMzkuNzEsNy4zNDNMMzMzLjEyNSw2LjU5N1pNMzQ3LjMwOSw3LjgwNUwzNDguNTI0LDguMDA3TDMzNS4yNDYsNi4yNTNMMzMwLjMxNSw2LjQyOEwzMTkuOTU0LDUuNTExTDMxNC4xNjUsNC45NDdMMzE0LjE2NSw0Ljk0N0wzMTEuNDMyLDQuNTQ2TDMzMS40NjQsNS42NzdMMzMxLjQ2NCw1LjY3N0wzNDEuNzE3LDYuOTU0Wk0zMjYuMjk4LDUuMTdMMzA4LjUwMyw0LjM3NEwyOTQuMzYsNC42ODRMMjg5LjczMiw0LjgzOUwyODkuNzMyLDQuODM5TDI4NC42NjUsNC45MDVMMjkwLjg5Niw0LjRMMjgzLjA2OCw0LjYyN0wyNzUuNzI3LDUuMzE1TDI3NS4zNTUsNS4wMjhMMjc1LjM1NSw1LjAyOEwyODUuNjY1LDQuMzQ3TDI5NS45OTIsNC4wMjdMMzA2LjMyMyw0LjA2OEwzMTYuNjQ3LDQuNDY5WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTk1Ljk1NSw1NzcuMTExTDIwMS42LDU3OS4xNTRMMjA3LjY4OSw1ODAuOTE3TDIyMi42NCw1ODUuNzEyTDIyNS4xNDcsNTg1LjM5MUwyMjguMTIyLDU4My4yOTFMMjUxLjExMyw1ODYuNzk1TDI2My41NjEsNTg3LjA3TDI3Ni4wOTgsNTg2LjYzOUwyOTEuNzM0LDU4OC41OEwzMjAuMjM3LDU4Ny4xNjlMMzQwLjYyNyw1ODcuMDM5TDM1MC4yNjUsNTg4LjM5OEwzNTkuNzAxLDU4OC42MDJMMzY3LjEwMSw1ODcuOTI2TDM0Ny4wMDcsNTkyLjE2MUwzNDMuMTc3LDU5Mi44MzRMMzQzLjE3Niw1OTIuODM0TDMzMi45Myw1OTQuMTYzTDMyMi42NDQsNTk1LjEzM0wzMTIuMzMsNTk1Ljc0M0wzMDIuMDAxLDU5NS45OTNMMjkxLjY3LDU5NS44ODNMMjgxLjM0OSw1OTUuNDEyTDI3MS4wNTEsNTk0LjU4MUwyNjAuNzg4LDU5My4zOTFMMjUwLjU3Miw1OTEuODQ0TDI0MC40MTcsNTg5Ljk0MUwyMzAuMzM1LDU4Ny42ODVMMjIwLjMzNyw1ODUuMDc5TDIxMC40MzYsNTgyLjEyNUwyMDAuNjQ1LDU3OC44MjdaTTQ2Ni4yNyw1MTYuOTFMNDU0LjM3OCw1MjcuMzkyTDQ0Mi4wMTgsNTM3LjE4NUw0MzkuOTA3LDUzMy40NjFMNDUzLjMwMiw1MjUuNVpNNDgyLjAzMyw0OTguODc0TDQ4OC4zMTYsNTAyLjQyOUw0NzIuODczLDUxNi42NTFaTTUzMi40MTcsNDExLjMyNEw1MzAuMjk3LDQxMi45M0w1MzAuOTQ5LDQxMC44OTVMNTMyLjk5OCw0MDkuMDA2Wk0yMi4xMjQsMzgxLjMwM0wyNC45MTUsMzk0LjU1NUwyOC40MjUsNDA3LjU1OUwzMi42NDUsNDIwLjI4MkwzNy41NjUsNDMyLjY5TDM1LjA0MSw0MzAuNDYyTDI2LjUzNCw0MTAuMzA3TDE5LjYzMSwzODkuNTA2Wk0zOTEuNTEzLDQxNi42NzlMNDAyLjA4NCw0MzkuOTY1TDQyNS4wNzMsNDY1LjUyM0w0MTcuODg3LDQ5MS41OTRMMzk5LjMzNCw1MTQuMTVMMzgzLjU4NSw1MjAuNzg2TDM2Mi44NTUsNTE4LjUzOUwzNDUuNTEsNTA3Ljk5NUwzMjcuODE2LDQ5NS44NTRMMjk5LjE5NCw1MDMuNTk1TDI3MC41OCw1MDkuMjI3TDI1Ny45NTksNDg4LjY1TDI0NS43NTQsNDY2LjIwNUwyNDguMjQxLDQ1NC45M0wyNzkuODU1LDQ0Ni40NTdMMjkwLjE0Nyw0MzEuNjA3TDMxNi43NzMsNDI0LjM5NEwzMzcuMTkxLDQwNi4yNzlMMzU5Ljg3NCw0MTEuNDc4TDM1MS44MTgsNDIyLjk0NEwzNzcuMjc1LDQzNC4yMDRMMzg3LjU1LDQwMi4xM1pNMzQ3LjAyMywzNTYuNTk4TDM5OC45ODUsMzY3Ljk1TDQxNy42MzUsMzkyLjU5TDM4OC40NTQsMzk1LjU4M0wzMjguNDc1LDM1NS45MjJaTTMwMS4yMzksMzQ0LjE1N0wyNzUuMTM4LDM1MC4wMDlMMjkwLjU1MSwzNzguMjg1TDI2Ny45MDEsMzY1LjI4NkwyNzguNzc3LDM0NC41OTVaTTIwMy4yNDksMzc4LjAxNkwxODcuNDM3LDM2OC44NDFMMTcwLjE3NSwzNDQuMjc3TDE1NC4yNTksMzE5LjI1M0wxNjMuODIsMzE4Ljc0M0wxOTMuMTQxLDM0Ny40MDVaTTI2My4zLDM0MS42ODRMMjU0LjU3MSwzNzEuMDYxTDIyNC42MDcsMzY0LjU1N0wyMTguODYxLDM1MS43NjlMMjU5Ljc2MSwzMTUuMzgxWk0zNjQuOTQxLDE2My4zODNMMzYzLjY3NywxNzIuNzc4TDMyNS42MjMsMTc5LjkxM0wzNTcuOTQ1LDE1OC43ODJaTTg0LjI3NiwxMTcuMDkyTDcyLjU5MywxMzIuMjA1TDc2LjE0NSwxMzcuOTY3TDg1LjkxMywxMjEuMDA5TDk2Ljc0OSwxMDQuOTQ0TDkzLjY0MSwxMDIuNjk1Wk00Ny4zNTUsMTQ1Ljc3MUw0Ni44ODYsMTQ4LjM0NUw2MC4wNCwxMzAuMjI5TDYxLjgzOSwxMjUuMTM0TDY0LjUwNSwxMjAuNjc1TDY3LjE5MiwxMTcuMTk4TDY3LjE5MiwxMTcuMTk4TDczLjcxNCwxMDkuMTg0TDc0LjMzNiwxMDguNDQ5TDc3Ljg2MiwxMDYuNjI1TDgzLjY1MSwxMDYuNzcxTDg5Ljc5Nyw5NS42MzVMOTcuMTE4LDg1LjY0Mkw4Ny4zNDQsOTQuNzQ4TDc4LjA5NywxMDQuMzYyTDc4LjcwMSwxMDMuNDIyTDc4LjcwMSwxMDMuNDIyTDg1LjY5Niw5NS44MTlMOTIuOTUzLDg4LjQ2NEwxMDAuNDYxLDgxLjM2N0wxMDguMjEzLDc0LjUzNkwxMTYuMTk5LDY3Ljk4MUwxMjQuNDA4LDYxLjcwN0wxMzIuODMxLDU1LjcyNEwxMzYuMzYyLDUzLjM0NUwxMzUuODU2LDUzLjY5NkwxNTEuNTA5LDQ0LjMyMkwxNjcuODMxLDM1LjQ4MkwxNTcuOTQ3LDQwLjMxNEwxNTcuOTQ4LDQwLjMxM0wxNjcuMDk3LDM1LjUxNEwxNzYuNDA5LDMxLjAzN0wxODUuODcsMjYuODg3TDE5MC44MzksMjQuODY0TDIwMS43NDEsMjEuNTYzTDIwNS4yMiwyMi4wOTlMMTg5LjI3LDMxLjYzMkwxNzIuMTY5LDM3LjA2TDE4OS41NiwzNC4yNDRMMjA4LjAxLDMzLjk3NEwyMDcuOTE1LDQwLjEzNkwyMTguMTI1LDMzLjExTDIzNi4wNTEsMzMuMjM2TDI1My4zNjUsMjguNzA0TDI2OC40NTQsMjcuODY2TDI4My42MjksMjcuNzcxTDI3OC4zLDMzLjAzNEwzMDEuMjEzLDM1LjMyOUwzMjQuMTE5LDM5LjM1NEwzMjMuMjc4LDM2LjA2NkwzMzguODE5LDM2Ljk0OEwzNTQuMjUsMzguNTY4TDM2MS4wMjEsNDEuNjg0TDM3MS44MTEsMzguMTgxTDM4My44MjMsMzcuODY2TDM4Ny4wMzYsMzguNTA3TDM4Ny4wMzYsMzguNTA3TDQwOS4zMDUsNDIuNTU3TDQxMi40Niw0OC4xNDlMNDAyLjU1LDQ4LjMyMUw0MDIuNTYxLDQ4LjMzN0w0MDkuMjksNTMuOTEyTDQwNS42Myw2NS45ODVMMzkyLjU4Miw2OC4wNjlMNDAyLjgyNyw4NS4yMzNMMzk4LjExMiwxMDAuOTEyTDM4NS4xOCw4NS4yODZMMzg5LjI2OCw2NC4wNjhMMzc0LjQyMiw2NC44OUwzNzIuNzY4LDcwLjc2M0wzNDUuMDI3LDc1LjI4N0wzMzAuMDQ5LDkxLjIyNUwzNTAuMDMyLDk2LjU0M0wzNTEuMDIsMTE0Ljc4TDMzNi44NjYsMTM2LjUxNUwzMTAuMDU3LDE1My4wNUwzMTguNDMxLDE2Ni40ODVMMzA2LjMzMiwxNzcuNzU0TDI5Ny4wODUsMTUyLjMxOUwyNjkuOTkyLDE1Ny4zNDFMMjg2Ljk3OSwxOTkuNTIxTDI1Ni43OTMsMjMzLjkxM0wyMjEuOTk2LDIzNy45MzJMMjA3LjM1OSwyNTAuNjU1TDIyMS4wNzksMjg5LjQ4NkwyMDAuNjM5LDI5Ny4zODhMMTc4Ljc1NywyNzcuNzU5TDE3Mi45MDQsMjk1LjEyN0wxOTEuMzMyLDMyMi45NDJMMTkxLjY0MSwzNDEuNTgyTDE2Ny43MjUsMzAzLjA0TDE2Ny4zNzIsMjgwLjc2NUwxNjcuNzcxLDI1OC41OThMMTQ5LjAyNywyMjYuNjg1TDEzMC4zNDYsMjMwLjg1NkwxMTQuNTk4LDI0Mi45MjNMOTkuODUxLDI1NS4yOTlMOTEuMzcxLDI3NC41OTFMODQuMDA4LDI5NC4wMTlMODAuMDQyLDI3Mi4xNjVMNzcuNDExLDI1MC40OEw4MS42NywyMjMuMDc1TDcxLjc1LDE5OS4wMThMNjAuMDY1LDE5Ny4yMTlMNTMuNTMzLDE4MC4wMjJMNTAuMTQxLDE2NC4zNTNMNDUuMTk3LDE3OS40MTVMNDEuMTY1LDE5NC45MUw1MC4wNywxOTQuMTU2TDUxLjQyNCwyMDkuMjg5TDQyLjA4LDIyMy41OUwzMC40NjYsMjMyLjE2TDIwLjk0MSwyNDEuMjU3TDE0LjMzMSwyNDMuNjI0TDE5LjEyLDIyMi40MThMMjIuNjY3LDIwNy4wNEwyNy4xNCwxOTEuOTcyTDMyLjUyNCwxNzcuMjY1TDM4LjgwMiwxNjIuOTY3TDQwLjU3OSwxNTguMjA5TDMyLjkyNCwxNzMuOTI3TDI2LjI4NCwxOTAuMTI0TDIwLjY4NCwyMDYuNzM5TDE2LjE0NiwyMjMuNzA4TDEzLjc5NSwyMzkuMzEzTDEyLjU4MiwyNTUuMTZMMjEuODY1LDI1My4yMjJMMTQuOTg2LDI3NC4zOTNMMTAuMzY5LDI5NS43NjdMNy4xODcsMzA2LjgwM0w1LjU0NiwzMTcuODAyTDYuNTM1LDMzNi4yNThMMTAuMDQ3LDM1Ny43NTVMMTUuMTMzLDM3OC45MzhMMTcuMzg4LDM4OC4wMTNMMTcuMzg4LDM4OC4wMTNMMTQuNDg4LDM3OC4wOTZMMTEuOTM3LDM2OC4wODRMOS43MzYsMzU3Ljk4OUw3Ljg4OSwzNDcuODI0TDYuMzk4LDMzNy42TDUuMjY0LDMyNy4zMzFMNC40OSwzMTcuMDI4TDQuMDc2LDMwNi43MDVMNC4wMjIsMjk2LjM3M0w0LjMyOSwyODYuMDQ2TDQuOTk2LDI3NS43MzVMNi4wMjMsMjY1LjQ1NUw3LjQwNywyNTUuMjE2TDkuMTQ5LDI0NS4wMzJMMTEuMjQ0LDIzNC45MTVMMTMuNjkyLDIyNC44NzdMMTYuNDg4LDIxNC45MzFMMTkuNjI5LDIwNS4wODhMMjMuMTEyLDE5NS4zNjFMMjYuOTMzLDE4NS43NjJMMzEuMDg2LDE3Ni4zMDFMMzUuNTY3LDE2Ni45OTJMNDAuMzcsMTU3Ljg0NEw0NS40ODksMTQ4Ljg3Wk0zNzYuODcxLDMyLjg4MUwzNzkuNjEsMzQuMzM3TDM3Ny4zMDUsMzQuMDY4Wk00NjQuMzg4LDUzLjg0NEw0NTMuNDg1LDQ3LjMxN0w0NDguOTk1LDQ2LjI5TDQ0My45MjQsNDYuMjUxTDQ1Mi44MTMsNTUuMDkyTDQ2MS4wMTksNjUuMDI4TDQ1NC44NCw2MC4wM0w0NDMuNDc4LDU2LjAzNEw0MzEuNzUxLDUyLjY2MUw0MjEuMzM0LDQyLjIxOUw0MTIuMTYzLDQyLjY5N0wzOTUuMzEyLDMwLjUzM0wzOTIuNjk1LDI3LjA5MUwzOTkuMjQ0LDI1LjY1OEw0MDUuNCwyNS4zMTFMMzk0LjYzNCwyMC4yNjRMMzkzLjc1MywxOS4yNEwzOTMuNzUzLDE5LjI0TDQwMy40OTUsMjIuNjgzTDQxMy4xMSwyNi40NjRMNDIyLjU4NywzMC41NzhMNDMxLjkxNSwzNS4wMkw0NDEuMDgzLDM5Ljc4NUw0NTAuMDc4LDQ0Ljg2OEw0NTguODkxLDUwLjI2MVpNMzg4LjUxMywxNy41NDRMMzg0LjQ0NCwxNi40NDFMMzczLjc5NywxMy40MDZMMzczLjc5NywxMy40MDZMMzcwLjk5NiwxMi42NEwzNzAuOTk3LDEyLjY0TDM4MC45ODIsMTUuMjkzWk0zODUuODg2LDE2LjkxNEwzODcuMDU5LDE3Ljc0NUwzNzUuMjY2LDE0LjYwNUwzNzMuMjg4LDEzLjM0MVpNMzU2LjU0LDkuNTY4TDM1OS43ODMsMTAuMTExTDM2Ny4wOTYsMTIuMTI4Wk0yMDkuNzMsMzEuMzQ4TDIwOS44NywyOC4yNjlMMjI4LjY4MSwyMi45ODdMMjQ0LjAwMSwyMi4zOTFMMjE1Ljk4OSwyNy42MThaTTM0Mi4yMDcsNy4wMjVMMzQyLjIwMSw3LjAyNEwzNDIuMjAxLDcuMDI0TDM0Mi4xOTcsNy4wMjNMMzQyLjE5OCw3LjAyM1pNMjQ5LjMyNywxMC41NDVMMjM1LjcxNSwxMi41ODdMMjUxLjY0MSw5LjQwMVpNMjc1LjgyLDIyLjk0OUwyNzIuMzU4LDE5Ljc5NEwyNzguMTI4LDE4LjcyNFpNMzI4LjE3MSw1LjQwOUwzMzYuNzE1LDYuMzExTDMzMy42NjMsNi4yMjhMMzI3LjMzNSw1LjY3OFpNMzMxLjk3NCw1LjczMkwzMjcuNDQxLDUuM0wzMjQuODc0LDUuNTlMMzE0LjU3Myw0Ljk4N0wzMDguMjkzLDQuNjA2TDMwOC4yOTMsNC42MDZMMzA0LjcyMiw0LjMwMUwzMTcuNDI4LDQuNTEzTDMxNy40MjgsNC41MTRMMzI3LjczLDUuMzAyWk0zMTMuMTg5LDQuMjk0TDMwMS41NDgsNC4yMjJMMjg4Ljg0Miw0LjkzOUwyODQuMzY4LDUuMjMzTDI4NC4zNjgsNS4yMzNMMjc4Ljk1OSw1LjQ1N0wyODQuMjQsNC43NzdMMjc1Ljk4Nyw1LjI0OUwyNjkuNTUzLDYuMTQ3TDI2Ni42NCw1LjkxM0wyNjMuNzY1LDYuMjI2TDI2My43NjUsNi4yMjZMMjc0LjA0LDUuMTQxTDI4NC4zNDYsNC40MTRMMjk0LjY3Miw0LjA0OEwzMDUuMDAzLDQuMDQyWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTk3LjMwNyw1NzcuNjE1TDE5Ny4wOTEsNTc3LjE0TDIxMS45NDcsNTgxLjk4N0wyMTkuODU4LDU4My41MzdMMjMyLjUyMiw1ODcuOTEyTDIzOC45NTUsNTg3LjQ1NkwyNDUuNzY5LDU4NS4yMDdMMjY5LjgzLDU4Ny45OTZMMjgzLjQyMiw1ODcuODc1TDI5Ny4wNTQsNTg3LjA0N0wzMTEuNzM1LDU4OC41MjdMMzQwLjM2Myw1ODYuMjQ4TDM1OC44ODgsNTg1LjUyN0wzNjUuNjgzLDU4Ni42MzdMMzcyLjIxNCw1ODYuNTk4TDM3Ny4yNTMsNTg1LjczM0wzNjYuNDEyLDU4OC40NTRMMzY2LjQxMiw1ODguNDU0TDM1Ni4zMDQsNTkwLjU5NkwzNDYuMTI4LDU5Mi4zODRMMzM1Ljg5Niw1OTMuODE1TDMyNS42Miw1OTQuODg5TDMxNS4zMTMsNTk1LjYwNEwzMDQuOTg3LDU5NS45NThMMjk0LjY1Niw1OTUuOTUyTDI4NC4zMyw1OTUuNTg1TDI3NC4wMjQsNTk0Ljg1OEwyNjMuNzUsNTkzLjc3MkwyNTMuNTE5LDU5Mi4zMjhMMjQzLjM0NSw1OTAuNTI4TDIzMy4yNDEsNTg4LjM3M0wyMjMuMjE3LDU4NS44NjhMMjEzLjI4Nyw1ODMuMDE0TDIwMy40NjMsNTc5LjgxNVpNNDg5LjcyMyw1MTEuNTAyTDQ3Ny42ODIsNTIyLjM0N0w0NjUuMTAyLDUzMi41MTlMNDY0LjcxOSw1MjguODMzTDQ3Ny40NjgsNTIwLjQ3NFpNNTA2LjE1OSw0OTIuOTc2TDUwOS42MzcsNDk2LjM4M0w0OTQuNTQ1LDUxMS4wNjlaTTU1Ny4xNDUsNDAzLjg4N0w1NTUuNDY4LDQwNS41NTFMNTU2LjEzOCw0MDMuNDk1TDU1Ny43ODgsNDAxLjU1Wk0zOS4zMjYsMzg5LjQ4NUw0MS4zMTcsNDAyLjY2NEw0My45ODQsNDE1LjU3NEw0Ny4zMjEsNDI4LjE4Mkw1MS4zMTksNDQwLjQ1NUw0Ni4zODcsNDM4LjM0TDM4LjQyMiw0MTguNDM2TDMxLjk5MiwzOTcuODM3Wk00MzcuNDUsNDEzLjIwMUw0NDUuNzk3LDQzNi4yTDQ2NC4yNjksNDYxLjEyOEw0NTQuNzczLDQ4Ny40NTFMNDQ1LjAxMiw0OTkuMzE5TDQzNC44Miw1MTAuNTkyTDQxOS41MDgsNTE3LjcwMUw0MDAuODk0LDUxNi4wNTFMMzg2LjI1NSw1MDUuOTkzTDM3MC45NTQsNDk0LjM1M0wzNDIuMDg5LDUwMi45NjhMMzEyLjc4Nyw1MDkuNDc5TDMwMi42MjQsNDg5LjI0OUwyOTIuNDM1LDQ2Ny4xNDRMMjk1LjkxMyw0NTUuNzc5TDMyOC40MzEsNDQ2LjMzMUwzMzkuNTc0LDQzMS4xNTZMMzY2LjExMSw0MjMuMTM1TDM4Ni42NDQsNDA0LjM5N0w0MDguMDg3LDQwOC45MjZMMzk5LjkyNCw0MjAuNjM4TDQyMy4yODYsNDMxLjE1N0w0MzQuMzg5LDM5OC43NThaTTM5Ny4wNDYsMzU0LjQwOUw0NDUuNzk4LDM2NC4yMzFMNDYyLjMwNywzODguMzM4TDQzNS40NDksMzkyLjE4MUwzNzkuMTk3LDM1NC4yODZaTTM1Mi42MDQsMzQzLjMzOUwzMjYuNzMzLDM0OS45ODFMMzQxLjg0NSwzNzcuNzkzTDMxOS40MjQsMzY1LjQ3OUwzMzAuMzU0LDM0NC40NTdaTTI1My4wMTEsMzgwLjJMMjM2LjUzNCwzNzEuNTE2TDIxOC4zMzgsMzQ3LjQ5TDIwMC45ODksMzIyLjk3MUwyMTEuMjgzLDMyMi4xNTlMMjQyLjY5NywzNDkuODk5Wk0zMTQuODM1LDM0Mi4wMTZMMzA1LjkyNSwzNzEuNjYxTDI3NS4zODgsMzY2LjA3N0wyNjkuNTIzLDM1My40NjRMMzEwLjkxNiwzMTUuODI3Wk00MDMuMzQ1LDE2MC44MjZMNDAzLjI2MiwxNzAuMjQyTDM2Ny42NzEsMTc4LjQ5NkwzOTYuMTc2LDE1Ni40NDFaTTk2Ljk2OSwxMjMuNDU0TDg2LjA0LDEzOC45MUw5Mi43OTksMTQ0LjUxNUwxMDAuNjUsMTI3LjI5TDEwOS40OTUsMTEwLjkyNkwxMDQuMTg2LDEwOC44MDVaTTQ1LjcyOSwxNDguNDY2TDUxLjU4NiwxMzkuMzU4TDQ4LjU3NCwxNDYuMTA3TDQ2LjUyNCwxNTMuNDQ2TDUwLjE2OSwxNTUuOTg2TDY0LjUyMSwxMzcuNDUyTDYzLjIzMiwxMzIuMzQ5TDYyLjgwMywxMjcuODU2TDcxLjUyOSwxMTUuNTMyTDgwLjE2NiwxMTMuMzY5TDkxLjE4NiwxMTMuMjNMOTMuODA4LDEwMS45NjFMOTcuNTgyLDkxLjc5OUw4Ny4xNzEsMTAxLjIxMkw3Ny4yODYsMTExLjExN0w3NS4wMDQsMTA5LjI4NUw2My41MjUsMTIyLjgwN0w4MC4wNjgsMTAyLjM1NUw5Mi43ODcsODguNjI3TDkyLjc4Nyw4OC42MjdMMTAwLjI5LDgxLjUyNEwxMDguMDM2LDc0LjY4N0wxMTYuMDE2LDY4LjEyNUwxMjQuMjIxLDYxLjg0NUwxMzIuNTUxLDU1LjkxNkwxMzEuNzI5LDU2Ljk4OUwxMzEuMzg0LDU4Ljc1MkwxNDguNDQ0LDQ4Ljg4TDE2NC4xNDEsMzkuNTU0TDE0OS40MDYsNDYuMTMzTDEzNS40Nyw1NC4wNkwxNTQuNTIxLDQyLjMwOEwxNTQuNDM5LDQyLjI2NEwxNTQuNDM5LDQyLjI2NEwxNjMuNTIyLDM3LjM0MUwxNzAuMzM4LDMzLjkxTDE4My45ODQsMjguMzUzTDE5OC40LDI0LjU5OUwyMDQuNjg3LDI0Ljk4N0wxOTIuNzM0LDM0Ljk0NEwxNzQuMDg5LDQwLjkxNUwxOTUuMDY0LDM3LjUxNkwyMTcuMDQ0LDM2LjYzMkwyMTkuOTAyLDQyLjc1MUwyMjguMTQ4LDM1LjQ0NkwyNDcuOTkzLDM0Ljk5N0wyNjQuNTAxLDI5Ljk1MkwyNzkuODk2LDI4LjY1MUwyOTUuMzQ1LDI4LjA5TDI5Mi4xMjUsMzMuNDgzTDMxNS44NzgsMzUuMDY5TDMzOS41MjYsMzguMzg4TDMzNy41MzIsMzUuMTQyTDM1Mi41MzYsMzUuNTZMMzY3LjM5MywzNi43MkwzNzQuNzEsMzkuNjIyTDM4Mi45OTQsMzUuODI5TDM5My4yODEsMzUuMTc2TDM5Ni4yOTYsMzUuNzIyTDM5Ni4yOTYsMzUuNzIyTDQxNi40NTQsMzkuMTI3TDQyMS41MjcsNDQuNTk0TDQxMy40NjEsNDUuMDRMNDEzLjQ3Niw0NS4wNTVMNDIxLjIzMiw1MC40MDlMNDIyLjE1Nyw2Mi41MjRMNDExLjM1Nyw2NC45NzFMNDI0Ljg1OCw4MS43NzRMNDI0LjEwOSw5Ny41MzZMNDA5LjA2NCw4Mi4zMzVMNDA3LjI4Miw2MS4wODJMMzk0LjE5OCw2Mi4zMjhMMzk0LjI1Nyw2OC4yMjVMMzY5LjYwMiw3My41NDVMMzU4LjgxLDg5Ljg3NUwzNzguODkzLDk0LjU4NUwzODMuMTY4LDExMi43NDJMMzczLjEwMSwxMzQuODQ0TDM0OS4zOCwxNTIuMTQ3TDM1OS4xOTIsMTY1LjMwNkwzNDguNjM3LDE3Ni45MTlMMzM2LjU0MiwxNTEuODA4TDMxMC4yMDEsMTU3LjY0MkwzMzEuNzA5LDE5OS4yMzdMMzA0LjI0MiwyMzQuNTA1TDI2OC45NzEsMjM5LjU4OUwyNTQuNjA4LDI1Mi43NTJMMjcwLjcxNCwyOTEuMTNMMjQ5Ljc1LDI5OS42NjFMMjI1Ljk0OSwyODAuNzI2TDIyMC4zOTUsMjk4LjI2N0wyNDAuNTk2LDMyNS40OTZMMjQxLjEwNiwzNDQuMTIzTDIxNS4xMDcsMzA2LjM0TDIxMy4yNjIsMjYxLjkyNEwxOTAuODA1LDIzMC42MzdMMTcwLjU5NywyMzUuMzk5TDE1My45MjYsMjQ3Ljk1OUwxMzguMDQ1LDI2MC44TDEyOS40MTgsMjgwLjM1MkwxMjEuNzA1LDMwMC4wMDlMMTE2LjA4MiwyNzguMzAxTDExMS41NzQsMjU2LjcyNEwxMTQuMjE0LDIyOS4yMTRMOTkuMzg0LDIwNS41MzRMODQuNDgxLDIwNC4xMzhMNzIuNzYsMTg3LjIxOEw2My45MzUsMTcxLjczNUw2MC44NzEsMTg2LjkxOUw1OC42NjQsMjAyLjUwOUw3MC44NzIsMjAxLjQzM0w3NS4xNSwyMTYuNDgyTDY0LjgxNSwyMzEuMDgxTDQ5LjkyNSwyNDAuMDU0TDM2Ljk3NCwyNDkuNDkyTDI2LjA2OSwyNTIuMTI2TDI5Ljk0LDIzMC43ODhMMzEuODQsMjE1LjMyN0wzNC42MzUsMjAwLjE0OEwzOC4zMTcsMTg1LjMwNEw0Mi44NzMsMTcwLjg0Mkw0Mi43MzgsMTY2LjA1OUwzNi41NjcsMTgxLjk4N0wzMS4zOTcsMTk4LjM2M0wyNy4yNDgsMjE1LjEyNkwyNC4xMzYsMjMyLjIxMUwyMy45OTgsMjQ3Ljg1NUwyNC45NTgsMjYzLjcwNUw0MC4wNDIsMjYxLjM5N0wzMS40ODUsMjgyLjgwMkwyNS4wNjEsMzA0LjM0NUwxOS4xNTcsMzE1LjUxOEwxNC43MzEsMzI2LjYwOUwxNC4zNzcsMzQ1LjA1NUwxOC42NTcsMzY2LjQzNEwyNC40NjQsMzg3LjQ1MkwyNC4zNzgsMzk3LjM4NkwyNS41MjMsNDA2Ljg4NUwzNC43MzIsNDI4Ljk0M0wzOS4yMDQsNDM5LjQ0N0w0NC41MjYsNDQ5LjQ5Nkw0NC41MjYsNDQ5LjQ5NkwzOS40NjQsNDQwLjQ4OUwzNC43Miw0MzEuMzExTDMwLjI5OSw0MjEuOTczTDI2LjIwNiw0MTIuNDg2TDIyLjQ0OCw0MDIuODYyTDE5LjAyNywzOTMuMTEzTDE1Ljk0OCwzODMuMjUxTDEzLjIxNiwzNzMuMjg3TDEwLjgzMywzNjMuMjMzTDguODAyLDM1My4xMDNMNy4xMjYsMzQyLjkwOEw1LjgwNywzMzIuNjYxTDQuODQ3LDMyMi4zNzRMNC4yNDYsMzEyLjA1OUw0LjAwNSwzMDEuNzNMNC4xMjUsMjkxLjM5OUw0LjYwNSwyODEuMDc5TDUuNDQ2LDI3MC43ODFMNi42NDUsMjYwLjUxOUw4LjIwMSwyNTAuMzA1TDEwLjExMywyNDAuMTUyTDEyLjM3OSwyMzAuMDcxTDE0Ljk5NCwyMjAuMDc2TDE3Ljk1NywyMTAuMTc4TDIxLjI2NCwyMDAuMzlMMjQuOTEsMTkwLjcyM0wyOC44OTEsMTgxLjE4OUwzMy4yMDMsMTcxLjhMMzcuODQsMTYyLjU2N0w0Mi43OTYsMTUzLjUwMVpNODguODQ1LDkyLjU2NUw3NS45NDQsMTA2LjcyM0w3Ni4zMTUsMTA2LjE0Mkw3Ni4zMTUsMTA2LjE0MUw4My4yMTcsOTguNDUzWk0zODUuMDUsMzAuNDIxTDM4OC4wODEsMzEuNzg5TDM4NS45ODIsMzEuNTg3Wk00NDUuMjE5LDQyLjA3MUw0NDIuNjYsNDEuODk4TDQ1NC4zLDUwLjQyN0w0NjUuMjUxLDYwLjA3Mkw0NTguNTU4LDU1LjI2OEw0NDguNzYzLDUxLjU5NEw0MzguNTg4LDQ4LjU1NEw0MjUuNDQ0LDM4LjQ3TDQxOC43NzEsMzkuMTg5TDM5OC44OTUsMjcuNTgzTDM5NC41ODYsMjQuMjQ2TDM5OC4wMTksMjIuNjYxTDQwMS4wNjUsMjIuMTc0TDM4OC4yMTYsMTcuNDg2TDM4Ny4yNzIsMTcuMTU4TDM4Ny4yNzIsMTcuMTU4TDM5Ny4wOSwyMC4zNzZMNDA2Ljc4OSwyMy45MzVMNDE2LjM1OSwyNy44M0w0MjUuNzg3LDMyLjA1Nkw0MzUuMDYxLDM2LjYxTDQ0NC4xNzEsNDEuNDg0Wk0zNzkuMDMxLDE0Ljc0NkwzODAuNTEsMTUuMTk5TDM2OS4zNDUsMTIuNDA5TDM2Ni4xMTksMTEuNDc5TDM2Ni4xMTksMTEuNDc5TDM3Ni4xNDgsMTMuOTYzWk0zNTYuMjg3LDkuNDAxTDM2MC4wNjYsMTAuMTk2TDM0OS45ODUsOC4yNTFMMzQ5Ljk4NSw4LjI1MVpNMjE3LjYwNiwzMy45NzFMMjE1LjkwNiwzMC45MTZMMjM0LjQyOCwyNS4wNjZMMjUxLjIwNCwyMy45ODNMMjIyLjY5NywzMC4wNjlaTTI0Ny40NDksMTIuMTEzTDIzMy4wOTEsMTQuNThMMjQ4LjUzOSwxMC45MThaTTI4NS4xNjYsMjMuNTQxTDI3OS45NDMsMjAuNTE4TDI4NS4yOTUsMTkuMjhaTTMyNy43MjcsNS4zMDFMMzI2LjU5Myw1LjMxM0wzMjAuNzE0LDQuOTQ4TDMxOS45Miw0LjY3OEwzMTkuOTIsNC42NzhMMzI0LjMsNC45OTlMMzI0LjMsNC45OTlaTTMxOC44MDIsNC41OThMMzE4LjY3Nyw0LjkyOEwzMDguNzQ5LDQuNjMyTDMwMi4xNjksNC40NDdMMzAyLjE2OSw0LjQ0N0wyOTcuODY4LDQuMjYyTDMwNi42NjYsNC4wNzVMMzA2LjY2Nyw0LjA3NUwzMTYuOTksNC40ODhaTTMwMi45OTcsNC4wMTVMMjk0LjU0Niw0LjI4MUwyODMuNjYyLDUuMzU3TDI3OS40NzksNS43ODJMMjc5LjQ3OSw1Ljc4MkwyNzMuODk0LDYuMTc0TDI3OC4wNjIsNS4zNUwyNjkuNjM1LDYuMDc1TDI2NC4zMDQsNy4xNTFMMjU4Ljk2NCw3LjA0M0wyNDguNDM2LDguNTI2TDI0OC40MzYsOC41MjZMMjU4LjY0LDYuOTA0TDI2OC44OTQsNS42MzlMMjc5LjE4Niw0LjczM0wyODkuNTAzLDQuMTg2TDI5OS44MzQsNFoiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjA0Ljg4LDU4MC4zTDIwNy4wNzcsNTgwLjU5NEwyMDkuNTQ0LDU4MC4wNzdMMjI0Ljk3LDU4NC40NjRMMjM0LjQ2Myw1ODUuNzVMMjQ0LjQ1NCw1ODkuNzgxTDI1NC42MTgsNTg5LjA3MkwyNjUuMDY1LDU4Ni41NjFMMjg5LjQ2NCw1ODguNjE1TDMwMy43ODYsNTg4LjA2OUwzMTguMDk5LDU4Ni44MTdMMzMxLjM4LDU4Ny44NzJMMzU5LjI2Myw1ODQuNzM1TDM3NS4zNjEsNTgzLjQ4OEwzNzkuMTA1LDU4NC40MzdMMzgyLjUzMiw1ODQuMjQ3TDM4My4wNDMsNTg0LjExMkwzODMuMDQzLDU4NC4xMTNMMzczLjA3Nyw1ODYuODM4TDM2My4wMjIsNTg5LjIxM0wzNTIuODksNTkxLjIzNkwzNDIuNjk0LDU5Mi45MDVMMzMyLjQ0NSw1OTQuMjE2TDMyMi4xNTgsNTk1LjE3TDMxMS44NDMsNTk1Ljc2M0wzMDEuNTE0LDU5NS45OTZMMjkxLjE4Myw1OTUuODY5TDI4MC44NjIsNTk1LjM4MUwyNzAuNTY1LDU5NC41MzNMMjYwLjMwNCw1OTMuMzI2TDI1MC4wOTEsNTkxLjc2MkwyMzkuOTM5LDU4OS44NDNMMjI5Ljg2MSw1ODcuNTdMMjE5Ljg2Nyw1ODQuOTQ3TDIwOS45NzIsNTgxLjk3N1pNNTA3LjQxMSw1MDUuNDY4TDQ5NS41ODcsNTE2LjY3N0w0ODMuMTcsNTI3LjIyOEw0ODQuNTI2LDUyMy41MjdMNDk2LjI0Miw1MTQuNzk3Wk01MjQuMDIxLDQ4Ni40NDFMNTI0LjU4OSw0ODkuNzg2TDUxMC4zMDcsNTA0LjkxOVpNNTc0LjA2LDM5NS44MTZMNTcyLjg3NiwzOTcuNTI0TDU3My41NDUsMzk1LjQ0OEw1NzQuNzQ2LDM5My40NlpNNjQuNDQ4LDM5Ny4wMjRMNjcuMzIzLDQyMi45OThMNzIuNjMsNDQ3LjY4N0w2NS40MzksNDQ1Ljc1N0w1OC4yNTksNDI2LjA4M0w1Mi40OTcsNDA1LjY2OVpNNDc5LjIxMSw0MDguMzlMNDg1LjA4MSw0MzEuMTczTDQ5OC40NzMsNDU1LjYxN0w0OTMuMDEzLDQ2OS4yTDQ4Ni45NTUsNDgyLjI2TDQ3Ni44NDYsNDk0LjQyOUw0NjYuMjEsNTA2LjAxOUw0NTEuOCw1MTMuNTc5TDQzNS44NjgsNTEyLjQ1NEw0MTEuOTM2LDQ5MS41NzVMMzgzLjcwNCw1MDEuMDU2TDM1NC42MDUsNTA4LjQ1NUwzMzkuMzQ3LDQ2Ni42NjFMMzQzLjcwOCw0NTUuMTc3TDM3Ni4xNDMsNDQ0Ljc0MkwzODcuNzk5LDQyOS4yMjFMNDEzLjQ0MSw0MjAuNDA3TDQzMy40NjUsNDAxLjA1M0w0NTMuMDE1LDQwNC45NTlMNDQ0Ljk5Myw0MTYuOTE4TDQ2NS41NTIsNDI2Ljc2OEw0NzEuNjU5LDQxMC41OTdMNDc3LjE0NSwzOTQuMDI1Wk00NDQuMTE5LDM1MC43NDVMNDg4LjE4MSwzNTkuMTU3TDUwMi4wNDgsMzgyLjgwMkw0NzguMzI4LDM4Ny40MTRMNDI3LjUxMywzNTEuMTQ2Wk00MDIuMzcsMzQwLjk4NEwzNzcuNTE3LDM0OC4zOTdMMzkxLjg2NywzNzUuNzYyTDM3MC4zNTYsMzY0LjExNUwzODEuMDA4LDM0Mi43NjVaTTMwNC4yMDIsMzgwLjg1TDI4Ny41NiwzNzIuNjY5TDI1MC43MjcsMzI1LjIyNEwyNjEuNDQyLDMyNC4wOTNMMjkzLjk5NSwzNTAuODYxWk0zNjUuOTE4LDM0MC43ODlMMzU3LjA5OCwzNzAuNzA0TDMyNi45MTYsMzY2LjA0MkwzMjEuMTEyLDM1My42MDdMMzYxLjczOSwzMTQuNzIzWk00MzguNjA5LDE1Ny4xNUw0MzkuNzEsMTY2LjU1MUw0MDcuNjYzLDE3NS44MzJMNDMxLjQ4NCwxNTIuOTgyWk0xMTUuODMyLDEyOS4zMzZMMTA1Ljk4OCwxNDUuMTA4TDExNS43NDgsMTUwLjQ2MkwxMjEuNDQ0LDEzMy4wMzFMMTI4LjAzLDExNi40MzNMMTIwLjY4MSwxMTQuNTA0Wk02Ni41MDUsMTE4LjA3N0w2NS43NzcsMTE5LjI0TDUzLjE1MiwxMzcuMDcxTDQ4LjU0OCwxNDYuMzMyTDQ0Ljk5OCwxNTYuMjM3TDUyLjIzMiwxNDYuODk2TDUyLjMzNSwxNTMuNjlMNTMuMzg2LDE2MS4wNDNMNjEuMDQzLDE2My40MTJMNzYuMTU4LDE0NC40M0w2OC4zMDcsMTM0Ljk4TDc1LjgxMSwxMjIuNDA5TDg5LjI5NywxMTkuOTFMMTA1LjA2NywxMTkuMzY0TDEwNC4wODUsMTA4LjA3TDEwNC4xOTcsOTcuODQ5TDgzLjI0MiwxMTcuNzk0TDc2LjkzMiwxMTYuMDkyTDY0LjcyOSwxMjkuOTc0TDc5Ljc1OCwxMDkuMDQyTDg2LjMzMiw5OS4yNzRMOTMuNTE0LDkwLjA3OUw4My44MTQsMTAxLjQ4NEw3NC44MywxMTMuNTQ3TDczLjQxNywxMTIuNzIyTDgxLjE1NywxMDIuMTc0TDg5LjU5NSw5Mi4yNTlMODguNzM2LDkyLjY3NUw4OC43MzYsOTIuNjc1TDk2LjEwMSw4NS40MjhMMTAzLjcxMyw3OC40NDNMMTExLjU2NSw3MS43MjhMMTE4LjE2OCw2Ni40MzRMMTI3LjExNyw2MC44NDdMMTMyLjAzNiw2My44NjVMMTQ5Ljk4NCw1My40NjJMMTY0LjU4LDQzLjY3NUwxNDcuODE5LDUwLjczM0wxMzEuODY3LDU5LjExNEwxNTAuMTMsNDYuNzk1TDE0Ny43NzQsNDYuODcyTDE2My4wMjUsMzguNDg3TDE4MC4xNTYsMzIuMTI5TDE5OC4xNDYsMjcuNjlMMjA3LjA1MSwyNy44NDdMMTk5LjQ1NywzOC4xMDFMMTc5LjgzNSw0NC42NTNMMjAzLjc1Niw0MC41NzNMMjI4LjU5OCwzOC45NzdMMjM0LjMyMyw0NC45NjZMMjQwLjM1NSwzNy40NDNMMjYxLjUxNiwzNi4zNzJMMjc2LjcxNSwzMC44NDVMMjkxLjk0OCwyOS4wNzlMMzA3LjIwNCwyOC4wNTJMMzA2LjE5LDMzLjUwOUwzMzAuMDYsMzQuMzcxTDM1My43MzIsMzYuOTcxTDM1MC42NDYsMzMuODAyTDM2NC42NTgsMzMuNzhMMzc4LjQ4OSwzNC41MDRMMzg2LjEyOSwzNy4xNzhMMzkxLjY1NiwzMy4xNzZMMzk5LjkwNSwzMi4yNDFMNDAyLjYzMSwzMi43TDQwMi42MzEsMzIuN0w0MjAuMDY1LDM1LjUzNEw0MjYuOTAyLDQwLjgyTDQyMC45MjUsNDEuNDc5TDQyMC45NDQsNDEuNDkzTDQyOS40OSw0Ni42TDQzNC45NzMsNTguNjE4TDQyNi43NDksNjEuMzUzTDQ0My4wOTUsNzcuNzAzTDQ0Ni4zMzUsOTMuNDI4TDQyOS42MzQsNzguNzA4TDQyNi4wODMsNjcuNjk1TDQyMi4wMzUsNTcuNTk4TDQxMS4xMTEsNTkuMjA5TDQxMi44ODIsNjUuMDc5TDM5Mi4wNjMsNzEuMDg5TDM4NS43ODUsODcuNjc4TDQwNS4zNTcsOTEuNzg1TDQxMi43ODksMTA5Ljc2NUw0MDcuMTE0LDEzMi4xMDZMMzg3LjIwMiwxNTAuMDcyTDM5OC4xNTQsMTYyLjkxNUwzODkuNDY1LDE3NC44MjFMMzc0Ljg4OSwxNTAuMTE1TDM1MC4wOTksMTU2LjcyNkwzNjMuMDExLDE3Ni43MjlMMzc1LjQ3NCwxOTcuNjA5TDM1MS41NjEsMjMzLjY1N0wzMTYuODksMjM5LjgwM0wzMDMuMjM3LDI1My4zOTJMMzIxLjIzOSwyOTEuMjUyTDMwMC4zODcsMzAwLjQxOUwyNzUuMzkyLDI4Mi4yMjVMMjcwLjMwNiwyOTkuOTI4TDI5MS42NjQsMzI2LjUyNUwyOTIuMzYxLDM0NS4xMzRMMjY1LjA2OCwzMDguMTZMMjYxLjM4OSwyNjMuODI5TDIzNS45MDEsMjMzLjI3TDIxNC43NzksMjM4LjY2TDE4MS4xNTksMjY1LjA2NkwxNjQuODIsMzA0Ljc3MkwxNTcuNzA5LDI4My4yNTdMMTUxLjQ2MiwyNjEuODQzTDE1Mi40MDMsMjM0LjI3OUwxMzMuMTE1LDIxMS4xMTdMMTE1LjQ0NiwyMTAuMjE2TDk4Ljg5MiwxOTMuNzI2TDg0LjkwMSwxNzguNTg5TDgzLjgxMSwxOTMuODM3TDgzLjQ5NSwyMDkuNDY0TDk4LjYzNiwyMDcuOTc0TDEwNS43MDksMjIyLjg1TDk0LjY5NywyMzcuNzczTDc2Ljk4MywyNDcuMjQyTDYwLjk5OCwyNTcuMTE5TDQ2LjEzMSwyNjAuMTQ0TDQ4Ljk2NSwyMzguNzA1TDQ5LjE2MSwyMjMuMjEyTDUwLjE5NCwyMDcuOTc1TDUyLjA2MiwxOTMuMDQ2TDU0Ljc1OCwxNzguNDc0TDUyLjcxMiwxNzMuNzI0TDQ4LjIxMywxODkuODE0TDQ0LjY3MSwyMDYuMzIzTDQyLjEsMjIzLjE4OEw0MC41MDgsMjQwLjM0NUw0Mi41ODcsMjU1Ljk1OEw0NS42OTEsMjcxLjc0N0w2Ni4xMTcsMjY4Ljg5OUw1Ni4xNDMsMjkwLjU4Nkw0OC4xMDYsMzEyLjM0OEwzOS42NiwzMjMuNzM5TDMyLjU4NCwzMzUuMDA2TDMwLjg5OCwzNTMuNDgzTDM1LjgxNiwzNzQuNzIyTDQyLjE2NywzOTUuNTU1TDM5LjQ1OSw0MDUuNTMxTDM3LjkxMyw0MTUuMDM3TDQ2LjkxOSw0MzYuODE4TDUxLjMyNSw0NTIuODU0TDU3LjcxLDQ2Ny42NzVMNTcuMzY4LDQ2OS41NDVMNTcuMzY3LDQ2OS41NDVMNTEuNTk4LDQ2MC45NzRMNDYuMTMyLDQ1Mi4yMDZMNDAuOTc0LDQ0My4yNTRMMzYuMTMzLDQzNC4xMjdMMzEuNjEyLDQyNC44MzZMMjcuNDE5LDQxNS4zOTRMMjMuNTU4LDQwNS44MUwyMC4wMzQsMzk2LjA5OEwxNi44NSwzODYuMjY5TDE0LjAxMiwzNzYuMzM1TDExLjUyMiwzNjYuMzA3TDkuMzg0LDM1Ni4xOTlMNy42LDM0Ni4wMjNMNi4xNzIsMzM1Ljc5TDUuMTAyLDMyNS41MTRMNC4zOTEsMzE1LjIwNkw0LjA0LDMwNC44OEw0LjA1LDI5NC41NDlMNC40MjEsMjg0LjIyM0w1LjE1MSwyNzMuOTE4TDYuMjQxLDI2My42NDNMNy42ODksMjUzLjQxM0w5LjQ5MywyNDMuMjRMMTEuNjUxLDIzMy4xMzZMMTQuMTYsMjIzLjExNEwxNy4wMTcsMjEzLjE4NUwyMC4yMiwyMDMuMzYyTDIzLjc2MywxOTMuNjU3TDI3LjY0MiwxODQuMDgxTDMxLjg1NCwxNzQuNjQ2TDM2LjM5MiwxNjUuMzY1TDQxLjI1MSwxNTYuMjQ3TDQ2LjQyNiwxNDcuMzA0TDUxLjkwOSwxMzguNTQ4TDU3LjY5NSwxMjkuOTg4TDYzLjc3NiwxMjEuNjM1Wk0zOTAuNjQ1LDI3Ljc1MkwzOTMuODc1LDI5LjAyNUwzOTIuMDQ2LDI4Ljg4MlpNNDM2Ljk5LDM3LjYwOEw0MzcuMDYxLDM3LjY0OEw0NTEuMDk5LDQ1Ljc4N0w0NjQuNDYxLDU1LjA2M0w0NTcuNDU5LDUwLjQ2N0w0NDkuNTI3LDQ3LjA2M0w0NDEuMjEzLDQ0LjMwM0w0MjUuNzQzLDM0LjY1NEw0MjEuNzY5LDM1LjUzNEwzOTkuNDc0LDI0LjU2OUwzOTMuNjAyLDIxLjM4N0wzOTMuNjk1LDE5LjIyTDM5My42OTYsMTkuMjIxTDQwMy40MzgsMjIuNjYyTDQxMy4wNTQsMjYuNDRMNDIyLjUzMiwzMC41NTNMNDMxLjg2MSwzNC45OTNaTTIyNy45ODQsMzYuMzE3TDIyNC40OTYsMzMuMzRMMjQyLjE2NywyNi45NDFMMjU5Ljg5MSwyNS4zMzRMMjMxLjc1MywzMi4yOFpNMjQ3LjE2NywxMy43MTRMMjMyLjQ5OSwxNi42MjJMMjQ3LDEyLjUwNVpNMjk0Ljk2NCwyMy44NDNMMjg4LjEzNywyMS4wMDNMMjkyLjkwOSwxOS42MTFaTTMxOC41NjIsNC41ODNMMzE4LjcxNSw0LjYyNEwzMTMuNDYzLDQuNDI5TDMxMS4yMjUsNC4yMTNMMzExLjIyNSw0LjIxM1pNMzEwLjAxNSw0LjE2OUwzMTEuOTEzLDQuNDYzTDMwMi42NTksNC40NTlMMjk1Ljk3OCw0LjQ3NUwyOTUuOTc4LDQuNDc1TDI5MS4wNzksNC40MjlMMjk3LjQ2Miw0LjAxMUwyOTcuNDYzLDQuMDExTDMwNy43OTQsNC4xMDNaTTI5NC4xNTEsNC4wNThMMjg3LjcxLDQuNTUxTDI3OC45NzksNS45MjRMMjc1LjIxMyw2LjQ3TDI3NS4yMTMsNi40N0wyNjkuNjIxLDcuMDMyTDI3Mi41NTEsNi4xTDI2NC4yMDUsNy4wOEwyNjAuMTQsOC4yOTlMMjUyLjUzNSw4LjM4OEwyMzMuODcxLDExLjUyNEwyMzIuNzksMTEuNzMxTDIzMi43OSwxMS43MzFMMjQyLjg5Miw5LjU2MUwyNTMuMDYzLDcuNzQ1TDI2My4yOTEsNi4yODVMMjczLjU2NCw1LjE4M0wyODMuODY5LDQuNDRaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjA2LjEyMiw1ODAuNzE4TDIwNS4wMDksNTgwLjMxOUwyMTMuNTYyLDU4Mi44NTlMMjE5LjAwNSw1ODMuMjQ5TDIyNC43NDUsNTgyLjU5NUwyNDAuMjcyLDU4Ni41MTJMMjUxLjA1OCw1ODcuNDg5TDI1OC4wNzQsNTkxLjI2MkwyNzEuNjU5LDU5MC4xOTJMMjg1LjQyMSw1ODcuMzE0TDMwOS40MTgsNTg4LjYzMkwzMjQuMDM2LDU4Ny42NDdMMzM4LjU5NSw1ODUuOTU2TDM1MC4wNzEsNTg2LjYzNUwzNzYuMzYyLDU4Mi42NzRMMzg5LjU0Myw1ODAuOTgyTDM5MC4yNDQsNTgxLjkwOEwzOTAuMjQzLDU4MS45MDhMMzgwLjM1LDU4NC44ODZMMzcwLjM1OSw1ODcuNTE2TDM2MC4yODIsNTg5Ljc5N0wzNTAuMTMxLDU5MS43MjRMMzM5LjkyLDU5My4yOTZMMzI5LjY1OSw1OTQuNTFMMzE5LjM2Myw1OTUuMzY2TDMwOS4wNDMsNTk1Ljg2MkwyOTguNzEyLDU5NS45OTdMMjg4LjM4Myw1OTUuNzcyTDI3OC4wNjgsNTk1LjE4NkwyNjcuNzc5LDU5NC4yNDFMMjU3LjUzLDU5Mi45MzdMMjQ3LjMzMiw1OTEuMjc3TDIzNy4xOTksNTg5LjI2MUwyMjcuMTQyLDU4Ni44OTNMMjE3LjE3NCw1ODQuMTc2TDIwNy4zMDcsNTgxLjExMlpNNTE4Ljc5Nyw0OTguOTkzTDUwNy41NSw1MTAuNTUyTDQ5NS42NzMsNTIxLjQ3M0w0OTguNzI2LDUxNy43MDVMNTA5LjA1Myw1MDguNjRaTTUyMC40MDYsNDk3LjU3OEw1MTkuNjc5LDQ5OC4zODZMNTM1LjA3Nyw0NzkuNDY2TDUzNS4wNzcsNDc5LjQ2Nkw1MzMuNTM1LDQ4MS44NzJMNTMzLjUzNCw0ODEuODczTDUyNy4wNDUsNDg5LjkxMlpNNTgyLjY0OSwzODcuMzU5TDU4MS45OTQsMzg5LjA5NEw1ODIuNjQsMzg2Ljk5OEw1ODMuMzU2LDM4NC45ODFaTTk2LjcyOCw0MDMuNjlMOTcuNzMxLDQyOS42MDZMMTAwLjg0OSw0NTQuMTY3TDkxLjYxOSw0NTIuNDg2TDg1LjQ0LDQzMy4wMTVMODAuNTIxLDQxMi43NjNaTTUxNS41MjYsNDAyLjM5M0w1MTguNzQxLDQyNS4wMzhMNTIzLjMzOCw0MzcuNDk0TDUyNi42NDcsNDQ5LjE1OEw1MjAuMzkzLDQ2Mi45MTlMNTEzLjQ1OCw0NzYuMTc3TDUwMy4zMDYsNDg4LjY1NEw0OTIuNTUsNTAwLjU2OEw0NzkuNDc5LDUwOC41NDZMNDY2LjcxMyw1MDcuODU3TDQ0OS41MTcsNDg3LjYwM0w0MjIuNzc3LDQ5Ny45MkwzOTQuNzY1LDUwNi4xODZMMzg1LjA2Myw0NjQuNzcxTDM5MC4xNzYsNDUzLjE0M0w0MjEuNTQxLDQ0MS43MzlMNDMzLjM1Niw0MjUuODYxTDQ1Ny4zMjQsNDE2LjI5M0w0NzYuMjMsMzk2LjM0OUw0OTMuMjkzLDM5OS42OThMNDg1LjY1Nyw0MTEuODk0TDUwMi43ODcsNDIxLjE3M0w1MDkuMDMsNDA0LjgxM0w1MTQuNTE5LDM4OC4wNzVaTTQ4Ni44MTQsMzQ1LjcxN0w1MjQuODQ2LDM1Mi44ODJMNTM1LjY1LDM3Ni4xNTNMNTE1Ljc4OSwzODEuNDI3TDQ5NS40NzQsMzY0LjU0TDQ3MS45NTQsMzQ2LjU5NlpNNDQ5LjAyNiwzMzcuMTY1TDQyNS45NDUsMzQ1LjMwNkw0MzkuMDk4LDM3Mi4yNTNMNDE5LjE1MSwzNjEuMjM2TDQyOS4yMDEsMzM5LjU3MVpNMzU1LjI2NSwzNzkuOTQ2TDMzOC45NjQsMzcyLjI2NkwzMDEuOTYyLDMyNS45NDNMMzEyLjc3MywzMjQuNDg1TDM0NS40NzYsMzUwLjI2MVpNNDE0Ljk5OSwzMzguMDQxTDQwNi41MzcsMzY4LjIxOEwzNzcuNjI2LDM2NC40NTNMMzcyLjA1OCwzNTIuMTkxTDM5MS43ODgsMzMyLjI5M0w0MTAuNjg3LDMxMi4xMDNaTTQ2OS42NjEsMTUyLjQ2N0w0NzEuOTEzLDE2MS44MTdMNDQ0LjM4MywxNzIuMDAzTDQ2Mi43OTcsMTQ4LjUxMVpNMTQ3LjQzMyw0Ny4zNzFMMTI5Ljk2Miw1OC45MjRMMTEzLjM0Niw3MS42ODlMMTEzLjcxMSw3MC4wMThMMTMwLjA5MSw1OC4wMDlaTTE5MC40NTcsMjUuMDE2TDE4OC41NDgsMjUuOTA3TDE4OC41NDgsMjUuOTA3TDE4My4wNTcsMjguMDhMMTgzLjA1NywyOC4wOFpNMTQwLjI5LDEzNC41NjFMMTMxLjgzMSwxNTAuNjExTDE0NC4yOTYsMTU1LjYyN0wxNDcuNjYzLDEzOC4wNThMMTUxLjc5MSwxMjEuMjk3TDE0Mi42MjQsMTE5LjYxOVpNNjMuNDU2LDEyMi4wNTlMNjMuNjA5LDEyMy41ODlMNjUuNDI2LDEyNi4zNjJMNTMuOTg2LDE0NC41NThMNTIuNDkyLDE1My45MTJMNTIuMDM1LDE2My44NzhMNjAuNDA3LDE1NC4zMDFMNjcuNzQyLDE2OC4zMThMNzkuMTc4LDE3MC4zOTdMOTQuNTk2LDE1MC45NTFMODAuODUyLDE0MS44MjlMODYuOTA0LDEyOS4wNTJMMTA0LjgzLDEyNi4wNzZMMTI0Ljg3LDEyNC45ODZMMTE2Ljc2MSwxMDMuNjA4TDk1Ljc4NCwxMjQuMTg5TDg1LjYzOCwxMjIuNzM3TDczLjA4MSwxMzYuOTk1TDg2LjE0MSwxMTUuNjM3TDkwLjUxNiwxMDUuNzAzTDk1LjQ4OCw5Ni4zMjNMODcuNjcxLDEwNy45OTRMODAuNTU3LDEyMC4zMDJMNzcuMTQzLDExOS41NUw4Mi42NjUsMTA4LjgwMUw4OC44ODEsOTguNjYzTDgzLjkwMSw5OS42NzRMNzMuNjc2LDEwOS44MDlMNjQuNDM3LDEyMC43N0w2NC43MTksMTIwLjM5Mkw2NC43MiwxMjAuMzkyTDcxLjEzMSwxMTIuMjlMNzcuODIyLDEwNC40MTdMODQuNzgzLDk2Ljc4Mkw4Ny43MTYsOTMuNzE5TDg2LjU3NCw5NS4xNEwxMDUuNzI4LDc3LjI3NkwxMTUuNjA3LDcxLjA3NEwxMjYuNDgzLDY2LjExTDEzMS43OTUsNjcuMDIyTDEzNy43OSw2OC44ODFMMTU2LjA4Myw1Ny45MjdMMTY5LjEzMyw0Ny43MjFMMTUwLjg1Nyw1NS4zMTFMMTMzLjM3Myw2NC4xOTlMMTUwLjI5Myw1MS4zNDZMMTQ1Ljc0MSw1MS41MjlMMTYwLjkwOCw0Mi42ODJMMTgwLjUxOSwzNS43NjVMMjAwLjk4NywzMC43NDJMMjEyLjIzOCwzMC41OTJMMjA5LjIzNSw0MS4wMDhMMTg5LjIzMyw0OC4xNjJMMjE1LjM3Miw0My4zMkwyNDIuMzIzLDQwLjkzOEwyNTAuNzM5LDQ2LjcxMkwyNTQuMzc0LDM5LjA0M0wyNzYuMjA4LDM3LjMxOEwyODkuNjM3LDMxLjM1NkwzMDQuMjQ2LDI5LjEzNkwzMTguODQzLDI3LjY1NkwzMjAuMDY3LDMzLjExTDM0My4zMjgsMzMuMjU2TDM2Ni4zMDYsMzUuMTQ3TDM2Mi4yMiwzMi4wODhMMzc0LjgxNSwzMS42NjFMMzg3LjIsMzEuOTg3TDM5NC45MzEsMzQuNDI4TDM5Ny41MzIsMzAuMzAyTDQwMy40OTMsMjkuMTUxTDQwNS44NDcsMjkuNTMyTDQwNS44NDcsMjkuNTMyTDQyMC4wMjgsMzEuODg3TDQyOC40MjIsMzYuOTQxTDQyNC43MTQsMzcuNzQ3TDQyNC43MzYsMzcuNzYxTDQzMy44MTQsNDIuNkw0NDMuNjg4LDU0LjM4NEw0MzguMjg5LDU3LjMyN0w0NTYuOTg1LDczLjE0NEw0NjQuMTE1LDg4LjcxMUw0NDYuMjY0LDc0LjUxN0w0MzkuOTQ4LDYzLjY1NEw0MzMuMDgxLDUzLjcyM0w0MjQuNjQ5LDU1LjYyN0w0MjguMDc3LDYxLjQxOEw0MTEuNzI2LDY3Ljk5M0w0MTAuMTUzLDg0LjcwMUw0MjguNjIsODguMjMxTDQzOC45ODMsMTA1Ljk0TDQzNy44NzMsMTI4LjM4NEw0MjIuMzc1LDE0Ni44ODhMNDM0LjEzNCwxNTkuMzg2TDQyNy41NzQsMTcxLjUyM0w0MTAuOTYsMTQ3LjI5MkwzODguNDc1LDE1NC42Mkw0MDMuMDc4LDE3NC4yMDZMNDE2Ljk0NywxOTQuNjg1TDM5Ny4zMTQsMjMxLjM5NUwzNjQuMjk1LDIzOC41N0wzNTEuNzY3LDI1Mi41NTdMMzcxLjExOSwyODkuODQ5TDM1MS4wMTMsMjk5LjYzOEwzMjUuNTgyLDI4Mi4yMUwzMjEuMTE4LDMwMC4wNThMMzQyLjk4NiwzMjUuOTk4TDM0My44NDgsMzQ0LjU4NEwzMTYuMDkxLDMwOC40NDZMMzEwLjY4OCwyNjQuMjUzTDI4Mi45NDUsMjM0LjUwM0wyNjEuNTUyLDI0MC41MzlMMjI3Ljg4NSwyNjcuOTY3TDIxMi4wNDIsMzA4LjE2MkwxOTUuODYzLDI2NS42ODJMMTk1LjA3NywyMzguMTE2TDE3MS45MTUsMjE1LjU5OEwxNTIuMDE4LDIxNS4yNjhMMTEyLjQwMywxODQuNzA3TDExNC45MDUsMjE1LjU2NUwxMzIuNTE5LDIxMy41NzdMMTQyLjE3LDIyOC4xOTlMMTMwLjgxNywyNDMuNDYyTDExMC44MTcsMjUzLjUwNEw5Mi4yODUsMjYzLjkwNkw3My45MDcsMjY3LjQzNkw3NS42MTgsMjQ1LjkyN0w3NC4xMDMsMjMwLjQ1NEw3My4zNDMsMjE1LjIxNEw3My4zNCwyMDAuMjU2TDc0LjA5NCwxODUuNjMyTDcwLjIwMSwxODAuOTcyTDY3LjUxMSwxOTcuMTcyTDY1LjcwNCwyMTMuNzYyTDY0Ljc4OCwyMzAuNjc5TDY0Ljc2NSwyNDcuODYxTDY4Ljk5OCwyNjMuMzc4TDc0LjE1LDI3OS4wNDJMOTkuMjk4LDI3NS41MDJMODguMjExLDI5Ny41MDlMNzguODA2LDMxOS41MzZMNjguMDczLDMzMS4yMThMNTguNTYxLDM0Mi43MzZMNTUuNTk2LDM2MS4yODRMNjEuMDAyLDM4Mi4zNjZMNjcuNzA1LDQwMy4wMDFMNjIuNDU2LDQxMy4wOTlMNTguMjY3LDQyMi42OTFMNjYuNzk1LDQ0NC4yMDVMNjguMTEyLDQ2MC4xNTVMNzEuMjczLDQ3NC44M0w2NC44NTgsNDc3LjA5TDUyLjA1Niw0NTkuNDI1TDQwLjY0OSw0NDAuODYzTDI4LjI2Myw0MTUuNjIxTDE4LjM0NywzODkuMzI4TDEzLjc5MSwzNjguMzQ2TDkuOTY3LDM1MC4xNTRMNy4yODgsMzMxLjc2M0w0LjcwNSwzMDkuMDU3TDUuNDYsMjg4LjY1Nkw1LjE3OCwyNzguMDcyTDUuNzkyLDI2Ny41NTVMNS43ODksMjY3LjUwNUw1Ljc4OSwyNjcuNTA0TDcuMTAyLDI1Ny4yNTZMOC43NzMsMjQ3LjA2TDEwLjc5OCwyMzYuOTI5TDEzLjE3NSwyMjYuODc0TDE1LjkwMiwyMTYuOTA5TDE4Ljk3NSwyMDcuMDQ0TDIyLjM5LDE5Ny4yOTNMMjYuMTQzLDE4Ny42NjhMMzAuMjMxLDE3OC4xNzlMMzQuNjQ2LDE2OC44MzhMMzkuMzg2LDE1OS42NTdMNDQuNDQyLDE1MC42NDdMNDkuODEsMTQxLjgxOUw1NS40ODMsMTMzLjE4NEw2MS40NTQsMTI0Ljc1MlpNMzkzLjQ4NSwyNC45NTVMMzk2LjgxNiwyNi4xMjhMMzk1LjMxNCwyNi4wMzZaTTQ1MC4yODQsNDQuOTg5TDQzOS41NDgsNDAuMDM4TDQyMi4yMjIsMzAuODg3TDQyMS4wNjgsMzEuODQ1TDM5Ny4wMywyMS41ODRMMzg5Ljc3NSwxOC42MDFMMzg2LjU5OCwxNi45NTFMMzg2LjU5OCwxNi45NTFMMzk2LjQyNCwyMC4xNDZMNDA2LjEzMiwyMy42ODFMNDE1LjcxMSwyNy41NTRMNDI1LjE0OCwzMS43NThMNDM0LjQzNCwzNi4yODlMNDQzLjU1NSw0MS4xNDFaTTI0MC41NTEsMzguMzE0TDIzNS4zODEsMzUuNDY5TDI1MS42NjMsMjguNTU0TDI2OS43OTYsMjYuNDAyTDI0Mi44ODQsMzQuMTg0Wk0yNDguNDkxLDE1LjI5OUwyMzMuOTU4LDE4LjY1MUwyNDcuMDcyLDE0LjExNFpNMzA0LjkxNSwyMy44NDVMMjk2LjY5MSwyMS4yMzRMMzAwLjczOCwxOS43MDdaTTMwOS44NzgsNC4xNjVMMzEwLjI2OCw0LjE4NEwzMDUuODA0LDQuMTM2TDMwMi42NjMsNC4wMTJMMzAyLjY2Myw0LjAxMlpNMzAxLjI3Miw0LjAwM0wzMDQuNzg3LDQuMjFMMjk2LjQ4OCw0LjQ3MkwyODkuOTEsNC42ODlMMjg5LjkxLDQuNjg5TDI4NC41NjEsNC44TDI4OC45MTksNC4yMDdMMjg4LjkyLDQuMjA3TDI5OS4yNSw0LjAwMVpNMjg1LjgyOSw0LjMzOUwyODEuMjQ3LDUuMDIyTDI3NC45MzQsNi42MjRMMjcxLjcwMSw3LjI3N0wyNzEuNzAxLDcuMjc3TDI2Ni4yNzEsOC4wMDZMMjY3Ljg3NSw3LjAwNUwyNTkuODYzLDguMjM0TDI1Ny4xODYsOS41NTVMMjQ3LjU0OCw5LjkwNkwyMjcuMDIsMTMuNjM3TDIyMi43ODEsMTQuMzIyTDIxMC42MzgsMTcuODI2TDIxMC43MjgsMTcuNzgzTDIxMC43MjgsMTcuNzgzTDIyMC42MzIsMTQuODM5TDIzMC42MzIsMTIuMjQzTDI0MC43MTcsOS45OTdMMjUwLjg3NCw4LjEwNUwyNjEuMDkxLDYuNTY4TDI3MS4zNTUsNS4zODlMMjgxLjY1NCw0LjU2OVoiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjEzLjQ2NSw1ODMuMDY4TDIxNy4wNTEsNTg0LjA1MkwyMTUuNTQ3LDU4My4wNDVMMjI1LjM5Myw1ODUuMzA2TDIzMy42OTEsNTg1LjQ4NkwyNDIuMjMzLDU4NC42MTZMMjU3LjM4OSw1ODguMDY2TDI2OS4xNDEsNTg4LjcwMkwyNzIuOTY4LDU5Mi4zMDlMMjg5LjU2Miw1OTAuNzgyTDMwNi4yMjEsNTg3LjQ0MUwzMjkuMDg2LDU4OC4wNDdMMzQzLjU1NSw1ODYuNjJMMzU3LjkxNyw1ODQuNDg5TDM2Ny4yNDEsNTg0Ljg1MkwzOTEuMTQxLDU4MC4xMjlMNDAxLjAwNSw1NzguMDg4TDM5OS43OSw1NzguNjcyTDM5OS43ODksNTc4LjY3MkwzOTAuMDAzLDU4MS45ODVMMzgwLjEwNyw1ODQuOTU0TDM3MC4xMTMsNTg3LjU3NkwzNjAuMDM0LDU4OS44NDhMMzQ5Ljg4Miw1OTEuNzY3TDMzOS42NjksNTkzLjMzTDMyOS40MDgsNTk0LjUzNUwzMTkuMTExLDU5NS4zODJMMzA4Ljc5MSw1OTUuODY5TDI5OC40Niw1OTUuOTk2TDI4OC4xMzEsNTk1Ljc2MkwyNzcuODE2LDU5NS4xNjhMMjY3LjUyOCw1OTQuMjE0TDI1Ny4yOCw1OTIuOTAxTDI0Ny4wODQsNTkxLjIzMkwyMzYuOTUyLDU4OS4yMDhMMjI2Ljg5OCw1ODYuODMxTDIxNi45MzIsNTg0LjEwNVpNMTM1LjE4NCw0MDkuMjgzTDEzNC4yODUsNDM1LjE5N0wxMzUuMTE5LDQ1OS42OTdMMTI0LjEyOSw0NTguMzI0TDExOS4xNDEsNDM5LjAyMkwxMTUuMjE1LDQxOC45MDVaTTU0NS4yOTMsMzk1LjM5Mkw1NDUuNzU1LDQxNy45ODFMNTQ3LjU1OCw0MzAuMzRMNTQ3LjkzNSw0NDEuOTQ4TDU0MS4wNzcsNDU1LjkwOEw1MzMuNDc0LDQ2OS4zODdMNTIzLjU4OSw0ODIuMTY4TDUxMy4wMzksNDk0LjQwN0w1MDEuNzA1LDUwMi43NTVMNDkyLjQ5Myw1MDIuNEw0ODIuNTU1LDQ4Mi41NThMNDU4LjExOCw0OTMuNjUyTDQzMi4wNDQsNTAyLjc0TDQzMC43NjcsNDgzLjA0Mkw0MjguMTk0LDQ2MS41MzFMNDMzLjkwNCw0NDkuNzM4TDQ2My4yNDcsNDM3LjQxMkw0NzQuODYxLDQyMS4xNzhMNDk2LjQyNyw0MTAuOTE5TDUxMy42NDEsMzkwLjQyNUw1MjcuNjk5LDM5My4zMDJMNTIwLjY3OSw0MDUuNzIxTDUzMy44NjEsNDE0LjUzOUw1NDAuMDUxLDM5Ny45OUw1NDUuMzc0LDM4MS4wODhaTTUyMy44MzIsMzM5LjQ3OUw1NTQuNjgsMzQ1LjU5N0w1NTguODI0LDM1Ny4xOTFMNTYyLjA5MiwzNjguNTkxTDU0Ni42OTMsMzc0LjRMNTMwLjgyNCwzNTguMDY0TDUxMS4xNywzNDAuNzc2Wk00OTEuMTU0LDMzMS45OTdMNDcwLjU0NiwzNDAuODAyTDQ4Mi4xMDMsMzY3LjM3M0w0NjQuMzI1LDM1Ni45MjlMNDczLjQ2OCwzMzQuOTczWk00MDQuNjQ5LDM3Ny41MTdMMzg5LjE4NCwzNzAuMzE5TDM1My4xMzcsMzI1LjEwNkwzNjMuNzE1LDMyMy4zMjNMMzk1LjU3NSwzNDguMTE4Wk00NjAuNTg2LDMzMy44NTRMNDUyLjczOSwzNjQuMjc5TDQyNS45NzgsMzYxLjM2TDQyMC44MTUsMzQ5LjI2MUw0MzkuMTczLDMyOC43ODRMNDU2LjI3MSwzMDguMDQ4Wk00OTUuNTU4LDE0Ni45MTlMNDk4Ljg5MiwxNTYuMTgzTDQ3Ni43MTcsMTY3LjEyNUw0ODkuMTY0LDE0My4xNjRaTTE0Ni4wMjUsNTIuMDI4TDEyOS40MTMsNjQuMDk5TDExMy42NTksNzcuMzU2TDExMC4zODQsNzUuNzI5TDEyNy43MTcsNjMuMjA4Wk0xODMuMzg0LDI5LjM3MkwxNzEuNjQ2LDMzLjcxNUwxODQuNjYxLDI3LjQ4NVpNMTY5LjYwMSwxMzguOTY4TDE2Mi43ODQsMTU1LjI1TDE3Ny41NzUsMTU5Ljg1MkwxODAuMDU0LDEyNS4zNzFMMTY5LjM1LDEyMy45OTVaTTQyLjc1NCwxNTMuNTc1TDQ0LjI5OCwxNTAuOTk4TDUxLjY1NywxMzkuNzIyTDU5LjgzNCwxMjguOTczTDY0LjYyMSwxMzAuMTcyTDcyLjIwMiwxMzMuMzg2TDYyLjI5NSwxNTEuOTA3TDYzLjk1NiwxNjEuMjU4TDY2LjYwNywxNzEuMTkxTDc1Ljg2MiwxNjEuMzQ2TDg5LjE1NCwxNzUuMDVMMTA0LjAyMiwxNzYuNzI5TDExOS4yNzUsMTU2LjgxN0wxMDAuMDU2LDE0OC4xOTZMMTA0LjQ3MywxMzUuMjZMMTI2LjI5MiwxMzEuNjhMMTQ5Ljk5NSwxMjkuOTI1TDEzNC44OTIsMTA4LjlMMTE0LjUzMSwxMzAuMTA5TDEwMC44NTYsMTI5LjAxOUw4OC4zMjgsMTQzLjY1OUw5OS4wMjEsMTIxLjkzOUwxMDMuNjc2LDEwMi40MTNMOTcuOTc5LDExNC4yODlMOTIuOTUzLDEyNi43ODFMODcuNjQxLDEyNi4xNjJMOTAuNzc3LDExNS4yODFMOTQuNTgxLDEwNC45OTFMODUuOTQsMTA2LjIxTDczLjkyMSwxMTYuNjgyTDYyLjg4NiwxMjcuOTUxTDYzLjc0NywxMjIuMzA0TDczLjY3MSwxMDkuOTg1TDg0LjI1MSw5OC4yMTZMODUuMzMsMTAxLjY0M0wxMDQuNzY2LDgzLjE5M0wxMTcuNDQ5LDc2LjY0OUwxMzEuMTIsNzEuMzEyTDEzOS40NzEsNzIuMDE3TDE0OC40NzQsNzMuNjQ4TDE2Ni41NTQsNjIuMTQxTDE3Ny42NjIsNTEuNTY4TDE1OC40MjYsNTkuNzI3TDEzOS45NDIsNjkuMTYyTDE1NS4wMDQsNTUuODIzTDE0OC4zOTUsNTYuMTc1TDE2My4wMTgsNDYuODc2TDE4NC41MTMsMzkuMzM1TDIwNi44MzYsMzMuNjYxTDIyMC4wOTIsMzMuMTM5TDIyMS43NzEsNDMuNTc1TDIwMS45OTUsNTEuMzMzTDIyOS41Niw0NS42NzZMMjU3Ljc5OSw0Mi40NTVMMjY4LjY1Miw0Ny45MzdMMjY5Ljc3OSw0MC4xOTVMMjkxLjYyMiwzNy44MDdMMzAyLjg3MywzMS40N0wzMTYuNDE0LDI4LjgyM0wzMjkuOTEsMjYuOTE1TDMzMy4zMzQsMzIuMjk4TDM1NS4yOCwzMS43NThMMzc2Ljg2NSwzMi45NzJMMzcxLjkwNCwzMC4wNUwzODIuNjk5LDI5LjI2OEwzOTMuMjYxLDI5LjI0NUw0MDAuODQ4LDMxLjQ1M0w0MDAuNDQ1LDI3LjI5NEw0MDMuOTM3LDI1Ljk5OUw0MDUuODQ3LDI2LjMxNkw0MDUuODQ3LDI2LjMxNkw0MTYuMzQzLDI4LjI5Nkw0MjYuMDM5LDMzLjA3NUw0MjQuNzE0LDMzLjk1OEw0MjQuNzM5LDMzLjk3MUw0MzQuMDcxLDM4LjUzTDQ0OC4wMzYsNDkuOTUyTDQ0NS42MjgsNTMuMDEzTDQ2Ni4xMDUsNjguMjM2TDQ3Ni45MDksODMuNTNMNDU4LjQ1MSw2OS44ODdMNDQ5LjU2Miw1OS4yNTVMNDQwLjA4Myw0OS41NzNMNDM0LjM5OSw1MS42OTJMNDM5LjM4LDU3LjM1NUw0MjcuOTk0LDY0LjM1MUw0MzEuMTc0LDgxLjAzNUw0NDcuOTc1LDg0LjAyOUw0NjAuOTU0LDEwMS4zODNMNDY0LjQ0MiwxMjMuNzkxTDQ1My44MywxNDIuNjkxTDQ2Ni4wMzksMTU0LjgyNkw0NjEuODA3LDE2Ny4xMjdMNDQzLjY2LDE0My40MjNMNDI0LjE2MywxNTEuMzlMNDQwLjAxMywxNzAuNTEzTDQ1NC44NjYsMTkwLjU1Nkw0NDAuMTEsMjI3Ljc4OEw0MDkuNzQ3LDIzNS45MjZMMzk4LjcyNCwyNTAuMjdMNDE4LjgzOCwyODYuOTYzTDQwMC4wODgsMjk3LjM0MkwzNzQuOTk0LDI4MC42ODJMMzcxLjI4OSwyOTguNjU0TDM5My4wMDEsMzIzLjkzMkwzOTQuMDAzLDM0Mi40OUwzNjYuNjI0LDMwNy4xOUwzNTkuNjYzLDI2My4xODRMMzMwLjUwNywyMzQuMjk5TDMwOS40OTIsMjQwLjk3OUwyNzYuODAyLDI2OS40MTVMMjYxLjkzNywzMTAuMDc2TDI0My40MjksMjY4LjEyNEwyNDAuOTM5LDI0MC42MDdMMjE0LjYwOCwyMTguODQxTDE5My4wODYsMjE5LjE0MUwxNDUuNjA1LDE4OS45MDNMMTUxLjkzOSwyMjAuNjI3TDE3MS40OSwyMTguMDc0TDE4My40MjgsMjMyLjM2OEwxNzIuMDc3LDI0Ny45NzZMMTUwLjQsMjU4LjY1MUwxMjkuODgyLDI2OS42NDZMMTA4LjU1MiwyNzMuNzhMMTA5LjA4OSwyNTIuMjM3TDEwMy4zNzksMjIxLjY0NEwxMDAuMjk0LDE5Mi4wOThMOTQuNjcyLDE4Ny41ODNMOTMuODcyLDIwMy44MzVMOTMuODU1LDIyMC40NTNMOTQuNjIyLDIzNy4zNzNMOTYuMTcsMjU0LjUzMUwxMDkuNDcyLDI4NS4zNjhMMTM4LjU3OCwyODEuMDAzTDEyNi43MTQsMzAzLjM1OUwxMTYuMjI2LDMyNS42ODhMOTEuODc1LDM0OS41NjZMODcuNzIsMzY4LjIyMkw5My40NSwzODkuMTM1TDEwMC4zLDQwOS41NjRMODUuOTY1LDQyOS42MTVMOTMuNzU2LDQ1MC44ODJMOTEuOTQ0LDQ2Ni44MzlMOTEuNzg3LDQ4MS40NjhMNzkuMDc3LDQ4NC4wMTlMNjUuMjI5LDQ2Ni43NTlMNTIuNzAyLDQ0OC41NkwzOS4zMjYsNDIzLjcxTDI4LjMyLDM5Ny43MzVMMjUuNjg3LDM3Ni44NjJMMjEuMjQyLDM1OC43OTVMMTcuODk5LDM0MC40OTZMMTIuNTk0LDMxNy45MUwxNC4yMjQsMjk3LjQ3MkwxMS41MDQsMjg2LjkzNEw5LjY2LDI3Ni40MzVMNC45OTYsMjc1LjczN0w0Ljk5NiwyNzUuNzM3TDYuMDIzLDI2NS40NTZMNy40MDcsMjU1LjIxOEw5LjE0OCwyNDUuMDM0TDExLjI0NCwyMzQuOTE2TDEzLjY5MSwyMjQuODc5TDE2LjQ4NywyMTQuOTMyTDE5LjYyOSwyMDUuMDlMMjMuMTEyLDE5NS4zNjNMMjYuOTMyLDE4NS43NjNMMzEuMDg1LDE3Ni4zMDNMMzUuNTY2LDE2Ni45OTNMNDAuMzY5LDE1Ny44NDZaTTM5My40ODUsMjIuMTE0TDM5Ni44MTYsMjMuMTg2TDM5NS42ODYsMjMuMTM0Wk00MzMuNjksMzUuOTExTDQzMy42NDMsMzUuODg3TDQzMi45ODIsMzUuNTU0TDQzMi45ODIsMzUuNTU0Wk00MTUuNDgzLDI3LjQ1N0w0MTYuNjg4LDI4LjIzM0wzOTEuNjM4LDE4LjcxN0wzODMuMjIsMTUuOTczTDM4MS43MjIsMTUuNTA1TDM4MS43MjIsMTUuNTA1TDM5MS42MDEsMTguNTNMNDAxLjM2OSwyMS44OTlMNDExLjAxMywyNS42MDZaTTI1NC45MjQsMzkuOTAyTDI0OC4yMjksMzcuMjM3TDI2Mi42MjgsMjkuODU2TDI4MC42MTksMjcuMTU1TDI1NS43NDksMzUuNzI0Wk0yNTEuMzgsMTYuODIxTDIzNy40MjQsMjAuNjA1TDI0OC43NTMsMTUuNjk3Wk0zMTQuNzE2LDIzLjU0N0wzMDUuMzQ2LDIxLjIwM0wzMDguNTQ1LDE5LjU2NlpNMzAxLjE3NCw0LjAwMkwzMDEuNTA5LDQuMDA1TDI5Ny45NjgsNC4wNzlMMjkzLjQ4Miw0LjA3MkwyOTMuNDgyLDQuMDcyWk0yOTIuMDIxLDQuMTA4TDI5Ny41MTUsNC4xNzVMMjkwLjQyNCw0LjY3MUwyODQuMTQ5LDUuMDgzTDI4NC4xNDksNS4wODNMMjc4LjUxMiw1LjM2MUwyODAuNDUzLDQuNjQ2TDI4MC40NTMsNC42NDZMMjkwLjc3Myw0LjE0NFpNMjc3LjQ4Miw0Ljg1OEwyNzUuMzU0LDUuNjgxTDI3MS42NTEsNy40MzZMMjY5LjA0OCw4LjE3N0wyNjkuMDQ4LDguMTc3TDI2My45NDcsOS4wNjZMMjY0LjE3NCw4LjAzOEwyNTYuNzQxLDkuNTAxTDI1NS41MzQsMTAuODgxTDI0NC4xNTQsMTEuNTUxTDIyMi4zODgsMTUuOTI1TDIxNi40MzYsMTYuNzY0TDIwMy45NywyMC42NDJMMjAxLjQ4NiwyMC44NzVMMjAxLjQ4NiwyMC44NzRMMjExLjI4OCwxNy42MDZMMjIxLjE5NywxNC42ODJMMjMxLjIwMywxMi4xMDZMMjQxLjI5Miw5Ljg4TDI1MS40NTMsOC4wMDhMMjYxLjY3Myw2LjQ5MkwyNzEuOTM5LDUuMzMzWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjEyLjk1Miw1ODIuOTExTDIyOC4wODIsNTg2LjQwNUwyMjguNjUxLDU4NS40MTJMMjM5LjQ5MSw1ODcuMzU5TDI1MC4zOTIsNTg3LjI0N0wyNjEuNDc2LDU4Ni4wNzlMMjc1LjgsNTg5LjA4MUwyODguMTYxLDU4OS4zNUwyODguNjgzLDU5Mi44OTJMMzA3Ljc4Miw1OTAuODIyTDMyNi44MzIsNTg2LjkzOUwzNDcuODcsNTg2Ljg3OEwzNjEuNzUxLDU4NS4wMkwzNzUuNDgsNTgyLjQ2M0wzODIuMzY4LDU4Mi41NzlMNDAzLjE1LDU3Ny4xNzhMNDA2LjgsNTc2LjA2MUw0MDYuNzk5LDU3Ni4wNjFMMzk3LjEsNTc5LjYyTDM4Ny4yODIsNTgyLjgzOUwzNzcuMzU4LDU4NS43MTNMMzY3LjM0LDU4OC4yMzhMMzU3LjIzOSw1OTAuNDEzTDM0Ny4wNjksNTkyLjIzNEwzMzYuODQyLDU5My42OThMMzI2LjU2OSw1OTQuODA1TDMxNi4yNjUsNTk1LjU1M0wzMDUuOTQsNTk1Ljk0TDI5NS42MDgsNTk1Ljk2N0wyODUuMjgyLDU5NS42MzRMMjc0Ljk3Myw1OTQuOTRMMjY0LjY5NSw1OTMuODg3TDI1NC40Niw1OTIuNDc2TDI0NC4yODEsNTkwLjcwOEwyMzQuMTY5LDU4OC41ODdMMjI0LjEzOCw1ODYuMTEzTDIxNC4xOTksNTgzLjI5MlpNMTc4LjY0OCw0MTMuNjNMMTc1Ljg3NSw0MzkuNkwxNzQuMzk5LDQ2NC4xMUwxNjEuOTg0LDQ2My4wOTJMMTU4LjMzOCw0NDMuOTIyTDE1NS41MjIsNDIzLjkwN1pNNTY3LjYwNywzODcuNkw1NjYuODAzLDM5OS4wMzhMNTY1LjMwMSw0MTAuMjE3TDU2NC4yNTcsNDIyLjU2NEw1NjEuNjg5LDQzNC4yMDZMNTU0LjQzNiw0NDguMzhMNTQ2LjM5Niw0NjIuMDk2TDUzNy4wNzksNDc1LjE3TDUyNy4wNTUsNDg3LjcyMUw1MTcuODAyLDQ5Ni4zODJMNTEyLjQyNCw0OTYuMjQ5TDUxMi4wNDksNDg3LjEzOUw1MTAuMDQ1LDQ3Ni41OTRMNDg4LjY1Niw0ODguMzg0TDQ2NS4zMTIsNDk4LjIyM0w0NjcuMTk5LDQ3OC41MTVMNDY3LjQzLDQ1Ny4wNEw0NzMuNTYzLDQ0NS4wNjdMNDk5Ljk5Miw0MzEuODk0TDUxMS4wNTMsNDE1LjMxNUw1MjkuNTYxLDQwNC40NDdMNTQ0LjU2LDM4My40NjRMNTU1LjE4NiwzODUuOTY2TDU0OC45OTcsMzk4LjU4Nkw1NTcuODI4LDQwNy4wNjlMNTYzLjc3OCwzOTAuMzM2TDU2OC43NzQsMzczLjI3N1pNNTU0LjA0OSwzMzIuMjE5TDU3Ni43NzUsMzM3LjUyM0w1NzkuMTQ1LDM0OS4wMThMNTgwLjU3MSwzNjAuMzQ2TDU3MC4xMDIsMzY2LjU0OUw1NjUuMTc1LDM1OC43MDVMNTU5LjE2LDM1MC42Mkw1NDMuOTcsMzMzLjg2MVpNNTI3LjQ3NCwzMjUuNjM3TDUwOS45NjUsMzM1LjAyMUw1MTkuNTc1LDM2MS4yNzFMNTA0LjUwNiwzNTEuMzI2TDUxMi40NjUsMzI5LjExWk00NTAuODUzLDM3My42MzVMNDM2LjY5NCwzNjYuODg4TDQyMC4zMiwzNDUuMDQ3TDQwMi42OTgsMzIyLjczOEw0MTIuNzIyLDMyMC42NDJMNDQyLjc2OSwzNDQuNDk3Wk01MDEuMjkzLDMyOC4zNTZMNDk0LjI5OSwzNTkuMDA2TDQ3MC41MDIsMzU2Ljg1Nkw0NjUuOTAxLDM0NC45MDVMNDgyLjMyOSwzMjMuOUw0OTcuMTA3LDMwMi42NzlaTTUxNS41MTQsMTQwLjY3M0w1MTkuODI4LDE0OS44MjJMNTAzLjY4MSwxNjEuMzQ2TDUwNy4yNDcsMTQ4Ljg0OUw1MDkuNzgzLDEzNy4xMDNaTTE0OS4yOTYsNTYuNjU3TDEzNC4wNDcsNjkuMjEyTDExOS42MzMsODIuOTI3TDExMi44MTksODEuNDUzTDEzMC41NzgsNjguMzk5Wk0xODEuNzY0LDMyLjk0TDE2OC4xOCwzNy42NjhMMTc5LjM4OCwzMS4wN1pNMjAyLjg3NCwxNDIuNDI1TDE5Ny45MDYsMTU4Ljg4NkwyMTQuNTczLDE2My4wMUwyMTEuOTYyLDEyOC41MzFMMjAwLjA0NCwxMjcuNDk5Wk00MTcuOTAyLDI4LjQ5NUw0MTkuODI2LDI5LjM0TDQyMC45MjUsMzAuMjI2TDQyMC45NTIsMzAuMjM4TDQzMC4yNTUsMzQuNTE1TDQ0Ny44ODcsNDUuNDU3TDQ0OC41NDIsNDguNTQ0TDQ3MC4xNzgsNjMuMTI3TDQ4NC4zMjcsNzguMDQyTDQ2NS44MjMsNjQuOTYxTDQ1NC42MzEsNTQuNjM0TDQ0Mi44MjgsNDUuMjc1TDQ0MC4wNjUsNDcuNTIyTDQ0Ni40NDksNTMuMDEyTDQ0MC4zNzQsNjAuMjc0TDQ0OC4yMDksNzYuNzkxTDQ2Mi44MzQsNzkuMzA3TDQ3OC4wMzUsOTYuMjMzTDQ4Ni4wMTUsMTE4LjQ2N0w0ODAuNjEsMTM3LjYxMUw0OTIuODk4LDE0OS4zNzNMNDkxLjEyNCwxNjEuNzY1TDQ3MS45OTUsMTM4LjYyOEw0NTYuMDc5LDE0Ny4xMzJMNDcyLjY5MywxNjUuNzYyTDQ4OC4wOCwxODUuMzQ2TDQ4My45MjgsMjAzLjg1MUw0NzguNjQ5LDIyMi45NDVMNDUxLjg2NCwyMzEuOTUxTDQ0Mi42ODEsMjQ2LjYwM0w0NTMuMiwyNjQuNTUzTDQ2Mi45NDYsMjgyLjY4Mkw0NDYuMTIzLDI5My42MDJMNDIyLjEyOCwyNzcuNjg3TDQxOS4yOTQsMjk1Ljc1OUw0NDAuMTkxLDMyMC4zOUw0NDEuMzAxLDMzOC45MTVMNDE1LjEzNCwzMDQuNDI4TDQwNi44MjYsMjYwLjY1NUwzNzcuMTQyLDIzMi42NjNMMzU3LjE0NCwyMzkuOTY2TDMyNi40MjMsMjY5LjM2NkwzMTIuOTg4LDMxMC40NTdMMjkyLjcxMywyNjkuMDk0TDI4OC41OTUsMjQxLjY3N0wyNTkuODk1LDIyMC43NDhMMjM3LjQwMywyMjEuNzE2TDE4My40OTgsMTk0LjAxOEwxOTMuNDcxLDIyNC40OTVMMjE0LjM2NiwyMjEuMzI3TDIyOC4yMjcsMjM1LjIyOUwyMTcuMjI0LDI1MS4xNzdMMTcyLjY0OSwyNzQuMTY1TDE0OS4wMTQsMjc4Ljk4MkwxNDguMzYsMjU3LjQ0MUwxMzkuMzg5LDIyNy4wNzFMMTMyLjU2MiwxOTcuNjc2TDEyNS4zODIsMTkzLjM1NUwxMjguMjcsMjI2LjE5NEwxMzMuNzY3LDI2MC4xNTNMMTUwLjU4MywyOTAuNTMyTDE4Mi43NjMsMjg1LjIzN0wxNzAuNDgyLDMwNy45NTlMMTU5LjIzLDMzMC42MTlMMTMxLjUxMywzNTUuMjg4TDEyNi4yOTMsMzc0LjA4NkwxMzIuMTczLDM5NC44MjNMMTM4Ljk2NCw0MTUuMDQ0TDEyMC4xNjcsNDM1LjU5OUwxMjYuOTg1LDQ1Ni42NDNMMTIyLjA5OCw0NzIuNzAyTDExOC42MjcsNDg3LjM4N0wxMDAuMDA5LDQ5MC40MTRMODUuNTM2LDQ3My41ODRMNzIuMjY5LDQ1NS43NzdMNTguMzEsNDMxLjM0Mkw0Ni41NDgsNDA1LjcxMkw0NS45MTgsMzg0Ljg5TDQwLjk4OCwzNjYuOTY1TDM3LjA4MSwzNDguNzc2TDI5LjIxNiwzMjYuMzlMMzEuNjcxLDMwNS44OUwyNi41OTUsMjk1LjQ3TDIyLjM1LDI4NS4wNjRMNy4zNjEsMjg0LjYyMUw3LjAyNSwyNzIuNjA2TDcuNDgyLDI2MC42NjRMOC43MywyNDguODNMMTAuNzY3LDIzNy4xMzNMMTYuNDYsMjE1LjIxOEwyMy44MzksMTkzLjgwN0wyOC44NDksMTgyLjUwNkwzNC41NDcsMTcxLjUwM0wzOS4yNzUsMTY0Ljk2OEw0NC42MzksMTU4Ljc2Mkw1My4zMTYsMTQ3LjI0Mkw2Mi44MDUsMTM2LjIyNkw3My4wMDUsMTM3LjE5Nkw4NS45LDE0MC4xTDc3LjgyNywxNTguODk0TDg4LjI2OSwxNzcuOTUzTDk4LjEyNywxNjcuODE4TDExNi45NzMsMTgxLjAzNEwxMzQuODIxLDE4Mi4yMTZMMTQ5LjQ0NiwxNjEuODVMMTI1LjMzNCwxNTMuODg3TDEyNy45ODIsMTQwLjg0NEwxNTMuMDMzLDEzNi41NTJMMTc5LjY3NywxMzQuMDMyTDE1OC4wNCwxMTMuNTY1TDEzOC45MTQsMTM1LjM3NEwxMjIuMTI2LDEzNC43NDdMMTEwLjAwNywxNDkuNzYxTDExOC4wMDgsMTI3Ljc1N0wxMTcuODI5LDEwOC4xNjNMMTE0LjQyNiwxMjAuMTc4TDExMS42MzksMTMyLjc4OUwxMDQuNTkxLDEzMi4zNTZMMTA2LjUyMywxMTEuMDUxTDk0LjQ4MywxMTIuNTg0TDgxLjAzNSwxMjMuNDQzTDY4LjU0LDEzNS4wN0w2NC41NDEsMTI5LjQ3MUw3NC4yNjgsMTE2Ljg1M0w4NC42NSwxMDQuNzY1TDkwLjYwOSwxMDguMDg2TDEwOS43MzUsODkuMDVMMTI0LjgzOSw4Mi4wODNMMTQwLjg4OSw3Ni4yOTVMMTUyLjAyNSw3Ni43MDNMMTYzLjc2Miw3OC4wMTlMMTgxLjA4LDY1Ljk3NUwxODkuOTA5LDU1LjA5OUwxNzAuMjk3LDYzLjg0OEwxNTEuMzc1LDczLjg1MkwxNjQuMTIxLDYwLjA5TDE1NS42NTYsNjAuNjcxTDE2OS4yODksNTAuOTQzTDE5Mi4wMTYsNDIuNzNMMjE1LjUxNiwzNi4zNkwyMzAuMzc0LDM1LjQxMUwyMzYuNjgzLDQ1LjcyNUwyMTcuNzM2LDU0LjA3MkwyNDUuODg4LDQ3LjU2OUwyNzQuNTU4LDQzLjQ4M0wyODcuNTE4LDQ4LjYwM0wyODYuMTAyLDQwLjg2NUwzMDcuMjkyLDM3LjgyNEwzMTYuMDIzLDMxLjE4M0wzMjguMDgzLDI4LjE0N0wzNDAuMDY4LDI1Ljg1MkwzNDUuNTg4LDMxLjA5OUwzNjUuNTUyLDI5LjkyMkwzODUuMDg4LDMwLjUxMkwzNzkuNDA0LDI3Ljc1MUwzODguMDcsMjYuNjczTDM5Ni40ODksMjYuMzYyTDQwMy43MDIsMjguMzQ2TDQwMC4zMDcsMjQuMjQ0TDQwMS4yMjMsMjIuODgzTDQwMi42MzEsMjMuMTQ5TDQwMi42MzEsMjMuMTQ5TDQwOC4yNjMsMjQuNTA5TDQwOC4yNjMsMjQuNTA5TDQxNy44MTIsMjguNDU2Wk0zOTAuNjQ1LDE5LjMxN0wzOTMuODc1LDIwLjI4OUwzOTMuMTUsMjAuMjY1Wk0yNzAuNjY3LDQxLjAzM0wyNjIuNjUsMzguNTkxTDI3NC43MjksMzAuODA4TDI5Mi4wMzEsMjcuNTcxTDI2OS45NTksMzYuODUzWk0yNTUuNzQ2LDE4LjIzMkwyNDIuNzkyLDIyLjQyNUwyNTEuOTksMTcuMjA1Wk0zMjQuMDcsMjIuOTU4TDMxMy44MzksMjAuOTExTDMxNi4wOTIsMTkuMTkyWk0yOTEuODgyLDQuMTExTDI5Mi43MDUsNC4wOTNMMjkwLjE5NCw0LjI1OUwyODMuNTk3LDQuNDU2TDI4My41OTcsNC40NTZMMjgzLjk3Nyw0LjQzNEwyODMuOTc3LDQuNDM0Wk0yODEuNDk4LDQuNTc5TDI5MC4zMTksNC4zNkwyODQuNjUxLDUuMDVMMjc4Ljg2OSw1LjY0NUwyNzguODY5LDUuNjQ1TDI3My4xMTYsNi4wOTVMMjcxLjU3Nyw1LjM2OEwyNzEuNTc4LDUuMzY4Wk0yNjcuNjE2LDUuNzc3TDI2OC42ODUsNS42NjJMMjcwLjIxLDYuNTA4TDI2OS4yMyw4LjMzNEwyNjcuMzM2LDkuMTQzTDI2Ny4zMzYsOS4xNDNMMjYyLjcxNywxMC4xOEwyNjEuNTYyLDkuMTY2TDI1NC45MzMsMTAuODQzTDI1NS4yMzMsMTIuMjM3TDI0Mi40NTgsMTMuMjc0TDIyMC4xMTMsMTguMzE4TDIxMi42MzEsMTkuMzYxTDIwMC4yMiwyMy42MTdMMTk0LjY1NSwyMy45NThMMTg5LjUxLDI1LjM5NUwxODkuNTEsMjUuMzk1TDE5OS4xNjEsMjEuNzA2TDIwOC45MzQsMTguMzU2TDIxOC44MTksMTUuMzVMMjI4LjgwMywxMi42OUwyMzguODczLDEwLjM4TDI0OS4wMTgsOC40MjRMMjU5LjIyNSw2LjgyMloiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjE2LjAyLDU4My44MzdMMjE2LjY0LDU4My45MDJMMjI4Ljg0OSw1ODYuNjI4TDI0MS4yOTksNTg4LjM5TDI0My45MjMsNTg3LjM0OEwyNTUuNDI3LDU4OC45NTVMMjY4LjYwMSw1ODguNDc4TDI4MS44OSw1ODYuOTM5TDI5NC45NDcsNTg5LjUyNkwzMDcuNTQxLDU4OS40MTZMMzA0Ljc0Myw1OTIuOTkyTDMyNS43NjUsNTkwLjMxMkwzNDYuNjI3LDU4NS44MjNMMzY1LjIsNTg1LjE2TDM3OC4wNzEsNTgyLjg5NkwzOTAuNzUsNTc5LjkzN0wzOTQuOTkyLDU3OS44ODVMNDA3LjI5NSw1NzUuODY5TDQwNy4yOTUsNTc1Ljg2OUwzOTcuNjAyLDU3OS40NDZMMzg3Ljc5LDU4Mi42ODJMMzc3Ljg3MSw1ODUuNTczTDM2Ny44NTcsNTg4LjExN0wzNTcuNzYsNTkwLjMxTDM0Ny41OTQsNTkyLjE0OUwzMzcuMzY5LDU5My42MzJMMzI3LjA5OCw1OTQuNzU3TDMxNi43OTUsNTk1LjUyM0wzMDYuNDcxLDU5NS45MjlMMjk2LjEzOSw1OTUuOTc1TDI4NS44MTIsNTk1LjY2TDI3NS41MDMsNTk0Ljk4NUwyNjUuMjIzLDU5My45NUwyNTQuOTg1LDU5Mi41NTdMMjQ0LjgwMyw1OTAuODA4TDIzNC42ODcsNTg4LjcwNEwyMjQuNjUxLDU4Ni4yNDlaTTIyNS43OTksNDE2LjYwMUwyMTcuNDk1LDQ2Ny4yNzJMMjA0LjAzMiw0NjYuNjQ3TDIwMC4yMiw0MjcuNjE4Wk01MjguMjk2LDQ4OC40MDdMNTI3LjI4Miw0ODkuNjJMNTI1LjkwMSw0ODkuNTlMNTI5LjQwOCw0ODAuNDMzTDUzMS4xNTQsNDY5Ljg5MUw1MjIuNTk2LDQ3Ni4zMTFMNTEzLjQ2MSw0ODIuMjc1TDQ5My41NTcsNDkyLjc3MUw0OTguNTUxLDQ3Mi45NTlMNTAxLjU3OSw0NTEuNDM0TDUwNy45NDgsNDM5LjI3MUw1MTkuNjY5LDQzMi41MzFMNTMwLjY2LDQyNS4zNTFMNTQwLjgzMiw0MDguNDVMNTU1LjcyMSwzOTcuMDc1TDU2OC4wNDksMzc1LjY3N0w1NzQuOTIsMzc3LjkxM0w1NjkuNzQ4LDM5MC43MDVMNTczLjk2MiwzOTguOTlMNTc5LjQ4OSwzODIuMDgzTDU4NC4wMDcsMzY0Ljg3OUw1ODEuNzksMzc5LjI1NEw1ODEuNzksMzc5LjI1NEw1NzkuNjU0LDM5MC43MzZMNTc2Ljc4Nyw0MDEuOTgyTDU3NC4zNzEsNDEwLjM4NUw1NzEuMjQ0LDQxOC41MDNMNTcxLjI0NCw0MTguNTAzTDU2Ni45NDMsNDI3Ljg5N0w1NjIuMzE2LDQzNy4xMzVMNTU3LjM3MSw0NDYuMjA2TDU1Mi4xMTEsNDU1LjA5OUw1NDYuNTQ1LDQ2My44MDRMNTQwLjY3OCw0NzIuMzA4TDUzNC41MTgsNDgwLjYwM1pNNTc2LjU0NywzMjQuMTU4TDU5MC40NiwzMjguOTA2TDU5MC45ODUsMzQwLjM1Nkw1OTAuNTI0LDM1MS42N0w1ODguMzEzLDM1NC45NjdMNTg1LjMwNCwzNTguMTExTDU4My4wNDMsMzUwLjM3Nkw1NzkuNjIyLDM0Mi40MzVMNTc1LjA1NCwzMzQuMzE5TDU2OS4zNTgsMzI2LjA2M1pNNTU2Ljg4MiwzMTguMjc5TDU0My4wMDQsMzI4LjEzOUw1NTAuMzc1LDM1NC4xMzFMNTM4LjQ3NCwzNDQuNTk2TDU0NS4wMDUsMzIyLjE2Wk00OTIuNDczLDM2OC40MTlMNDgwLjA1MSwzNjIuMDc1TDQ2NS40NTMsMzQwLjcwNUw0NDkuMTM5LDMxOC45MTJMNDU4LjMwMywzMTYuNTI1TDQ4NS42MjYsMzM5LjUwOFpNNTM1Ljg4NCwzMjEuNzE1TDUyOS45NTYsMzUyLjU2MUw1MDkuODQ1LDM1MS4wNzhMNTA1Ljk0NywzMzkuMjU2TDUxOS45NDYsMzE3Ljc4OUw1MzEuOTU1LDI5Ni4xNlpNNTI4LjkyLDEzMy45MjFMNTM0LjA4NCwxNDIuOTI2TDUyNC40NTYsMTU0Ljg0Mkw1MjQuOCwxNDIuMjg2TDUyNC4wMjgsMTMwLjUxM1pNMTU3LjE0Niw2MS4xMTdMMTQzLjcyNCw3NC4xMDdMMTMxLjA4OCw4OC4yMzNMMTIwLjk0MSw4Ny4wMTdMMTM4LjU4Nyw3My40MjZaTTE4My43MzYsMzYuNTAzTDE2OC43Miw0MS42NjVMMTc3Ljc4MSwzNC43NTlaTTIzOS4wOTksMTQ0LjgyNkwyMzYuMTMsMTYxLjQwN0wyNTQuMTY3LDE2NS4wMDRMMjQ2LjU0NSwxMzAuNjhMMjMzLjc3NiwxMzAuMDIzWk00MzUuMTczLDM2LjY2N0w0NDMuMjQ0LDQxLjAzNEw0NDYuOTQyLDQ0LjA1NUw0NjkuMDc5LDU3Ljk3M0w0ODYuMTQ0LDcyLjQxNEw0NjguMTU3LDU5Ljg4N0w0NTUuMDAxLDQ5LjkzTDQ0MS4yMzQsNDAuOTU5TDQ0MS40NzYsNDMuMjQ1TDQ0OS4wNjcsNDguNTIzTDQ0OC40ODgsNTUuODg2TDQ2MC43NDIsNzIuMDk3TDQ3Mi43NDUsNzQuMjA5TDQ4OS43MDYsOTAuNjQ2TDQ5Ni4xMDgsMTAxLjMxOEw1MDEuOTM2LDExMi41NzNMNTAxLjkwMywxMzEuNzk5TDUxMy44OTcsMTQzLjE5M0w1MTQuNjMzLDE1NS42MDFMNDk1LjEwNCwxMzMuMDUxTDQ4My4yNTIsMTQxLjk3N0w1MDAuMTI3LDE2MC4wOThMNTE1LjU3OSwxNzkuMjEzTDUxNC4zMjYsMTk3LjgwMUw1MTEuNzYsMjE3LjAxNEw0ODkuMzY2LDIyNi43NjdMNDgyLjMwMywyNDEuNjY2TDQ5Mi42ODksMjU5LjI5OEw1MDIuMTAzLDI3Ny4xMzZMNDg3LjcxNywyODguNTNMNDY1LjU1MSwyNzMuMzE3TDQ2My42NzQsMjkxLjQ2TDQ4My4xMjEsMzE1LjQ3OEw0ODQuMzA2LDMzMy45NjhMNDcyLjc0NywzMTcuMTU5TDQ2MC4xNDUsMzAwLjI0Nkw0NTUuODg2LDI3OC40MzNMNDUwLjc0MiwyNTYuNzQyTDQyMS40MzQsMjI5LjY0Nkw0MDMuMDYsMjM3LjUzMkwzNzUuMjQyLDI2Ny44MjJMMzYzLjY0NSwzMDkuMjkzTDM0Mi4yMTksMjY4LjU2M0wzMzYuNTk4LDI0MS4yOTVMMzA2LjQwMSwyMjEuMjZMMjgzLjYyMiwyMjIuOTE2TDI1My45ODMsMjA5LjM0NUwyMjQuOTMxLDE5Ni45MjlMMjM4LjI0MSwyMjcuMDUxTDI1OS44NDMsMjIzLjIzOEwyNzUuMjA4LDIzNi42OTZMMjY0Ljg4NiwyNTIuOTY4TDIxOS4yODUsMjc3LjMyNkwxOTQuMDY0LDI4Mi44ODVMMTkyLjIzOSwyNjEuMzgyTDE4MC4yNzksMjMxLjMzTDE2OS45MTgsMjAyLjE5NkwxNjEuMzk3LDE5OC4xMTRMMTY3LjkwMywyMzAuODA5TDE3Ni40MTYsMjY0LjU1NkwxOTYuMjM0LDI5NC4zNzlMMjMwLjUwOSwyODguMDczTDIwNi41MTEsMzM0LjE3N0wxNzYuMjcsMzU5LjcyN0wxNzAuMTQ1LDM3OC42OThMMTc1Ljk5NiwzOTkuMjU2TDE4Mi41Miw0MTkuMjc2TDE1OS44MzMsNDQwLjQ2MUwxNjUuNDcsNDYxLjMxNkwxNTAuOTc4LDQ5Mi40MDdMMTM4LjY1OSw0OTQuNjUzTDEyNy4wMTgsNDk2LjA4TDExMi4zNTksNDc5LjY5Mkw5OC43NTYsNDYyLjI5NEw4NC42MzcsNDM4LjI4NUw3Mi40NzcsNDEzLjAyTDczLjg2OCwzOTIuMTg1TDY4LjYwMywzNzQuNDE2TDY0LjI1MiwzNTYuMzUyTDU0LjA2NSwzMzQuMjRMNTcuMjcyLDMxMy42NTVMNDMuNDc2LDI5My4xOEwxOC40OCwyOTMuMzQ0TDE2LjE0MSwyODEuMzY5TDE0LjU3LDI2OS40NDVMMTMuNzcxLDI1Ny42MDNMMTMuNzQ3LDI0NS44NzZMMTkuMTkyLDIyMy43OTJMMjYuMzA4LDIwMi4xNjFMMzIuMzI5LDE5MC42OTJMMzkuMDI5LDE3OS41MDFMNTIuNzM4LDE2Ni4zOThMNjIuNDcsMTU0LjU5OUw3Mi45ODMsMTQzLjI3OEw4OC4yODYsMTQzLjg2MUwxMDYuMTAzLDE0Ni4yOThMMTAwLjEwOSwxNjUuMzA2TDExNi4zNjUsMTgzLjk2TDEyNi41MjYsMTczLjUyTDE1MC4zNTMsMTg2LjA4OEwxNzAuNjM4LDE4Ni42OUwxODQuMTkxLDE2NS44OTdMMTU1LjkyLDE1OC43MjlMMTU2LjcxOCwxNDUuNjM0TDE4NC4yMzksMTQwLjU0NEwyMTMuMDE2LDEzNy4xODJMMTg1LjUwMiwxMTcuNDYxTDE2OC4xOTEsMTM5LjgyNEwxNDguOCwxMzkuNzQ2TDEzNy40NTgsMTU1LjExN0wxNDIuNTI0LDEzMi45MTVMMTM3LjUxNywxMTMuMzk5TDEzNi4wNDksMTM4LjE0MUwxMjcuNDc5LDEzNy45NDZMMTI0LjM0NCwxMTYuNjU5TDEwOS4yNzEsMTE4LjYwNEw5NC44MDIsMTI5Ljg4N0w4MS4yMjcsMTQxLjkxTDcyLjQ4OSwxMzYuNTA0TDgxLjcyNCwxMjMuNTk4TDkxLjU5MiwxMTEuMjAzTDEwMi4yNDksMTE0LjI3MUwxMjAuNDg1LDk0LjY2OEwxMzcuNTUsODcuMjEyTDE1NS40OTMsODAuOTA3TDE2OS4wNzUsODAuOTQxTDE4My4xODksODEuODY0TDE5OS4yMTksNjkuMzEzTDIwNS41MDEsNTguMjA3TDE4Ni4xMDksNjcuNTQ5TDE2Ny4zMjMsNzguMTI2TDE3Ny4zNjcsNjQuMDE4TDE2Ny4zMDIsNjQuODhMMTc5LjUzMyw1NC43NTlMMjAyLjgsNDUuODQ3TDIyNi43NjMsMzguNzU2TDI0Mi43NzIsMzcuMzM4TDI1My41Miw0Ny4zOTNMMjM1Ljk3Niw1Ni4yOTRMMjYzLjg2LDQ4Ljk0TDI5Mi4wOSw0My45ODlMMzA2Ljc2Miw0OC42OUwzMDIuODQ4LDQxLjAzM0wzMjIuNzM5LDM3LjM2N0wzMjguNjg1LDMwLjUwNEwzNDkuMDA4LDI0LjQ5OUwzNTYuNDU3LDI5LjU0OUwzNzMuODMzLDI3LjgwNUwzOTAuNzI2LDI3Ljg0MUwzODQuNDksMjUuMjYxTDM5MC43NjUsMjMuOTU2TDM5Ni43ODUsMjMuNDI2TDQwMy40MDQsMjUuMTk5TDM5Ny4xMiwyMS4yNDVMMzk1LjQzMywxOS44OTVMMzk2LjI5NiwyMC4xMjdMMzk2LjI5NiwyMC4xMjdMMzk2LjY4NCwyMC4yMzZMMzk2LjY4NSwyMC4yMzZMNDA2LjM4OSwyMy43OEw0MTUuOTY1LDI3LjY2Mkw0MjUuMzk4LDMxLjg3NUw0MzQuNjc5LDM2LjQxNFpNMzg1LjA1LDE2LjY0OEwzODguMDgxLDE3LjUyNUwzODcuNzg0LDE3LjUxN1pNMjg3LjMwMSw0MS42NzFMMjc4LjIwNiwzOS40OUwyODcuNTk3LDMxLjM4TDMwMy42ODUsMjcuNjM2TDI4NS4wODIsMzcuNTM2Wk0yNjEuNDU2LDE5LjQ4OUwyNDkuODk3LDI0LjA1NUwyNTYuNjg2LDE4LjU5MlpNMzMyLjY5MywyMi4wOTVMMzIxLjkxMSwyMC4zNjhMMzIzLjE1LDE4LjU5NlpNMjgxLjE4NSw0LjU5OUwyODQuMTIyLDQuNDQ1TDI4Mi43MTcsNC42NzFMMjc1LjA3MSw1LjA4NEwyNzUuMDcxLDUuMDg0TDI3Ni4yOTEsNC45NTFMMjc2LjI5MSw0Ljk1MVpNMjcyLjA4NCw1LjMxOUwyNzIuNzE4LDUuMjg0TDI4My40MTcsNC43NTlMMjc5LjM0NCw1LjU5N0wyNzQuMjMxLDYuMzU4TDI3NC4yMzEsNi4zNThMMjY4LjUzNiw2Ljk4MkwyNjEuNzgxLDYuNDc4TDI2MS43ODEsNi40NzhMMjcyLjA0OCw1LjMyM1pNMjEyLjYzMiwxNy4xODhMMjIzLjA2NiwxNC4yMzJMMjM4LjMzMiwxMC42NDlMMjQ4LjI4MSw4LjU1OEwyNjAuNDA0LDYuNzM5TDI2NS45NzEsNy40NzhMMjY3Ljc0Myw5LjI5MkwyNjYuNjE2LDEwLjE0N0wyNjYuNjE2LDEwLjE0N0wyNjIuNjIxLDExLjMxNEwyNjAuMTE4LDEwLjM1NkwyNTQuNDk0LDEyLjIxOUwyNTYuMjkyLDEzLjU4MUwyNDIuNTEsMTUuMDIxTDIyMC4yNjYsMjAuNzQzTDIxMS40OCwyMi4wMzNMMTk5LjUwMSwyNi42NkwxOTAuMDUxLDI3LjM0NkwxODEuMTQxLDI5LjM3M0wxNjEuNDg1LDM4LjQwOUwxNjEuNDg1LDM4LjQwOUwxNzAuNjk5LDMzLjczNUwxODAuMDcsMjkuMzg0TDE4OS41ODgsMjUuMzY0TDE5OS4yNCwyMS42NzhMMjA5LjAxNSwxOC4zMzFaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjIwLjcwNCw1ODUuMTgxTDIyMy40MDEsNTg1Ljg5NEwyMjcuODYzLDU4Ni4yNjRMMjQxLjk4Myw1ODguNTkxTDI1Ni4yOTksNTg5Ljk0NUwyNjAuODk5LDU4OC43OTRMMjcyLjcxOCw1OTAuMDQ3TDI4Ny43NjMsNTg5LjE0MUwzMDIuODUzLDU4Ny4xNzFMMzE0LjI0OCw1ODkuMzg2TDMyNi42OTIsNTg4Ljg5NkwzMjAuNjU4LDU5Mi42MDZMMzQyLjk2Niw1ODkuMjY4TDM2NS4wMDYsNTg0LjEyN0wzODAuNTQ5LDU4Mi45NDZMMzkyLjAxOCw1ODAuMzEyTDQwMy4yNjIsNTc2Ljk5TDQwNC42MzQsNTc2Ljg4OUw0MDQuNjM0LDU3Ni44ODlMMzk0LjkwNyw1ODAuMzcyTDM4NS4wNjQsNTgzLjUxNEwzNzUuMTE4LDU4Ni4zMUwzNjUuMDgsNTg4Ljc1N0wzNTQuOTYzLDU5MC44NTJMMzQ0Ljc3OSw1OTIuNTkzTDMzNC41NCw1OTMuOTc4TDMyNC4yNiw1OTUuMDA0TDMxMy45NDksNTk1LjY3MUwzMDMuNjIyLDU5NS45NzhMMjkzLjI5LDU5NS45MjRMMjgyLjk2Nyw1OTUuNTFMMjcyLjY2NCw1OTQuNzM1TDI2Mi4zOTUsNTkzLjYwMkwyNTIuMTcxLDU5Mi4xMUwyNDIuMDA2LDU5MC4yNjNMMjMxLjkxMSw1ODguMDYyTDIyMS44OTksNTg1LjUxMVpNMjc1LjIwNCw0MTguMTA1TDI2My4wOTksNDY5LjA4NkwyNDguOTk2LDQ2OC44OEwyNDcuOTUsNDI5LjkyNFpNNTM3LjIwNyw0NzcuMDU1TDU0MS42NjgsNDcwLjE2OEw1NDUuMjQsNDYyLjY1M0w1MzguODE5LDQ2OS4zMDFMNTMxLjc4MSw0NzUuNTExTDUyNC4xNDEsNDgxLjI2NUw1MTUuOTIxLDQ4Ni41NUw1MjMuODcsNDY2LjU0MUw1MjkuNjAzLDQ0NC44ODNMNTM2LjAxNSw0MzIuNTI2TDU0NS41NzYsNDI1LjQ2M0w1NTQuMzIsNDE3Ljk4M0w1NjMuMjk0LDQwMC43OTFMNTc0LjExLDM4OS4wMjVMNTgzLjM5MywzNjcuMjk5TDU4Ni4zLDM2OS4zODdMNTgyLjMwNCwzODIuMzE4TDU4Mi40MDgsMzg2LjU0Nkw1ODEuNzcyLDM5MC41NDdMNTg2LjcwOSwzNzMuNDgxTDU5MC42MTEsMzU2LjE0OUw1ODkuNTYyLDM2MS40MDFMNTg5LjU2MSwzNjEuNDAxTDU4Ny4yNDIsMzcxLjQ3TDU4NC41NzMsMzgxLjQ1MUw1ODEuNTU3LDM5MS4zMzNMNTc4LjE5OCw0MDEuMTAzTDU3NC41LDQxMC43NUw1NzAuNDY4LDQyMC4yNjNMNTY2LjEwNiw0MjkuNjI5TDU2MS40Miw0MzguODM3TDU1Ni40MTUsNDQ3Ljg3Nkw1NTEuMDk4LDQ1Ni43MzRMNTQ1LjQ3NSw0NjUuNDAyTDUzOS41NTMsNDczLjg2OFpNNTkxLjk4MiwzNDguNjA2TDU5MS44MzYsMzQ5LjM0M0w1OTIuMzEyLDM0MS42MzVMNTkxLjU4OCwzMzMuNzU3TDU4OS42NjksMzI1Ljc0TDU4Ni41NjEsMzE3LjYxN0w1OTAuNjQzLDMxNS41NDFMNTkwLjY0MywzMTUuNTQxTDU5NC4yMjQsMzE3Ljc5OEw1OTUuMzMsMzE5LjkwNkw1OTUuMzMsMzE5LjkwNkw1OTQuNDU1LDMzMC4yMDFMNTkzLjIyMiwzNDAuNDU5Wk01NzguNDg1LDMxMC4xNDVMNTY4LjY2LDMyMC4zNjZMNTcxLjUyNywzMzMuMzE5TDU3My41NjcsMzQ2LjE3MUw1NjUuMTk2LDMzNi45NDRMNTcwLjEwMiwzMTQuMzM0Wk01MjguMjQ1LDM2Mi4wMjhMNTE3LjkzNywzNTYuMDI5TDUwNS41NTgsMzM1LjA2OUw0OTEuMDQ4LDMxMy43NDRMNDk5LjA3NSwzMTEuMDk1TDUyMi44NDIsMzMzLjMwM1pNNTYzLjMwOCwzMTQuMTMxTDU2MS4zMzYsMzI5LjY3Nkw1NTguNjI2LDM0NS4xMzhMNTQyLjgxMiwzNDQuMjAxTDUzOS43MzUsMzMyLjQ4NUw1NTAuODc5LDMxMC42MzZMNTU5Ljc1NCwyODguNjlaTTUzNS4zNzIsMTI2Ljg2OEw1NDEuMjI4LDEzNS43MDVMNTQwLjM2NywxNDEuMzk2TDUzOC40MTEsMTQ3LjgxTDUzNS41MjMsMTM1LjI5Mkw1MzEuNDY2LDEyMy41OTNaTTE2OS4zMzcsNjUuMjcyTDE1OC4xNDksNzguNjM2TDE0Ny42NzUsOTMuMTE0TDEzNC41MDQsOTIuMjUyTDE1MS41LDc4LjEzNFpNMTg5LjI0LDM5Ljk1MkwxNzMuMjQ4LDQ1LjU4NUwxNzkuODg3LDM4LjQ0MVpNMjc3LjE3NCwxNDYuMDk4TDI3Ni4yOTQsMTYyLjczOEwyOTUuMTU0LDE2NS43NzRMMjgyLjc1MiwxMzEuNzU0TDI2OS41MiwxMzEuNDkyWk00NzcuNTM3LDYzLjE1M0w0ODIuMzA2LDY2LjgxN0w0NjUuMzgyLDU0LjgyTDQ1MC42OTEsNDUuMzAzTDQzNS40MDcsMzYuNzg3TDQzNS40MDgsMzYuNzg4TDQ0NC41MTEsNDEuNjc0TDQ1My40MzksNDYuODc0TDQ2Mi4xNzksNTIuMzgzTDQ3MC43MjIsNTguMTk0Wk00MzUuMzUzLDM2Ljc2TDQzOC41ODgsMzguOTlMNDQ3LjE1Nyw0NC4wMjJMNDQ5LjgzOSw0Ny4zMDdMNDUyLjA5LDUxLjMxOUw0NjAuNDQ0LDU4LjkwMUw0NjguMzksNjcuMDk3TDQ3Ny40MDcsNjguODg5TDQ5NS42MTMsODQuNzkyTDUwMy45NjYsOTUuMjRMNTExLjcyMSwxMDYuMjg5TDUxNC43NDUsMTE1LjU1N0w1MTcuMDYxLDEyNS40MzRMNTI4LjM5NiwxMzYuNDczTDUzMS42MjEsMTQ4LjgyMUw1MjIuMjM4LDEzNy42MzNMNTEyLjI4NCwxMjYuODYyTDUwNC44NTcsMTM2LjA4MUw1MjEuNDgsMTUzLjY5M0w1MzYuNTI3LDE3Mi4zNDVMNTM4LjIxMiwxOTAuOTI1TDUzOC40MzYsMjEwLjE3NUw1MjEuMTE1LDIyMC41MzFMNTE2LjM4NiwyMzUuNjA5TDUyNi4zMjMsMjUyLjkzMkw1MzUuMTE5LDI3MC40OTRMNTIzLjYwOCwyODIuMjgxTDUwMy45NDQsMjY3LjcwM0w1MDMuMDgxLDI4NS44ODhMNTIwLjQ4NywzMDkuMzQ2TDUyMS43MTEsMzI3LjhMNTExLjY0LDMxMS4zMTlMNTAwLjI5LDI5NC43N0w0OTUuNzM5LDI3My4wOTFMNDkwLjA3OCwyNTEuNTY0TDQ3Ni40ODEsMjM4LjMwM0w0NjIuMDM1LDIyNS4zNEw0NDUuODQ0LDIzMy43NTFMNDIxLjc3NSwyNjQuODI5TDQxMi4zNjcsMzA2LjYxOUwzOTAuNDQxLDI2Ni41NDhMMzgzLjQ4OSwyMzkuNDdMMzUyLjcxMywyMjAuMzYyTDMzMC4zMzgsMjIyLjcwNEwyOTkuNDg4LDIxMC4wNTJMMjY4LjY0NSwxOTguNTQ1TDI4NC44ODcsMjI4LjIxOUwzMDYuNTQxLDIyMy43NDlMMzIyLjk0MSwyMzYuNzI0TDMxMy42MTUsMjUzLjI5NUwyNjguMzc0LDI3OS4wMzNMMjQyLjMzMywyODUuMzcxTDIzOS4zOTIsMjYzLjkzOUwyMTEuMjI2LDIwNS41MjFMMjAxLjYyNCwyMDEuNzE0TDIxMS41NSwyMzQuMTZMMjIyLjgxOSwyNjcuNjA2TDI0NS4wMzgsMjk2Ljc5TDI4MC4zNjcsMjg5LjQyN0wyNTYuNjMzLDMzNi4yNTdMMjI0Ljc4NywzNjIuNzVMMjE3Ljk0MiwzODEuOTE3TDIyOS42NDYsNDIyLjEyOUwyMDMuNzU4LDQ0NC4wNTJMMjA4LjA0Myw0NjQuNzU3TDE4Ny44NTcsNDk2LjM3NEwxNzMuMzAzLDQ5OS4wMjlMMTU5LjI4Myw1MDAuODQ2TDE0NC44ODQsNDg0LjlMMTMxLjM1Nyw0NjcuOTEzTDExNy41MDgsNDQ0LjMyOUwxMDUuMzE5LDQxOS40MzRMMTA4LjY5LDM5OC41MjdMMTAzLjI0OSwzODAuOTJMOTguNTg2LDM2Mi45OTRMODYuMzg3LDM0MS4yMjJMOTAuMjQ3LDMyMC41MjlMNzIuMzk3LDMwMC41MzVMMzguMTUzLDMwMS41OTlMMzAuMzMsMjc3Ljg3OEwyNy41MDksMjY2LjA5MUwyNS40MjUsMjU0LjM5NkwzMC40NTcsMjMyLjE1M0wzNy4wOTMsMjEwLjMxM0w1MS40NDEsMTg3LjI0Mkw2OC4zNTEsMTczLjY3NEw3OC44NDEsMTYxLjU2N0w5MC4wNTgsMTQ5LjkxNkwxMTAsMTQ5Ljk2NEwxMzIuMTk4LDE1MS43OTNMMTI4LjQ2NCwxNzAuOTQ5TDE1MC4wNDEsMTg5LjAyOEwxNjAuMTk1LDE3OC4yOEwxODguMjgsMTkwLjA1OUwyMTAuMzg3LDE5MC4wMTdMMjIyLjQ1NCwxNjguODM1TDE5MC44ODMsMTYyLjU3NkwxODkuODA3LDE0OS40ODVMMjE4Ljk2MywxNDMuNTMzTDI0OC45OTcsMTM5LjI3OEwyMTYuNDQyLDEyMC40N0wyMDEuNDczLDE0My4zMjRMMTgwLjA2OSwxNDMuODY2TDE2OS44NDgsMTU5LjU2M0wxNzEuODI2LDEzNy4yNTRMMTYyLjE0MiwxMTcuOTYyTDE2NS40NCwxNDIuNjc2TDE1NS42MDgsMTQyLjc2MUwxNDcuNTAxLDEyMS42NDVMMTI5Ljg1NCwxMjQuMDg2TDExNC44MDQsMTM1LjgxOEwxMDAuNTYxLDE0OC4yNjRMODcuMzUxLDE0My4xOTFMOTUuODEzLDEzMC4wMTZMMTA0Ljg2NiwxMTcuMzMzTDExOS44OTksMTIwLjAxMkwxMzYuNjksOTkuODc2TDE1NS4xOTcsOTEuODhMMTc0LjQ4Nyw4NS4wMDlMMTkwLjEwMyw4NC41OTlMMjA2LjE2NSw4NS4wNjRMMjIwLjQyLDcyLjA1M0wyMjMuOTY0LDYwLjc5OEwyMDUuMzgyLDcwLjcxN0wxODcuMzAyLDgxLjg1M0wxOTQuMzM5LDY3LjQ4NkwxODIuOTgxLDY4LjY3NEwxOTMuNDM2LDU4LjIwOEwyMTYuNTM3LDQ4LjU5MUwyNDAuMjM2LDQwLjc3N0wyNTYuOTA4LDM4Ljg2MkwyNzEuNzY5LDQ4LjUyOEwyNTYuMTYxLDU3LjkzM0wyODIuOTMsNDkuNzQ4TDMwOS44NjMsNDMuOTZMMzI1LjgwMiw0OC4xOTVMMzE5LjUwNyw0MC42OTRMMzM3LjQ5NiwzNi40NTJMMzQwLjQ3NiwyOS40NTNMMzU2LjQ2LDIyLjg5N0wzNjUuNjExLDI3LjY5NUwzNzkuODcsMjUuNDdMMzkzLjYwNywyNS4wNEwzODcuMDEsMjIuNjU2TDM5NC4xNCwyMC41MjZMMzk5Ljk2NCwyMi4xMUwzOTAuOTgzLDE4LjM4N0wzODkuMzI4LDE3LjgwMUwzODkuMzI4LDE3LjgwMUwzOTkuMTIyLDIxLjA5TDQwOC43OTYsMjQuNzE5TDQxOC4zMzcsMjguNjg0TDQyNy43MzMsMzIuOTc5Wk0zMDQuMzIxLDQxLjc5OEwyOTQuNDI0LDM5LjkwNkwzMDAuODQyLDMxLjU1NkwzMTUuMjI3LDI3LjM0OEwzMDAuNjU4LDM3Ljc1M1pNMjY4LjMzOCwyMC41NTZMMjU4LjUyNSwyNS40NDZMMjYyLjY5OCwxOS44MTdaTTM0MC4zMjIsMjAuOTg2TDMyOS4zMTcsMTkuNTlMMzI5LjUwNSwxNy43OTZaTTI2Ny4zMDEsNS45NTlMMjY4LjIsNS43MTRMMjc2LjAyMiw1LjA1TDI3NS43NjYsNS4zMDFaTTI2MS42OTQsNi40ODlMMjY0Ljg5NSw2LjIzMkwyNzcuMDE5LDUuMzZMMjc0LjY2NSw2LjI5NUwyNzAuMzc2LDcuMTk5TDI3MC4zNzYsNy4xOTlMMjY0LjkxMyw3Ljk5M0wyNTcuNjIsNy41MzRMMjUwLjQ4NSw4LjE3MUwyNTAuNzg4LDguMTJMMjUwLjc4OCw4LjEyTDI2MS4wMDUsNi41OFpNMjY2LjkxMSwxMS4xNTdMMjYzLjY2LDEyLjQzNEwyNTkuODg1LDExLjU3MUwyNTUuNDM4LDEzLjU4N0wyNTguNjc5LDE0Ljg3M0wyNDQuMzA4LDE2Ljc0MUwyMjIuODQxLDIzLjEyNkwyMTMuMDE5LDI0LjdMMjAxLjgzNywyOS42NzhMMTg5LjM5MSwzMC42OTdMMTc3LjQ4OSwzMy4wNEwxNjUuNTkyLDM3Ljk5MUwxNTQuMDE1LDQzLjU2OEwxNTkuNzAxLDM5LjY1M0wxNzUuMzY4LDMxLjc2NEwxOTEuNDczLDI0LjgxOUwyMTYuNjA5LDE2LjY2N0wyMzIuMTU4LDEyLjYxN0wyNDAuNTQzLDEwLjI0N0wyNTMuMzI3LDguMDVMMjYyLjc2Niw4LjU2MUwyNjcuMjM3LDEwLjI3OVoiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjIzLjg3Nyw1ODYuMDQ0TDIyMS44NCw1ODUuNDU3TDIzMy43OTksNTg4LjA2NEwyNDEuMjc5LDU4OC4yNTJMMjU2Ljg4LDU5MC4xMjdMMjcyLjYyNiw1OTEuMDI1TDI3OS4wNjMsNTg5LjcwNkwyOTAuODM3LDU5MC42TDMwNy4yOTcsNTg5LjIxNkwzMjMuNzMxLDU4Ni43NjdMMzMzLjExNSw1ODguNjY3TDM0NS4wMzIsNTg3LjgwNkwzMzUuOTQ1LDU5MS43NDZMMzU4Ljg2MSw1ODcuNzIxTDM4MS40MSw1ODEuOTAyTDM5My40NSw1ODAuMzAyTDQwOS41ODIsNTc0Ljk2OUw0MDkuNTgyLDU3NC45NjlMMzk5LjkxOSw1NzguNjI2TDM5MC4xMzQsNTgxLjk0M0wzODAuMjM5LDU4NC45MTdMMzcwLjI0Nyw1ODcuNTQ0TDM2MC4xNjksNTg5LjgyTDM1MC4wMTgsNTkxLjc0M0wzMzkuODA2LDU5My4zMTFMMzI5LjU0NSw1OTQuNTIyTDMxOS4yNDgsNTk1LjM3M0wzMDguOTI4LDU5NS44NjVMMjk4LjU5Nyw1OTUuOTk3TDI4OC4yNjgsNTk1Ljc2N0wyNzcuOTUzLDU5NS4xNzhMMjY3LjY2NSw1OTQuMjI5TDI1Ny40MTYsNTkyLjkyMUwyNDcuMjE5LDU5MS4yNTZMMjM3LjA4Nyw1ODkuMjM3TDIyNy4wMzEsNTg2Ljg2NVpNMzI1LjM2Myw0MTguMDk2TDMwOS44MjMsNDY5LjQ5N0wyOTUuNTEsNDY5LjcyM0wyOTcuMjYxLDQzMC43NTdaTTU0OC40MjQsNDYwLjkzOUw1NDAuODQ2LDQ3MC44OTJMNTMxLjcyNCw0NzkuNzQ5TDUzNy4zNSw0NjkuODE0TDU0Mi4zODcsNDU5LjQ1OEw1NDYuODI1LDQ0OC43MDdMNTUwLjY1MSw0MzcuNTg3TDU1Ni45MTEsNDI1LjAzOEw1NjQuMDIxLDQxNy43MjFMNTcwLjI1Myw0MTAuMDE0TDU3Ny43NTYsMzkyLjU3Mkw1ODQuMTcxLDM4MC41NDRMNTkwLjEyNiwzNTguNTg2TDU5MC4wODMsMzU4Ljg5TDU5MC4wODMsMzU4Ljg5TDU4Ny44NTEsMzY4Ljk3OEw1ODUuMjY4LDM3OC45ODJMNTgyLjMzOCwzODguODlMNTc5LjA2NCwzOTguNjg5TDU3NS40NDksNDA4LjM2OEw1NzEuNSw0MTcuOTE1TDU2Ny4yMTksNDI3LjMxOEw1NjIuNjEzLDQzNi41NjdMNTU3LjY4Nyw0NDUuNjQ5TDU1Mi40NDcsNDU0LjU1M1pNNTk1LjM4NCwzMTkuMDgxTDU5NS4wNTcsMzA4Ljc4MUw1OTUuOTA3LDMwNi42M0w1OTUuOTA3LDMwNi42M0w1OTUuOTE5LDMwNi45MDZMNTk1LjkxOSwzMDYuOTA2TDU5NS40OTgsMzE3LjIyOVpNNTkxLjYyNiwzMDEuNDg0TDU4Ni4xNTMsMzExLjkzN0w1ODcuNzM4LDMyNC44MjNMNTg4LjQ0NywzMzcuNjMzTDU4My44NTksMzI4LjYwM0w1ODYuOTkxLDMwNS44NzFaTTU1Ny4wODMsMzU0LjY1NEw1NDkuMjAxLDM0OC45MzJMNTM5LjQxOCwzMjguMzA4TDUyNy4xNTIsMzA3LjM5MUw1MzMuNzk4LDMwNC41MTlMNTQ0LjE2MywzMTUuMzMzTDU1My4yODgsMzI2LjA2OUw1NTUuNTY4LDM0MC40MjJaTTU4Mi43MzIsMzA1LjgzNUw1ODEuNDgyLDMyMS40M0w1NzkuNDM4LDMzNi45NjRMNTY4LjQwMiwzMzYuNDM0TDU2Ni4yMzgsMzI0Ljc5OEw1NzQuMTksMzAyLjY1OUw1NzkuNjYxLDI4MC40OTVaTTUzNC42NzIsMTE5LjcyN0w1NDEuMDQzLDEyOC4zNzhMNTQzLjYzNywxMzQuMDQzTDU0NS4xMjIsMTQwLjQ2NEw1MzkuMDksMTI4LjA4Mkw1MzEuODcxLDExNi41NTRaTTExMy4yNjYsNzAuMzM0TDExNS45OTksNjguMTc1TDExNS45OTksNjguMTc1TDEwMS45NDEsODAuMzM5TDEwNC4yNCw3Ny45NzdMMTA0LjI0MSw3Ny45NzdMMTEyLjEwOCw3MS4yOFpNMTg1LjQ5OCw2OC45OTdMMTc2Ljg4NSw4Mi42NjJMMTY4Ljg5MSw5Ny40MkwxNTMuMDk1LDk2Ljk5OEwxNjguOTI1LDgyLjM4MVpNMTk4LjExLDQzLjE4MkwxODEuNjI4LDQ5LjMwOUwxODUuNjQyLDQyLjAwM1pNMzE1Ljk0MiwxNDYuMjAyTDMxNy4xNzksMTYyLjgzN0wzMzYuMjg4LDE2NS4yOTdMMzE5LjQ4MywxMzEuNzJMMzA2LjE5MSwxMzEuODYxWk00NDIuMjUxLDQwLjQyMkw0NTEuMDcyLDQ2LjcxM0w0NjEuMjAyLDU0LjAxNEw0NzAuOTIxLDYxLjk0Mkw0NzYuNjc5LDYzLjUxTDQ5NS41NzYsNzguODQ5TDUwNS42MjYsODkuMDE4TDUxNS4wNzMsOTkuODA1TDUyMC43MTMsMTA4Ljk0Mkw1MjUuNjI0LDExOC43MDlMNTM1Ljk1NSwxMjkuNDE5TDU0MS41NzEsMTQxLjYzM0w1MzIuNTkyLDEzMC43MjNMNTIzLjAxNSwxMjAuMjQ4TDUyMC4yMzcsMTI5LjYyM0w1MzYuMTAzLDE0Ni43NDFMNTUwLjI4OSwxNjQuOTQ5TDU1NC44NiwxODMuNDM1TDU1Ny44NjgsMjAyLjYzNUw1NDYuMTQ2LDIxMy40MzJMNTQzLjg5NCwyMjguNjE2TDU1My4wODEsMjQ1LjY0OUw1NjAuOTkyLDI2Mi45NTdMNTUyLjcwNSwyNzUuMDQ1TDUzNi4xNDEsMjYxLjAxN0w1MzYuMzE3LDI3OS4yMTNMNTUxLjE1NCwzMDIuMTgxTDU1Mi4zOCwzMjAuNTk3TDU0NC4xMDIsMzA0LjM5Nkw1MzQuMzUsMjg4LjE2N0w1MjkuNjQ1LDI2Ni42MjhMNTIzLjYzOCwyNDUuMjc5TDUxMS4xODQsMjMyLjQxNEw0OTcuNzEzLDIxOS44NzRMNDg0LjE5NywyMjguNzM3TDQ2NC42MDcsMjYwLjQ3OEw0NjEuNTc0LDI4MS40NDdMNDU3LjY3NiwzMDIuNTE2TDQ0Ny4yNDMsMjgyLjc2TDQzNS45MTYsMjYzLjEwOUw0MjcuODQzLDIzNi4yNkwzOTcuNDIyLDIxOC4wODFMMzc2LjEzMywyMjEuMDg2TDM0NS4wMDksMjA5LjM3NkwzMTMuMzExLDE5OC44MkwzMzEuOTkyLDIyNy45NjNMMzUzLjA0MSwyMjIuODQ0TDM2OS45NzgsMjM1LjMxM0wzNjEuOTMxLDI1Mi4xNDdMMzE4LjQyMywyNzkuMjMzTDI5Mi4zNTQsMjg2LjM2M0wyODguMzg2LDI2NS4wMzdMMjU1LjIzMSwyMDcuNTQ5TDI0NC44NCwyMDQuMDQ2TDI3MS41NjgsMjY5LjIxMUwyOTUuNTEyLDI5Ny42OTNMMzMwLjgyMiwyODkuMjU3TDMwOC4wNzIsMzM2Ljc5M0wyNzUuNTg5LDM2NC4yNjNMMjY4LjIzMywzODMuNjQ3TDI3OC45MSw0MjMuNTE5TDI1MC42MDcsNDQ2LjI2NUwyNTMuNDEsNDY2Ljg2MUwyMjguMTQzLDQ5OS4xN0wyMTEuNzk4LDUwMi4yOTNMMTk1LjgyMyw1MDQuNTY2TDE4Mi4xMjEsNDg5LjA0N0wxNjkuMDgyLDQ3Mi40NjRMMTU1LjkyNCw0NDkuMjkxTDE0NC4wNzYsNDI0Ljc2TDE0OS4zMjQsNDAzLjcyM0wxMzkuMDQsMzY4LjQ5OUwxMjUuMiwzNDcuMTIyTDEyOS41OTYsMzI2LjMwNEwxMDguMjMzLDMwNi45MDZMNjUuNzgyLDMwOS4xMzVMNTQuMjg1LDI4NS43MDhMNDUuNDQ2LDI2Mi40MzVMNDkuOTEyLDI0MC4wNDdMNTUuODY2LDIxOC4wMTZMNzEuNDA1LDE5NC40OTFMOTEuMDAyLDE4MC4zNjhMMTAxLjkzMiwxNjcuOTM2TDExMy41MTMsMTU1LjkzOUwxMzcuNDg4LDE1NS4zMkwxNjMuMzkxLDE1Ni40MThMMTYyLjAzMiwxNzUuNjUxTDE4OC4yNzMsMTkzLjAwNEwxOTguMTEzLDE4MS45NTFMMjI5LjYwMSwxOTIuODI2TDI1Mi44NTgsMTkyLjA5NUwyNjMuMDc0LDE3MC41NzRMMjI5LjE2MiwxNjUuMzFMMjI2LjI0NSwxNTIuMjhMMjU2LjE0OSwxNDUuNDMxTDI4Ni41MjgsMTQwLjI1N0wyNjguMTM2LDEzMC45MDZMMjQ5LjkyMSwxMjIuNUwyMzcuNzQ5LDE0NS43NjZMMjE0Ljk4MSwxNDYuOTc5TDIwNi4xOTMsMTYyLjk2NkwyMDUuMDIyLDE0MC42NDRMMTkwLjk1NiwxMjEuNzEzTDE5OC45MiwxNDYuMjU2TDE4OC4xMjUsMTQ2LjY1NEwxNzUuMjkzLDEyNS44NTZMMTU1LjYwNywxMjguODY1TDE0MC40MzQsMTQxLjA1NUwxMjUuOTU1LDE1My45MzhMMTA4LjY3MywxNDkuMzI5TDEyNC4wNywxMjIuOTcxTDE0My4wMiwxMjUuMTMzTDE1Ny44NTcsMTA0LjUxNkwxNzcuMjQ0LDk1Ljk0NUwxOTcuMjk1LDg4LjQ3N0wyMTQuNDcsODcuNTY4TDIzMS45OTMsODcuNTIzTDI0NC4wNCw3NC4xMTJMMjQ0LjczNyw2Mi43OTNMMjI3LjUyOSw3My4yNTVMMjEwLjcwNiw4NC45MjJMMjE0LjUyMSw3MC4zOUwyMDIuMjE1LDcxLjkzN0wyMTAuNTc4LDYxLjE4NUwyMzIuODEsNTAuODhMMjU1LjUyNCw0Mi4zNjFMMjcyLjM1NCwzOS45MzdMMjkwLjg3NSw0OS4wOTZMMjc3LjY3OSw1OC45MzhMMzAyLjUxOSw0OS45NjlMMzI3LjMzNSw0My4zOTVMMzQ0LjA1Nyw0Ny4xMzRMMzM1LjU3NCwzOS44NTdMMzUxLjExNCwzNS4xMDZMMzUxLjAzNywyOC4wNjNMMzYyLjE5NiwyMS4wOTRMMzcyLjc3MSwyNS41OTJMMzgzLjQ4MSwyMi45ODhMMzkzLjY0NCwyMi4xOTVMMzg2Ljg4NiwyMC4wMTRMMzg4LjYzNSwxNy43NDlMMzkzLjQ4NywxOS4xNzFMMzkwLjQ4OCwxOC4xN0wzOTAuNDg4LDE4LjE3TDQwMC4yNjgsMjEuNUw0MDkuOTI3LDI1LjE2OUw0MTkuNDUxLDI5LjE3M0w0MjguODMsMzMuNTA3TDQzOC4wNTIsMzguMTY1Wk0xMzUuMzYyLDU0LjAxMUwxMjEuNTEsNjMuOTg3TDExOS40NTYsNjUuNDM3TDExOS40NTYsNjUuNDM3TDEyNy43NTIsNTkuMjc5Wk00LjE0OSwzMDkuMzk1TDUuNzM1LDMyMy4wMDZMOS42MTQsMzM2LjQzOEwxMS45NzEsMzU0LjI5MUwxMi42NDgsMzY0LjYxN0wxNC4xMzUsMzc0Ljc2TDE4LjMzMywzOTAuNTY2TDIzLjYzNyw0MDYuMDE2TDIzLjYzNyw0MDYuMDE2TDIwLjEwNSwzOTYuMzA2TDE2LjkxNSwzODYuNDc5TDE0LjA2OSwzNzYuNTQ3TDExLjU3MiwzNjYuNTIyTDkuNDI2LDM1Ni40MTVMNy42MzQsMzQ2LjI0TDYuMTk4LDMzNi4wMDhMNS4xMjEsMzI1LjczM0w0LjQwMiwzMTUuNDI2Wk0yMzMuODU4LDExLjQ4NEwyMDkuNjk2LDE4LjI2M0wyMDEuNzE0LDIwLjg0MkwxODguNjgsMjYuMDkxTDE3Mi40ODEsMzIuODc3TDE3Mi40ODEsMzIuODc3TDE4MS44ODEsMjguNTg5TDE5MS40MjUsMjQuNjMyTDIwMS4xMDIsMjEuMDExTDIxMC44OTgsMTcuNzI5TDIyMC44MDQsMTQuNzkxTDIzMC44MDYsMTIuMjAxWk0zMjEuMjA5LDQxLjQxMUwzMTAuODEyLDM5LjgyNkwzMTQuMDYyLDMxLjMzTDMyNi4zMDYsMjYuNzE4TDMxNi4yMTQsMzcuNDk2Wk0yNTYuNTgzLDcuMjAxTDI1Ny4yMzgsNy4xMDVMMjU3LjIzOCw3LjEwNUwyMzYuNTU2LDEwLjg5TDIzOS42MiwxMC4yMjRMMjM5LjYyMSwxMC4yMjRMMjQ5Ljc3LDguMjkzWk0yNzYuMTgyLDIxLjM5OUwyNjguNDEzLDI2LjU1NkwyNjkuODQ0LDIwLjg0MlpNMzQ2LjcyNiwxOS42NjRMMzM1LjgzMywxOC42TDMzNC45NjMsMTYuODE3Wk0yNjAuNTI2LDcuMDU2TDI1OS44ODgsNi44MDZMMjY4LjY1LDUuODkxTDI2OS41NTIsNi4xMzJaTTI2Ny40MjEsOC4xNDRMMjYyLjM1Niw5LjA5OEwyNTIuMzI0LDguOTAyTDI0Mi40Nyw5Ljc5N0wyNTAuNjA3LDguMTU4TDI1OC4xMzgsNy40MDJMMjcxLjMxOSw2LjE0NEwyNzAuNzU2LDcuMTI0Wk0yNjguMjExLDEyLjE0MkwyNjUuODA0LDEzLjUwNkwyNjAuODcyLDEyLjc3NUwyNTcuNzM3LDE0LjkwNkwyNjIuMzIyLDE2LjA3M0wyNDcuNzk5LDE4LjM4TDIyNy43NjEsMjUuMzk2TDIxNy4yMDEsMjcuMjc5TDIwNy4xNTUsMzIuNThMMTkyLjA5MiwzNC4wMTZMMTc3LjU2LDM2Ljc2MkwxNTIuNDk5LDQ4LjAyNkwxNTYuMDksNDMuOTcxTDE3MS4xNCwzNS42MTVMMTg2LjY0NCwyOC4xOUwyMTIuNjg2LDE5LjI2MUwyMjguMDQ2LDE0Ljc0TDIzNC42MTEsMTIuMTQzTDI0Ny42NjgsOS41NTRMMjYwLjY5Miw5LjcyM0wyNjcuNzI2LDExLjI2N1oiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjM2LjgxNSw1ODkuMTc3TDIzMi40MjgsNTg3LjY3MUwyNDYuMjA5LDU4OS44ODdMMjU2LjQ3OSw1ODkuODA2TDI3My4wODcsNTkxLjE5MUwyODkuNzg2LDU5MS41OTZMMjk3Ljg2Myw1OTAuMDU2TDMwOS4yMzUsNTkwLjU5OUwzMjYuNjEsNTg4LjcwMUwzNDMuODg3LDU4NS43NEwzNTAuOTc3LDU4Ny4zODlMMzYyLjAwMyw1ODYuMThMMzUwLjE0LDU5MC40MzhMMzcyLjk2Nyw1ODUuNzE4TDM5NS4zNCw1NzkuMjE3TDQwMy41MTEsNTc3LjMxTDQwMy45OTIsNTc3LjEzMUw0MDMuOTkyLDU3Ny4xMzFMMzk0LjI1Nyw1ODAuNTkyTDM4NC40MDcsNTgzLjcxTDM3NC40NTQsNTg2LjQ4M0wzNjQuNDEsNTg4LjkwN0wzNTQuMjg4LDU5MC45NzlMMzQ0LjEsNTkyLjY5NkwzMzMuODU4LDU5NC4wNTdMMzIzLjU3NSw1OTUuMDZMMzEzLjI2NCw1OTUuNzAzTDMwMi45MzYsNTk1Ljk4NUwyOTIuNjA0LDU5NS45MDhMMjgyLjI4Miw1OTUuNDY5TDI3MS45ODEsNTk0LjY3MUwyNjEuNzE0LDU5My41MTNMMjUxLjQ5NCw1OTEuOTk5TDI0MS4zMzMsNTkwLjEyOFpNMzc0Ljc1MSw0MTYuNTc1TDM2NS44NDUsNDQzLjI4NEwzNTYuMjQ5LDQ2OC40OTRMMzQyLjE2LDQ2OS4xNTFMMzQ2LjY1NSw0MzAuMDlaTTU0MC45NjYsNDcxLjkwNUw1NDcuNjQ5LDQ2MS45MjdMNTUzLjczOSw0NTEuNTYyTDU1OS4yMjEsNDQwLjgzM0w1NjQuMDgyLDQyOS43NjdMNTcwLjAwMSw0MTcuMDMzTDU3NC40NDMsNDA5LjU0MUw1NzcuOTc0LDQwMS42ODVMNTgwLjExNiwzOTUuNjYyTDU4MC4xMTYsMzk1LjY2Mkw1NzYuNjA2LDQwNS4zOEw1NzIuNzYsNDE0Ljk2OUw1NjguNTgyLDQyNC40MThMNTY0LjA3Niw0MzMuNzE2TDU1OS4yNDgsNDQyLjg1MUw1NTQuMTA1LDQ1MS44MTFMNTQ4LjY1Miw0NjAuNTg3TDU0Mi44OTYsNDY5LjE2N1pNNTk1LjkwNiwyOTIuNTU4TDU5NC45NTEsMzAzLjEwOUw1OTUuMjA3LDMxNS45NjZMNTk0LjU2MywzMjguNzc2TDU5My44OTgsMzE5LjgyNUw1OTUuMTYxLDI5Ny4wMjZaTTU3OC4xMDgsMzQ2LjUyNEw1NzIuODk0LDM0MUw1NjYuMDAzLDMyMC42M0w1NTYuMzU0LDMwMC4wNDVMNTYxLjQxNiwyOTYuOTk2TDU2OS40MTEsMzA3LjUzMUw1NzYuMDM4LDMxOC4wMjhMNTc3LjQ4OSwzMzIuMzI0Wk01OTMuNTY0LDI5Ny4wOEw1OTMuMDc1LDMxMi43MDFMNTkxLjc1OSwzMjguMjg2TDU4NS44MzYsMzI4LjAxNEw1ODQuNjUyLDMxNi40MjlMNTg5LjE3LDI5NC4xTDU5MS4wNywyNzEuODI1Wk01NDMuNTU3LDEzMS43ODZMNTQ0LjM4NiwxMzMuMDI3TDU0Mi4zNTMsMTMwLjA1Nkw1NDIuMzUzLDEzMC4wNTZaTTExMi41MDcsNzMuODE5TDEwMC4zMzEsODYuMzgxTDEwMC45NzQsODIuMTQ3Wk0yMDUuMTM3LDcyLjE3OEwxOTkuMzYxLDg2LjA2MUwxOTQuMDksMTAxLjAyMUwxNzYuMTQ5LDEwMS4xMTFMMTkwLjMzMyw4Ni4wMzlaTTIxMC4wNzYsNDYuMDk2TDE5My42MDQsNTIuNzI0TDE5NC44NzMsNDUuMzM3Wk0zNTQuMjI2LDE0NS4xMzZMMzU3LjU0MiwxNjEuNzAyTDM3Ni4zMTksMTYzLjU4NkwzNTUuNjIzLDEzMC41NzlMMzQyLjY3MywxMzEuMTE5Wk00NDUuOTU4LDQyLjQ4OEw0NTcuMzAxLDQ5LjMzM0w0NjguMjYsNTYuNzg5TDQ2OS43NTgsNTcuNTE3TDQ2OS43NTgsNTcuNTE3TDQ3OC4xMTcsNjMuNTg5TDQ4Ni4yNiw2OS45NDlMNDk0LjE3NSw3Ni41OUw1MDEuODUzLDgzLjUwMkw1MDkuMjg2LDkwLjY3OUw1MTIuNTg1LDk0LjAzTDUyMC4yOTIsMTAyLjYzTDUyNy4zMzEsMTExLjgyN0w1MzYuMzQ1LDEyMi4yNDRMNTQ0LjE4MSwxMzQuMjUzTDUzNS44NzgsMTIzLjYwNkw1MjYuOTY5LDExMy40MTJMNTI4LjkyNiwxMjIuNzk5TDU0My41NTIsMTM5LjQ1NEw1NTYuNDQ2LDE1Ny4yNTFMNTYzLjc2NCwxNzUuNTU2TDU2OS40NjUsMTk0LjYyM0w1NjMuNjk3LDIwNS42ODdMNTYzLjk5MSwyMjAuOUw1NzIuMTQ5LDIzNy42N0w1NzguOTM0LDI1NC43NTRMNTc0LjEyMywyNjcuMDQxTDU2MS4xNjIsMjUzLjQ2Mkw1NjIuMzc0LDI3MS42MzdMNTY4LjcyOCwyODIuODlMNTc0LjE4OSwyOTQuMkw1NzUuMzgsMzEyLjU3OUw1NjkuMTQ3LDI5Ni41OThMNTYxLjI4OCwyODAuNjM3TDU1Ni41NzQsMjU5LjI0Mkw1NTAuNDA0LDIzOC4wNzdMNTM5LjQ3LDIyNS41NjdMNTI3LjM4NCwyMTMuNDE2TDUxNi45NTMsMjIyLjY0M0w1MTAuMjY0LDIzOC42MDZMNTAyLjQzOSwyNTQuOTAyTDUwMC44NTQsMjc1Ljk0MUw0OTguMTk0LDI5Ny4xMUw0ODguMjk5LDI3Ny42NjNMNDc3LjI2MSwyNTguMzUxTDQ2OC4zMTMsMjMxLjc2TDQzOS4xNzIsMjE0LjQ4N0w0MTkuNjE1LDIxOC4xMTJMMzg5LjE2MiwyMDcuMzM3TDM1Ny41NzQsMTk3Ljc0M0wzNzguMTI1LDIyNi4yOUwzOTcuOTI4LDIyMC41NUw0MTQuODg4LDIzMi41MDRMNDA4LjM2NSwyNDkuNTZMMzY3LjkxMywyNzcuOTIyTDM0Mi42MDcsMjg1LjgzMkwzMzcuNzM0LDI2NC42NEwzMDAuNTk3LDIwOC4yMkwyODkuNzMyLDIwNS4wNEwzMjEuMTgxLDI2OS4zMjFMMzQ2LjEyMiwyOTcuMDYxTDM4MC4zNCwyODcuNTY5TDM1OS4yNjcsMzM1Ljc3TDMyNy4xMzIsMzY0LjIyMkwzMTkuNDg5LDM4My44MzNMMzI4LjgxNCw0MjMuNDAxTDI5OC45NTcsNDQ3LjAzMUwzMDAuMTkzLDQ2Ny41NjZMMjg1LjM0NCw0ODQuODcyTDI3MC42MTIsNTAwLjcwOEwyNTIuOTcyLDUwNC4zNDhMMjM1LjUyOSw1MDcuMTI4TDIyMi45NDEsNDkyLjAwOUwyMTAuNzg2LDQ3NS44MDhMMTk4LjcxOCw0NTMuMDE4TDE4Ny41NzEsNDI4LjgzN0wxOTQuNTM3LDQwNy42MTRMMTg0LjM4NSwzNzIuNzAxTDE2OS4zMjQsMzUxLjc2M0wxNzQuMTIyLDMzMC44MDVMMTQ5Ljg5NiwzMTIuMUwxMDAuNTI3LDMxNS43MjRMODUuNzA1LDI5Mi42OTZMNzMuMjAxLDI2OS43NDhMNzYuOTY1LDI0Ny4yMzVMODIuMDU2LDIyNS4wMzZMOTguMzE0LDIwMS4wMjhMMTIwLjAwMywxODYuMjc4TDE0Mi42MzQsMTYxLjE2M0wxNjkuOTEyLDE1OS43NjVMMTk4LjczNSwxNjAuMDMyTDE5OS43OTIsMTc5LjI2OUwyMjkuOSwxOTUuNzY2TDIzOS4xMjcsMTg0LjQyNEwyNzMuMDYyLDE5NC4zMDRMMjk2Ljc2MSwxOTIuODZMMzA0LjgxNiwxNzEuMDYxTDI2OS41OTQsMTY2Ljg0OEwyNjQuOTI0LDE1My45MzNMMjk0LjY2NywxNDYuMTc4TDMyNC40NjksMTQwLjA5TDMwNC43MDksMTMxLjMxOUwyODQuOTIyLDEyMy40OUwyNzUuOTE2LDE0Ny4wNzhMMjUyLjQ3NywxNDguOTkzTDI0NS4zODgsMTY1LjIyMUwyNDEuMTAzLDE0Mi45ODJMMjIzLjA4MywxMjQuNTM4TDIzNS40NzEsMTQ4Ljc3MkwyMjQuMDQxLDE0OS41MDhMMjA2Ljg3NCwxMjkuMTY1TDE4NS43NDcsMTMyLjc5NEwxNzAuOTExLDE0NS40NDFMMTU2LjYzNywxNTguNzZMMTM1LjgwOSwxNTQuNzNMMTQ4LjYxOSwxMjcuOTQzTDE3MC45MTEsMTI5LjQ3OUwxODMuMzQzLDEwOC40NDhMMjAzLjAyMSw5OS4yODNMMjIzLjIyMyw5MS4yMDNMMjQxLjQzNiw4OS43NTdMMjU5Ljg4Niw4OS4xNjVMMjY5LjM1OSw3NS40MjhMMjY3LjE5LDY0LjEzMUwyNTEuODc5LDc1LjA4N0wyMzYuODIzLDg3LjIzOEwyMzcuMyw3Mi42NDFMMjI0LjQyLDc0LjU3MUwyMzAuNDM2LDYzLjZMMjUxLjEyNSw1Mi42NDRMMjcyLjE2NCw0My40NTlMMjg4LjYzOSw0MC41M0wzMTAuMjU5LDQ5LjA3OUwyOTkuODc1LDU5LjI3OUwzMjIuMDMxLDQ5LjU5NkwzNDMuOTc3LDQyLjMxMUwzNjAuOTc0LDQ1LjUzOEwzNTAuNTU5LDM4LjU0OEwzNjMuMTc4LDMzLjM3TDM2MC4wNDgsMjYuMzc1TDM2Ni4wNDIsMTkuMTQ2TDM3Ny43MiwyMy4zMDZMMzg0LjU1NCwyMC40MzVMMzkwLjgzNiwxOS4zOTNMMzg0LjEyMSwxNy40MTZMMzgxLjA3NCwxNS4zMTlMMzgxLjA3NCwxNS4zMkwzOTAuOTYsMTguMzIyTDQwMC43MzUsMjEuNjY4TDQxMC4zODcsMjUuMzU0TDQxOS45MDUsMjkuMzczTDQyOS4yNzcsMzMuNzIzTDQzOC40OTEsMzguMzk3Wk0xNjguMDE3LDM1LjA1NEwxNjEuMzkyLDM4LjYyOUwxNDcuODYyLDQ2LjI5TDE1NS41NDcsNDIuNDY4TDEzNy4wODgsNTMuOTk5TDExOC4zNzUsNjkuNDU4TDExMS40MjYsNzMuMDIxTDExNC4zNzYsNjkuNDUxTDk4LjA1OCw4My42MjFMOTQuODA2LDg3LjYwMUw4OS41NTYsOTEuODQzTDg5LjU1Niw5MS44NDNMOTYuOTQ5LDg0LjYyNUwxMDQuNTg5LDc3LjY3TDExMi40NjcsNzAuOTg2TDEyMC41NzQsNjQuNTgxTDEyOC44OTksNTguNDYyTDEzNy40MzMsNTIuNjM4TDE0Ni4xNjUsNDcuMTE1TDE1NS4wODQsNDEuOUwxNjQuMTgsMzdaTTUuNTc4LDI2OS40NzRMNS41MiwyNzQuNDA3TDUuMTE3LDI5MC42MzhMNS44MzUsMzA2LjkwNUw4LjM1MywzMTYuNThMMTIuMDE0LDMyNi4xODlMMTYuODA0LDMzNS42OTZMMjIuNzA0LDM0NS4wNjNMMjUuMDUyLDM2Mi44NDRMMjQuMDA0LDM3My4xNzVMMjMuNzM2LDM4My4zTDI4LjE0NSw0MDQuMjI1TDM0LjQ2OCw0MjQuNDE3TDMyLjc2OCw0MjUuOTRMNDEuNzc5LDQ0NC42NzZMNDIuODg4LDQ0Ni42NjFMNDIuODg4LDQ0Ni42NjFMMzcuOTI2LDQzNy41OThMMzMuMjg0LDQyOC4zNjhMMjguOTY2LDQxOC45ODJMMjQuOTc5LDQwOS40NUwyMS4zMjcsMzk5Ljc4NkwxOC4wMTQsMzg5Ljk5OUwxNS4wNDUsMzgwLjEwM0wxMi40MjMsMzcwLjExTDEwLjE1MSwzNjAuMDMxTDguMjMzLDM0OS44NzlMNi42NywzMzkuNjY2TDUuNDY0LDMyOS40MDRMNC42MTcsMzE5LjEwN0w0LjEzLDMwOC43ODdMNC4wMDQsMjk4LjQ1Nkw0LjIzOCwyODguMTI3TDQuODMzLDI3Ny44MTJaTTE4Ni41MTUsMjYuNjE5TDE5NS4wNTIsMjMuNTU4TDIwOC4yMjcsMTguNzA2TDIxMy41ODQsMTYuODk1TDIxMy41ODQsMTYuODk1TDIyMi40OTUsMTQuMzI3TDIyNi45MjUsMTMuMjA1TDIyNi45MjUsMTMuMjA1TDIyNi40MDksMTMuNTQyTDIwNC4xNTYsMjEuMDkxTDE5NS42NzgsMjMuOTJMMTg0LjUxNywyOS41MzdMMTY2LjE5MiwzNi45MjJMMTY2LjU2LDM2LjEwOEwxODUuMTIxLDI3LjIwMkwxODUuMTIxLDI3LjIwMlpNMzM3LjQ1NCw0MC41MTlMMzI2Ljg3MSwzOS4yNTRMMzI2Ljg1NCwzMC43MDhMMzM2LjU4NiwyNS43NjJMMzMxLjI3OCwzNi43NzVaTTI0OS4xMzcsOC41MjhMMjI5LjIzMywxMi45MjlMMjM4LjUxMiwxMC40NzVaTTI4NC43NSwyMS45OTJMMjc5LjI2MSwyNy4zNTFMMjc3LjkwNiwyMS42MzVaTTM1MS43MTEsMTguMTY4TDM0MS4yNTksMTcuNDI5TDMzOS4zNTksMTUuNjg3Wk0yNTQuOTUsOC4zNEwyNTIuNzk1LDguMTMzTDI2Mi4yMzEsNi45NDFMMjY0LjI2Miw3LjEzOFpNMjY1LjQ1Niw5LjE2NEwyNjAuOTQzLDEwLjI2M0wyNDguNDc2LDEwLjQwOUwyMzYuMjAyLDExLjY0TDI0Mi45MzIsOS43NzZMMjUyLjY1NCw4Ljc1N0wyNjYuNDkxLDcuMDg5TDI2Ny43MzUsOC4wNTlaTTI3MC40NzcsMTMuMDc0TDI2OC45ODYsMTQuNDk3TDI2My4wNDcsMTMuOTMxTDI2MS4zMTksMTYuMTM2TDI2Ny4xMDksMTcuMTQ1TDI1Mi44NzYsMTkuODg5TDIzNC44NzYsMjcuNDgzTDIyMy44OTgsMjkuNjkzTDIxNS4yOTQsMzUuMjc3TDE5OC4wNzIsMzcuMjA0TDE4MS4zNTEsNDAuNDI0TDE1NS40NjUsNTIuNDYzTDE1Ni44NTEsNDguMzMyTDE3MC44MjgsMzkuNTM1TDE4NS4yNTksMzEuNjU1TDIxMS40MTYsMjEuOTMzTDIyNi4xMiwxNi45NTZMMjMwLjY2NywxNC4xOUwyNDMuNTk5LDExLjIwNkwyNTkuODEzLDEwLjkzMUwyNjkuMTk2LDEyLjIyNloiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjQ3LjM5LDU5MS4yODdMMjQ1LjA2OCw1ODkuNTMyTDI2MC4yNTQsNTkxLjMwOEwyNzMuMDAyLDU5MC44NzdMMjkwLjExMiw1OTEuNzVMMzA3LjI1Niw1OTEuNjQxTDMxNi43MjgsNTg5LjgzNUwzMjcuMzUzLDU5MC4wNDNMMzQ1LjExNCw1ODcuNjExTDM2Mi43MDksNTg0LjEyTDM2Ny4yODksNTg1LjU5MkwzNzcuMDkxLDU4NC4wNjdMMzYyLjgxMiw1ODguNzIyTDM4NC44NTcsNTgzLjMyMUw0MDYuMzczLDU3Ni4xNTJMNDA3LjUxOSw1NzUuNzgyTDQwNy41MTgsNTc1Ljc4MkwzOTcuODI4LDU3OS4zNjZMMzg4LjAxOSw1ODIuNjFMMzc4LjEwMiw1ODUuNTFMMzY4LjA5MSw1ODguMDYyTDM1Ny45OTYsNTkwLjI2M0wzNDcuODMxLDU5Mi4xMUwzMzcuNjA3LDU5My42MDFMMzI3LjMzOCw1OTQuNzM1TDMxNy4wMzUsNTk1LjUwOUwzMDYuNzExLDU5NS45MjRMMjk2LjM4LDU5NS45NzhMMjg2LjA1Miw1OTUuNjcxTDI3NS43NDIsNTk1LjAwNEwyNjUuNDYxLDU5My45NzhMMjU1LjIyMyw1OTIuNTk0Wk00MjEuODY4LDQxMy41ODhMNDEyLjAwMyw0NDAuNTgyTDQwMC45NjYsNDY2LjEwNUwzODcuNTI5LDQ2Ny4xOEwzOTQuNjMyLDQyNy45NDNaTTU5MC42ODQsMzM3Ljg4Mkw1ODguMjk0LDMzMi40NzVMNTg2Ljc3MiwzMjIuNEw1ODQuNTA2LDMxMi4yNjZMNTc3Ljc2NywyOTEuOTMxTDU4MS4wOTIsMjg4Ljc1NEw1ODYuNDczLDI5OS4wODZMNTkwLjQsMzA5LjQyMkw1OTAuOTc4LDMyMy42ODhaTTU5NS4zNjgsMzE5LjMzOUw1OTQuNTg2LDMxOS4xOTZMNTk0LjQxNywzMDcuNjMxTDU5NS4zOTEsMjg4LjE5MUw1OTQuMzU0LDI2OC44MzFMNTk0LjM1NCwyNjguODMxTDU5NS4yNjMsMjc5LjEyM0w1OTUuODEyLDI4OS40NEw1OTYsMjk5Ljc3TDU5NS44MjgsMzEwLjFaTTExNC43MTEsNzkuNDgyTDEwNC43ODgsOTIuMzhMMTAxLjQyLDg4LjE4OFpNMjI3LjY1OSw3NC43MThMMjIyLjUwNywxMDMuODA3TDIwMi45NjcsMTA0LjQ2N0wyMTUuMDczLDg4Ljk5NVpNMjI0Ljc3NCw0OC42MDVMMjA4LjgxNCw1NS43MjVMMjA3LjI5Nyw0OC4zNDNaTTM5MC44NjIsMTQyLjkzMkwzOTYuMTU3LDE1OS4zNjdMNDE0LjAzMiwxNjAuNjk0TDQwMi4zMDcsMTQ0LjE0MUwzOTAuMDcyLDEyOC4zNjZMMzc3Ljg1OCwxMjkuMjg4Wk01MjQuOTIxLDEwNy41NzdMNTMwLjY1OSwxMTUuODE3TDU0MS4xMDgsMTI4LjY1M0w1NTAuNDY5LDE0Mi4yNjJMNTUwLjQ2OSwxNDIuMjYyTDU1NS44MjIsMTUxLjFMNTYwLjIxMSwxNTguOTFMNTY2Ljk4NSwxNzIuNDM1TDU3Mi44NzQsMTg2LjM4NEw1NzMuNTUxLDE5MS43Nkw1NzMuMjM2LDE5Ny41M0w1NzYuMDY4LDIxMi42OTVMNTgyLjk0OCwyMjkuMjM3TDU4OC40MDEsMjQ2LjEzNUw1ODcuMjEzLDI1OC41MTNMNTgzLjExOCwyNTEuODI0TDU3OC4yNDgsMjQ1LjI2N0w1ODAuNDU4LDI2My4zOUw1ODUuMTQ5LDI3NC40NzVMNTg4Ljg5NCwyODUuNjQ1TDU5MC4wMTMsMzAzLjk5TDU4Ni4wMTQsMjg4LjE2NEw1ODAuMjg4LDI3Mi40MUw1NzUuNzA3LDI1MS4xNTVMNTY5LjU2MSwyMzAuMTc3TDU2MC40OCwyMTcuOTcyTDU1MC4xNDYsMjA2LjE2MUw1NDMuMTE3LDIxNS42NTNMNTM5LjI2NCwyMzEuNzc3TDUzNC4xMTksMjQ4LjI2OUw1MzQuMDMxLDI2OS4zMzRMNTMyLjY4OSwyOTAuNTY0TDUyMy42MzMsMjcxLjQwNEw1MTMuMjIsMjUyLjQxOUw1MDMuNjY4LDIyNi4xMDlMNDc2LjY5MywyMDkuNjg4TDQ1OS40NjIsMjEzLjg3M0w0MzAuNjA2LDIwMy45OThMNDAwLjA4NiwxOTUuMzQ3TDQyMS44ODQsMjIzLjI1MUw0MzkuODQsMjE2LjkzOEw0NTYuMzA3LDIyOC4zODRMNDUxLjUwNiwyNDUuNjEyTDQxNS4zMzksMjc1LjEzOEwzOTEuNTY2LDI4My43OTNMMzg1LjkzNSwyNjIuNzYxTDM2Ni4zODMsMjM0LjcwMUwzNDUuOTQ1LDIwNy41MTNMMzM0LjkzNiwyMDQuNjY2TDM1Mi45NDUsMjM1LjgxMkwzNzAuMTUsMjY3LjkzM0wzOTUuMzMxLDI5NC45MTJMNDI3LjQxNywyODQuNDEyTDQxOC41MDksMzA4Ljg1MUw0MDguNjYsMzMzLjIxOUwzNzcuODUxLDM2Mi42MjdMMzcwLjE1MiwzODIuNDcxTDM3Ny44NDMsNDIxLjc4MUwzNDcuMzM4LDQ0Ni4zMjhMMzQ2Ljk2OSw0NjYuODVMMzMwLjU5NCw0ODQuNjNMMzEzLjk3NSw1MDAuOTQyTDI5NS41NzUsNTA1LjEzTDI3Ny4xOTQsNTA4LjQ1NEwyNjYuMTAxLDQ5My42OTRMMjU1LjIsNDc3Ljg0NEwyNDQuNTg5LDQ1NS4zOTlMMjM0LjQ4Myw0MzEuNTQxTDI0Mi45NTQsNDEwLjA4M0wyMzMuMjQyLDM3NS40NzFMMjE3LjQxOCwzNTUuMDAzTDIyMi40NzMsMzMzLjg5NkwxOTYuMTIsMzE1Ljk1OEwxNDEuMzM0LDMyMS4xNjVMMTIzLjYzNywyOTguNjMxTDEwNy44NDgsMjc2LjExM0wxMTAuNzk2LDI1My40OThMMTE0Ljg2OSwyMzEuMTU5TDEzMS4zNTIsMjA2LjY1NEwxNTQuNDc0LDE5MS4yMjNMMTc2LjUzNywxNjUuNDI5TDIwNi4yOSwxNjMuMTY1TDIzNy4xNTYsMTYyLjUyNUwyNDAuNTk2LDE4MS42OTRMMjczLjY1NywxOTcuMjMxTDI4MS45OSwxODUuNjIyTDMxNy4zNDEsMTk0LjQ1TDM0MC43NjMsMTkyLjI5TDM0Ni40MTEsMTcwLjI4M0wzMTAuOTQ5LDE2Ny4xNDRMMzA0LjY2OCwxNTQuMzk1TDMzMy4zNDgsMTQ1Ljc1MkwzNjEuNjY2LDEzOC43ODJMMzQxLjEzOCwxMzAuNjIzTDMyMC4zODEsMTIzLjQwOUwzMTQuODE1LDE0Ny4yMTlMMjkxLjQxNiwxNDkuODQ1TDI4Ni4yNDIsMTY2LjI1OUwyNzguOTc1LDE0NC4xOTZMMjU3LjU0NywxMjYuMzUxTDI3My45ODIsMTUwLjE0OEwyNjIuMjY1LDE1MS4yMzVMMjQxLjI4NCwxMzEuNDcyTDIxOS4zNTgsMTM1Ljc1NUwyMDUuMzExLDE0OC44NEwxOTEuNjc1LDE2Mi41ODNMMTY3LjkzNCwxNTkuMjMxTDE3Ny43NjcsMTMyLjFMMjAyLjcyNSwxMzIuOTE4TDIxMi4zNzQsMTExLjU1MkwyMzEuNzQ1LDEwMS43OTNMMjUxLjQ4NCw5My4xMDdMMjcwLjE4MSw5MS4xTDI4OC45OTksODkuOTQyTDI5NS42MSw3NS45NkwyOTAuNjM5LDY0Ljc3MUwyNzcuNjksNzYuMTU3TDI2NC44Niw4OC43MzJMMjYxLjk4NSw3NC4xNzFMMjQ4LjkyMiw3Ni40OTVMMjUyLjQwOCw2NS4zOEwyNzAuOTI0LDUzLjgyOEwyODkuNjQ5LDQ0LjAzOUwzMDUuMjcsNDAuNjIyTDMyOS4zMzEsNDguNDc3TDMyMi4wNzQsNTguOTQ2TDM0MC44NzQsNDguNjRMMzU5LjI4Myw0MC43NDNMMzc2LjAzOCw0My40NTZMMzY0LjAwOSwzNi44MDhMMzczLjMyMywzMS4yOTZMMzY3LjIzMywyNC40NDFMMzY3Ljg4MSwxNy4xMTFMMzgwLjMwOCwyMC45MDVMMzgzLjA1OSwxNy44ODlMMzg1LjI2OCwxNi43MTdMMzc4LjgwMSwxNC45NDFMMzc1LjI1LDEzLjcyNUwzNzUuMjUsMTMuNzI1TDM4NS4xOTUsMTYuNTI1TDM5NS4wMzYsMTkuNjcxTDQwNC43NjIsMjMuMTU5TDQxNC4zNTksMjYuOTg0TDQyMy44MTgsMzEuMTQxTDQzMy4xMjYsMzUuNjI2TDQ0Mi4yNzEsNDAuNDMzTDQ1MS4yNDMsNDUuNTU2TDQ2MC4wMzEsNTAuOTlMNDY4LjYyNCw1Ni43MjZMNDc3LjAxMSw2Mi43NTlMNDg1LjE4Myw2OS4wODJMNDkzLjEyOSw3NS42ODVMNTAwLjg0LDgyLjU2Mkw1MDguMzA2LDg5LjcwM0w1MTUuNTE4LDk3LjEwMUw1MjIuNDY4LDEwNC43NDZaTTEzMi40ODQsNTUuOTYyTDE0MC4wNzMsNTEuMTU0TDE1Mi44ODMsNDMuNDY2TDE2Ni4wNzYsMzYuNDQ1TDE1Ny4yMzMsNDIuOTA0TDE0NC4yNDQsNTAuOTY4TDE1My41MDYsNDYuODg4TDEzNi4xOSw1OC45NjNMMTIwLjc1OCw3NC45NEwxMTEuNDA3LDc4Ljc1MUwxMTAuNjk5LDc1LjE0N0w5NS4yNzYsODkuNzk5TDk0LjkzLDkzLjgzNEw4NS40NTQsOTguOTRMODYuNzk3LDk1LjM1MUw3Ni42OSwxMDUuNzFMNzYuNjksMTA1LjcxTDgzLjYwNyw5OC4wMzVMOTAuNzg3LDkwLjYwNkw5OC4yMjIsODMuNDMyTDEwNS45MDMsNzYuNTIyTDExMy44MjEsNjkuODg0TDEyMS45NjUsNjMuNTI3TDEzMC4zMjYsNTcuNDU4Wk05LjQ5NSwyNDMuMjMyTDkuNTkzLDI0OC41NDZMOC40ODgsMjYyLjUzM0w4LjM2NywyNzYuNjQ2TDExLjg4NCwyODMuMjU4TDEzLjQwNSwyOTkuNDcyTDE2LjAxNiwzMTUuNjg5TDIxLjQ1NiwzMjUuMjQyTDI3Ljk4NywzMzQuNjk3TDM1LjU4NSwzNDQuMDE1TDQ0LjIxOSwzNTMuMTYxTDQ2LjQ4NiwzNzAuODcyTDQxLjczLDM5MS40MjFMNDQuNTQ1LDQxMi4yMzZMNDkuMTU3LDQzMi4yNjJMNDMuNzg3LDQzMy44OTNMNTAuNTA0LDQ1Mi4zOUw1Ny4wODQsNDY3LjM1OEw2NS43MjcsNDgwLjkwNEw2Ni4wNDksNDgxLjMzN0w2Ni4wNDksNDgxLjMzN0w1OS44NjMsNDczLjA2MUw1My45Nyw0NjQuNTc1TDQ4LjM3Niw0NTUuODg5TDQzLjA4OSw0NDcuMDEyTDM4LjExNSw0MzcuOTU3TDMzLjQ1OSw0MjguNzMzTDI5LjEyOSw0MTkuMzUyTDI1LjEyOSw0MDkuODI2TDIxLjQ2Myw0MDAuMTY3TDE4LjEzNywzOTAuMzg1TDE1LjE1NSwzODAuNDkzTDEyLjUxOSwzNzAuNTAzTDEwLjIzNCwzNjAuNDI3TDguMzAxLDM1MC4yNzdMNi43MjQsMzQwLjA2N0w1LjUwNSwzMjkuODA3TDQuNjQ0LDMxOS41MTFMNC4xNDMsMzA5LjE5MUw0LjAwMiwyOTguODYxTDQuMjIyLDI4OC41MzFMNC44MDMsMjc4LjIxNkw1Ljc0MywyNjcuOTI3TDcuMDQxLDI1Ny42NzdMOC42OTcsMjQ3LjQ3OFpNMjE0Ljc1OCwxNi41NEwyMjAuNjE2LDE0Ljg2M0wyMDYuNDYsMTkuMTk5TDIwNi40NiwxOS4xOTlMMTkzLjkwNSwyMy43MDJMMjA0LjY0NiwyMC4wODZMMTg5LjU0NywyNS44MUwxODkuOSwyNS4zMDRMMTg2LjY5LDI2LjU0NkwxODYuNjkxLDI2LjU0NkwxOTYuMzAzLDIyLjc1OEwyMDYuMDQyLDE5LjMwOFpNMjIwLjI0LDE1LjUyN0wyMjAuOTI3LDE1Ljg2MUwyMDEuNTI4LDI0LjA0NEwxOTIuODEyLDI3LjEzNEwxODMuODYyLDMzLjA1NUwxNjQuMTIyLDQxLjAxOUwxNjIuODYyLDQwLjIxOEwxNzkuNDc1LDMwLjM1NUwxOTAuNjE0LDI2LjgxNEwyMDIuNTQsMjEuNThMMjA5LjExNywxOC40NDdaTTI0OS42NjEsOC4zMTJMMjQ4LjU0NSw4LjUxNkwyNDguNTQ1LDguNTE2TDI0Mi44MzIsOS41NzNMMjQyLjgzMiw5LjU3M1pNMzUyLjU2LDM5LjE1MkwzNDIuMTEzLDM4LjIwNkwzMzguODMxLDI5LjcxTDM0NS43NTQsMjQuNTExTDM0NS4zOTEsMzUuNjFaTTI0Mi41ODIsMTAuMTczTDIyNC4wNjEsMTUuMTU4TDIzMS4yNzYsMTIuNDU0Wk0yOTMuNzgxLDIyLjMxOUwyOTAuNzM5LDI3LjgwN0wyODYuNjM5LDIyLjE3NFpNMzU1LjEyNCwxNi41NDVMMzQ1LjQzMiwxNi4xMTJMMzQyLjU1OSwxNC40NDNaTTI1MC43NDIsOS43NzNMMjQ3LjEzNyw5LjY1M0wyNTYuOTU5LDguMTY5TDI2MC4wNTgsOC4yODdaTTI2NC41NDEsMTAuMjI3TDI2MC43MTYsMTEuNDUzTDI0Ni4xOTQsMTIuMDA5TDIzMS44NzMsMTMuNjQ1TDIzNi45OSwxMS42TDI0OC42MDgsMTAuMjU3TDI2Mi42ODEsOC4xNjVMMjY1LjY5NCw5LjA3Wk0yNzMuNjQsMTMuOTIzTDI3My4xMTEsMTUuMzc2TDI2Ni4zNDUsMTUuMDA0TDI2Ni4wNzYsMTcuMjM5TDI3Mi44OTYsMTguMDU3TDI1OS4zODUsMjEuMjIyTDI0My45NjksMjkuMzIzTDIzMi45MDgsMzEuODY4TDIyNi4wMDcsMzcuNjg4TDIwNy4xNDgsNDAuMTYzTDE4OC43NDcsNDMuOTE3TDE2Mi44MjIsNTYuNzQzTDE2MS45NjIsNTIuNjA0TDE3NC40NCw0My40MDVMMTg3LjM2LDM1LjExTDIxMi44MzcsMjQuNjAzTDIyNi40MzgsMTkuMTk2TDIyOC44MjksMTYuMzI1TDI0MS4yNDQsMTIuOTU1TDI2MC4xNTUsMTIuMTQ3TDI3MS42MDEsMTMuMTI1WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjU1LjgwOCw1OTIuNjgzTDI1Ni43NjksNTkyLjc3MUwyNTkuMzc4LDU5MC45ODRMMjc1LjUwNiw1OTIuMjg0TDI5MC4zNDQsNTkxLjQzNEwzMDcuNDM3LDU5MS43ODhMMzI0LjUwNSw1OTEuMTU4TDMzNS4wODQsNTg5LjA0OEwzNDQuNjM5LDU4OC45NUwzNjIuMjQ3LDU4NS45OEwzNzkuNjI3LDU4MS45NThMMzgxLjU1Nyw1ODMuMzMxTDM4OS44MzYsNTgxLjUzMUwzNzMuNTc1LDU4Ni42NUwzODYuNjc1LDU4My4wMjVMMzg2LjY3NSw1ODMuMDI2TDM3Ni43NDUsNTg1Ljg3OEwzNjYuNzIxLDU4OC4zODJMMzU2LjYxNiw1OTAuNTM1TDM0Ni40NDIsNTkyLjMzNEwzMzYuMjExLDU5My43NzdMMzI1LjkzNiw1OTQuODYxTDMxNS42Myw1OTUuNTg3TDMwNS4zMDUsNTk1Ljk1MkwyOTQuOTczLDU5NS45NTdMMjg0LjY0Nyw1OTUuNjAyTDI3NC4zNCw1OTQuODg2TDI2NC4wNjQsNTkzLjgxMVpNNDY1LjI4Myw0MDkuMjI2TDQ1NC43NTgsNDM2LjUyOUw0NDIuNjE1LDQ2Mi40MDVMNDMwLjIzOSw0NjMuODcyTDQzNS4zODMsNDQ0LjU1MUw0MzkuNzMzLDQyNC4zODNaTTU5NC44NCwzMjYuMTc5TDU5NC45MzUsMzIzLjYxNEw1OTUuMDMyLDMxMy41NjFMNTk0LjM2NCwzMDMuNDcyTDU5Mi45MzIsMjkzLjM3NEw1OTAuNzQxLDI4My4yOTRMNTkyLjIyNywyODAuMDQ0TDU5NC44MzIsMjkwLjI1NEw1OTUuOTM5LDMwMC41MTRMNTk1Ljc3MSwzMTEuNjQ5TDU5NS43NzEsMzExLjY0OUw1OTUuMTg0LDMyMS45NjVaTTEyMi41NDUsODQuOTkzTDExNS4xNzcsOTguMTU0TDEwNy44OTksOTQuMTIzWk0yNTIuMzgsNzYuNTRMMjUzLjI3OSwxMDUuNjk0TDIzMi43MzMsMTA2Ljk2M0wyNDIuMzkzLDkxLjE2Wk0yNDEuNzU4LDUwLjYzM0wyMjYuNzkzLDU4LjIyM0wyMjIuNTM4LDUwLjkyOFpNNDI0LjczOCwxMzkuNjU2TDQzMS44NSwxNTUuOTAzTDQ0OC4yOCwxNTYuNzA5TDQzNS4zNjksMTQwLjUzTDQyMS43ODQsMTI1LjE0N0w0MTAuNjc4LDEyNi40MjRaTTU3NC4xNDEsMTg4LjM2M0w1NzQuNDczLDE4OS4yMDlMNTc5Ljc1NiwyMDQuMjUxTDU4NS43MzUsMjIyLjcyNUw1ODUuNzM1LDIyMi43MjVMNTg4LjI1OCwyMzIuNzQ0TDU5MC40MywyNDIuODQ1TDU5MC42ODYsMjQ0LjE2Nkw1OTEuNTc1LDI0OS43Mkw1ODkuNjI0LDI0My4xMjNMNTg2Ljg3OSwyMzYuNjgyTDU5MC4wMiwyNTQuNzIzTDU5Mi45MDcsMjY1LjY5M0w1OTQuODIsMjc2Ljc3N0w1OTUuODM0LDI5NS4wOUw1OTQuMTkxLDI3OS4zNDlMNTkwLjc3MSwyNjMuNzM0TDU4Ni40NjIsMjQyLjYxNEw1ODAuNTI4LDIyMS44Mkw1NzMuNTc2LDIwOS44NTlMNTY1LjMwNywxOTguMzMxTDU2MS44OTQsMjA3Ljk4MUw1NjAuOTk1LDIyNC4xNzdMNTU4LjY4NSwyNDAuNzgyTDU2MC4wOTYsMjYxLjgyN0w1NjAuMTE1LDI4My4wNzdMNTUyLjE3MywyNjQuMTc2TDU0Mi43MDEsMjQ1LjQ5Mkw1MzIuODM2LDIxOS40NzhMNTIxLjI1NywyMTEuNDg3TDUwOC44NDUsMjAzLjgzMUw0OTQuNDYzLDIwOC40OTZMNDY4LjA4MiwxOTkuNDYxTDQzOS41NTgsMTkxLjcwN0w0NjEuOTQsMjE4LjkzOUw0NzcuNTAzLDIxMi4xMTdMNDkyLjk3NywyMjMuMDc4TDQ5MC4wNDMsMjQwLjQyM0w0NzUuMzMyLDI1NS41MjJMNDU5LjI2MSwyNzAuOTY2TDQzNy43NDIsMjgwLjMxTDQzMS41MjUsMjU5LjQ1N0w0MTEuNDU0LDIzMkwzODkuODk2LDIwNS40NUwzNzkuMDc4LDIwMi45MzRMMzk4Ljc4MywyMzMuNTA3TDQxNi45ODcsMjY1LjA5TDQ0MS42NDQsMjkxLjMxMkw0NzAuNjIyLDI3OS44ODRMNDYzLjMzNiwzMDQuNTY5TDQ1NC43NTIsMzI5LjIxN0w0NDAuODQ5LDM0NC40ODlMNDI2LjIwNSwzNTkuNTI3TDQxOC42ODUsMzc5LjYwMkw0MjQuNTA3LDQxOC43MDdMNDA5LjYzOSw0MzEuNzM1TDM5NC4yODEsNDQ0LjE3NkwzOTIuMzE5LDQ2NC43MzRMMzc0LjkxNCw0ODMuMDI3TDM1Ni45MTMsNDk5Ljg2NUwzMzguMzEzLDUwNC42MTVMMzE5LjU1MSw1MDguNTA0TDMwMC45NzUsNDc4LjUxTDI4My4zODQsNDMyLjc4OEwyOTMuMTA1LDQxMS4wNTRMMjg0LjEyOCwzNzYuNzI3TDI2OC4wMjEsMzU2Ljc0NEwyNzMuMTgsMzM1LjQ4MUwyNDUuNSwzMTguMzY0TDE4Ni45NjEsMzI1LjI5MkwxNjYuOTI3LDMwMy4zMzJMMTQ4LjMzMywyODEuMzM2TDE1MC4zNzUsMjU4LjY0NUwxNTMuMzA3LDIzNi4yMDFMMTY5LjUxNCwyMTEuMTk4TDE5My4zNjYsMTk1LjA1NEwyMTQuMTkxLDE2OC42MDlMMjQ1LjUxNSwxNjUuNDE2TDI3Ny40ODYsMTYzLjgyMkwyODMuMjA2LDE4Mi44NTJMMzE4LjIxNCwxOTcuMzU1TDMyNS40LDE4NS41MUwzNjEuMDkzLDE5My4yNThMMzgzLjUyNywxOTAuNDAyTDM4Ni41OTcsMTY4LjI2MkwzNTEuOTcxLDE2Ni4xODhMMzQ0LjI3MSwxNTMuNjUyTDM3MS4wMTUsMTQ0LjE2N0wzOTYuOTg5LDEzNi4zNzFMMzc2LjMxOCwxMjguODM4TDM1NS4yMjEsMTIyLjI2MUwzNTMuMjY0LDE0Ni4xODRMMzMwLjYxNywxNDkuNTFMMzI3LjUxNSwxNjYuMDVMMzE3LjQ4NSwxNDQuMjVMMjkzLjMwMSwxMjcuMDk4TDMxMy4yODQsMTUwLjM0MUwzMDEuNjM1LDE1MS43ODNMMjc3LjQ3OCwxMzIuNzA2TDI1NS40MiwxMzcuNjU3TDIzMC4wMDUsMTY1LjI5M0wyMDQuMDcyLDE2Mi42OTRMMjEwLjYzLDEzNS4zMTVMMjM3LjQ5NCwxMzUuMzQ1TDI0NC4wNjcsMTEzLjczM0wyNjIuNTQyLDEwMy4zOTlMMjgxLjIyLDk0LjEyOUwyOTkuODMzLDkxLjU1NkwzMTguNDQ2LDg5LjgyOUwzMjEuOTk0LDc1LjY5M0wzMTQuMzczLDY0LjY5NUwzMDQuMTc5LDc2LjQzM0wyOTMuOTY0LDg5LjM1OEwyODcuODI1LDc0LjkzNEwyNzQuOTc2LDc3LjY1MkwyNzUuODI3LDY2LjQ3MUwyOTEuNjA4LDU0LjM5N0wzMDcuNDQ5LDQ0LjA4M0wzMjEuNzQxLDQwLjIxMkwzNDcuNTEyLDQ3LjMxTDM0My42MDMsNTcuOTQ4TDM1OC40NzUsNDcuMTMxTDM3Mi43ODgsMzguNzM2TDM4OC43OTEsNDAuOTUyTDM3NS41MTMsMzQuNjg4TDM4MS4yNCwyOC45NDhMMzcyLjM3NiwyMi4zMkwzNjcuNjU4LDE1LjA1MkwzODAuNDU1LDE4LjQ2M0wzNzkuMTg1LDE1LjYxOEwzNzcuNDg0LDE0LjMyMUwzNzcuNDg0LDE0LjMyMUwzODcuNDA3LDE3LjJMMzk3LjIyMywyMC40MjJMNDA2LjkyMSwyMy45ODZMNDE2LjQ4OSwyNy44ODVMNDI1LjkxNCwzMi4xMTZMNDM1LjE4NywzNi42NzRMNDQ0LjI5NCw0MS41NTJMNDUzLjIyNiw0Ni43NDZMNDYxLjk3MSw1Mi4yNDdMNDcwLjUxOSw1OC4wNTFMNDc4Ljg1OSw2NC4xNDlMNDg2Ljk4MSw3MC41MzVMNDk0Ljg3NSw3Ny4yMDFMNTAyLjUzMiw4NC4xMzdMNTA5Ljk0Miw5MS4zMzdMNTE3LjA5Nyw5OC43OTFMNTIzLjk4NywxMDYuNDlMNTMwLjYwMywxMTQuNDI1TDUzNi45MzksMTIyLjU4Nkw1NDIuOTg3LDEzMC45NjNMNTQ4LjczOCwxMzkuNTQ2TDU1NC4xODYsMTQ4LjMyNUw1NTkuMzI1LDE1Ny4yODhMNTY0LjE0NywxNjYuNDI2TDU2OC42NDgsMTc1LjcyNUw1NzIuODIyLDE4NS4xNzdaTTE0NC4wODcsNDguMzkxTDEzMi4yMDcsNTcuMDY2TDExOS41NDIsNjYuMjgxTDEzNi44MzEsNTYuMDYyTDE0OS41NjgsNDcuOTg3TDE2Mi42OTUsNDAuNTY2TDE1Ny40MTEsNDcuMjM5TDE0NS4zNTgsNTUuNjgzTDE1NS45MTcsNTEuMzAyTDE0MC4yNjksNjMuODc4TDEyOC41ODcsODAuMjY3TDExNy4xMTksODQuMzk1TDExMi43NzMsODAuODY3TDk4LjcxNCw5NS45NjhMMTAxLjI4NSw5OS45NjhMODguNDc2LDEwNS40MTNMODYuNzIxLDEwMS44M0w3Ni4yMTEsMTEwLjY4NEw2Ni41NjksMTIwLjI3M0w1OS4xOTUsMTI5Ljk4TDUzLjE4OCwxMzcuMTU0TDQ3LjkzNSwxNDQuODI2TDQ3LjkzNSwxNDQuODI1TDUzLjUwNCwxMzYuMTIzTDU5LjM3MywxMjcuNjJMNjUuNTM2LDExOS4zMjdMNzEuOTg0LDExMS4yNTVMNzguNzEsMTAzLjQxMkw4NS43MDYsOTUuODA5TDkyLjk2Miw4OC40NTVMMTAwLjQ3MSw4MS4zNThMMTA4LjIyMyw3NC41MjhMMTE2LjIwOSw2Ny45NzJMMTI0LjQxOSw2MS42OTlMMTMyLjg0Miw1NS43MTdMMTQxLjQ2OSw1MC4wMzJaTTguNDk2LDI0OC42MDVMOS45OCwyNDcuNzA0TDEyLjQxLDI1Mi4zMjRMMTYuNzU1LDI1Ny4yNjFMMTcuNzkxLDI3MS4yNDlMMTkuNzgxLDI4NS4zMzRMMjcuMDAzLDI5MS43ODNMMzAuNDAxLDMwNy45MjJMMzQuODI1LDMyNC4wMzJMNDMuMDIxLDMzMy4zNzhMNTIuMjI1LDM0Mi41OTRMNjIuMzk5LDM1MS42NDJMNzMuNTA1LDM2MC40ODhMNzUuNjI0LDM3OC4xMzNMNjcuNTcyLDM5OC44NzZMNjguNzA2LDQxOS42MzFMNzEuNDY3LDQzOS41NDVMNjIuNTksNDQxLjM5Mkw2Ni44MTEsNDU5LjcyM0w3MC4wMDcsNDc0LjU0Mkw3NS4xNTcsNDg3Ljg3OUw3NS4wMTcsNDkxLjU0OEw4NC41NzIsNTAyLjgwNEw5NC44NTIsNTEzLjM3OEw5NC44NTIsNTEzLjM3OEw4Ny41Myw1MDYuMDg5TDgwLjQ2Nyw0OTguNTQ4TDczLjY3Miw0OTAuNzY1TDY3LjE1Miw0ODIuNzVMNjAuOTE2LDQ3NC41MTNMNTQuOTcxLDQ2Ni4wNjNMNDkuMzI1LDQ1Ny40MUw0My45ODQsNDQ4LjU2NkwzOC45NTUsNDM5LjU0TDM0LjI0NCw0MzAuMzQ1TDI5Ljg1Nyw0MjAuOTkxTDI4LjM2OSw0MTcuNjEyTDE5Ljk2NSwzOTUuN0wxOC4wMSwzODkuOTg2TDE4LjAxLDM4OS45ODZMMTUuMDQxLDM4MC4wOUwxMi40MTksMzcwLjA5NkwxMC4xNDgsMzYwLjAxN0w4LjIzLDM0OS44NjVMNi42NjgsMzM5LjY1Mkw1LjQ2MywzMjkuMzlMNC42MTYsMzE5LjA5M0w0LjEzLDMwOC43NzNMNC4wMDQsMjk4LjQ0Mkw0LjIzOSwyODguMTEzTDQuODM0LDI3Ny43OThMNS43ODgsMjY3LjUxTDcuMTAyLDI1Ny4yNjJaTTIwMi42NSwyMC40NjdMMTk1Ljg4NCwyMy4xMzRMMjEzLjc5NiwxNy4zNzlMMjAwLjExNywyMi4xMzdMMjAwLjExNywyMi4xMzdMMTg3Ljk0MywyNy4wMTdMMTk5Ljg5NywyMy4wNTZMMTg1LjU4NCwyOS4yMjZMMTg0LjMyMiwyOC43MzVMMTc0LjY1MSwzMi4xNTVMMTY1LjM2MiwzNi4zOTNMMTY1LjM2MiwzNi4zOTNMMTc0LjY0NCwzMS44NTVMMTg0LjA3OCwyNy42NDNMMTkzLjY1NCwyMy43NjRaTTIyOS4wNzUsMTIuNjIzTDIyMy45NjQsMTMuOTc5TDIwOS4xMDEsMTguMzQyTDIxMC4yNiwxNy45MzFMMjEwLjI2MSwxNy45MzFMMjIwLjE1OSwxNC45NzFaTTIxNS45NzksMTguMDE2TDIxNy44NDcsMTguMzFMMjAxLjg5MiwyNy4wM0wxOTMuMjAyLDMwLjM4NUwxODYuNzM2LDM2LjU0MUwxNjYuMTgsNDUuMTE2TDE2My4zMzEsNDQuMzc4TDE3Ni41MTQsMzQuMDYyTDE4OS41MDEsMzAuMTU1TDE5OS44MTQsMjQuNTgzTDIwMy41NzYsMjEuMjkzWk0yNDQuMzE0LDkuMjg1TDI0MC45MzMsMTAuMTk1TDI0MC45MzMsMTAuMTk1TDIzNC41NjksMTEuNTExTDI0My44NjksOS4zNzFMMjQzLjg3LDkuMzcxWk0zNjYuMDY5LDM3LjM1TDM1Ni4wNzYsMzYuNzE0TDM0OS42MjcsMjguMzY2TDM1My41MzIsMjMuMDAzTDM1OC4xMjUsMzQuMDM4Wk0yMzcuNzcxLDExLjk5MUwyMjEuMTk1LDE3LjUwOUwyMjYuMTI4LDE0LjYyWk0zMDMsMjIuMzY3TDMwMi40OTksMjcuOTFMMjk1Ljc3OCwyMi40NDFaTTM1Ni44NjIsMTQuODQ0TDM0OC4yMjUsMTQuNjg5TDM0NC40NjYsMTMuMTIxWk0yNDguMDMyLDExLjMxMUwyNDMuMDg1LDExLjMyMUwyNTIuOTk1LDkuNTM3TDI1Ny4wNjgsOS41NDZaTTI2NC43MDMsMTEuMzAyTDI2MS42ODMsMTIuNjMyTDI0NS41NDcsMTMuNjU0TDIyOS42MTQsMTUuNzQ5TDIzMi45NjMsMTMuNTc2TDI0Ni4xMjQsMTEuODU2TDI2MC4wMDQsOS4zNEwyNjQuNjk2LDEwLjEyOFpNMjc3LjYwNCwxNC42NjNMMjc4LjA1MywxNi4xMThMMjcwLjY2NiwxNS45NjFMMjcxLjg2NSwxOC4xODJMMjc5LjUwNiwxOC43OEwyNjcuMTI4LDIyLjMzOEwyNTQuNzY1LDMwLjg2MkwyNDMuOTU2LDMzLjczOUwyMzguOTY4LDM5LjczOUwyMTkuMDQ2LDQyLjgwNEwxOTkuNTIzLDQ3LjEzNEwxNzQuMzQ4LDYwLjczNkwxNzEuMjY3LDU2LjY1N0wxODEuODY4LDQ3LjEwOEwxOTIuODg0LDM4LjQ0OEwyMTYuOTA3LDI3LjE4OUwyMjguOTkyLDIxLjM5MkwyMjkuMTU0LDE4LjQ4MkwyNDAuNjc0LDE0Ljc0OUwyNjEuNzA3LDEzLjMzNEwyNzQuODcsMTMuOTM4WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjYyLjkyLDU5My42NjhMMjY3LjIyNCw1OTMuOTI2TDI3MS4wMzQsNTkzLjM0M0wyNzQuOTIxLDU5MS45ODJMMjkxLjUwMiw1OTIuNzg1TDMwNy45OCw1OTEuNDU5TDMyNC41MzcsNTkxLjMwMkwzNDEuMDEsNTkwLjE2M0wzNTIuMzc1LDU4Ny43MTlMMzYwLjU2OSw1ODcuMzUxTDM3Ny40ODksNTgzLjg1N0wzOTQuMTI1LDU3OS4zMThMMzkzLjM0Nyw1ODAuNjc0TDM5OS44NTIsNTc4LjY0OUwzOTguNjM1LDU3OS4wODNMMzk4LjYzNSw1NzkuMDgzTDM4OC44MzUsNTgyLjM1NUwzNzguOTI3LDU4NS4yODNMMzY4LjkyMiw1ODcuODY0TDM1OC44MzQsNTkwLjA5NEwzNDguNjc0LDU5MS45NzFMMzM4LjQ1NSw1OTMuNDkxTDMyOC4xODksNTk0LjY1NUwzMTcuODg4LDU5NS40NTlMMzA3LjU2Niw1OTUuOTAzTDI5Ny4yMzQsNTk1Ljk4N0wyODYuOTA2LDU5NS43MUwyNzYuNTk0LDU5NS4wNzNMMjY2LjMxLDU5NC4wNzdaTTUwMy42NzUsNDAzLjYyMUw0OTIuODExLDQzMS4yNDlMNDc5LjkzMSw0NTcuNTA1TDQ2OC45OTEsNDU5LjMyNkw0NzUuMzA1LDQzOS44MzFMNDgwLjU4OSw0MTkuNTE2Wk01OTUuMDc3LDI3Ni42NDZMNTk0Ljg4LDI3NC4zOTdMNTk0LjgyLDI3My42MDJMNTk0LjgyMSwyNzMuNjAyWk0xMzUuNzcxLDkwLjE4NEwxMzEuMTgxLDEwMy41MjZMMTIwLjIxNiw5OS43NzNaTTI3OC41NDcsNzcuNTlMMjg1LjQ3MSwxMDYuNjI0TDI2NC41NDQsMTA4LjUyM1pNMjYwLjUxMSw1Mi4xMThMMjQ2Ljk5OCw2MC4xNEwyNDAuMTMzLDUzLjAxNFpNNDU0LjgyMywxMzUuNDA5TDQ2My41MzYsMTUxLjQxNUw0NzguMDIyLDE1MS43NTJMNDY0LjMxOSwxMzUuOTc4TDQ0OS43OTYsMTIxLjAyMkw0NDAuMTM1LDEyMi42MTNaTTU4Ni45OCwyMjcuNDg2TDU4Mi45NzEsMjEzLjI2TDU3OC4zNTksMjAxLjQ3M0w1NzIuNDA3LDE5MC4xNjFMNTcyLjcxNCwxOTkuODU5TDU3NC43OTUsMjE2LjAzN0w1NzUuMzkyLDIzMi42NjlMNTc4LjI1OSwyNTMuNjQ5TDU3OS42MzcsMjc0Ljg3N0w1NzMuMDUsMjU2LjE5N0w1NjQuODA3LDIzNy43ODJMNTU0LjkyOCwyMTIuMDY3TDU0NS4yNTIsMjA0LjRMNTM0LjY1MSwxOTcuMDkzTDUyMy41NTcsMjAyLjE0NUw1MDAuNDUsMTkzLjg2Mkw0NzQuNzksMTg2LjkzMUw0ODYuMjY2LDIwMC4wMjlMNDk3LjA3NSwyMTMuNDg1TDUwOS43NzMsMjA2LjIzM0w1MjMuNzg0LDIxNi43NDZMNTIyLjgwNywyMzQuMTUxTDUxMS4zOTUsMjQ5LjY0N0w0OTguMzQ0LDI2NS41MzNMNDc5LjczNCwyNzUuNDg2TDQ3My4xMTgsMjU0LjgyOUw0NTMuMTQsMjI3Ljk4TDQzMS4xMTYsMjAyLjA5Mkw0MjAuODE4LDE5OS44OTdMNDQxLjYxOSwyMjkuODU1TDQ2MC4yNywyNjAuODc4TDQ4My42NTIsMjg2LjM3TDUwOC42NDQsMjc0LjEyM0w1MDMuMiwyOTlMNDk2LjE0MiwzMjMuODg2TDQ4My45MTcsMzM5LjU1NUw0NzAuNzI0LDM1NS4wMTZMNDYzLjYxLDM3NS4zMTRMNDY1Ljk0OSwzOTUuMDUxTDQ2Ny4zODgsNDE0LjI3Mkw0NTMuMjE2LDQyNy43NDJMNDM4LjM2LDQ0MC42NDJMNDM0Ljg2NCw0NjEuMjgyTDQxNi45NTgsNDgwLjExMkwzOTguMTIyLDQ5Ny41MUwzNzkuODg2LDUwMi44MTlMMzYxLjMxNSw1MDcuMjc1TDM0Ni43Miw0NzcuNzg2TDMzMi43OTEsNDMyLjU0M0wzNDMuNDY1LDQxMC40OTlMMzM1LjQ5NiwzNzYuNDI5TDMxOS41OTYsMzU2LjkzMkwzMjQuNzAyLDMzNS41MTNMMjk2LjUzNiwzMTkuMjQ1TDIzNi4wMjQsMzI3Ljk4MkwyMTQuMjYxLDMwNi42NTdMMTkzLjQyNiwyODUuMjU5TDE5Ni4yMDMsMjQwLjAwNkwyMTEuNjQxLDIxNC41MjNMMjM1LjQ5OSwxOTcuNjU0TDI1NC40NTIsMTcwLjYwNEwyODYuMzk1LDE2Ni40NTFMMzE4LjUwMSwxNjMuODgzTDMyNi4zMjYsMTgyLjcwN0wzNjIuMjE4LDE5Ni4xMzNMMzY4LjAzOCwxODQuMDkxTDQwMi45ODksMTkwLjc2Nkw0MjMuNzUyLDE4Ny4yNTNMNDI0LjE1MSwxNjUuMDYxTDM5MS40MTUsMTY0LjAwOUwzODIuNTI4LDE1MS43MjVMNDA2LjUyNCwxNDEuNDdMNDI5LjM2NSwxMzIuOTMzTDQwOS4xNzksMTI2LjAyTDM4OC4zODMsMTIwLjA3OUwzOTAuMDk0LDE0NC4wMDZMMzY4Ljg4NywxNDcuOTk5TDM2Ny45NTEsMTY0LjZMMzU1LjQ2NCwxNDMuMTQyTDMyOS4yNTksMTI2Ljc1NUwzNTIuMTgzLDE0OS4zNDZMMzQwLjk1NiwxNTEuMTM2TDMxNC4zNTcsMTMyLjgzTDI5Mi44MzcsMTM4LjQ0NEwyNzAuNDYxLDE2Ni44MDVMMjQzLjEyNCwxNjUuMDE2TDI0Ni4yMDgsMTM3LjQ5TDI3NC4xNjMsMTM2LjY4N0wyNzcuNDU5LDExNC45MjVMMjk0LjQ3OCwxMDQuMDUyTDMxMS41MjYsOTQuMjM5TDMyOS40ODksOTEuMTFMMzQ3LjMzMyw4OC44MjlMMzQ3LjcxLDc0LjYzNEwzMzcuNjcsNjMuOTA0TDMyMy4yNTIsODkuMDk2TDMxNC4wMzQsNzQuOTA1TDMwMS43OSw3OC4wMDVMMjk5Ljk3OSw2Ni44MzhMMzEyLjU0Niw1NC4zMzRMMzI1LjAyMyw0My41OUwzMzcuNTUxLDM5LjMxMUwzNjQuMjUsNDUuNjEyTDM2My44MDcsNTYuMzE2TDM3NC4zLDQ1LjExNEwzODQuMDgxLDM2LjM1M0wzOTguODQ3LDM4LjEwMkwzODQuNzIzLDMyLjI1NEwzODYuNjg5LDI2LjM5NkwzNzUuMzIsMjAuMDc3TDM3MC40NDYsMTYuMTY2TDM2NS4zOCwxMy4wMzFMMzc4LjE1OCwxNi4wNTNMMzc0LjY1NywxMy45NTZMMzcwLjk1NSwxMi42M0wzNzAuOTU2LDEyLjYzTDM4MC45NDIsMTUuMjgyTDM5MC44MjksMTguMjhMNDAwLjYwNSwyMS42MjJMNDEwLjI1OSwyNS4zMDJMNDE5Ljc3OSwyOS4zMThMNDI5LjE1MywzMy42NjNMNDM4LjM2OSwzOC4zMzJMNDQ3LjQxNyw0My4zMjFMNDU2LjI4NSw0OC42MjJMNDY0Ljk2Myw1NC4yMjlMNDczLjQ0LDYwLjEzNkw0ODEuNzA1LDY2LjMzNUw0ODkuNzQ5LDcyLjgxOUw0OTcuNTYyLDc5LjU3OUw1MDUuMTM0LDg2LjYwOEw1MTIuNDU3LDkzLjg5OEw1MTkuNTIsMTAxLjQzOEw1MjYuMzE2LDEwOS4yMkw1MzIuODM2LDExNy4yMzRMNTM5LjA3MywxMjUuNDcyTDU0NS4wMTgsMTMzLjkyMUw1NTAuNjY1LDE0Mi41NzRMNTU2LjAwNiwxNTEuNDE4TDU2MS4wMzYsMTYwLjQ0M0w1NjUuNzQ3LDE2OS42MzhMNTcwLjEzNSwxNzguOTkxTDU3NC4xOTQsMTg4LjQ5M0w1NzcuOTE4LDE5OC4xM0w1ODEuMzA0LDIwNy44OTFMNTg0LjM0NywyMTcuNzY1Wk0yMy44NDQsMTkzLjQ0NUwyNC44NTUsMTkxLjI0N0wxOC44MiwyMDcuNTEzTDE4LjgyLDIwNy41MTNMMjIuMjE5LDE5Ny43NTZaTTE1LjQ0LDIxOC41MDRMMTQuMjMxLDIyNi4xNzRMMTAuNjc5LDI0Mi4zMUw4LjAzOSwyNTguNjI3TDExLjY3MSwyNTcuMzQ4TDE3LjU1NCwyNTYuNDAxTDI0LjExOSwyNjAuODg0TDMyLjUyMiwyNjUuNjI4TDM1LjY2OSwyNzkuNTUyTDM5LjcwOSwyOTMuNTQ2TDUwLjQxNiwyOTkuNzIyTDU1LjU4OSwzMTUuNzMxTDYxLjY5MSwzMzEuNjgxTDgzLjk5MSwzNDkuNjM5TDEwOS42NzQsMzY2LjgyMUwxMTEuNTc4LDM4NC40MDRMMTAwLjQ3Nyw0MDUuNDM4TDk5Ljg5NCw0MjYuMTg1TDEwMC43MjEsNDQ2LjA0NEw4OC42MDgsNDQ4LjIxTDkwLjIwMiw0NjYuNDUzTDg5LjkxOCw0ODEuMjI4TDkxLjQxOCw0OTQuNDY0TDg3LjIxNCw0OTguMTk4TDk4LjIxMSw1MTIuNTA1TDExMC4zODMsNTI1LjU3NUwxMjAuMDY2LDUzNC42MTNMMTMwLjUwMyw1NDIuNjY2TDEzMC40MDIsNTQyLjU5NUwxMzAuNDAyLDU0Mi41OTVMMTIyLjAzOSw1MzYuNTI4TDExMy44OTIsNTMwLjE3NEwxMDUuOTczLDUyMy41MzhMOTguMjg5LDUxNi42MzFMOTIuODMsNTExLjQxNUw4Mi44ODgsNTAxLjA0OUw3My42MDEsNDkwLjA3N0w2NC45OTYsNDc4LjUzM0w1Ny4wOTksNDY2LjQ1MUw0OC40MDYsNDUxLjY2Mkw0MC42NjYsNDM2LjI5OUwzMy45MDcsNDIwLjQyTDI4LjE1Niw0MDQuMDg1TDIyLjE5NCwzOTIuOTM5TDE3LjE0LDM4MS40ODlMMTMuMjA5LDM2OC4xNTFMOS45NjksMzU0LjY0OEw3LjQyNywzNDEuMDEzTDUuNTksMzI3LjI4TDQuOTkxLDMxMy45TDUuMTEyLDMwMC40ODVMNy40NSwyODcuNDUzTDcuNjc5LDI2Ni4xNDdMOC42ODQsMjUwLjA1TDExLjM5NiwyMzQuMjQ3TDExLjM5NiwyMzQuMjQ2TDEzLjg2NiwyMjQuMjE0Wk0yMDIuODYxLDIwLjM5M0wxOTYuNzc2LDIyLjk3MkwxOTAuOTk3LDI2LjM3MUwyMDkuNTk2LDIwLjA2MkwxOTYuODEsMjUuMjIyTDE5Ni44MSwyNS4yMjJMMTg1LjM4NSwzMC40NkwxOTguMTksMjYuMTIzTDE4NS4wOTgsMzIuNzFMMTgyLjI1OSwzMi4yODFMMTY5Ljg1NiwzNi4zMkwxNTcuOTA3LDQxLjI4MkwxNDAuNDY3LDUxLjczN0wxMzUuNTM0LDU2LjYzNkwxMzEuMDM4LDYyLjE4MkwxMTguNzY4LDcxLjc3NkwxMzguNTQ3LDYwLjk5NEwxNTAuODIzLDUyLjUzOUwxNjMuNDg3LDQ0LjcyNkwxNjEuOTIyLDUxLjUwM0wxNTEuMTcxLDYwLjI5NEwxNjIuNzA2LDU1LjU3N0wxNDkuMjAxLDY4LjU5NkwxNDEuNjI0LDg1LjI3OEwxMjguMzg3LDg5Ljc4TDEyMC41MzYsODYuNDM4TDEwOC4yNjgsMTAxLjkzOEwxMTMuNjc4LDEwNS44MThMOTcuOTI2LDExMS42OTZMOTMuMTI2LDEwOC4yMTNMODAuOTQsMTE3LjQxMkw2OS42MDUsMTI3LjMxOUw2Mi4zMjEsMTM3LjI0OUw1My43NDUsMTQ1LjIyM0w0Ni4wNDEsMTUzLjc0NEwzMi43NzEsMTc4Ljk4NEw0My41NTksMTU1LjUzTDQzLjU2OCwxNTIuOTg4TDQ0LjMxNCwxNTAuODY3TDQ0LjMxNCwxNTAuODY3TDQ5LjY3NCwxNDIuMDM1TDU1LjM0LDEzMy4zOTVMNjEuMzAzLDEyNC45NThMNjcuNTU3LDExNi43MzRMNzQuMDk1LDEwOC43MzNMODAuOTA4LDEwMC45NjZMODcuOTg3LDkzLjQ0MUw5NS4zMjUsODYuMTY4TDEwMi45MTMsNzkuMTU1TDExMC43NCw3Mi40MTFMMTE4Ljc5OCw2NS45NDVMMTI3LjA3Nyw1OS43NjNMMTM1LjU2Niw1My44NzVMMTQ0LjI1Niw0OC4yODZMMTUzLjEzNiw0My4wMDRMMTYyLjE5NCwzOC4wMzVMMTcxLjQyMSwzMy4zODVMMTgwLjgwNCwyOS4wNkwxOTAuMzMyLDI1LjA2NkwxOTkuOTk0LDIxLjQwNlpNMjIzLjM4MywxNC4wODhMMjI0Ljk1MiwxMy43ODJMMjI0Ljk1MiwxMy43ODJMMjE3LjM3MSwxNi4zODlMMjAyLjc5MSwyMS4xOTlMMjA0LjM5NywxOS44NjRMMjA0LjM5NywxOS44NjRMMjE0LjIzMiwxNi42OThaTTIxNC4yNzEsMjAuNTk0TDIxNy4yNjQsMjAuODE1TDIwNS4yMzcsMjkuOTZMMTk2LjgzNywzMy41NzRMMTkzLjA1MiwzOS44ODZMMTcyLjMwNCw0OS4wODlMMTY3Ljk1Myw0OC40NkwxNzcuMzA2LDM3LjgwMkwxOTEuNzQ1LDMzLjQ3OEwyMDAuMTMyLDI3LjYyMkwyMDAuOTY1LDI0LjI2MlpNMjM2Ljk4NiwxMC43ODVMMjI3LjQ2NSwxMy4xMTVMMjI0LjkxOCwxMy42ODFMMjI0LjkxOSwxMy42ODFMMjM0Ljk1NywxMS4yMzVaTTIzNS4xMTUsMTIuMDc4TDIyOC42NTEsMTMuNTg5TDIzNi40NzcsMTEuMDUzWk0zNzcuNTcxLDM1LjE2N0wzNjguMzM1LDM0LjgyNEwzNTguOTE2LDI2LjcxN0wzNTkuNjg0LDIxLjI4M0wzNjkuMDkzLDMyLjEwNVpNMjM0Ljg1MSwxMy45MjZMMjIwLjcyNSwxOS45MUwyMjMuMjI1LDE2LjkwOVpNMzEyLjEyOSwyMi4xMzhMMzE0LjE4MiwyNy42NTZMMzA1LjA0NiwyMi40MjlaTTM1Ni44NzMsMTMuMTE2TDM0OS41NTIsMTMuMjA0TDM0NS4wMjIsMTEuNzYxWk0yNDYuOSwxMi45MDdMMjQwLjc2MiwxMy4wODVMMjUwLjQ1OSwxMS4wMDRMMjU1LjM4MywxMC44NzZaTTI2NS45MzgsMTIuMzU2TDI2My44MTQsMTMuNzY0TDI0Ni41NTQsMTUuMjkzTDIyOS40OTQsMTcuODg5TDIzMC45NzIsMTUuNjQzTDI0NS4yNzYsMTMuNTA2TDI1OC41NDMsMTAuNTc3TDI2NC43NzEsMTEuMTk5Wk0yODIuMjQ4LDE1LjI3M0wyODMuNjYyLDE2LjdMMjc1Ljg3OCwxNi43NzNMMjc4LjUwOCwxOC45MzZMMjg2LjczOSwxOS4yOTNMMjc1Ljg2OSwyMy4yMDRMMjY2LjkzNiwzMi4wNTFMMjU2LjcwOCwzNS4yNDhMMjUzLjc4Myw0MS4zNjlMMjMzLjQwNCw0NS4wNDVMMjEzLjM1Myw0OS45NzdMMTg5LjY5MSw2NC4zMjFMMTg0LjQ4Myw2MC4zNjhMMTkyLjg4NCw1MC41M0wyMDEuNjYzLDQxLjU3TDIyMy41MDEsMjkuNjE0TDIzMy43MDMsMjMuNDc4TDIzMS42MzEsMjAuNTk3TDI0MS45MDYsMTYuNTMzTDI2NC40MjMsMTQuNDU2TDI3OC45MDIsMTQuNjQxWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjA1LjgzOCw1ODAuNjIzTDE5OC41NjgsNTc4LjA0OUwyMTkuOTksNTg0Ljk2TDIyNC40OTcsNTg2LjIwOEwyMjQuNDk2LDU4Ni4yMDhMMjE0LjU1NCw1ODMuMzk5Wk0yNjkuODgzLDU5NC40NjRMMjY5LjM4OSw1OTQuNDEzTDI3OC42NzQsNTk0Ljc0OEwyODQuOTMxLDU5NC4wMTJMMjkxLjIyNyw1OTIuNDk2TDMwNy43NTcsNTkyLjc5NkwzMjUuMzc0LDU5MC45NTJMMzQwLjg5LDU5MC4zMDhMMzU2LjI2OSw1ODguNjg1TDM2OC4wNzQsNTg1Ljg4OUwzNzQuNjU4LDU4NS4yOTdMMzkwLjM3Nyw1ODEuMzA3TDQwNS43NjIsNTc2LjI4MUw0MDMuNTk3LDU3Ny4yNzlMNDAzLjU5Nyw1NzcuMjc5TDM5My44NTcsNTgwLjcyNkwzODQuMDAzLDU4My44M0wzNzQuMDQ2LDU4Ni41ODlMMzYzLjk5OSw1ODguOTk5TDM1My44NzQsNTkxLjA1NkwzNDMuNjg0LDU5Mi43NTlMMzMzLjQ0LDU5NC4xMDVMMzIzLjE1NSw1OTUuMDkzTDMxMi44NDMsNTk1LjcyMUwzMDIuNTE0LDU5NS45ODlMMjkyLjE4Myw1OTUuODk3TDI4MS44NjEsNTk1LjQ0NEwyNzEuNTYxLDU5NC42MzFaTTUzNS44NzgsMzk2Ljk0M0w1MjUuMDA1LDQyNC45MDFMNTExLjc4LDQ1MS41NTRMNTAyLjYwOSw0NTMuNjhMNTA5Ljg5OSw0MzMuOTc5TDUxNS45NTgsNDEzLjQ5MlpNMTUzLjk4Nyw5NC44OTdMMTUyLjMxNSwxMDguMzM1TDEzNy45OTUsMTA0Ljk2NVpNMzA1LjM2Niw3Ny44MzRMMzE4LjEwNCwxMDYuNTdMMjk3LjQzMSwxMDkuMTAxWk0yODAuNDY0LDUzLjAxNUwyNjguODEyLDYxLjQxOUwyNTkuNTQ3LDU0LjUzOFpNNDgwLjIwNCwxMzAuMzE5TDQ5MC4yNTQsMTQ2LjA0TDUwMi4zNTUsMTQ1Ljk3M0w0ODguMjc1LDEzMC42MjFMNDczLjI1NywxMTYuMTE0TDQ2NS4zMzQsMTE3Ljk3MlpNNTczLjUsMTg2LjgwMkw1NzUuMjQ3LDE5MS41MzRMNTgwLjI0NiwyMDcuNjA1TDU4My43MywyMjQuMTc0TDU4Ny45NjcsMjQ1LjA0Nkw1OTAuNjYyLDI2Ni4yMTNMNTg1LjYzMSwyNDcuNzA5TDU3OC44NjcsMjI5LjUyMkw1NjkuMjc1LDIwNC4xMDRMNTYxLjc5NSwxOTYuNjk3TDU1My4zMjgsMTg5LjY4TDU0NS44NTcsMTk1LjAxNEw1MjYuNzI4LDE4Ny4zNzJMNTA0LjcxLDE4MS4xNjZMNTE1Ljg1MywxOTMuOTJMNTI2LjIyMywyMDcuMDU0TDUzNS42NjksMTk5LjQ2Nkw1NDcuNzkxLDIwOS41ODJMNTQ4LjgsMjI2Ljk4Nkw1NDEuMDM0LDI0Mi43NzNMNTMxLjQsMjU5LjAwNEw1MTYuMjY0LDI2OS40N0w1MDkuNDUyLDI0OS4wMTdMNDkwLjE3MiwyMjIuNzY0TDQ2OC4zNTIsMTk3LjU0Mkw0NTguODg2LDE5NS42NDdMNDY5Ljg0MiwyMTAuMTM2TDQ4MC4xNTMsMjI0Ljk2Nkw0ODkuNzc5LDI0MC4wODJMNDk4LjY4MywyNTUuNDI1TDUwOS43OTksMjY3Ljc2Nkw1MjAuMDgsMjgwLjIzNkw1NDAuMzI1LDI2Ny4zMDJMNTM2Ljg4OSwyOTIuMzE0TDUzMS41NzIsMzE3LjM4OEw1MjEuMzk2LDMzMy4zOTdMNTEwLjA1NiwzNDkuMjMxTDUwMy41NjUsMzY5LjczNkw1MDQuOTMsMzg5LjQxNkw1MDUuMTgyLDQwOC42MTJMNDkyLjEzNyw0MjIuNDk1TDQ3OC4yMzQsNDM1LjgzMkw0NzMuMzEsNDU2LjYwMUw0NTUuNDQ4LDQ3NS45NzRMNDM2LjM0OSw0OTMuOTQ4TDQxOS4wMzIsNDk5Ljc5N0w0MDEuMjE1LDUwNC44MDZMMzkxLjA0Niw0NzUuNjkzTDM4MS4yMDIsNDMwLjgxMUwzOTIuNTA0LDQwOC40MzNMMzg1Ljc4NiwzNzQuNTg2TDM3MC41NzYsMzU1LjU2MkwzNzUuNDczLDMzMy45OTFMMzQ3LjY3NywzMTguNTczTDI4Ny4wMywzMjkuMTUxTDI0MS43NTcsMjg3Ljc2M0wyNDIuMjUyLDI0Mi40NkwyNTYuNDUzLDIxNi41MjdMMjc5LjU5MSwxOTguOTQ0TDI5Ni4wOTcsMTcxLjM1NkwzMjcuNjg5LDE2Ni4yMzdMMzU4Ljk1MywxNjIuNzA2TDM2OC42NDYsMTgxLjI2NEw0MDQuMzMyLDE5My42MDJMNDA4LjYwOSwxODEuNDA3TDQ0MS43NTYsMTg3LjA0N0w0NjAuMjE4LDE4Mi45MzlMNDU3LjkzMywxNjAuNzc1TDQyOC4wODEsMTYwLjY3NUw0MTguMjc4LDE0OC42NzRMNDM4Ljc5NywxMzcuNzQzTDQ1Ny44MTEsMTI4LjU3TDQzOC43MjMsMTIyLjI1NEw0MTguODYsMTE2LjkzMUw0MjQuMTg3LDE0MC43NTFMNDA1LjA2NCwxNDUuMzU2TDQwNi4zMjMsMTYxLjk1MkwzOTEuNzU4LDE0MC45MDVMMzY0LjMyOCwxMjUuMzM0TDM4OS40OTYsMTQ3LjE5NEwzNzkuMDMzLDE0OS4zMTNMMzUwLjc5OSwxMzEuODQxTDMzMC40NzEsMTM4LjA4OUwzMTEuODE1LDE2Ny4wNzRMMjgzLjkwNCwxNjYuMTI0TDI4My40MjEsMTM4LjU1OUwzMTEuNjE2LDEzNi45MDNMMzExLjUzNywxMTUuMDkyTDMyNi41ODEsMTAzLjczM0wzNDEuNDgyLDkzLjQzNEwzNTguMjUsODkuNzc3TDM3NC43ODEsODYuOTc0TDM3MS45NzYsNzIuODE1TDM1OS44MjMsNjIuNDIzTDM1MS44MzMsODcuOTU1TDMzOS44MTcsNzQuMDg3TDMyOC41NDksNzcuNTQ0TDMyNC4xMzMsNjYuNDcyTDMzMy4xMDMsNTMuNjRMMzQxLjgzNiw0Mi41NzRMMzUyLjIyLDM3Ljk0N0wzNzkuMDM1LDQzLjQzNUwzODIuMDcyLDU0LjFMMzkyLjgxOSwzMy42NjVMNDA1Ljg5OSwzNC45OTFMMzkxLjM1OSwyOS41NzlMMzg5LjUwMywyMy43MkwzNzUuOTc1LDE3Ljc3OEwzNjguNjM5LDE0LjA1M0wzNjEuMTE0LDExLjEwOUwzNzMuNDg2LDEzLjc0OUwzNjYuMjg4LDExLjUxOEwzNjYuMjg4LDExLjUxOEwzNzYuMzE2LDE0LjAwN0wzODYuMjUsMTYuODQ1TDM5Ni4wOCwyMC4wMjdMNDA1Ljc5MiwyMy41NTFMNDE1LjM3NSwyNy40MTFMNDI0LjgxOCwzMS42MDRMNDM0LjEwOSwzNi4xMjRMNDQzLjIzNyw0MC45NjVMNDUyLjE5LDQ2LjEyMUw0NjAuOTU3LDUxLjU4N0w0NjkuNTI5LDU3LjM1Nkw0NzcuODkzLDYzLjQyTDQ4Ni4wNDIsNjkuNzczTDQ5My45NjMsNzYuNDA2TDUwMS42NDgsODMuMzExTDUwOS4wODgsOTAuNDgxTDUxNi4yNzIsOTcuOTA1TDUyMy4xOTQsMTA1LjU3Nkw1MjkuODQzLDExMy40ODRMNTM2LjIxMiwxMjEuNjE5TDU0Mi4yOTQsMTI5Ljk3MUw1NDguMDgsMTM4LjUzMUw1NTMuNTY0LDE0Ny4yODdMNTU4LjczOSwxNTYuMjI5TDU2My41OTksMTY1LjM0N0w1NjguMTM4LDE3NC42MjhMNTcyLjM1LDE4NC4wNjNaTTIxMS42NjcsMTcuNDg3TDE5Ni45MDEsMjIuODQyTDE5Mi45NTYsMjUuNzQ4TDE4OS40MjIsMjkuNzA3TDIwOC4xNDIsMjIuODMxTDE5Ni42MzcsMjguMzZMMTk2LjYzNywyOC4zNkwxODYuMzEsMzMuOTI5TDE5OS41NzYsMjkuMTk2TDE4OC4xMDMsMzYuMTU2TDE4My43NzQsMzUuODM1TDE2OS42ODUsNDAuMjc3TDE1Ni4wNTIsNDUuNjI3TDEzOS4zNDQsNTYuNjAxTDEzNS4wMDIsNjcuMjU2TDEyMy41LDc3LjIxTDE0NS4xNjksNjUuNzk5TDE1Ni42MTEsNTYuOTgzTDE2OC40MjYsNDguNzk4TDE3MC42MjksNTUuNTY2TDE2MS41MDcsNjQuNjU5TDE3My42NjYsNTkuNTgyTDE2Mi43MTUsNzIuOTcyTDE1OS40NzQsODkuODE5TDE0NC44Nyw5NC43NDRMMTMzLjc1Miw5MS42OUwxMjMuNjQ4LDEwNy41M0wxMzEuNzMyLDExMS4yMDVMMTEzLjUxNiwxMTcuNTk5TDEwNS44MTYsMTE0LjMwNkw5Mi4zMjYsMTIzLjg5NUw3OS42NDEsMTM0LjE2N0w3Mi42NywxNDQuMzE0TDYyLjIxNSwxNTIuNTc3TDUyLjYwMywxNjEuMzYxTDM5LjkzNiwxODYuOTk1TDQ4LjQ1NywxNjMuMjQ3TDQyLjMyNywxNTYuNzg4TDM3LjM4MiwxNjQuMDU3TDI2Ljc2NSwxODYuMzNMMTguNzMzLDIwOS43MDlMMjIuMzk4LDIwNC40MjJMMjcuMzI0LDE5OS41N0wyMS43NDEsMjEyLjM4NEwxNi45MDIsMjI1LjQzMkwyMC4xNzcsMjM0Ljc2N0wxNy40NTksMjUwLjk5OEwxNS42MywyNjcuMzgzTDMzLjcwOSwyNjQuNzM4TDU2LjQxNywyNzMuMzkyTDYxLjU3OSwyODcuMTlMNjcuNTQ2LDMwMS4wMzJMODEuNDEzLDMwNi44MzRMODguMjAzLDMyMi42NjJMOTUuNzk4LDMzOC40MDNMMTIyLjMyMSwzNTUuNjIxTDE1MS42MjYsMzcxLjk2NkwxNTMuMjU5LDM4OS40OTZMMTM5LjQ0Myw0MTAuOTA4TDEzNy4xNjMsNDMxLjY5OUwxMzYuMDMsNDUxLjU2M0wxMjEuMDQ4LDQ1NC4xNDFMMTE5Ljk2OCw0NzIuMzc1TDExNi4yMTIsNDg3LjIxMkwxMTQuMDE3LDUwMC40NThMMTA1Ljg3NSw1MDQuMzhMMTE0LjgxNSw1MTguMzg0TDEyNC44MzIsNTMxLjExN0wxMzIuMjcxLDUzOS44OTRMMTQwLjQxNCw1NDcuNjY1TDEyOS44MTYsNTQxLjMxM0wxMTguODMyLDUzMi43NjhMMTA4LjI4Niw1MjMuNjZMOTcuNjg3LDUxMi4zOTFMODcuOTA4LDUwMC4yNjFMNzguOTg4LDQ4Ny4zMkw3MC45NjQsNDczLjYyTDYzLjAwMyw0NTkuMDg0TDU1LjkzOSw0NDMuOTQ2TDQ5LjgsNDI4LjI2M0w0NC42MDcsNDEyLjA5NUwzNi40NzcsNDAxLjE2M0wyOS4yMDgsMzg5LjlMMTkuODkyLDM2My4zMDlMMTMuMjcxLDMzNi4xMDlMMTMuOTg5LDMwOS4zMUwxOC45MTgsMjk2LjE2OEwxNi41NTYsMjc0Ljg5NEwxNC4yNjcsMjU3Ljk0M0wxMy44NCwyNDEuMjY2TDE0LjE4LDIyOS45NDdMMTUuNzYsMjE4LjkzMkwxNy40NDMsMjExLjgwOUwxNy40NDMsMjExLjgwOUwyMC42OTMsMjAyLjAwMUwyNC4yODMsMTkyLjMxM0wyOC4yMSwxODIuNzU3TDMyLjQ2NywxNzMuMzQzTDM3LjA1LDE2NC4wODNMNDEuOTU0LDE1NC45ODlMNDcuMTcyLDE0Ni4wNzJMNTIuNjk4LDEzNy4zNDJMNTguNTI1LDEyOC44MUw2NC42NDcsMTIwLjQ4N0w3MS4wNTUsMTEyLjM4M0w3Ny43NDIsMTA0LjUwN0w4NC43LDk2Ljg3TDkxLjkyLDg5LjQ3OUw5OS4zOTQsODIuMzQ2TDEwNy4xMTMsNzUuNDc3TDExNS4wNjYsNjguODgyTDEyMy4yNDQsNjIuNTY5TDEzMS42MzgsNTYuNTQ1TDE0MC4yMzcsNTAuODE4TDE0OS4wMzEsNDUuMzk0TDE1OC4wMDgsNDAuMjhMMTY3LjE1OSwzNS40ODNMMTc2LjQ3MSwzMS4wMDhMMTg1LjkzNCwyNi44NjFMMTk1LjUzNiwyMy4wNDZMMjA1LjI2NSwxOS41NjlaTTIxOC44MTksMTYuMTU1TDIxMy4yOSwxOC45NjJMMTk5LjQzNCwyNC4yMDRMMTk3LjE3MywyMi44MDRMMjE0LjcyOCwxNi43NDlaTTIxNS4xNjgsMjMuMTg2TDIxOS4xOTQsMjMuM0wyMTEuNDYxLDMyLjc0NUwyMDMuNjA3LDM2LjYwNkwyMDIuNjE3LDQyLjk5TDE4Mi4zMDksNTIuODE3TDE3Ni41ODcsNTIuMzQxTDE4MS44MjUsNDEuNDYxTDE5Ny4yNzgsMzYuNjgzTDIwMy40ODUsMzAuNjA2TDIwMS4zNjMsMjcuMjY1Wk0yMTQuNzU0LDE2LjY3NkwyMjAuOTgxLDE0Ljc1MUwyMzAuNTQzLDEyLjQ0MkwyMjEuMTQ0LDE1LjQxNVpNMjMxLjI2OSwxNC4xMDhMMjI0LjkwMSwxNS44MTRMMjMwLjM1NywxMy4wNzZaTTM4Ni43MTUsMzIuNjcyTDM3OC41MTgsMzIuNTkzTDM2Ni40MTQsMjQuODEzTDM2NC4wMjIsMTkuNDAzTDM3Ny45NjEsMjkuODcxWk0yMzMuOTEsMTUuOTJMMjIyLjY2MywyMi4yOUwyMjIuNjU1LDE5LjI1Wk0zMjAuODg5LDIxLjYzNkwzMjUuNDM1LDI3LjA1NUwzMTQuMTYsMjIuMTM3Wk0zNTUuMTU2LDExLjQxNEwzNDkuMzc0LDExLjcwMUwzNDQuMjEsMTAuNDA2Wk0yNDcuMzgyLDE0LjUxM0wyNDAuMjM5LDE0Ljg5M0wyNDkuNDI5LDEyLjUyNEwyNTUuMDUzLDEyLjIzN1pNMjY4LjIwNywxMy4zNTdMMjY3LjA0NSwxNC44MTVMMjQ5LjE4NSwxNi44NzdMMjMxLjUxNiwyMC4wMDFMMjMxLjA4LDE3LjczOUwyNDYuMDkyLDE1LjE1NkwyNTguMzQyLDExLjg0TDI2NS45MTYsMTIuMjUyWk0yODcuNDMyLDE1LjczNEwyODkuNzY3LDE3LjEwM0wyODEuODIzLDE3LjQxNUwyODUuODA0LDE5LjQ3OEwyOTQuMzc1LDE5LjU3OUwyODUuMzQ0LDIzLjc5NEwyODAuMTExLDMyLjg1NkwyNzAuNzc0LDM2LjM1TDI3MC4wMDMsNDIuNTI3TDI0OS43ODUsNDYuODJMMjI5LjgxNSw1Mi4zNTlMMjA4LjM4Niw2Ny4zODhMMjAxLjIxLDYzLjYyM0wyMDcuMTU2LDUzLjU2N0wyMTMuNDI5LDQ0LjM3OUwyMzIuNDIsMzEuODAzTDI0MC40MjksMjUuMzlMMjM2LjE4NiwyMi42MDVMMjQ0LjkwNCwxOC4yNTNMMjY4LjIyLDE1LjQ4TDI4My41NzUsMTUuMjExWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjY5LjA4Nyw1OTQuMzgxTDI2OS4yMDUsNTk0LjM4N0wyNjkuMjA1LDU5NC4zODdMMjcwLjczNCw1OTQuNTVMMjcwLjczMyw1OTQuNTVaTTIyMC40MDksNTg1LjA5OUwyMTIuMzU2LDU4Mi40NzVMMjIyLjQxLDU4NS41MzZMMjIyLjQxLDU4NS41MzZMMjIyLjc5LDU4NS43NTNMMjIyLjc5LDU4NS43NTNaTTIyOS4wODcsNTg3LjM4TDIyOS40Myw1ODcuNDI4TDIwOS4xODUsNTgwLjk3TDIzMC4zOTcsNTg3LjIzM0wyNDEuOTY1LDU5MC4yMjlMMjQyLjMzNSw1OTAuMzI5TDI0Mi4zMzQsNTkwLjMyOUwyMzIuMjM3LDU4OC4xMzlaTTI4NC41NjUsNTk1LjU5N0wyNzguNzgsNTk1LjJMMjkwLjc3Myw1OTUuMjEyTDI5OS4yODUsNTk0LjI1MUwzMDcuOCw1OTIuNTExTDMyMy43NzYsNTkyLjMxN0wzNDEuOTk3LDU4OS45MjlMMzU2LjAwMiw1ODguODM2TDM2OS44MTgsNTg2Ljc3TDM4MS43MDUsNTgzLjYxNEwzODYuNDc5LDU4Mi44NDlMNDAyLjI0Miw1NzcuNzgxTDQwMi4yNDIsNTc3Ljc4MkwzOTIuNDg1LDU4MS4xODFMMzgyLjYxNiw1ODQuMjM3TDM3Mi42NDYsNTg2Ljk0N0wzNjIuNTg3LDU4OS4zMDhMMzUyLjQ1Miw1OTEuMzE2TDM0Mi4yNTQsNTkyLjk2OUwzMzIuMDAzLDU5NC4yNjVMMzIxLjcxNCw1OTUuMjAyTDMxMS4zOTksNTk1Ljc4TDMwMS4wNjksNTk1Ljk5OEwyOTAuNzM4LDU5NS44NTVaTTU2MC45MTUsMzg5LjM5NUw1NTUuOTc0LDQwMy42NzNMNTUwLjM2Myw0MTcuNjc5TDU0NC4wOTcsNDMxLjM3OEw1MzcuMTkzLDQ0NC43MzNMNTMwLjA3LDQ0Ny4xMDdMNTM4LjExNiw0MjcuMTczTDU0NC43NjQsNDA2LjQ5MlpNMTc2LjY0LDk4Ljk5TDE3Ny45MzYsMTEyLjQzM0wxNjAuNjk3LDEwOS41NDNaTTMzMi4wMjEsNzcuMjY2TDM0MS4yMDgsOTAuODczTDM1MC4xODYsMTA1LjUzM0wzMzAuMzk2LDEwOC42NzhaTTMwMS4wMTEsNTMuMjk2TDI5MS41NzUsNjIuMDIxTDI4MC4xOSw1NS40NTRaTTUwMC4xMSwxMjQuNTQyTDUxMS4xOTEsMTM5Ljk0MUw1MjAuNTQsMTM5LjU0OEw1MDYuNTExLDEyNC42MjNMNDkxLjQ1MywxMTAuNTczTDQ4NS41MDksMTEyLjY0MlpNNTkxLjY3OSwyNDkuNjFMNTg4LjYxNCwyMzUuMTY0TDU4NC40NTQsMjIwLjk2NEw1NzUuNDQsMTk1LjgyOEw1NzAuMzgzLDE4OC42MTJMNTY0LjMwOCwxODEuODE2TDU2MC42ODcsMTg3LjMxOEw1NDYuMTE3LDE4MC4xODlMNTI4LjQxLDE3NC41ODZMNTM4Ljg4MSwxODcuMDExTDU0OC40OTcsMTk5Ljg0Mkw1NTQuNDA0LDE5Mi4wMjFMNTY0LjI2OSwyMDEuODAzTDU2Ny4yMzQsMjE5LjE0Nkw1NjMuMzUsMjM1LjExMUw1NTcuNDI1LDI1MS41NzhMNTQ2LjIyMywyNjIuNDQ0TDUzOS40MjEsMjQyLjE5OEw1MzAuODA5LDIyOS4yMzZMNTIxLjQyNSwyMTYuNTExTDUxMS4zMDIsMjA0LjA2NUw1MDAuNDczLDE5MS45MzlMNDkyLjEyNywxOTAuMzE1TDUwMy4wNTYsMjA0LjQ3MUw1MTMuMjEzLDIxOC45OUw1MjIuNTU5LDIzMy44MTdMNTMxLjA2LDI0OC44OTZMNTQwLjkyLDI2MC45MTlMNTQ5LjgyMiwyNzMuMDk3TDU2NC43MDUsMjU5LjYyOUw1NjMuMzgxLDI4NC43MTRMNTU5Ljk2NiwzMDkuOTJMNTUyLjE0OSwzMjYuMjAzTDU0My4wMDUsMzQyLjM0OEw1MzcuMzM1LDM2My4wMzdMNTM3LjY4NCwzODIuNjkyTDUzNi43NDMsNDAxLjg5OEw1MjUuMjIxLDQxNi4xNTVMNTEyLjY5Myw0MjkuODkzTDUwNi40OTEsNDUwLjgzTDQ4OS4yMTUsNDcwLjczOEw0NzAuNDMzLDQ4OS4yODdMNDU0LjU2Miw0OTUuNjQxTDQzOC4wNCw1MDEuMTcxTDQzMi42MDYsNDcyLjI5NUw0MzAuNDY4LDQ1MC42NTVMNDI3LjE0NSw0MjcuNjQ2TDQzOC43MzIsNDA0LjkyTDQzMy40NjksMzcxLjI1NUw0MTkuNDExLDM1Mi42NzVMNDIzLjk1MSwzMzAuOTYxTDM5Ny4zNywzMTYuMzdMMzM4LjQzLDMyOC43NjRMMjkxLjg1OSwyODguNzcyTDI5MC4wNTUsMjQzLjQ4OUwzMDIuNTg3LDIxNy4xNDlMMzI0LjMwMywxOTguODg1TDMzNy44NjEsMTcwLjg0TDM2OC4xNDIsMTY0Ljc4MUwzOTcuNjE0LDE2MC4zMjdMNDA4Ljg4LDE3OC41NjdMNDQzLjI3NSwxODkuODQxTDQ0NS44ODEsMTc3LjU0MUw0NzYuMjE1LDE4Mi4yMTdMNDkxLjgxNSwxNzcuNTlMNDg2LjkxNiwxNTUuNTM2TDQ2MC44NTUsMTU2LjI4NUw0NTAuNDM0LDE0NC41OTJMNDgxLjQ2MSwxMjMuNDE1TDQ2NC4wNTEsMTE3LjY1NEw0NDUuNzI0LDExMi45MTFMNDU0LjUwNywxMzYuNTE3TDQzOC4wNDksMTQxLjY2M0w0NDEuNDY0LDE1OC4xODhMNDI1LjI2MywxMzcuNjA4TDM5Ny40NDIsMTIyLjg3Nkw0MjQuMDksMTQzLjk0OUw0MTQuNzA4LDE0Ni4zN0wzODUuNjk4LDEyOS43NjdMMzY3LjE3OSwxMzYuNjA2TDM1Mi44MSwxNjYuMDkyTDMyNS4xNzQsMTY1Ljk4NkwzMjEuMTM3LDEzOC40OUwzNDguNzE3LDEzNS45ODdMMzQ1LjI2NCwxMTQuMjI5TDM3MC4xNzcsOTEuNzM4TDM4NS4yNCw4Ny41OTdMMzk5Ljk1Nyw4NC4zMkwzOTQuMDU1LDcwLjI5M0wzODAuMTU3LDYwLjI5N0wzNzguODM5LDg1Ljk3TDM2NC4zOTEsNzIuNTA0TDM1NC40NDEsNzYuMjgzTDM0Ny41NTMsNjUuMzgzTDM1Ny4zNzgsNDEuMDY3TDM2NS4zMDMsMzYuMTYyTDM5MS40MTgsNDAuODQ2TDM5Ny44NDMsNTEuMzY3TDM5OC43NjMsMzkuODE1TDM5OC43MzcsMzAuNzU1TDQwOS43MzQsMzEuNzE1TDM5NS4yMTksMjYuNzQ0TDM4OS41OTgsMjAuOTk5TDM3NC4zMjIsMTUuNDk1TDM2NC43NDYsMTIuMDI3TDM1NC45OTIsOS4zNDVMMzY2LjU4MSwxMS42MjFMMzYzLjU5NywxMC45MTNMMzYzLjU5OCwxMC45MTNMMzczLjY0OCwxMy4zMDlMMzgzLjYwOCwxNi4wNTNMMzkzLjQ2NywxOS4xNDRMNDAzLjIxMiwyMi41NzdMNDEyLjgzMSwyNi4zNDhMNDIyLjMxMiwzMC40NTNMNDMxLjY0NSwzNC44ODZMNDQwLjgxNywzOS42NDFMNDQ5LjgxOCw0NC43MTVMNDU4LjYzNiw1MC4wOTlMNDY3LjI2MSw1NS43ODdMNDc1LjY4Miw2MS43NzNMNDgzLjg4OSw2OC4wNUw0OTEuODcxLDc0LjYwOEw0OTkuNjIxLDgxLjQ0Mkw1MDcuMTI3LDg4LjU0Mkw1MTQuMzgsOTUuODk5TDUyMS4zNzMsMTAzLjUwNUw1MjguMDk1LDExMS4zNTFMNTM0LjU0LDExOS40MjZMNTQwLjY5OSwxMjcuNzIxTDU0Ni41NjUsMTM2LjIyN0w1NTIuMTMsMTQ0LjkzMUw1NTcuMzg5LDE1My44MjVMNTYyLjMzMywxNjIuODk3TDU2Ni45NTgsMTcyLjEzNkw1NzEuMjU4LDE4MS41M0w1NzUuMjI3LDE5MS4wNjlMNTc4Ljg2MSwyMDAuNzQxTDU4Mi4xNTYsMjEwLjUzNEw1ODUuMTA2LDIyMC40MzVMNTg3LjcwOSwyMzAuNDM0TDU4OS45NjIsMjQwLjUxN1pNMjA5LjA3NCwxOC4zMTFMMjA5LjA2OCwxOC40OTdMMTkyLjMzOSwyNi4wNDRMMTkxLjIwNywzMy4wNEwyMDkuNDgsMjUuNjAyTDE5OS42MDYsMzEuNDU2TDE5OS42MDYsMzEuNDU2TDE5MC42ODksMzcuMzE3TDIwNC4wMTMsMzIuMThMMTk0LjUwOCwzOS40NTlMMTg4LjgxOSwzOS4yOUwxNzMuNDc0LDQ0LjE3OUwxNTguNTcxLDQ5Ljk2M0wxNDMuMTAyLDYxLjQyNkwxNDMuOTc5LDcyLjEzM0wxMzMuNTk1LDgyLjQyTDE1Ni40OTUsNzAuMzMxTDE3Ny4zNjMsNTIuNjZMMTgzLjI2Niw1OS4zMDVMMTc2LjA1LDY4LjY0NkwxODguNDY1LDYzLjE5NkwxODAuNDAxLDc2Ljg3NUwxODEuNTkzLDkzLjc1MkwxNjYuMDY2LDk5LjEzNkwxNTIuMDE5LDk2LjQ2NEwxNDQuMzg3LDExMi41NzRMMTU0Ljg5OSwxMTUuOTY2TDEzNC43NzIsMTIyLjk0MkwxMjQuNDA3LDExOS45MjNMMTEwLjAyMiwxMjkuOTM2TDk2LjM3MywxNDAuNjA5TDg5LjkyNSwxNTAuOTU5TDc3LjkxLDE1OS41NjNMNjYuNjgxLDE2OC42NjRMNTUuMDAzLDE5NC42NjhMNjAuOTk5LDE3MC43TDQ2LjQ4NCwxNjQuNTU0TDM5LjQ4NiwxNzIuMDA1TDI4LjUzNSwxOTQuNjA1TDIzLjQ5NSwyMTguMTgyTDMwLjE3NCwyMTIuNzM5TDM4LjA3OSwyMDcuNjkyTDMxLjg5NiwyMjAuNjg0TDI2LjQzMSwyMzMuODg5TDM0LjYyNSwyNDMuMDVMMzIuODIzLDI1OS4zNDlMMzEuODYyLDI3NS43NzdMNTcuOTU1LDI3Mi40Nkw4Ny43MTMsMjgwLjMxOEwxMDIuNDQ1LDMwNy41NjRMMTE5LjA1MiwzMTIuOTA0TDEzNi4xMSwzNDMuOTk2TDE2Ni4wNDksMzYwLjM1NUwxOTguMDg2LDM3NS43NjlMMTk5LjM5NywzOTMuMjUzTDE4My4yODgsNDE1LjEyMUwxNzYuMzIxLDQ1NS45MzNMMTU4LjkyNiw0NTkuMDAyTDE1NS4yMDUsNDc3LjMxTDE0Mi4yNjcsNTA1LjY4TDEzMC40MzUsNTA5LjkwNkwxMzcuMDQ1LDUyMy42NzNMMTQ0LjYwNCw1MzYuMTM5TDE0OS41NzMsNTQ0LjcyOEwxNTUuMTczLDU1Mi4yOUwxNDMuMTg5LDU0Ni4yODFMMTMyLjgzOCw1MzguMDZMMTIyLjg5Miw1MjkuMjY0TDExMy45NTMsNTE4LjI5MUwxMDUuNzY4LDUwNi40MzRMOTguMzcsNDkzLjc0MUw5MS43ODksNDgwLjI2M0w4NC44MDEsNDY1Ljk1NEw3OC42MjksNDUxLjAxN0w3My4yOTQsNDM1LjUwOUw2OC44MTgsNDE5LjQ4N0w1OC43NjcsNDA4LjgzMUw0OS41MDUsMzk3LjgyTDM4LjMyNSwzNzEuNTRMMjkuNjY0LDM0NC41NzJMMzEuNTU3LDMxNy43MzRMMzguOTI2LDMwNC40MDRMMzQuMDQ2LDI4My4yNDFMMjguNDI4LDI2Ni40MUwyNC41NzksMjQ5Ljc5OEwyMS44NTksMjM4LjUxNUwyMC4zNDUsMjI3LjQ5OUwxOC44OTYsMjE4LjQwOUwxOS4wNTQsMjA5Ljc4N0wyNy4xMiwxODYuMzA4TDM1Ljc5NSwxNjYuNTM5TDM1Ljc5NSwxNjYuNTM5TDQwLjYxNCwxNTcuNEw0NS43NDksMTQ4LjQzNEw1MS4xOTMsMTM5LjY1M0w1Ni45NDEsMTMxLjA2OEw2Mi45ODQsMTIyLjY4OEw2OS4zMTcsMTE0LjUyNEw3NS45MywxMDYuNTg2TDgyLjgxNyw5OC44ODRMODkuOTY4LDkxLjQyN0w5Ny4zNzUsODQuMjI0TDEwNS4wMjksNzcuMjg0TDExMi45Miw3MC42MTZMMTIxLjA0LDY0LjIyNkwxMjkuMzc3LDU4LjEyNEwxMzcuOTIyLDUyLjMxN0wxNDYuNjY1LDQ2LjgxMUwxNTUuNTk1LDQxLjYxNEwxNjQuNywzNi43MzJMMTczLjk3MSwzMi4xNzFMMTgzLjM5NCwyNy45MzVMMTkyLjk2LDI0LjAzMkwyMDIuNjU3LDIwLjQ2NFpNMjE1LjE1MiwxOC42NzhMMjExLjg0MiwyMS42MThMMTk5LjEzMywyNy4yNjRMMTkyLjgyNSwyNS45OTVMMjA5LjMwNywxOS40MjNaTTIxOC42NDIsMjUuNzExTDIyMy41NzksMjUuNjg4TDIyMC4zNzUsMzUuM0wyMTMuMzA2LDM5LjM4OEwyMTUuMTQxLDQ1Ljc1OUwxOTUuODg5LDU2LjE4N0wxODguOTcxLDU1LjkwM0wxODkuOTM1LDQ0LjkyOUwyMDUuOTMyLDM5LjY3M0wyMDkuNzcxLDMzLjQ0M0wyMDQuNzU4LDMwLjIxMVpNMjA5LjAwMSwxOS4zNTNMMjEzLjk2MSwxNy4yNThMMjI0LjY1NywxNC42NDJMMjE3LjIxOSwxNy44N1pNMjI5LjUxMSwxNi4yMjNMMjIzLjQzMywxOC4xMThMMjI2LjM1MywxNS4yNTNaTTM5My4yMjUsMjkuOTM4TDM4Ni4zMTUsMzAuMDg5TDM3MS44OTUsMjIuNzEyTDM2Ni40MTUsMTcuNDIyTDM4NC40NjEsMjcuNDAzWk0yMzQuOTc4LDE3LjkxMUwyMjYuOTUxLDI0LjU3NEwyMjQuNDM1LDIxLjU3M1pNMzI5LjAxNSwyMC44NzhMMzM1LjkxNCwyNi4xMjNMMzIyLjg0NCwyMS41NzVaTTM1MS43NjIsOS43OUwzNDcuNjk2LDEwLjIyNkwzNDIuMDU0LDkuMDk1Wk0yNDkuNDYyLDE2LjA4TDI0MS41MzIsMTYuNjg5TDI0OS45MzUsMTQuMDUzTDI1Ni4wODksMTMuNTg3Wk0yNzEuNDQzLDE0LjI3M0wyNzEuMjc3LDE1Ljc1MkwyNTMuMzYsMTguMzU4TDIzNS42MTgsMjIuMDE5TDIzMy4yODEsMTkuNzk5TDI0OC41NDUsMTYuNzU3TDI1OS40MDYsMTMuMDlMMjY4LjA5NywxMy4yNTVaTTI5Mi45OTgsMTYuMDMxTDI5Ni4xODMsMTcuMzE3TDI4OC4zMiwxNy44NjlMMjkzLjUzMSwxOS43OTJMMzAyLjE4MiwxOS42MzJMMjk1LjI2NCwyNC4wODhMMjkzLjg5LDMzLjI1MUwyODUuNzI5LDM3LjAxMUwyODcuMTM0LDQzLjE3OEwyNjcuNjkyLDQ4LjA3NEwyNDguNDEsNTQuMjA5TDIyOS44NjUsNjkuODQ2TDIyMC45MzgsNjYuMzI1TDIyNy44MjYsNDYuNzlMMjQzLjM5MiwzMy42OUwyNDguOTY1LDI3LjA3MUwyNDIuNjc5LDI0LjQ0NkwyNDkuNTc2LDE5Ljg1NkwyNzIuOTgyLDE2LjM3M0wyODguNzQ3LDE1LjYzMVoiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjc3LjM2NCw1OTUuMTMzTDI3OC44NzgsNTk1LjE3NkwyNzguODc4LDU5NS4xNzZMMjgyLjM5MSw1OTUuNDc2TDI4Mi4zOTEsNTk1LjQ3NlpNMjMzLjU3Niw1ODcuNzI0TDIzMi4xMzIsNTg3Ljk4MkwyMjQuMjQ1LDU4NC45NThaTTIzNS4xMTgsNTg4LjgwMkwyMzYuMjc3LDU4OS4wNThMMjM5Ljk0OSw1ODkuNDEzTDIyMi41NjEsNTgzLjUyNkwyNDIuOTE5LDU4OS4xNTdMMjUyLjI1Nyw1OTEuODM2TDI1MS4zMSw1OTEuOTY4TDI1MS4zMSw1OTEuOTY4TDI0MS4xNSw1OTAuMDkxWk0yOTUuMzMxLDU5NS45NjNMMjg4LjgxNSw1OTUuNjkzTDMwMy4xNTIsNTk1LjMwNEwzMTMuNjYxLDU5NC4wNTVMMzI0LjEzNSw1OTIuMDI2TDMzOS4wNzIsNTkxLjM2MkwzNTcuMzQzLDU4OC40MkwzNjkuNDEyLDU4Ni45M0wzODEuMjQ2LDU4NC40NzVMMzkyLjg1Myw1ODAuOTYyTDM5NC42ODEsNTgwLjQ0OUwzOTQuNjgxLDU4MC40NDlMMzg0LjgzNiw1ODMuNTgyTDM3NC44ODcsNTg2LjM3TDM2NC44NDcsNTg4LjgwOUwzNTQuNzI5LDU5MC44OTZMMzQ0LjU0Myw1OTIuNjI5TDMzNC4zMDMsNTk0LjAwNkwzMjQuMDIyLDU5NS4wMjRMMzEzLjcxMSw1OTUuNjgyTDMwMy4zODQsNTk1Ljk4MVpNNTc4LjAyMywzODEuMjA4TDU3My40MjYsMzk1LjYzTDU2OC4xMTMsNDA5LjgwMkw1NjIuMSw0MjMuNjg3TDU1NS40LDQzNy4yNDlMNTUwLjU0MSw0MzkuODA2TDU1OS4wOTgsNDE5LjYxOUw1NjYuMTM0LDM5OC43MzFMNTcyLjQ1NywzOTAuMDk0Wk0yMDMuMDQsMTAyLjMzN0wyMDcuMjY2LDExNS42OTZMMTg3LjYzMSwxMTMuMzY2Wk0zNTcuNzA0LDc1LjkwM0wzNjkuMzk5LDg5LjE5M0wzODAuNzQ0LDEwMy41NDRMMzYyLjQzOCwxMDcuMjY4Wk0zMjEuNTI3LDUyLjk1NEwzMTQuNTkzLDYxLjkyN0wzMDEuNDM1LDU1LjczM1pNNTEzLjkzNiwxMTguMjUxTDUyNS43MTEsMTMzLjMwNEw1MzIuMDIzLDEzMi42NzNMNTE4LjQ3MywxMTguMTY3TDUwMy44MzIsMTA0LjU2OEw1MDAuMDQ4LDEwNi43ODVaTTU3MC42MTQsMTgwLjA2Nkw1NjcuMjU2LDE3My43NEw1NjcuNTk3LDE3OS4yOTJMNTYzLjIzMiwxNzUuNzEzTDU1OC4wMjcsMTcyLjUyOUw1NDUuMTcxLDE2Ny4zOTFMNTU0LjY1MSwxNzkuNTE0TDU2My4yMiwxOTIuMDY4TDU2NS40MSwxODQuMTI0TDU3Mi43MTcsMTkzLjY0NUw1NzcuNTQ4LDIxMC44N0w1NzcuNjY0LDIyNi44OTFMNTc1LjYyOCwyNDMuNDhMNTY4LjcwMSwyNTQuNjIxTDU2Mi4xMTYsMjM0LjU3OEw1NTQuNDU5LDIyMS44NjRMNTQ1Ljk1MSwyMDkuNDExTDUzNi42MjIsMTk3LjI2TDUyNi41MDMsMTg1LjQ1Mkw1MTkuNTMxLDE4NC4wNjFMNTMwLjEsMTk3Ljg5TDUzOS43OTQsMjEyLjEwOEw1NDguNTc3LDIyNi42Nkw1NTYuNDE2LDI0MS40OUw1NjQuNzIxLDI1My4yMzdMNTcxLjk3MiwyNjUuMTdMNTc3LjAyOSwyNTguMTc1TDU4MS4wNDIsMjUxLjMzOEw1ODEuODcsMjc2LjQzMUw1ODAuNDYxLDMwMS43MUw1NzUuMjQsMzE4LjE5MUw1NjguNTcxLDMzNC41NzZMNTYzLjg5MywzNTUuNDIzTDU2My4yMTUsMzc1LjA4Mkw1NjEuMTEsMzk0LjMzNUw1NTEuNDYxLDQwOC45MTNMNTQwLjY5LDQyMy4wMDVMNTMzLjM5OCw0NDQuMTQ4TDUxNy4yMzIsNDY0LjU2M0w0OTkuMzM5LDQ4My42NjlMNDg1LjM5NSw0OTAuNDc2TDQ3MC42NzEsNDk2LjQ4MUw0NzAuODg1LDQ4Mi42MDJMNDcwLjEzNiw0NjcuNjk1TDQ3MC40NTUsNDQ2LjA4M0w0NjkuMjI1LDQyMy4xNDNMNDgwLjc0Niw0MDAuMDY2TDQ3Ny4wOTcsMzY2LjUzN0w0NjQuNjE4LDM0OC4zNkw0NjguNjYyLDMyNi41MTZMNDQ0LjEwNCwzMTIuNzAxTDM4OC42NjIsMzI2LjgzM0wzNDIuMjA3LDI4OC4yNTRMMzM4LjE2MSwyNDMuMDZMMzQ4LjY0NCwyMTYuMzcxTDM2OC4yNzcsMTk3LjQ3OEwzNzguNDc0LDE2OS4wNzJMNDA2LjUyNCwxNjIuMTI3TDQzMy4zMDksMTU2LjgxOUw0NDUuODA2LDE3NC42OThMNDc3Ljg2NSwxODQuOTYyTDQ3OC43MTksMTcyLjYwOUw1MDUuMzIsMTc2LjQyTDUxNy41ODQsMTcxLjM3MUw1MTAuMjIsMTQ5LjUwM0w0ODguNzQyLDE1MC45NzRMNDc4LjAxOSwxMzkuNjAyTDQ5OS41OTgsMTE3LjYyNkw0ODQuMzk1LDExMi4zNkw0NjguMTYyLDEwOC4xNDNMNDgwLjEzMiwxMzEuNDMzTDQ2Ni44MzksMTM3LjAzMUw0NzIuMzA3LDE1My40MjFMNDU0Ljk2MywxMzMuMzUxTDQyNy41OTUsMTE5LjQ1N0w0NDEuNDg5LDEyOS4zMDFMNDU0LjkxMywxMzkuNzFMNDQ2Ljg5OCwxNDIuMzk2TDQxNy45OTMsMTI2LjY3Mkw0MDEuODQ2LDEzNC4wMzhMMzkyLjIsMTYzLjg4OUwzNjUuNjc4LDE2NC42MDZMMzU4LjIxMSwxMzcuMjg0TDM4NC4zMzcsMTMzLjk2NUwzNzcuNjE1LDExMi4zNjJMMzk2Ljc0LDg5LjIwMkw0MjIuMDk2LDgwLjk0Nkw0MTMuMjc3LDY3LjE0M0wzOTguMDU3LDU3LjU4OUw0MDEuMDIyLDY5Ljc4NEw0MDMuNDUsODMuMjAxTDM4Ny4wMDgsNzAuMjA0TDM3OC42NzksNzQuMjYxTDM2OS41MjgsNjMuNjA0TDM3MS4xNzcsMzkuMTE0TDM3Ni40MDEsMzQuMDA5TDQwMS4wMjQsMzcuOTIyTDQxMC42NDIsNDguMTk5TDQwNi42NTksMzYuNjk0TDQwMS42NTUsMjcuNzExTDQxMC4yMzQsMjguMzczTDM5Ni4xODUsMjMuODM2TDM4Ni45NzEsMTguMzE2TDM3MC40MTEsMTMuMjk2TDM1OC44ODUsMTAuMTQ5TDM0Ny4xOTksNy43OTNMMzQ5LjUzNCw4LjE3NEwzNDkuNTM1LDguMTc0TDM1OS42ODksMTAuMDgxTDM2OS43NzEsMTIuMzRMMzc5Ljc2OCwxNC45NTFMMzg5LjY2NywxNy45MDhMMzk5LjQ1NywyMS4yMDlMNDA5LjEyNiwyNC44NUw0MTguNjYyLDI4LjgyNkw0MjguMDU0LDMzLjEzM0w0MzcuMjg5LDM3Ljc2NEw0NDYuMzU4LDQyLjcxNUw0NTUuMjQ4LDQ3Ljk4TDQ2My45NDksNTMuNTUxTDQ3Mi40NSw1OS40MjNMNDgwLjc0MSw2NS41ODhMNDg4LjgxMSw3Mi4wMzlMNDk2LjY1Miw3OC43NjdMNTA0LjI1Myw4NS43NjVMNTExLjYwNSw5My4wMjRMNTE4LjcsMTAwLjUzNUw1MjUuNTI4LDEwOC4yODlMNTMyLjA4MSwxMTYuMjc2TDUzOC4zNTIsMTI0LjQ4OEw1NDQuMzMyLDEzMi45MTNMNTUwLjAxNCwxNDEuNTQyTDU1NS4zOTIsMTUwLjM2NEw1NjAuNDU5LDE1OS4zNjhMNTY1LjIwOCwxNjguNTQ0TDU2OS42MzQsMTc3Ljg3OVpNODAuMzM5LDEwMS41OTRMOTIuODM5LDg4LjU5OUwxMDYuMTMxLDc2LjQxMkwxMjcuNjE1LDU5LjM3N0wxMjcuNjE1LDU5LjM3N0wxMzYuMTE4LDUzLjUwOEwxNDQuODIsNDcuOTM4TDE1My43MTEsNDIuNjc2TDE2Mi43ODEsMzcuNzI3TDE3Mi4wMTgsMzMuMDk4TDE4MS40MSwyOC43OTRMMTkwLjk0NywyNC44MjFMMjAwLjYxOCwyMS4xODNMMjEwLjQwOSwxNy44ODRMMjEyLjU3MSwxNy4yMDZMMjAwLjg0OSwyMS4yNjFMMjAzLjcwMiwyMS4zNDJMMTkxLjA0OCwyOS4zMzVMMTk2LjI5OCwzNi4yNjhMMjEzLjU2OCwyOC4yOUwyMDUuNjI0LDM0LjQxNUwyMDUuNjI0LDM0LjQxNUwxOTguMzg5LDQwLjUyMUwyMTEuMzY3LDM0Ljk4NEwyMDQuMTE5LDQyLjUxOEwxOTcuMjQzLDQyLjU0TDE4MS4xMDcsNDcuOTA4TDE2NS4zODYsNTQuMTU2TDE1MS42MjgsNjYuMDYzTDE1Ny42OTgsNzYuNjY1TDE0OC43NDYsODcuMjQ2TDE3Mi4xODIsNzQuNDUzTDE5MC4wMjYsNTYuMTk0TDE5OS40NSw2Mi42MDZMMTk0LjM1OSw3Mi4xMzRMMjA2LjY1Myw2Ni4zMDhMMjAxLjcyMSw4MC4xODVMMjA3LjMxMSw5Ni45NTlMMTkxLjMzMiwxMDIuODIxTDE3NC43ODIsMTAwLjYxNUwxNjkuODUzLDExNi45MTVMMTgyLjQ3NCwxMTkuOTU1TDE2MS4wNDgsMTI3LjU2NEwxNDguMzMzLDEyNC44OTVMMTMzLjQ5LDEzNS4zNTJMMTE5LjI5MiwxNDYuNDQ3TDExMy41NjQsMTU2Ljk4M0wxMDAuMzUzLDE2NS45N0w4Ny44NDksMTc1LjQzMkw3Ny41MTQsMjAxLjc3TDgwLjgwMywxNzcuNjYxTDU4LjM0NCwxNzIuMDc3TDQ5LjUwNSwxNzkuNzY4TDM4LjU1NCwyMDIuNzAxTDM2LjY1OCwyMjYuMzg0TDQ2LjE0OCwyMjAuNjk1TDU2Ljc5MiwyMTUuMzY2TDQ0LjI3MiwyNDEuOTNMNTcuMTM2LDI1MC43NzFMNTYuMzA1LDI2Ny4xMUw1Ni4yNDEsMjgzLjU1M0w4OS41NTYsMjc5LjMzNUwxMjUuNDU5LDI4Ni4xOTVMMTQzLjM0OCwzMTIuOTQ2TDE2Mi4xODgsMzE3Ljc0N0wxODEuNDAyLDM0OC4yODdMMjEzLjg0NywzNjMuNjk5TDI0Ny42NDIsMzc4LjExM0wyNDguNTkzLDM5NS41NjNMMjMwLjY3OSw0MTcuOTQ3TDIyMC4zNyw0NTkuMDIyTDIwMS4wOTEsNDYyLjY0OEwxOTQuODQxLDQ4MS4xMDdMMTc1LjMwOSw1MDkuOTcxTDE2MC4xNDcsNTE0LjYwNkwxNjQuMjI3LDUyOC4yMTJMMTY5LjA5Nyw1NDAuNDg5TDE3MS40NDYsNTQ4Ljk2NkwxNzQuMzMzLDU1Ni40TDE2MS4zMjYsNTUwLjc3TDE0Mi44NzksNTM0LjM0MUwxMzUuODcyLDUyMy42MTFMMTI5LjUzLDUxMS45NzVMMTIzLjg3OCw0OTkuNDhMMTE4LjkzOSw0ODYuMTc3TDExMy4xMzgsNDcyLjA2M0wxMDguMDQ0LDQ1Ny4yOTdMMTAzLjY3Nyw0NDEuOTM1TDEwMC4wNTMsNDI2LjAzN0w4OC4zODcsNDE1LjcxMUw3Ny40MTMsNDA1LjAwN0w2NC43MDksMzc5LjA5TDU0LjI3MSwzNTIuNDEyTDU3LjI4MSwzMjUuNDk5TDY2Ljg2NiwzMTEuOTEyTDU5LjYxNiwyOTAuOTMzTDUwLjg0LDI3NC4zMjFMNDMuNjg3LDI1Ny44NzZMMzcuOTg5LDI0Ni43MjFMMzMuNDI4LDIzNS43OTdMMjguMjM3LDIyNi44MDlMMjQuNiwyMTguMjM5TDMwLjQxNCwxOTQuNTQ5TDM2LjEsMTczLjYxOUw0NC4wOCwxNTMuNzg4TDM2LjEzNywxNzEuMDU1TDI5LjU2NCwxODguOTkxTDMyLjcyOSwxNzguMDUzTDM2LjYwOCwxNjcuNDQyTDQzLjk0NywxNTMuMTVMNTIuMDgyLDEzOS4zMTRMNjAuNjc3LDEyNi4wNTRMNzAuMTgxLDExMy40NTRMNzAuMTgyLDExMy40NTRMNzYuODMyLDEwNS41NDdaTTIxNC4wNjQsMjEuMjcyTDIxMy4wNzQsMjQuMjc4TDIwMS44OTYsMzAuMjg3TDE5MS43MzQsMjkuMjY4TDIwNi42NDEsMjIuMjE5Wk0yMjQuNTg4LDI4LjA5MkwyMzAuMjg3LDI3LjkwOUwyMzEuNzA5LDM3LjU0N0wyMjUuNjM5LDQxLjgzNEwyMzAuMjQzLDQ4LjEwOEwyMTIuNjMyLDU5LjA5NkwyMDQuNzI5LDU5LjAzN0wyMDEuMzksNDguMDk5TDIxNy40NDUsNDIuMzU2TDIxOC43OTgsMzYuMDQ3TDIxMS4wNDcsMzMuMDA5Wk0yMDYuMDE0LDIyLjE2NEwyMDkuNTU0LDE5Ljk0TDIyMS4wNjEsMTYuOTg2TDIxNS44MDksMjAuNDA3Wk0yMjkuODk1LDE4LjM1OUwyMjQuMjkxLDIwLjQzMkwyMjQuNTg3LDE3LjUxOFpNMzk2LjkwMywyNy4wNDlMMzkxLjQ5LDI3LjM4N0wzNzUuMTkxLDIwLjQ3N0wzNjYuNzksMTUuMzk4TDM3Ny42ODcsMTkuNzQ3TDM4OC4zOTQsMjQuNzc3Wk0yMzguMDIxLDE5Ljg0MUwyMzMuNDU4LDI2LjY5NUwyMjguNTExLDIzLjgwN1pNMzM2LjI1OSwxOS44ODZMMzQ1LjMwMywyNC44ODlMMzMwLjgzMywyMC43NTlaTTM0Ni43OTYsOC4yOTJMMzQ0LjU2OCw4LjgyNEwzMzguNjIxLDcuODY5Wk0yNTMuMDc4LDE3LjU2MUwyNDQuNjAxLDE4LjQxOUwyNTEuOTYzLDE1LjU0NEwyNTguNDU5LDE0Ljg4NVpNMjc1LjU0NiwxNS4wNzlMMjc2LjM4MiwxNi41NDdMMjU4Ljk1MywxOS42OUwyNDEuNjc3LDIzLjg4NEwyMzcuNTA5LDIxLjc2MkwyNTIuNTYyLDE4LjI1OUwyNjEuNzA0LDE0LjI4OEwyNzEuMjQ3LDE0LjE3NlpNMjk4Ljc3NiwxNi4xNTZMMzAyLjcxNSwxNy4zMzRMMjk1LjE3MiwxOC4xMkwzMDEuNDU1LDE5Ljg2OEwzMDkuOTIzLDE5LjQ0OEwzMDUuMzI4LDI0LjA3OUwzMDcuODU1LDMzLjIyNEwzMDEuMTE3LDM3LjIxMUwzMDQuNjU2LDQzLjMwMkwyODYuNTgxLDQ4Ljc2OEwyNjguNTcyLDU1LjQ3MUwyNTMuNDc1LDcxLjYxOEwyNDMuMDY4LDY4LjM5MUwyNDQuNDE2LDQ4LjczMUwyNTYuMDg0LDM1LjIxN0wyNTkuMDUxLDI4LjQ2OEwyNTAuOTE0LDI2LjA2MkwyNTUuNzgsMjEuMjk0TDI3OC41NjYsMTcuMTA5TDI5NC4yNjEsMTUuODg5WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjg1LjI4MSw1OTUuNjM0TDI4OS4xOTMsNTk1LjY2MUwyODkuMTkzLDU5NS42NjFMMjkyLjM0Miw1OTUuOTAxTDI5Mi4zNDEsNTk1LjkwMVpNMjQ2Ljc2LDU4OS41NDJMMjQzLjMzOSw1ODkuODc0TDIzOC40MzUsNTg3LjA0NFpNMjMwLjAwMyw1ODcuNjA1TDIzMC41NDEsNTg3LjczTDI0Ni4xMzUsNTkwLjg0NEwyNTIuMjk0LDU5MS4wNUwyMzguMjg5LDU4NS42NEwyNTcuMTc2LDU5MC42NzVMMjYzLjk5OSw1OTMuMTA5TDI2MC4xNjksNTkzLjI2OUwyNTQuNzQ4LDU5Mi41MjFMMjU0Ljc0OCw1OTIuNTJMMjQ0LjU2Niw1OTAuNzYzTDIzNC40NTMsNTg4LjY1MVpNMzA0LjM0NCw1OTUuOTY4TDI5OS4xOSw1OTUuODc1TDMxNS40MzUsNTk1LjAyMkwzMjcuNjIyLDU5My40MjhMMzM5LjczNyw1OTEuMDU1TDM1My4xODEsNTg5Ljk2MUwzNzAuOTQ4LDU4Ni40NzFMMzg2LjY0LDU4My4wMzZMMzg2LjY0LDU4My4wMzZMMzc2LjcwOSw1ODUuODg4TDM2Ni42ODUsNTg4LjM5MUwzNTYuNTgsNTkwLjU0MkwzNDYuNDA2LDU5Mi4zNEwzMzYuMTc1LDU5My43ODFMMzI1LjksNTk0Ljg2NUwzMTUuNTk0LDU5NS41ODlMMzA1LjI2OCw1OTUuOTUzWk01ODYuNjg1LDM3Mi42MjhMNTgyLjU3MSwzODcuMTgzTDU3Ny43MTgsNDAxLjUxTDU3Mi4xMzgsNDE1LjU3MUw1NjUuODQ3LDQyOS4zM0w1NjMuNCw0MzEuOTk4TDU3Mi4yMDcsNDExLjU0N0w1NzkuNDE3LDM5MC40NDNMNTgzLjQ0NCwzODEuNjQ5Wk0yMzIuMzg3LDEwNC44MzdMMjM5LjQxMywxMTguMDI1TDIxNy45OCwxMTYuMzJaTTM4MS42MzQsNzMuNzg2TDM5NS40ODIsODYuNjg4TDQwOC44NDksMTAwLjY2M0wzOTIuNTgzLDEwNC45MTNMMzg3LjM1Niw4OC43NTFaTTM0MS4zODksNTEuOTk4TDMzNy4xNjgsNjEuMTQxTDMyMi42MzYsNTUuMzY3Wk01MjEuMjYxLDExMS42NEw1MzMuMzczLDEyNi4zMjlMNTM2LjQ1NywxMjUuNTU1TDUyMy43OTYsMTExLjQ0OEw1MTAuMDE4LDk4LjI4TDUwOC41MDksMTAwLjU3OFpNNTY1LjYyNywxNjkuMzkyTDU2My44MDEsMTY2LjQ5OEw1NjEuMzMxLDE2My45MzFMNTU0LjQ4MiwxNTkuOEw1NjIuNjg0LDE3MS42NTRMNTY5Ljk0NSwxODMuOTY4TDU2OC4zNSwxNzYuMDE1TDU3Mi4yMTMsMTgzLjc0Mkw1NzIuMjE0LDE4My43NDNMNTc2LjEwNSwxOTMuMzE0TDU3Ni4xNDgsMTkzLjQyNkw1NzkuNDI5LDIwMi40MDhMNTgzLjU0MiwyMTguMzY1TDU4NS40NTcsMjM0Ljk1NUw1ODMuMDE0LDI0Ni4yNEw1NzYuODQ2LDIyNi4zOUw1NzAuMzc3LDIxMy44OUw1NjMuMDA0LDIwMS42NzhMNTU0Ljc1MywxODkuNzk1TDU0NS42NSwxNzguMjc5TDU0MC4yNjQsMTc3LjA3NUw1NTAuMTUyLDE5MC41OTRMNTU5LjA4OSwyMDQuNTI5TDU2Ny4wNDIsMjE4LjgyNkw1NzMuOTgsMjMzLjQzMkw1ODAuNDc4LDI0NC45NTRMNTg1Ljg1OSwyNTYuNjk1TDU4Ny44OTIsMjQ5LjU5M0w1ODguODM5LDI0Mi42OEw1OTEuNzk1LDI2Ny43MTVMNTkyLjQzNCwyOTMuMDA3TDU4OS45NjgsMzA5LjYwNEw1ODUuOTc2LDMyNi4xNTFMNTgyLjQzMywzNDcuMTIzTDU4MC43NSwzNjYuODE4TDU3Ny41NDMsMzg2LjE1MUw1NzAuMDYxLDQwMC45OUw1NjEuMzczLDQxNS4zNzhMNTUzLjIxMyw0MzYuNzU1TDUzOC42NSw0NTcuNjM3TDUyMi4xODgsNDc3LjI2NUw1MTAuNTk1LDQ4NC40Nkw0OTguMTE2LDQ5MC44NzhMNTAwLjg3Miw0NzYuOTU0TDUwMi40OTcsNDYyLjAzNEw1MDUuMjYzLDQ0MC4zNzVMNTA2LjE2Myw0MTcuNDRMNTE3LjI2NywzOTQuMDJMNTE2LjczMywzNzcuNDVMNTE1LjM0MywzNjAuNTc1TDUwNC44MjMsMzQyLjc0OEw1MDguMjQ5LDMyMC43OUw0ODYuNDYsMzA3LjY3OUw0MzYuMjAxLDMyMy40MTdMNDE0LjM1NSwzMDQuODQ4TDM5MS4yNzMsMjg2LjIyNkwzODUuMTA3LDI0MS4xODdMMzkzLjIyMiwyMTQuMjE2TDQxMC4xNzYsMTk0Ljc2N0w0MTYuNzAzLDE2Ni4xMDdMNDQxLjY2OSwxNTguMzU3TDQ2NC45NTQsMTUyLjI4OEw0NzguMzAxLDE2OS43NzRMNDkzLjA4MSwxNzQuMThMNTA3LjA1LDE3OS4xMTRMNTA2LjEyOCwxNjYuNzYzTDUyOC4xODcsMTY5LjgzNEw1MzYuNzQyLDE2NC40NjhMNTI3LjEzNiwxNDIuODU4TDUxMC44OTMsMTQ0LjkwM0w1MDAuMTk1LDEzMy44NTZMNTA3LjA1NSwxMjEuNjUxTDUxMS42NzEsMTExLjM3OEw0OTkuMTM2LDEwNi41MzRMNDg1LjQ4OSwxMDIuNzdMNTAwLjI4NCwxMjUuNjU0TDQ5MC41NiwxMzEuNjAxTDQ5Ny45MTQsMTQ3Ljc5Nkw0NzkuOTU0LDEyOC4yNjNMNDUzLjg3MiwxMTUuMTgxTDQ2Ny43MjksMTI0LjYwM0w0ODEuMDI5LDEzNC42MDdMNDc0LjYyNCwxMzcuNTExTDQ2MC45MiwxMjkuODA5TDQ0Ni43MDMsMTIyLjY1MUw0MzMuNDE5LDEzMC40NjRMNDI4Ljc4OSwxNjAuNTMyTDQwNC4xODcsMTYyLjAyNkwzOTMuNTE2LDEzNC45NzlMNDE3LjM5NSwxMzAuOTAxTDQwNy42MDgsMTA5LjU0OEw0MjAuMzY0LDg1LjkwNEw0NDAuNTI1LDc2Ljk1Nkw0MjkuMDU2LDYzLjQ2Mkw0MTIuOTc3LDU0LjM4M0w0MTkuMjY0LDY2LjQzN0w0MjQuOTE3LDc5LjczMUw0MDYuOTgxLDY3LjI1N0w0MDAuNTI3LDcxLjUzOEwzODkuMzksNjEuMTlMMzg2LjQxMSw0OC4wOEwzODIuODEzLDM2Ljc3NUwzODUuMTc4LDMxLjU1NEw0MDcuNTYxLDM0Ljc1M0w0MjAuMDc5LDQ0LjY5NEw0MTEuMzE0LDMzLjM4M0w0MDEuNDg0LDI0LjYyNUw0MDcuMzg1LDI1LjA2N0wzOTQuMjI5LDIwLjk0M0wzODEuNzAxLDE1Ljc1NEwzNjQuMzYsMTEuMjQ4TDM0Ny41OTUsNy44NTJMMzQ3LjU5Niw3Ljg1MkwzNTcuNzYyLDkuNjkxTDM2Ny44NTksMTEuODgzTDM3Ny44NzMsMTQuNDI3TDM4Ny43OTIsMTcuMzE5TDM5Ny42MDMsMjAuNTU1TDQwNy4yOTcsMjQuMTMxTDQxNi44NTksMjguMDQ0TDQyNi4yNzksMzIuMjg4TDQzNS41NDUsMzYuODU4TDQ0NC42NDYsNDEuNzQ5TDQ1My41NzEsNDYuOTU0TDQ2Mi4zMDgsNTIuNDY4TDQ3MC44NDgsNTguMjgzTDQ3OS4xOCw2NC4zOTNMNDg3LjI5Myw3MC43OUw0OTUuMTc4LDc3LjQ2Nkw1MDIuODI2LDg0LjQxM0w1MTAuMjI2LDkxLjYyM0w1MTcuMzcsOTkuMDg3TDUyNC4yNSwxMDYuNzk1TDUzMC44NTYsMTE0LjczOUw1MzcuMTgxLDEyMi45MDlMNTQzLjIxNywxMzEuMjk0TDU0OC45NTYsMTM5Ljg4NUw1NTQuMzkyLDE0OC42NzFMNTU5LjUxOSwxNTcuNjQxTDU2NC4zMjksMTY2Ljc4NVpNMjE5LjMwMywxNS4yMTJMMjA3LjI1NSwxOS4yMzFMMTk1LjU3MiwyNC4zNTRMMjAxLjI2MywyNC4zMDVMMTkzLjA2OCwzMi42MTRMMjA0LjUzOSwzOS4yOTRMMjIwLjI4MiwzMC44MTRMMjE0LjUxMSwzNy4xNDhMMjE0LjUxMSwzNy4xNDhMMjA5LjE3Nyw0My40NDVMMjIxLjQxNCwzNy41MjVMMjE2LjY0Myw0NS4yNDFMMjA4Ljc4OSw0NS40ODdMMTkyLjM1Myw1MS4zNDlMMTc2LjI5Miw1OC4wODFMMTY0LjY2Miw3MC4zNzRMMTc1Ljc0LDgwLjcxNUwxNjguNDkzLDkxLjU0MkwxOTEuNzUyLDc4LjA0TDIwNi4wMzEsNTkuMjkzTDIxOC42ODksNjUuMzY5TDIxNS44NzgsNzUuMDE3TDIyNy42NzcsNjguODI1TDIyNi4wMjYsODIuODAyTDIzNS44NDQsOTkuMzQyTDIxOS45LDEwNS42ODlMMjAxLjM1MSwxMDQuMDE2TDE5OS4yNzQsMTIwLjQyM0wyMTMuNjIxLDEyMy4wNTNMMTkxLjU0NiwxMzEuMzIyTDE3Ni44NjcsMTI5LjA3TDE2Mi4wMTcsMTM5Ljk3OEwxNDcuNzAyLDE1MS41MDdMMTQyLjg2OCwxNjIuMjAyTDEyOC44NjIsMTcxLjYwM0wxMTUuNDYzLDE4MS40NThMMTA2Ljc4NSwyMDguMDg1TDEwNy4yNjcsMTgzLjkxOUw3Ny41NDYsMTc5LjEyOEw2Ny4xMzUsMTg3LjExMUw1Ni41MTYsMjEwLjM3Mkw1Ny44MjIsMjM0LjA2NEw2OS44MzUsMjI4LjA0OEw4Mi44OTQsMjIyLjM1OUw2OS44ODMsMjQ5LjMxMUw4Ny4wMjcsMjU3LjY5Nkw4OC4wMjYsMjkwLjQ3N0wxMjcuNTUxLDI4NS4xNTJMMTY4LjUwOSwyOTAuODQ0TDE4OS4wMSwzMTcuMDEyTDIwOS41MTIsMzIxLjIxNUwyMzAuMjk3LDM1MS4xNDhMMjY0LjI2MywzNjUuNTUxTDI5OC43OSwzNzguOTI2TDI5OS4zNSwzOTYuMzU0TDI4MC4xNzcsNDE5LjMwMUwyNjYuODM5LDQ2MC43MzVMMjQ2LjI2LDQ2NC45NjdMMjM3LjY3Miw0ODMuNjUyTDIxMi4xNCw1MTMuMkwxOTQuMTA5LDUxOC4zNEwxOTUuNTM0LDUzMS44NjJMMTk3LjU2OCw1NDQuMDM0TDE5Ny4zMTEsNTU5Ljg2OUwxODMuNjc2LDU1NC42NDRMMTY3LjY0MSw1MzguNzM5TDE2Mi43NzgsNTI4LjE4OUwxNTguNDcxLDUxNi43MTVMMTU0LjczNyw1MDQuMzYzTDE1MS41OTIsNDkxLjE4MkwxNDcuMTUzLDQ3Ny4yMjNMMTQzLjI5Miw0NjIuNTk0TDEzNy4zNjMsNDMxLjU0NUwxMTIuMDgzLDQxMS4yNDRMOTguMjQzLDM4NS43M0w4Ni4zNDQsMzU5LjM5Mkw5MC4zOCwzMzIuMzcxTDEwMS44OTEsMzE4LjQ2NEw5Mi40OSwyOTcuNzM4TDgwLjgyMywyODEuNDM2TDcwLjU4MywyNjUuMjU1TDYyLjA4MSwyNTQuMzE2TDU0LjYxLDI0My41NzVMNDUuODM1LDIzNC43OTlMMzguNTE0LDIyNi4zOTVMNDEuODk5LDIwMi41NjZMNDMuOTQ3LDE4MS41MTlMNDguMjIxLDE2MS41MDJMNDIuNTc2LDE3OC45NzRMMzguMjY5LDE5Ny4wNzZMMzkuMzA0LDE4Ni4wNzRMNDEuMDM3LDE3NS4zNzhMNDcuMTg3LDE2MC44ODFMNTQuMTI0LDE0Ni44MTZMNjEuNDMyLDEzMS44MjdMNjkuODY0LDExNy42MzFMODUuOTA2LDk5LjMwNkwxMDMuNDAyLDgyLjM0NEwxMTMuMzExLDcyLjk1OUwxMjMuNjcxLDY0LjEyM0wxMzQuNDU2LDU1Ljg1NkwxNDUuNjQxLDQ4LjE3N0wxNTkuOTYyLDM5LjIyMkwxNTkuOTYyLDM5LjIyMkwxNjkuMTQ5LDM0LjQ5M0wxNzguNDk0LDMwLjA4OEwxODcuOTg4LDI2LjAxMkwxOTcuNjE4LDIyLjI3TDIwNy4zNzMsMTguODY2TDIxNy4yNDEsMTUuODA1Wk0yMTUuNTg3LDIzLjg2TDIxNi45NDcsMjYuODYxTDIwNy42NDEsMzMuMTgxTDE5My45MzMsMzIuNTI0TDIwNi44MTIsMjUuMDUzWk0yMzIuODI2LDMwLjI1OEwyMzkuMTEzLDI5Ljg5M0wyNDUuMTE4LDM5LjQxOEwyNDAuMjMxLDQzLjg3MkwyNDcuNDY1LDQ5Ljk2NkwyMzIuMDMsNjEuNDU2TDIyMy4zODEsNjEuNjQ5TDIxNS44NCw1MC44NzZMMjMxLjQ2Niw0NC42NTJMMjMwLjI5MiwzOC4zNEwyMjAuMDM5LDM1LjU3NVpNMjA1Ljg4MiwyNS4wMjFMMjA3Ljg5NiwyMi43MTNMMjE5Ljg2MywxOS40MDNMMjE2Ljk1NywyMi45NDhaTTIzMi40MDksMjAuNDUxTDIyNy40NDksMjIuNjg0TDIyNS4xMTMsMTkuODAxWk0zOTcuNjM2LDI0LjA5NEwzOTMuODg0LDI0LjU3MUwzNzYuMjAzLDE4LjE3N0wzNjUuMTM1LDEzLjM5NEwzNzcuNDgzLDE3LjM4OUwzODkuNjQyLDIyLjA3MlpNMjQyLjk0OCwyMS42NDlMMjQxLjk4NywyOC41ODdMMjM0Ljc1OSwyNS44ODRaTTM0Mi40MDEsMTguNjkxTDM1My4zMTUsMjMuMzlMMzM3Ljg4NiwxOS43MTVaTTM0MC40MDgsNi45NjdMMzQwLjA4Niw3LjUzOEwzMzQuMDE0LDYuNzY2Wk0yNTguMTIsMTguOTFMMjQ5LjM1NCwyMC4wM0wyNTUuNDUsMTYuOTVMMjYyLjA5MSwxNi4wOTJaTTI4MC4zOTMsMTUuNzQ4TDI4Mi4yMDQsMTcuMTc2TDI2NS43OTIsMjAuODMzTDI0OS41MDgsMjUuNTM3TDI0My42MzYsMjMuNTY4TDI1OC4wMiwxOS42MThMMjY1LjE2NSwxNS4zOTlMMjc1LjI3LDE0Ljk4OVpNMzA0LjU5MiwxNi4xMDVMMzA5LjE2NCwxNy4xNTNMMzAyLjE3MSwxOC4xNkwzMDkuMzM1LDE5LjcwNEwzMTcuMzYyLDE5LjAzM0wzMTUuMjMxLDIzLjc2N0wzMjEuNTgyLDMyLjc3N0wzMTYuNDcyLDM2Ljk0M0wzMjIuMDM3LDQyLjg5N0wzMDUuODc3LDQ4Ljg4M0wyODkuNjg5LDU2LjEwNUwyNzguNDk4LDcyLjY1MUwyNjYuOTI4LDY5Ljc1OUwyNjIuNjk1LDUwLjE0M0wyNzAuMTExLDM2LjMzOEwyNzAuMzgyLDI5LjU0TDI2MC42NDEsMjcuNDA2TDI2My4zMjcsMjIuNTIzTDI4NC44LDE3LjY2NkwyOTkuOTUsMTUuOTc3WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjkzLjI4Myw1OTUuOTI0TDI5OS44MzYsNTk1LjgyOEwyOTkuODM2LDU5NS44MjhMMzAxLjQ2OCw1OTUuOTk2TDMwMS40NjgsNTk1Ljk5NlpNMjYxLjU2Miw1OTAuOTM1TDI1Ni4yNjcsNTkxLjM5OUwyNTQuNDk1LDU4OC42NzFaTTIzMS4xNTQsNTg3Ljg4MkwyMzQuODEyLDU4OC43MjVMMjQwLjU0Niw1ODkuNjg5TDI1Ny42MjksNTkyLjMwNkwyNjYuMDg4LDU5Mi4yOUwyNTUuODkzLDU4Ny4yNDhMMjcyLjczNCw1OTEuNzRMMjc2LjgzNSw1OTQuMDA4TDI3MC40MzQsNTk0LjMyM0wyNjMuNzA4LDU5My42OTJMMjY4LjYzOSw1OTQuMzM0TDI2OC42MzgsNTk0LjMzNEwyNTguMzg1LDU5My4wNkwyNDguMTgzLDU5MS40MjlMMjM4LjA0NCw1ODkuNDQzWk0zMTIuNjE4LDU5NS43MzFMMzA5LjU5LDU5NS43NDFMMzI3LjI0OSw1OTQuMzczTDM0MC43NDQsNTkyLjM4OUwzNTQuMTMyLDU4OS42MjlMMzY1LjY3NSw1ODguMTU1TDM4Mi4zOTYsNTg0LjE0MUwzODYuODQsNTgyLjk3NUwzODYuODQsNTgyLjk3NUwzNzYuOTExLDU4NS44MzNMMzY2Ljg4OSw1ODguMzQzTDM1Ni43ODUsNTkwLjUwMkwzNDYuNjEyLDU5Mi4zMDdMMzM2LjM4Myw1OTMuNzU2TDMyNi4xMDksNTk0Ljg0NkwzMTUuODAzLDU5NS41NzhaTTI2My43ODksMTA2LjQxNEwyNzMuNDAyLDExOS4zNUwyNTAuODIsMTE4LjMxM1pNNDAzLjA4Myw3MC45OEw0MTguNjYzLDgzLjQzNUw0MzMuNjQ2LDk2Ljk3OUw0MTkuOTE0LDEwMS42ODVMNDExLjgxNSw4NS43MjZaTTM1OS45OTQsNTAuNDU3TDM1OC42MTMsNTkuNjg2TDM0My4xNSw1NC4zNjhaTTU1Ny4yNjQsMTUzLjYwNkw1NTYuMDYsMTUyLjA0NEw1NjMuMjY1LDE2NC42OTVMNTYzLjI2NSwxNjQuNjk1TDU2Ny44MjcsMTczLjk2Nkw1NzIuMDYyLDE4My4zODlMNTc1Ljk2NiwxOTIuOTU1TDU3OS41MzQsMjAyLjY1Mkw1ODIuNzYxLDIxMi40NjZMNTg1LjY0NCwyMjIuMzg4TDU4Ny4zMiwyMjguODQzTDU4OC43MjgsMjM3LjU1NEw1ODMuMTY1LDIxNy44ODJMNTc4LjA4LDIwNS41NThMNTcyLjA2NSwxOTMuNTQ5TDU2NS4xNDIsMTgxLjg5Nkw1NTcuMzM0LDE3MC42MzhMNTUzLjY5NiwxNjkuNTcxTDU2Mi42MDMsMTgyLjgwNEw1NzAuNTEyLDE5Ni40ODNMNTc3LjM5MywyMTAuNTU1TDU4My4yMiwyMjQuOTY3TDU4Ny43MTMsMjM2LjMyMkw1OTEuMDYsMjQ3LjkzTDU5MC4yNzQsMjQyLjA1OEw1OTAuMjc0LDI0Mi4wNTlMNTkyLjExOSwyNTIuMjI0TDU5My42MDgsMjYyLjQ0OEw1OTQuNzQsMjcyLjcxOEw1OTUuNTEzLDI4My4wMjFMNTk1Ljg1MywyOTAuNjY2TDU5NS43NzMsMzA0LjAwNEw1OTQuNjkyLDMxNy4zMjlMNTkyLjM5MSwzMzguMzlMNTg5Ljc1MywzNTguMTUxTDU4NS41NDMsMzc3LjU5N0w1ODAuNDU1LDM5Mi42MjZMNTc0LjExNSw0MDcuMjQyTDU2NS4zMzQsNDI4Ljg3N0w1NTIuODE2LDQ1MC4xN0w1MzguMjg2LDQ3MC4yN0w1MjkuMzk3LDQ3Ny43NzVMNTE5LjU0Miw0ODQuNTMzTDUyNC43NTYsNDcwLjQ4OEw1MjguNzA1LDQ1NS40ODNMNTMzLjgzNCw0MzMuNzA0TDUzNi44MzcsNDEwLjcxTDU0Ny4xODcsMzg2Ljk2M0w1NDcuNjA2LDM3MC4zOTZMNTQ3LjA0NywzNTMuNTVMNTM4LjgwNSwzMzYuMDA4TDU0MS41MDksMzEzLjk1N0w1MjMuMTUsMzAxLjQ1Nkw1MDIuNDc1LDMxMC4wOTNMNDc5LjYwMSwzMTguNjE5TDQ1OS40NDYsMzAwLjY4OEw0MzcuNTY2LDI4Mi43NUw0MzMuOTE1LDI2MC4yMkw0MjkuNDY4LDIzNy45MjdMNDM0Ljk2NywyMTAuNzQ5TDQ0OC43MjgsMTkwLjgzNEw0NTEuMzg2LDE2Mi4wMzRMNDcyLjUxLDE1My41ODRMNDkxLjU4NiwxNDYuODcxTDUwNS4zNzksMTYzLjk0NUw1MTguMTIsMTY3LjkzM0w1MjkuOTQ1LDE3Mi40NzVMNTI3LjI3MywxNjAuMTc4TDU0NC4xMiwxNjIuNjU5TDU0OC43MDYsMTU3LjA5M0w1MzcuMTUxLDEzNS44MDVMNTI2LjYzNywxMzguMjU2TDUxNi4yODksMTI3LjUyOUw1MTcuOTgyLDExNS4xOTNMNTE3LjMxMiwxMDQuODYxTDUwNy44MjcsMTAwLjM1MUw0OTcuMTgxLDk2Ljk1Nkw1MTQuMzUsMTE5LjM1NEw1MDguNDkxLDEyNS41MzhMNTE3LjUwOCwxNDEuNDg1TDQ5OS40NzcsMTIyLjQ5OEw0ODcuNzQzLDExNi4wNzZMNDc1LjQ3MywxMTAuMTc4TDQ4OC44NzIsMTE5LjE4Nkw1MDEuNjQ1LDEyOC43OTNMNDk3LjA0NCwxMzEuODY1TDQ4NC4yOTQsMTI0LjU2NUw0NzAuOTU1LDExNy44MjVMNDYwLjkzNywxMjUuOTkyTDQ2MS41NTIsMTQwLjcxMUw0NjEuNDY1LDE1Ni4xMjJMNDM5LjUzMSwxNTguMzIzTDQyNS45OCwxMzEuNjQ1TDQ0Ni44ODYsMTI2Ljg4NUw0MzQuMzMyLDEwNS44NzNMNDQwLjMzMSw4MS45NDNMNDU0LjY4NSw3Mi40NzFMNDQwLjkxNCw1OS4zNkw0MjQuNDY0LDUwLjc3Nkw0MzMuODgyLDYyLjU5MUw0NDIuNTg5LDc1LjY2N0w0MjMuNzAzLDYzLjc1Mkw0MTkuMzIsNjguMTk4TDQwNi41MzcsNTguMjEzTDM5OS41OTIsNDUuMjU0TDM5MS45MzMsMzQuMTJMMzkxLjM2NywyOC44NzJMNDEwLjgyOSwzMS40MzVMNDI1Ljg2Nyw0MC45NThMNDEyLjU4NywyOS45ODFMMzk4LjIzLDIxLjU5MUw0MDEuMjc0LDIxLjg5N0wzODkuNDExLDE4LjE1M0wzNzUuMzc4LDEzLjc1OUwzNzUuMzc5LDEzLjc1OUwzODUuMzIzLDE2LjU2NEwzOTUuMTYyLDE5LjcxNEw0MDQuODg2LDIzLjIwNkw0MTQuNDgyLDI3LjAzNUw0MjMuOTM5LDMxLjE5N0w0MzMuMjQ0LDM1LjY4Nkw0NDIuMzg4LDQwLjQ5N0w0NTEuMzU4LDQ1LjYyNEw0NjAuMTQzLDUxLjA2Mkw0NjguNzMzLDU2LjgwMkw0NzcuMTE4LDYyLjgzOUw0ODUuMjg3LDY5LjE2NUw0OTMuMjMsNzUuNzcyTDUwMC45MzgsODIuNjUyTDUwOC40MDEsODkuNzk3TDUxNS42MSw5Ny4xOThMNTIyLjU1NiwxMDQuODQ3TDUyOC43OTUsMTEyLjJMNTE5LjY0LDEwMS43NTFMNTA5LjgyMiw5MS45MDJMNTEwLjYzNCw5NC4yMUw1MjEuODYzLDEwNC45MDhMNTIxLjg2MywxMDQuOTA4TDUzMy45NDQsMTE5LjIzTDUzMy44NTksMTE4LjU0NUw1MzMuODU5LDExOC41NDVMNTQwLjA1LDEyNi44MTdMNTQ1Ljk0NywxMzUuMzAxTDU1MS41NDUsMTQzLjk4NEw1NTYuODM3LDE1Mi44NThaTTIwOC43NzQsMTguNDA5TDIxMS4xNjgsMTcuNjcyTDIxMi4wMTIsMTcuNzQ4TDIwMi41NDcsMjIuMTAzTDE5My40NjcsMjcuNTU5TDIwMS44MjMsMjcuMjk2TDE5OC4zMzcsMzUuNzgzTDIwNi44MywzOC40MDJMMjE1LjY4MSw0Mi4wMjVMMjI5LjQxOCwzMy4wOThMMjI1Ljk5NSwzOS41NzFMMjI1Ljk5NSwzOS41NzFMMjIyLjcyNCw0NS45OThMMjMzLjg0OSwzOS43MjRMMjMxLjY5OSw0Ny41NDVMMjIzLjEwNyw0OC4wNDFMMjA2Ljg2OSw1NC40TDE5MC45NTcsNjEuNjE3TDE4MS44MDgsNzQuMjI1TDE5Ny41NTcsODQuMTU5TDE5Mi4yMzUsOTUuMTc3TDIxNC42MTEsODAuOTgyTDIyNC44OTEsNjEuODYxTDI0MC4zOTksNjcuNTFMMjM5Ljk1NCw3Ny4yMDdMMjUwLjg5OCw3MC42N0wyNTIuNTgsODQuNjQ2TDI2Ni4zMjcsMTAwLjgyOEwyNTAuOTAxLDEwNy42NTJMMjMwLjkxNiwxMDYuNTY0TDIzMS43NTYsMTIyLjk5TDI0Ny4zOTIsMTI1LjE2NUwyMjUuMzQsMTM0LjEwNEwyMDkuMTQzLDEzMi4zMjFMMTk0LjczNywxNDMuNjczTDE4MC43MzksMTU1LjYzMkwxNzYuOTQ1LDE2Ni40NTlMMTQ4LjY4NCwxODYuNTYxTDE0MS45MjcsMjEzLjQyMkwxMzkuNTg3LDE4OS4yODRMMTAzLjUwOCwxODUuNDkzTDkxLjg0MSwxOTMuODEyTDgxLjg3NywyMTcuMzg1TDg2LjM0NSwyNDAuOTg5TDExNS41OTMsMjI4LjQ1OUwxMDIuNDg2LDI1NS44MDhMMTIzLjM4OSwyNjMuNjE1TDEyNi4yNTIsMjk2LjMzN0wxNzAuNzg2LDI4OS43MzVMMjE1LjU1NCwyOTQuMTI1TDIzOC4wNDUsMzE5LjYzOUwyNTkuNTg2LDMyMy4yMDRMMjgxLjMxLDM1Mi40OTFMMzE1Ljc2NSwzNjUuODU0TDM0OS45NzQsMzc4LjE4NkwzNTAuMTI3LDM5NS42MDJMMzMwLjI3Nyw0MTkuMTQyTDMxNC4zMTUsNDYxLjAyMUwyOTMuMDYzLDQ2NS44ODlMMjgyLjM5Nyw0ODQuODY2TDI2Ni44NzgsNTAwLjkyMUwyNTEuNjQxLDUxNS4yNjlMMjMxLjI4OCw1MjAuOTkyTDIyOS4xNTEsNTQ2LjY2NkwyMjMuNDEsNTYyLjU5MkwyMDkuNTYxLDU1Ny43ODZMMTk2LjQyNCw1NDIuMzIzTDE5MS43MTMsNTIwLjUxTDE4OC43NTQsNDk1LjEyN0wxODMuMzAyLDQ2Ni43NDdMMTc5LjYxNSw0MzUuODQ1TDE1Mi40NjQsNDE2LjM0TDEzNy45MDYsMzkxLjI1OEwxMjQuOTA5LDM2NS4yOThMMTI5Ljg0OCwzMzguMTQxTDE0Mi45MzQsMzIzLjg2TDEzMS42NywzMDMuNDQ3TDExNy40NjUsMjg3LjUzOUwxMDQuNDUsMjcxLjcxMUw4My4yNDgsMjUwLjU5Nkw2MC4zNzQsMjM0LjAwOEw2MS4yMjYsMjEwLjExNUw1OS41NzQsMTg5LjA2MUw2MC4wMTIsMTY4Ljk3M0w1Ni44MzcsMTg2LjU3OUw1NC45MjUsMjA0Ljc3NUw1My4zMzQsMTgzLjA2TDU4LjEwOSwxNjguMzk2TDYzLjYzNiwxNTQuMTQzTDY4LjM5NiwxMzguOTdMNzQuMjQ3LDEyNC41NTdMODkuNzMzLDEwNS43NTNMMTA2LjY0Nyw4OC4yNjhMMTI0LjMyOCw2OS40NzFMMTQzLjcwNCw1Mi44OTdMMTUxLjE1NCw0NS45OTRMMTU5LjE4NSw0MC4wODFMMTU0LjM4MSw0Mi4yOTZMMTU0LjM4MSw0Mi4yOTZMMTYzLjQ2NCwzNy4zNzFMMTcyLjcxMywzMi43NjZMMTgyLjExNiwyOC40ODdMMTkxLjY2NCwyNC41MzhMMjAxLjM0MywyMC45MjVaTTIxOS42NzQsMjYuMzYzTDIyMy4zNDMsMjkuMjg3TDIxNi4xOTIsMzUuODU3TDE5OS4zNTQsMzUuNjY0TDIwOS44MTQsMjcuODM5Wk0yNDMuMTA1LDMyLjE0M0wyNDkuNzg5LDMxLjU4TDI2MC4xOTQsNDAuODU3TDI1Ni42MzksNDUuNDM5TDI2Ni4yODQsNTEuMjc2TDI1My40OTQsNjMuMTk1TDI0NC4zNjEsNjMuNjU4TDIzMi44NDgsNTMuMTc0TDI0Ny41NjksNDYuNDg5TDI0My45MDQsNDAuMjUxTDIzMS40NiwzNy44MzFaTTIwOC42MSwyNy44NEwyMDkuMDM3LDI1LjQ5NEwyMjEuMSwyMS44MTlMMjIwLjYyOCwyNS40MTVaTTIzNi45NzcsMjIuNDM1TDIzMi44MTIsMjQuODA3TDIyNy45MTMsMjIuMDM0Wk0zOTUuNDAyLDIxLjE2MUwzOTMuNDI2LDIxLjcyNUwzNzQuODk5LDE1Ljg4MkwzNjEuNTAyLDExLjQ3TDM3NC45MjUsMTUuMDc0TDM4OC4xNjYsMTkuMzcxWk0yNDkuNjA4LDIzLjI4MkwyNTIuMjc5LDMwLjE5NEwyNDIuOTg5LDI3Ljc0MlpNMzQ3LjI1NSwxNy4zMjlMMzU5LjcwNywyMS42NzNMMzQzLjc4OCwxOC40NzRaTTMzMi43OTMsNS44NTVMMzM0LjM4Niw2LjQwN0wzMjguMzc0LDUuODE4Wk0yNjQuNDM0LDIwLjA4NkwyNTUuNjQ1LDIxLjQ3NEwyNjAuMjksMTguMjNMMjY2Ljg3NSwxNy4xNzFaTTI4NS44MzUsMTYuMjYxTDI4OC41NjgsMTcuNjJMMjczLjY3MSwyMS43NTNMMjU4Ljg3NCwyNi45MjlMMjUxLjQ3NiwyNS4xNjFMMjY0Ljc1NCwyMC43OTFMMjY5LjY4NSwxNi4zODlMMjgwLjA0NiwxNS42NjhaTTMxMC4yNjgsMTUuODc5TDMxNS4zMzUsMTYuNzgxTDMwOS4xMDQsMTcuOTg5TDMxNi45MzIsMTkuMzA1TDMyNC4yNzMsMTguNDAxTDMyNC42NywyMy4xNjFMMzM0LjY1MiwzMS45MjNMMzMxLjMyNiwzNi4yMTdMMzM4Ljc0OCw0MS45NzNMMzI0Ljk5NSw0OC40MTRMMzExLjExOSw1Ni4wOTJMMzA0LjE3NSw3Mi45MTVMMjkxLjc5Myw3MC4zODZMMjgyLjEwNyw1MC45ODFMMjg1LjA0NiwzNy4wMTlMMjgyLjYxMiwzMC4yNTRMMjcxLjU2NCwyOC40MzZMMjcxLjk4OSwyMy41MDVMMjkxLjQ5NywxOC4wMjZMMzA1LjY0LDE1Ljg5MloiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzAxLjk1Nyw1OTUuOTk0TDMxMC40ODQsNTk1LjY3MUwzMTAuNDg0LDU5NS42NzFMMzEwLjM4Myw1OTUuODE4TDMxMC4zODMsNTk1LjgxOFpNMjc3LjUzMSw1OTEuODZMMjcwLjUyNCw1OTIuNTEyTDI3MS45MzksNTg5Ljc4OFpNMjQyLjQ5Myw1OTAuMzZMMjQ2LjI5OCw1OTEuMDgxTDIzMy41ODEsNTg4LjMyOEwyNDQuODYsNTkwLjU1M0wyNTIuMzU4LDU5MS4zMTZMMjcwLjQxMSw1OTMuMzk5TDI4MC45MTIsNTkzLjA5NUwyNzQuODM3LDU4OC4zTDI4OS4xMiw1OTIuMzJMMjkwLjM3Niw1OTQuNTA2TDI4MS41OTgsNTk1LjA1MkwyNzQuMjUxLDU5NC42MzRMMjgwLjMyNSw1OTUuMzQ1TDI4MC4zMjUsNTk1LjM0NUwyNzAuMDI5LDU5NC40NzlMMjU5Ljc3LDU5My4yNTNMMjQ5LjU2MSw1OTEuNjcxWk0zMjAuNzYsNTk1LjI3MUwzMTkuNjk5LDU5NS4yOTZMMzM4LjIzNSw1OTMuMzc5TDM1Mi42MjgsNTkwLjk3TDM2Ni44ODIsNTg3Ljc5MUwzNzYuMTczLDU4NkwzODIuODEsNTg0LjE4TDM4Mi44MSw1ODQuMThMMzcyLjg0Miw1ODYuODk3TDM2Mi43ODUsNTg5LjI2NUwzNTIuNjUxLDU5MS4yOEwzNDIuNDU0LDU5Mi45NEwzMzIuMjA1LDU5NC4yNDNMMzIxLjkxNiw1OTUuMTg4Wk0yOTYuMjksMTA3LjAyMUwzMDguMTk5LDExOS42M0wyODUuMTU1LDExOS4yODZaTTQyMS40LDY3LjU2OUw0MzguMjM5LDc5LjUzMkw0NTQuMzgzLDkyLjYwM0w0NDMuNjAzLDk3LjY4MUw0MzIuODc4LDgyLjAwOFpNMzc2Ljc3NSw0OC4zOEwzNzguMjc4LDU3LjYwNkwzNjIuMzUyLDUyLjc2NVpNNTczLjEzMiwxODUuOTE4TDU2Ny42MzgsMTc0LjExN0w1NjEuMTk4LDE2Mi43Nkw1NTkuNDIxLDE2MS43NzZMNTY1LjkwNiwxNzIuNjI1TDU3MS42ODEsMTgzLjgxNEw1NzYuNzMxLDE5NS4zMTRMNTgxLjA0MiwyMDcuMDkzTDU4MS4wNDIsMjA3LjA5NEw1ODQuMTEzLDIxNi45NThMNTg2LjgzOCwyMjYuOTI0TDU4OS4yMTMsMjM2Ljk3OUw1OTEuMjM3LDI0Ny4xMTFMNTkyLjkwNSwyNTcuMzA3TDU5NC4yMTcsMjY3LjU1Nkw1OTUuMTcsMjc3Ljg0M0w1OTUuNzYzLDI4OC4xNThMNTk1Ljk5NiwyOTguNDg3TDU5NS44NjksMzA4LjgxOEw1OTUuMzgxLDMxOS4xMzlMNTk0LjUzMywzMjkuNDM2TDU5My4zMjYsMzM5LjY5N0w1OTEuNzYyLDM0OS45MUw1ODkuODQyLDM2MC4wNjFMNTg3LjU3LDM3MC4xNEw1ODQuOTQ3LDM4MC4xMzRMNTgxLjk3NiwzOTAuMDI5TDU3OC42NjMsMzk5LjgxNUw1NzUuMDA5LDQwOS40OEw1NzEuMDIxLDQxOS4wMTFMNTY2LjcwMyw0MjguMzk3TDU2Mi4wNTksNDM3LjYyNkw1NTcuMDk3LDQ0Ni42ODhMNTUxLjgyMSw0NTUuNTcxTDU0OC40Myw0NjAuOTMxTDU0Ny4xNDQsNDYyLjg5NUw1NDEuMjI4LDQ3MC42MjZMNTM0LjI5Nyw0NzcuNjM4TDU0MS44MTEsNDYzLjRMNTQ3Ljk2NSw0NDguMjQyTDU1NS4zLDQyNi4yNzNMNTYwLjMxNSw0MDMuMTU3TDU2OS41OTYsMzc5LjExMkw1NzAuOTU1LDM2Mi41MThMNTcxLjI0NCwzNDUuNjc2TDU2NS41MzEsMzI4LjM0Nkw1NjcuNDMsMzA2LjIyNUw1NTMuMDYsMjk0LjIyMUw1MzYuNTg3LDMwMy40MjJMNTE3LjU0NCwzMTIuNTg2TDQ5OS42OTEsMjk1LjIzMkw0NzkuNjc5LDI3Ny45M0w0NzUuMzA4LDI1NS41MjNMNDY5Ljg5NCwyMzMuMzc5TDQ3Mi42MTIsMjA2LjA3Nkw0ODIuNzYsMTg1Ljc5OEw0ODEuNDY5LDE1Ni45NzdMNTEyLjM5OCwxNDAuNzM0TDUyNi4yMTcsMTU3LjM4OEw1MzYuNTMxLDE2MS4wMjZMNTQ1Ljg1MywxNjUuMjQ3TDU0MS41MTMsMTUzLjA1Nkw1NDcuNTQ4LDE1My44MDRMNTUyLjYzNiwxNTUuMTEyTDU1My4xMTQsMTQ5LjQ3TDUzOS45NiwxMjguNTU2TDUzNS40OTUsMTMxLjIzNUw1MjUuODEsMTIwLjgxMkw1MjQuMzUyLDExNC40MDdMNTIyLjI4NSwxMDguNTA1TDUxOS42MTUsMTAzLjEyMkw1MTYuMzQ5LDk4LjI3M0w1MTAuMjAzLDk0TDUwMi44ODIsOTAuODc4TDUxMi42NTYsMTAxLjU1N0w1MjEuOTAzLDExMi43MjdMNTIwLjA4NywxMTkuMDI3TDUzMC40OTMsMTM0LjY3OUw1MTIuOTQsMTE2LjIzM0w1MDIuNjMsMTEwLjE0NUw0OTEuNzQyLDEwNC41OTlMNTA0LjI3NywxMTMuMjEzTDUxNi4xMzQsMTIyLjQ0Nkw1MTMuNDc4LDEyNS42MjhMNTAyLjA2OCwxMTguNjk1TDQ5MC4wMTMsMTEyLjM0MUw0ODMuNTY2LDEyMC43NThMNDg2LjgwNiwxMzUuNDE4TDQ4OS4yMzQsMTUwLjc5NEw0NzAuNjM0LDE1My42MTFMNDU0LjYxNiwxMjcuMzgyTDQ3MS45MTMsMTIyLjA0Mkw0NTYuOTc0LDEwMS40NDdMNDU2LjkyOCw4OC44NzNMNDU2LjAzMyw3Ny40NDFMNDY0LjE0NCw2Ny42MjhMNDQ4LjQ5MSw1NC45NjNMNDMyLjE2OSw0Ni44NzdMNDQ0LjQzMiw1OC4zNjNMNDU1LjkyOSw3MS4xMzJMNDM2LjY2Nyw1OS43OTdMNDM0LjQ4Nyw2NC4zNDJMNDIwLjQ0Nyw1NC43NjVMNDA5Ljc0Niw0Mi4wNzNMMzk4LjI1OSwzMS4yM0wzOTQuNzgsMjYuMDQ0TDQxMC43MywyOC4wNjlMNDI3LjgzMSwzNy4xMDNMNDEwLjQ0LDI2LjU5M0w0MDEuMzM2LDIyLjMxNEwzOTEuOTksMTguNzAxTDM5Mi4wNDksMTguNjc3TDM5Mi4wNSwxOC42NzdMNDAxLjgxMiwyMi4wNkw0MTEuNDUsMjUuNzgzTDQyMC45NTIsMjkuODRMNDMwLjMwNywzNC4yMjVMNDM5LjUwMywzOC45MzVMNDQ4LjUyOSw0My45NjJMNDU3LjM3NCw0OS4zMDJMNDY2LjAyNyw1NC45NDdMNDc0LjQ3OCw2MC44OTFMNDgyLjcxNyw2Ny4xMjVMNDkwLjczMyw3My42NDRMNDk4LjUxNiw4MC40MzhMNTA2LjA1OCw4Ny41TDUxMy4zNDgsOTQuODIxTDUyMC4zNzksMTAyLjM5Mkw1MjcuMTQxLDExMC4yMDNMNTMzLjYyNywxMTguMjQ2TDUzOS44MjgsMTI2LjUxTDU0NS43MzYsMTM0Ljk4Nkw1NTEuMzQ1LDE0My42NjJMNTU2LjY0OCwxNTIuNTI5TDU2MS42MzksMTYxLjU3Nkw1NjYuMzEsMTcwLjc5MUw1NzAuNjU3LDE4MC4xNjRaTTE3MS4wOTksMzMuNTQxTDE3OC42NjYsMzAuMzEyTDE4Ny42MjEsMjYuMTYyTDE4Ny42MjEsMjYuMTYyTDE4OC4wODEsMjUuOTc0TDIwNC42ODgsMjAuNDdMMjA3LjMwNSwyMC40OTNMMjAwLjc1NiwyNS4wOTJMMTk0LjYsMzAuNzc5TDIwNS4zNjYsMzAuMjI2TDIwNi42OTUsMzguNzQ1TDIxNy44ODIsNDEuMDY1TDIyOS4zODYsNDQuMzc5TDI0MC42OTksMzUuMDcxTDIzOS43MjcsNDEuNjExTDIzOS43MjcsNDEuNjExTDIzOC42Miw0OC4xMDVMMjQ4LjI5NCw0MS41MTRMMjQ4LjgzMSw0OS4zNkwyMzkuNzYxLDUwLjEyNEwyMjQuMjE1LDU2Ljk2NkwyMDguOTM1LDY0LjY1N0wyMDIuNTQ1LDc3LjUwMUwyMjIuNDg3LDg2Ljg5M0wyMTkuMjUyLDk4LjA0MUwyNDAuMDY1LDgzLjE4OUwyNDYuMDMzLDYzLjgyMkwyNjMuOTIsNjguOTYzTDI2NS44NTMsNzguNjM4TDI3NS42MTIsNzEuNzg3TDI4MC41NzQsODUuNjYyTDI5Ny44MzMsMTAxLjM3M0wyODMuMzk0LDEwOC42NUwyNjIuNTgxLDEwOC4xODJMMjY2LjMxMSwxMjQuNTM4TDI4Mi43NjIsMTI2LjIyNkwyNjEuNDAyLDEzNS44MjVMMjQ0LjE3OSwxMzQuNTQ5TDIxNy40LDE1OC42OTlMMjE0Ljc2MiwxNjkuNjI0TDE4Ni41MDIsMTkwLjU4NEwxODEuODcxLDIxNy42MThMMTc2Ljc4MSwxOTMuNTkzTDEzNS40MzksMTkwLjk3OEwxMjIuODcyLDE5OS42NjVMMTEzLjg2NiwyMjMuNTI2TDEyMS4zNiwyNDYuOTQ5TDE1My44OTYsMjMzLjQ4TDE0MS4wOSwyNjEuMjIzTDE2NS4xMTcsMjY4LjM0N0wxNjkuNzU4LDMwMC45NTVMMjE3Ljk0NywyOTIuOTQ0TDI2NS4xNjQsMjk1LjkzN0wyODguOTYyLDMyMC43NDhMMzEwLjg4NywzMjMuNjUyTDMzMi44OSwzNTIuMjc1TDM5OS42NCwzNzUuOTEzTDM5OS4zODEsMzkzLjMzMUwzNzkuNDU3LDQxNy40NzVMMzcwLjY1NSw0MzkuMTYzTDM2MS4zNTYsNDU5Ljg3MkwzNDAuMDc2LDQ2NS4zODZMMzI3LjY1Nyw0ODQuNzE0TDMxMC4xNzcsNTAxLjI3TDI5Mi42MTEsNTE2LjExNkwyNzAuNTU1LDUyMi40ODRMMjYyLjg4Nyw1NDguMzA2TDI1MS44MzYsNTY0LjQ4OEwyMzguMTk0LDU2MC4wOThMMjI4LjM1NSw1NDQuOTg1TDIyOC4yNDQsNTIzLjI0NUwyMjkuMjk1LDQ5Ny44OTFMMjI2Ljg1Nyw0NjkuNjMxTDIyNS41MjUsNDM4LjgwNUwxOTcuMzI3LDQyMC4xNDFMMTgyLjQ5NSwzOTUuNTA2TDE2OC43OTQsMzY5Ljk1MUwxNzQuNDg3LDM0Mi42MzNMMTg4Ljc1MSwzMjcuOTM2TDE3NS45NjQsMzA3Ljg4OUwxNDQuMjU5LDI3Ny4wNDhMMTE4LjQ3MiwyNTYuNjQ3TDg5LjUxNCwyNDAuODQ3TDg3LjgwOCwyMTYuOTY2TDgyLjUwNiwxOTYuMDE4TDc5LjA5NSwxNzUuOTc1TDc4LjQ4NywxOTMuNjM5TDc5LjAyOSwyMTEuODU2TDczLjEyNiwxOTAuMjU0TDc2LjM4LDE3NS40NjlMODAuMzMsMTYxLjA3MUw4Mi4zOTgsMTQ1Ljc5NUw4NS40OTEsMTMxLjI0NUw5OS45NDksMTExLjk4NkwxMTUuNzY3LDk0LjAwNEwxMzAuMzIzLDc0LjcxN0wxNDYuNTE1LDU3LjYwM0wxNTEuMDA1LDUwLjUxOUwxNTYuMDc2LDQ0LjQwN0wxNDcuMTg3LDQ3LjQ3NUwxMzguOTgxLDUxLjY3M0wxNDUuMTYsNDcuODg4TDE1OS44NjMsMzkuMjc1TDE1OS44NjQsMzkuMjc1TDE2OS4wNDgsMzQuNTQzWk0yMjYuMjAzLDI4LjcwNUwyMzIuMDY4LDMxLjQ4NEwyMjcuMjg5LDM4LjIzNUwyMDcuODMzLDM4LjU5NEwyMTUuNTU2LDMwLjQ5MlpNMjU1LjExMiwzMy42OUwyNjEuOTksMzIuOTIxTDI3Ni40OCw0MS44MTlMMjc0LjM2NSw0Ni40ODdMMjg2LjEyNiw1MS45OTlMMjc2LjM3LDY0LjI2MUwyNjcuMDMyLDY1LjAwNEwyNTEuODk2LDU0LjkyNUwyNjUuMjY1LDQ3LjgxNEwyNTkuMjIxLDQxLjcyM0wyNDQuOTY0LDM5LjcwOVpNMjE0LjExNCwzMC41MzNMMjEyLjk0MSwyOC4xOTlMMjI0LjczNCwyNC4xNjFMMjI2LjcxMiwyNy43MzRaTTI0My40NiwyNC4yNTJMMjQwLjIxNywyNi43MzZMMjMyLjkwNCwyNC4xNDlaTTM5MC4yNywxOC4zNEwzOTAuMTMsMTguOTM3TDM3MS4zMTksMTMuNjZMMzU1Ljk5OSw5LjY4NUwzNzAuMDksMTIuODcxTDM4NC4wMTEsMTYuNzU1Wk0yNTcuNzk5LDI0LjY4OEwyNjQuMDIxLDMxLjQ2NUwyNTIuOTUxLDI5LjMyM1pNMzUwLjY3MywxNS44NDFMMzY0LjI4NSwxOS43OUwzNDguMzU5LDE3LjA3NFpNMzI0LjM0Miw1LjAwM0wzMjcuNjQyLDUuNDY0TDMyMS44NzIsNS4wNTVMMzI0LjA5MSw0Ljk4MkwzMjQuMDkxLDQuOTgyWk0yNzEuODI5LDIxLjA1NUwyNjMuMjg1LDIyLjcwNUwyNjYuMzM3LDE5LjM0NUwyNzIuNjY1LDE4LjA5Wk0yOTEuNzA3LDE2LjYwMkwyOTUuMjc4LDE3Ljg2NUwyODIuMzUsMjIuNDIxTDI2OS40ODgsMjguMDE3TDI2MC43OSwyNi40OTRMMjcyLjU1OSwyMS43NDRMMjc1LjEyNiwxNy4yMjdMMjg1LjQyNywxNi4xOTJaTTMxNS42MzIsMTUuNDg2TDMyMS4wNDEsMTYuMjI4TDMxNS43NiwxNy42MTFMMzI0LjAxMywxOC42ODNMMzMwLjQ0NywxNy41N0wzMzMuMzYsMjIuMjc5TDM0Ni42NywzMC42ODdMMzQ1LjIyOCwzNS4wNTRMMzU0LjI4Miw0MC41NkwzNDMuMzUzLDQ3LjM3NkwzMzIuMjEyLDU1LjQzNEwzMjkuNzI1LDcyLjRMMzE2LjkwOCw3MC4yNTRMMzAyLjA2Myw1MS4yMjJMMzAwLjQzNSwzNy4yNEwyOTUuMzcxLDMwLjU4OUwyODMuMzUsMjkuMTIxTDI4MS41MDIsMjQuMjEyTDI5OC40NTIsMTguMTc4TDMxMS4xNTgsMTUuNjM3WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzEyLjI5OSw1OTUuNzQ0TDMyMC44MTMsNTk1LjE5NkwzMjAuODEzLDU5NS4xOTZMMzE5LjYxNiw1OTUuMzQ5TDMxOS42MTYsNTk1LjM0OVpNMjk0LjE4Myw1OTIuMjlMMjg1LjY3Nyw1OTMuMTc3TDI5MC4yMzUsNTkwLjM2M1pNMjM2LjM4Nyw1ODkuMDg0TDIzNy40MTMsNTg5LjI3NUwyNTYuMjMyLDU5Mi41NjJMMjQ0LjcyOSw1OTAuMTc3TDI1Ni41ODMsNTkyLjA1MUwyNjUuNjE4LDU5Mi41NjJMMjg0LjA5Myw1OTQuMDlMMjk2LjMxNiw1OTMuNDQxTDI5NC41NDUsNTg4Ljc2NUwzMDUuODM3LDU5Mi4zOTZMMzA0LjIwOCw1OTQuNTg4TDI5My4zMjEsNTk1LjQzM0wyODUuNTc3LDU5NS4yNDRMMjkwLjMzMSw1OTUuODQyTDI5MC4zMzEsNTk1Ljg0MkwyODAuMDEyLDU5NS4zMjRMMjY5LjcxNyw1OTQuNDQ3TDI1OS40Niw1OTMuMjExTDI0OS4yNTIsNTkxLjYxN0wyMzkuMTA1LDU4OS42NjhaTTMyOS4yMzcsNTk0LjU1M0wzMjkuMjA5LDU5NC41NTNMMzQ4LjA1OSw1OTIuMDY4TDM2Mi45MTMsNTg5LjIxNUwzNzcuNTk5LDU4NS41OTZMMzgwLjA2MSw1ODQuOTY3TDM4MC4wNiw1ODQuOTY3TDM3MC4wNjYsNTg3LjU4OEwzNTkuOTg3LDU4OS44NThMMzQ5LjgzNCw1OTEuNzc1TDMzOS42MjEsNTkzLjMzNkwzMjkuMzYsNTk0LjU0Wk0zMjguOTA0LDEwNi42MzhMMzQyLjc0NiwxMTguODU2TDMxOS45NDEsMTE5LjIwOFpNNDM2LjAyOSw2My42NTlMNDUzLjYxNSw3NS4wOThMNDcwLjQyOCw4Ny42NjlMNDYyLjkyNyw5My4wMjRMNDQ5LjkwMiw3Ny43MTJaTTM5MS4yMjQsNDUuODI3TDM5NS41NjQsNTQuOTY1TDM3OS42Niw1MC42MDhaTTU0Ni44ODQsNDYzLjI5Mkw1NTMuNjg5LDQ1Mi4xNTJMNTU5LjY4OSw0NDAuNTI5TDU2OS4wMDksNDE4LjMwOEw1NzUuODgzLDM5NS4wMTFMNTgzLjgxNCwzNzAuNzA1TDU4Ni4wNzIsMzU0LjA1NUw1ODcuMiwzMzcuMTkyTDU4NC4xODksMzE5Ljk5NUw1ODUuMjI2LDI5Ny44MjlMNTc1LjI4MSwyODYuMTk1TDU2My41MSwyOTUuODI1TDU0OC44NzcsMzA1LjVMNTMzLjg3LDI4OC42NDVMNTE2LjMzMiwyNzEuOTE0TDUxMS4zNzQsMjQ5LjY0OEw1MDUuMTU5LDIyNy42ODJMNTA1LjAxMiwyMDAuMzM5TDUxMS4yNCwxNzkuODEyTDUwOC45ODMsMTY1LjIyOUw1MDYuMDM5LDE1MS4wOUw1MjYuNzU1LDEzNC4wNjJMNTQwLjE4MSwxNTAuMzAyTDU0Ny43NTUsMTUzLjY2OEw1NTQuMjksMTU3LjY0OEw1NDguNDE0LDE0NS42MTNMNTUxLjQyNiwxNDYuMjI0TDU1My40NzYsMTQ3LjQyM0w1NTIuMTg2LDE0NS4wMjJMNTUyLjE4NiwxNDUuMDIyTDU1Ny40NDEsMTUzLjkxOEw1NjIuMzgyLDE2Mi45OTFMNTY3LjAwNCwxNzIuMjMyTDU3MS4zMDEsMTgxLjYyOEw1NzUuMjY2LDE5MS4xNjhMNTc4Ljg5NywyMDAuODQxTDU4Mi4xODgsMjEwLjYzNUw1ODUuMTM1LDIyMC41MzdMNTg3LjczNCwyMzAuNTM3TDU4OS45ODMsMjQwLjYyMUw1OTEuODc5LDI1MC43NzdMNTkzLjQxOSwyNjAuOTk0TDU5NC42MDEsMjcxLjI1OEw1OTUuNDI1LDI4MS41NTdMNTk1Ljg4OSwyOTEuODc4TDU5NS45OTIsMzAyLjIwOUw1OTUuNzM0LDMxMi41MzhMNTk1LjExNywzMjIuODUxTDU5NC4xMzksMzMzLjEzN0w1OTIuODA0LDM0My4zODJMNTkxLjExMSwzNTMuNTc0TDU4OS4wNjQsMzYzLjcwMUw1ODYuNjY1LDM3My43NTFMNTgzLjkxNywzODMuNzFMNTgwLjgyMiwzOTMuNTY4TDU3Ny4zODYsNDAzLjMxMUw1NzMuNjExLDQxMi45MjlMNTY5LjUwMyw0MjIuNDA5TDU2NS4wNjcsNDMxLjc0TDU2MC4zMDgsNDQwLjkxMUw1NTUuMjMyLDQ0OS45MDlMNTQ5Ljg0NCw0NTguNzI1Wk01MzYuNjU4LDEyMi4yMTFMNTM3LjE5NywxMjQuMDU0TDUyOC40NzEsMTEzLjkxMUw1MjQuMjgyLDEwNy4zNDVMNTE5LjQzNSwxMDEuMzQ0TDUxOS40MzYsMTAxLjM0NEw1MjYuMjM1LDEwOS4xMjRMNTMyLjc1OSwxMTcuMTM1Wk01MDUuNTI2LDg2Ljk4Nkw1MDIuNDE4LDg0LjcyMUw1MTIuODI5LDk1LjA5M0w1MjIuNzE0LDEwNS45NzJMNTI0Ljk5NiwxMTIuMjY2TDUzNi40NzUsMTI3LjU4NUw1MTkuOTMyLDEwOS42NTdMNTExLjM2LDEwMy44NTZMNTAyLjE4Niw5OC42MTRMNTEzLjQ3NSwxMDYuODY2TDUyNC4wNTYsMTE1Ljc1OUw1MjMuNDI1LDExOC45OUw1MTMuNzAyLDExMi4zNzhMNTAzLjI5OCwxMDYuMzY2TDUwMC42MTcsMTE0LjkyMkw1MDYuMzg0LDEyOS40NDVMNTExLjI1NCwxNDQuNzFMNDk2LjU1NCwxNDguMDMyTDQ4Ny44MjYsMTM0LjkzN0w0NzguNTU0LDEyMi4zMkw0OTEuNzE4LDExNi41MThMNDc0Ljg0Niw5Ni40MDZMNDcxLjM4NCw4My44ODVMNDY2Ljk5NSw3Mi41MzNMNDY4LjYxNiw2Mi41NzJMNDUxLjU1Niw1MC40MDVMNDM1Ljg1OSw0Mi44MDVMNDUwLjU5NCw1My44ODFMNDY0LjUzLDY2LjI2NEw0NDUuNDc5LDU1LjUxTDQ0NS41NjgsNjAuMDg3TDQzMC42OTYsNTAuOTQ5TDQxNi41NjYsMzguNjM1TDQwMS42LDI4LjE5NEwzOTUuMzEzLDIzLjE1Nkw0MDcuMjY2LDI0Ljc1N0w0MjUuOTExLDMzLjI0OUw0MTEuMTUxLDI1LjkzOUwzOTUuODU1LDE5Ljk1TDM5NS44NTYsMTkuOTUxTDQwNS41NzEsMjMuNDY2TDQxNS4xNTcsMjcuMzE5TDQyNC42MDQsMzEuNTA0TDQzMy44OTgsMzYuMDE2TDQ0My4wMjksNDAuODVMNDUxLjk4Niw0Nkw0NjAuNzU4LDUxLjQ1OUw0NjkuMzM0LDU3LjIyMUw0NzcuNzA0LDYzLjI3OEw0ODUuODU3LDY5LjYyNEw0OTMuNzg0LDc2LjI1MUw1MDEuNDc1LDgzLjE1Wk0yMDkuMTY4LDE4LjI4MUwyMDYuNzE5LDE5LjA5NEwyMDMuNzA0LDIwLjEyN0wyMDMuNzA0LDIwLjEyN0wxODMuNTQ2LDI4LjM2N0wxNzguNDczLDMwLjE1MUwxODIuNDA5LDI4LjM2TDE4Mi40MDksMjguMzZMMTkxLjk2MSwyNC40MjJMMjAxLjY0NCwyMC44MTlaTTIxNC45NSwxNi42NDhMMjExLjkxOSwxNy41MjVMMjE0LjAxOCwxNi44NDVaTTI1NS4yOTEsNDMuMjA2TDI1Ni4zOCw0OS43TDI2NC4zMSw0Mi44NDJMMjY3LjUxNyw1MC42MzFMMjU4LjI0NSw1MS42NzRMMjQzLjg2NCw1OC45N0wyMjkuNjgsNjcuMTA5TDIyNi4yNDMsODAuMTAyTDI0OS43NzMsODguODMzTDI0OC43MjMsMTAwLjA0NkwyNjcuMzQsODQuNTk2TDI2OC44MTUsNjUuMTE2TDI4OC41MzcsNjkuNjg2TDI5Mi43OTEsNzkuMjY2TDMwMS4wNjcsNzIuMTQxTDMwOS4xNTgsODUuODE4TDMyOS40MDUsMTAwLjk1OUwzMTYuMzkyLDEwOC42NTNMMjk1LjM4MywxMDguODIxTDMwMS44ODksMTI1LjAyMUwzMTguNjU2LDEyNi4yMDRMMjk4LjYzNywxMzYuNDMyTDI4MC45MTIsMTM1LjY4OEwyNTYuNTcxLDE2MC42MTRMMjU1LjE2OSwxNzEuNkwyMjcuNzcsMTkzLjQwNkwyMjUuNDA1LDIyMC41NDZMMjE3LjcxOSwxOTYuNzE1TDE5NC42OCwxOTUuNzA0TDE3Mi4zNzEsMTk1LjQxN0wxNTkuMjg1LDIwNC40OTRMMTUxLjUxLDIyOC42MUwxNjEuODAyLDI1MS43NjJMMTk2LjYzNywyMzcuMjdMMTg0LjUyMywyNjUuMzkxTDIxMC45NDMsMjcxLjc0OUwyMTcuMjIxLDMwNC4xOTJMMjY3LjYwMSwyOTQuNjgzTDMxNS44MzMsMjk2LjIyNUwzNDAuMjE0LDMyMC4zMDVMMzYxLjg1OCwzMjIuNTQ3TDM4My40NzIsMzUwLjUwN0w0NDYuMjc4LDM3Mi4xNzdMNDQ1LjYxNiwzODkuNjA5TDQyNi4yMjIsNDE0LjM1MUw0MTYuNzg5LDQzNi4zMTZMNDA2LjUzMyw0NTcuMzIxTDM4NS44NzIsNDYzLjQ3MkwzNzIuMDc2LDQ4My4xOThMMzUzLjE2Nyw1MDAuMzA3TDMzMy44MDYsNTE1LjcxNUwzMTAuNzE2LDUyMi43NjhMMjk3Ljc1MSw1NDguOTA0TDI4OS43MTYsNTU3Ljc0MUwyODEuNzI1LDU2NS40OTdMMjY4LjcwNSw1NjEuNTEzTDI2Mi40NjIsNTQ2LjY0NEwyNzEuOTg2LDQ5OS4zOTFMMjczLjY5OCw0NDAuMzM2TDI0NS4zMSw0MjIuNTMyTDIzMC42NTQsMzk4LjM0NEwyMTYuNjY2LDM3My4yMUwyMjIuOTM5LDM0NS43MUwyMzcuOTQ3LDMzMC41NjlMMjI0LjAyNywzMTAuOTI4TDE4OC43OTksMjgxLjEwNEwxNTkuMjEyLDI2MS41NDNMMTI1LjA1LDI0Ni43MDJMMTIwLjgzOCwyMjIuOTEyTDExMi4wNDcsMjAyLjE3OEwxMDQuODkxLDE4Mi4yOTVMMTA2Ljg2NywxOTkuOTM4TDEwOS44NDYsMjE4LjEwMkw5OS44MTEsMTk2Ljc0MkwxMDMuNjk5LDE2Ny4zOUwxMDMuMDExLDE1Mi4wOTNMMTAzLjI1MSwxMzcuNDkzTDExNi4yNDQsMTE3LjgxN0wxMzAuNDg1LDk5LjM3OUwxNDEuNDczLDc5LjcwM0wxNTMuOTksNjIuMTUzTDE1NS4zODMsNTQuOThMMTU3LjM0LDQ4Ljc2MUwxNDUuNyw1Mi4xNDFMMTM0Ljc0OSw1Ni42M0wxNDEuNDQyLDUyLjY0OUwxNTEuMjM3LDQ1LjU0NkwxNjEuNDEyLDM5LjA5MkwxNzQuNTU2LDM0LjA2MUwxODEuMjI5LDI5LjU4M0wyMDEuMTA1LDIzLjQyTDIwNS40MTQsMjMuMzM5TDIwMS45ODEsMjguMDg5TDE5OC45MzUsMzMuOTE2TDIxMS43ODQsMzMuMDAzTDIxNy44ODgsNDEuNDFMMjMxLjQzLDQzLjM1NEwyNDUuMjM1LDQ2LjI4NEwyNTMuNzgyLDM2LjY3NFpNMjM0Ljk3MywzMC44MTRMMjQyLjg1OCwzMy4zODRMMjQwLjU5NSw0MC4yNDJMMjE5LjExMyw0MS4yMjNMMjIzLjg2NSwzMi45MzFaTTI2OC40ODMsMzQuODVMMjc1LjM0NiwzMy44NzNMMjkzLjQ4MSw0Mi4yNzVMMjkyLjg3LDQ2Ljk4NUwzMDYuMzkxLDUyLjExM0wyOTkuOTY1LDY0LjYyTDI5MC43MDUsNjUuNjQ2TDI3Mi40MDUsNTYuMDc1TDI4NC4wMTcsNDguNTg0TDI3NS43NzcsNDIuNzExTDI2MC4xNCw0MS4xNVpNMjIyLjIyOSwzMy4wMTlMMjE5LjQ5LDMwLjc0NEwyMzAuNjU1LDI2LjM1OEwyMzUuMDIyLDI5LjgzNVpNMjUxLjY2MSwyNS44NDVMMjQ5LjQzOCwyOC40MTNMMjM5LjkzNCwyNi4wOFpNMzgyLjkzMSwxNS44NTVMMzg0LjA5NCwxNi4yOUwzNjUuNTcyLDExLjU4MUwzNDguNzk2LDguMDkzTDM2My4xMjYsMTAuODQ3TDM3Ny4zMDMsMTQuMzA1TDM4MC4yMSwxNS4wNzVMMzgwLjIxLDE1LjA3NVpNMjY3LjI3MiwyNS44MjdMMjc2Ljg1NiwzMi4zNjRMMjY0LjM0NCwzMC41NzlaTTM1Mi41NTEsMTQuMjczTDM2Ni45MDksMTcuNzk3TDM1MS40NjEsMTUuNTU4Wk0zMTYuODkzLDQuNDgyTDMyMC4wNTcsNC43NEwzMTQuNzA1LDQuNDk5TDMxNC43OTgsNC4zN0wzMTQuNzk4LDQuMzdaTTI4MC4wOCwyMS43ODVMMjcyLjAzOSwyMy42ODhMMjczLjQwNywyMC4yNjFMMjc5LjI4NiwxOC44MlpNMjk3LjgzMSwxNi43NjFMMzAyLjEzMiwxNy45MDVMMjkxLjU2NSwyMi44MTdMMjgxLjAzLDI4Ljc2OUwyNzEuMjk2LDI3LjUyNkwyODEuMTk3LDIyLjQ0NkwyODEuMzIzLDE3Ljg4OUwyOTEuMjUxLDE2LjU0N1pNMzIwLjUyMSwxNC45MzdMMzI2LjEwNiwxNS41MTJMMzIxLjkzOCwxNy4wMzhMMzMwLjM2NSwxNy44NTdMMzM1LjY5NiwxNi41NjVMMzQxLjAzNiwyMS4xNDlMMzU3LjI3LDI5LjEwOEwzNTcuNzU1LDMzLjQ5TDM2OC4xNjYsMzguN0wzNTIuMzI2LDU0LjE1TDM1NC4zNzIsNzEuMTIyTDM0MS41MDgsNjkuMzY2TDMyMS45NTYsNTAuODU3TDMxNS44MTEsMzYuOTkzTDMwOC4yNzEsMzAuNTM0TDI5NS42NDMsMjkuNDRMMjkxLjU3NywyNC42MjFMMzA1LjQ1NCwxOC4xMTlMMzE2LjMzOCwxNS4yMTlaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzI2LjUzMSw1OTQuODA5TDMzMC41MTEsNTk0LjQxNkwzMzAuNTExLDU5NC40MTZMMzI5Ljc0NSw1OTQuNTAyTDMyOS43NDUsNTk0LjUwMlpNMzExLjAxMiw1OTIuMjExTDMwMS4yNjUsNTkzLjM3NUwzMDguODI3LDU5MC4zNzdaTTIzOS4yMTYsNTg5LjY5MkwyNDQuMjgyLDU5MC42NDhMMjQ3LjgzLDU5MS4wMThMMjY3LjQ5NSw1OTMuNzIxTDI1Ny41NTYsNTkxLjY2MkwyNjkuNjI1LDU5My4xNzJMMjc5LjkyMiw1OTMuMzg5TDI5OC4yNTcsNTk0LjM1OUwzMTEuODMyLDU5My4zMTdMMzE0LjQxOSw1ODguNjI5TDMyMi4zNzYsNTkxLjk2OEwzMTcuOTEzLDU5NC4yNTJMMzA1LjI0Nyw1OTUuNDU1TDI5Ny4zNCw1OTUuNTA0TDI5OS41MTIsNTk2TDI5OS41MTIsNTk2TDI4OS4xODIsNTk1LjgwMkwyNzguODY1LDU5NS4yNDVMMjY4LjU3NCw1OTQuMzI3TDI1OC4zMjIsNTkzLjA1MUwyNDguMTIsNTkxLjQxOFpNMzYwLjY0LDEwNS4yNzhMMzc1Ljk5NSwxMTcuMDUyTDM1NC4xMjIsMTE4LjA4M1pNNDQ2LjUyNCw1OS4zNjZMNDY0LjMyMyw3MC4yNjhMNDgxLjI5NSw4Mi4zMjVMNDc3LjMwMiw4Ny44NTVMNDYyLjM3Myw3Mi45NjhaTTQwMi45MDEsNDIuODc4TDQwOS45NDcsNTEuODQzTDM5NC41NDgsNDcuOTYxWk01ODIuMTUyLDM4OS40NzlMNTgzLjA2OSwzODYuNTE5TDU4NS4xNDIsMzc5LjQzNkw1ODUuMTQyLDM3OS40MzZMNTgyLjE5NiwzODkuMzM5Wk01OTEuMTYzLDM1My4yOTFMNTk0LjQyOSwzMjguMzU2TDU5NC4yMTEsMzExLjIwN0w1OTQuMzU1LDI4OS4wMjRMNTkyLjE5LDI4My4yOTdMNTg5LjEzNywyNzcuNjJMNTgyLjQyNywyODcuNTMxTDU3Mi42NDgsMjk3LjU3N0w1NjAuOTQyLDI4MS4xMjhMNTQ2LjQxMywyNjQuODg0TDU0MS4wMTgsMjQyLjc3NUw1MzQuMTksMjIxLjAwN0w1MzEuMTgzLDE5My43MTJMNTMzLjMwMSwxNzMuMDU4TDUyOS4yMDEsMTU4LjU3Mkw1MjQuMzQ4LDE0NC41NTJMNTMwLjY1NCwxMzQuODI1TDUzNC4yMjMsMTI3LjA1OUw1NDYuODQ4LDE0Mi45MDNMNTUxLjQ1MiwxNDYuMDg0TDU1NS4wMDIsMTQ5LjkxMUw1NDcuNzY4LDEzOC4wNzVMNTQ3LjgxMywxMzguMTIxTDU0Ny44MTMsMTM4LjEyMUw1NTMuMzExLDE0Ni44NjhMNTU4LjUwMSwxNTUuODAyTDU2My4zNzYsMTY0LjkxMUw1NjcuOTMsMTc0LjE4NUw1NzIuMTU4LDE4My42MTNMNTc2LjA1NCwxOTMuMTgyTDU3OS42MTQsMjAyLjg4MUw1ODIuODMzLDIxMi42OTlMNTg1LjcwNywyMjIuNjIyTDU4OC4yMzQsMjMyLjY0MUw1OTAuNDA5LDI0Mi43NDFMNTkyLjIzLDI1Mi45MTFMNTkzLjY5NiwyNjMuMTM4TDU5NC44MDMsMjczLjQxMUw1OTUuNTUyLDI4My43MTVMNTk1Ljk0LDI5NC4wNEw1OTUuOTY4LDMwNC4zNzJMNTk1LjYzNSwzMTQuNjk4TDU5NC45NDIsMzI1LjAwN0w1OTMuODg5LDMzNS4yODVMNTkyLjQ3OSwzNDUuNTJaTTUyMi4yMzEsMTA0LjQ3N0w1MjMuMDY4LDEwNS40NTlMNTM1LjI3MSwxMjAuNDE4TDUyMC4yNDIsMTAyLjk2OUw1MTMuNjY4LDk3LjM5OUw1MDYuNDg2LDkyLjQwNUw1MTYuMTg2LDEwMC4zMzlMNTI1LjE3LDEwOC45MzRMNTI2LjU4MywxMTIuMTU0TDUxOC44NDMsMTA1LjgwN0w1MTAuNDA1LDEwMC4wODFMNTExLjU3MiwxMDguNjZMNTE5LjY5MiwxMjIuOTcyTDUyNi44NTUsMTM4LjA1NEw1MTYuNSwxNDEuNzU3TDUwNy4wODQsMTI4LjkzOEw0OTcuMDY3LDExNi42MTNMNTA1LjY5NywxMTAuNDhMNDg3LjQwNiw5MC45MDNMNDgwLjYzMyw3OC41MzdMNDcyLjg4Myw2Ny4zN0w0NzAuNzcsNjEuOTMxTDQ2Ny45NjQsNTcuNDU5TDQ1MC4wMTYsNDUuODIzTDQzNS40MiwzOC42ODRMNDUyLjE4MSw0OS4yODFMNDY4LjEzMyw2MS4yMUw0NDkuODcsNTEuMDIzTDQ1Mi4yMjYsNTUuNTYzTDQzNi45NzUsNDYuODgzTDQxOS44NDQsMzUuMDQ0TDQwMS44NTQsMjUuMTAzTDM5Mi45NDksMjAuMjk2TDQwMC41NDMsMjEuNkw0MjAuMTY1LDI5LjUxTDQxNC4xOTcsMjYuOTE2TDQxNC4xOTcsMjYuOTE2TDQyMy42NTgsMzEuMDY4TDQzMi45NjgsMzUuNTQ3TDQ0Mi4xMTcsNDAuMzQ5TDQ1MS4wOTIsNDUuNDY3TDQ1OS44ODMsNTAuODk1TDQ2OC40NzksNTYuNjI2TDQ3Ni44Nyw2Mi42NTRMNDg1LjA0Niw2OC45NzJMNDkyLjk5Niw3NS41N0w1MDAuNzExLDgyLjQ0Mkw1MDguMTgxLDg5LjU4TDUxNS4zOTgsOTYuOTczWk0yMTAuNzEzLDE3Ljc4OEwyMDguMzQ0LDE4LjYzOEwyMDAuMDk1LDIyLjAyOUwxOTcuMzY5LDIzLjE0OUwxOTcuMzY5LDIzLjE0OUwxNzkuOTM1LDMxLjk2MUwxNzMuMDk4LDMzLjkyNUwxNzkuMDc1LDMwLjIyNkwxNzkuMDU2LDMwLjIzM0wxNzAuNTEsMzQuMDE5TDE2OC4zLDM0LjkxM0wxNjguMzAxLDM0LjkxM0wxNzcuNjMyLDMwLjQ3OEwxODcuMTEzLDI2LjM3MkwxOTYuNzMxLDIyLjU5OUwyMDYuNDc1LDE5LjE2NFpNMjA5LjM1NSwxOS4zMTdMMjA2LjEyNSwyMC4yODlMMjA3Ljk1NCwxOS41NVpNMjcyLjIxMyw0NC4zMDdMMjc1LjQ2Niw1MC43MzVMMjgxLjQxLDQzLjY2N0wyODcuMTkxLDUxLjMxOUwyNzcuOTk4LDUyLjY0MkwyNjUuMjE5LDYwLjM1MUwyNTIuNTYxLDY4Ljg5OEwyNTIuMTgzLDgxLjk0OUwyNzguNTg0LDg5LjkyMkwyNzkuNzUxLDEwMS4xMzNMMjk1LjYwNyw4NS4xNTlMMjkyLjU0NCw2NS43MDNMMzEzLjUwMiw2OS42NTVMMzE5Ljk0Nyw3OS4wNzNMMzI2LjQ4OSw3MS43MjJMMzM3LjQ2NSw4NS4xMUwzNjAuMDgzLDk5LjZMMzQ4Ljg5MiwxMDcuNjYyTDMyOC4zMjUsMTA4LjQ2TDMzNy40MTEsMTI0LjQyNEwzNTMuOTgyLDEyNS4xMDFMMzM1LjkxMywxMzUuOTA3TDMxOC4yMjQsMTM1LjcwMUwyOTcuMDYxLDE2MS4zMThMMjk2LjkzOCwxNzIuMzI3TDI3MS4yMzEsMTk0Ljk0TDI3MS4yMDYsMjIyLjExN0wyNjEuMTU3LDE5OC41NTVMMjM2Ljk1MSwxOTguMjYyTDIxMy4xODEsMTk4LjY3NUwxOTkuOTczLDIwOC4xNTFMMTkzLjY2NSwyMzIuNDgyTDIwNi40NDQsMjU1LjI4M0wyNDIuNTE5LDIzOS43MTRMMjMxLjQ2NCwyNjguMTg3TDI1OS40NzUsMjczLjcxOEwyNjcuMTk5LDMwNS45NDhMMzE4LjI0LDI5NC44OThMMzY2LjAyMiwyOTQuOTgyTDM5MC4yNDUsMzE4LjMyM0w0MTAuOTQ5LDMxOS45MjJMNDMxLjUxNywzNDcuMjQxTDQ4OC40NzIsMzY3LjA5MUw0ODcuNDI2LDM4NC41NDlMNDY5LjE1Myw0MDkuODYzTDQ1OS4zNzQsNDMyLjEyTDQ0OC40NzMsNDUzLjQ0N0w0MjkuMDU4LDQ2MC4yMDdMNDE0LjMwNSw0ODAuMzY3TDM5NC41NDEsNDk4LjA2M0wzNzMuOTc0LDUxNC4wNzdMMzUwLjU1Miw1MjEuODM3TDM0MS43MzksNTM1LjgyNkwzMzIuNjgzLDU0OC40NDJMMzIyLjQ3Myw1NTcuNTU2TDMxMi4xNjksNTY1LjU5TDMwMC4xNjYsNTYxLjk4NkwyOTcuNzEsNTQ3LjI0OUwzMDYuNjcyLDUyNS4yMzhMMzE1LjUyNyw0OTkuNTgxTDMyMi42Nyw0NDAuMzkxTDI5NC45NTUsNDIzLjQzOUwyNjcuMDcsMzc0Ljk3N0wyNzMuNzMyLDM0Ny4yOEwyODkuMDI5LDMzMS42NzhMMjc0LjM5OCwzMTIuNDcxTDIzNi43MTgsMjgzLjc1NEwyMDQuMjMsMjY1LjEzN0wxNjUuOTAxLDI1MS4zOTdMMTU5LjMxMSwyMjcuNzcxTDE0Ny4yOTksMjA3LjM1M0wxMzYuNjE0LDE4Ny43NDFMMTQ2LjQ0MiwyMjMuMzIzTDEzMi41NzksMjAyLjMyN0wxMzMuMDMyLDE3Mi45MDlMMTI2Ljk5LDE0My4xMTFMMTM4LjEyMiwxMjMuMDY4TDE1MC4zNTMsMTA0LjIyN0wxNTcuNDM5LDg0LjI3OEwxNjUuOTAxLDY2LjQwOUwxNjIuOTM5LDUzLjAxTDE0OC45MDEsNTYuNzgxTDEzNS41MzksNjEuNjM5TDE0Mi41NDEsNTcuNDVMMTUwLjQ3Myw1MC4wNzhMMTU4Ljc4Nyw0My4zNDNMMTc0LjI1NywzNy44NzdMMTc4LjIzMSwzMy4yMzdMMjAwLjUyNiwyNi40MzRMMjA2LjM5OCwyNi4xOThMMjA2LjM0MSwzNi44NzRMMjIwLjg4MywzNS41NDZMMjMxLjU3NSw0My42OTdMMjQ3LjA2MSw0NS4yTDI2Mi43NDksNDcuNjgyTDI2OC4yNjksMzcuODU4Wk0yNDUuNzIsMzIuNjI2TDI1NS4zODMsMzQuOTNMMjU1LjcwNyw0MS44MTdMMjMyLjg1MSw0My40NzJMMjM0LjQ4NiwzNS4wODNaTTI4Mi44MTIsMzUuNTlMMjg5LjQ1MiwzNC40MDhMMzEwLjY3OSw0Mi4yMTJMMzExLjU5MSw0Ni45MTdMMzI2LjQ2MSw1MS42MTRMMzIzLjU2LDY0LjI2M0wzMTQuNjU5LDY1LjU2NUwyOTMuNzU0LDU2LjU5TDMwMy4yNTUsNDguNzc3TDI5My4wNjgsNDMuMTg0TDI3Ni41MjcsNDIuMTEyWk0yMzIuNzA2LDM1LjIyM0wyMjguNDg2LDMzLjA1NEwyMzguNjg0LDI4LjM0M0wyNDUuMzA2LDMxLjY1M1pNMjYxLjMzLDI3LjE2N0wyNjAuMTk1LDI5Ljc4NUwyNDguNzg5LDI3Ljc3MVpNMzU5Ljc3MiwxMC4wOThMMzU3LjgzMyw5LjcwNkwzNTMuNzY0LDguOTI0TDM1My43NjUsOC45MjRaTTI3Ny43NCwyNi42NjJMMjkwLjM5NSwzMi44NjFMMjc2LjgxOSwzMS40NzNaTTM1Mi44MzMsMTIuNjcyTDM2Ny41MDEsMTUuNzU1TDM1MywxMy45NzFaTTMwOS4zODIsNC4xNDlMMzExLjg2Myw0LjI1NUwzMDcuMDkxLDQuMTY4TDMwNS45NDcsNC4wNkwzMDUuOTQ3LDQuMDZaTTI4OC45MzYsMjIuMjU2TDI4MS42NDQsMjQuMzkxTDI4MS4yODUsMjAuOTQ5TDI4Ni41MzcsMTkuMzM5Wk0zMDQuMDIyLDE2LjczM0wzMDguOTIxLDE3LjczN0wzMDEuMDM3LDIyLjkzTDI5My4xNDgsMjkuMTYxTDI4Mi42NzQsMjguMjI1TDI5MC40MDcsMjIuODc3TDI4OC4wODcsMTguMzU0TDI5Ny4zNDEsMTYuNzJaTTMyNC43ODcsMTQuMjQ4TDMzMC4zNzksMTQuNjU0TDMyNy40NDksMTYuMjg4TDMzNS43OTUsMTYuODUyTDMzOS44NiwxNS40MTdMMzQ3LjQ2NSwxOS44MDRMMzY2LjEyOSwyNy4yMzRMMzY4LjUyOCwzMS41NzFMMzc5Ljk3OSwzNi40NDlMMzcwLjg1LDUyLjI3OEwzNzcuMzY2LDY5LjEyMUwzNjQuODQ4LDY3Ljc1TDM1My4xMDksNTguMzk5TDM0MS4xODIsNDkuODk3TDMzMC43MDYsMzYuMjg2TDMyMC45MTksMzAuMDlMMzA4LjA2OCwyOS4zODNMMzAxLjkwOCwyNC43MkwzMTIuMjksMTcuODQ5TDMyMS4wMjEsMTQuNjUyWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzI3LjUwNiw1OTEuNjI2TDMxNi44MTUsNTkzLjEwMUwzMjcuMTUyLDU4OS44MzFaTTIzOC41NDIsNTg5LjU1TDIzOC40NTksNTg5LjUzTDI1NC45MDUsNTkyLjE4TDI1OS44MzMsNTkyLjQyMUwyNzkuNzQ3LDU5NC41MjJMMjcxLjY3Miw1OTIuNzM3TDI4My41OTEsNTkzLjg4MkwyOTQuODM3LDU5My43NzNMMzEyLjQ3NSw1OTQuMTk2TDMyNi45ODksNTkyLjcyN0wzMzMuODU2LDU4Ny44OTVMMzM4LjIzNiw1OTEuMDQ3TDMzMS4wNzMsNTkzLjUwOEwzMTcuMDEzLDU5NS4xMTdMMzA5LjE4NSw1OTUuNDA1TDMwOC40NzUsNTk1Ljg3OUwzMDguNDc1LDU5NS44NzlMMjk4LjE0NCw1OTUuOTk0TDI4Ny44MTUsNTk1Ljc0OUwyNzcuNTAxLDU5NS4xNDRMMjY3LjIxNCw1OTQuMTc5TDI1Ni45NjgsNTkyLjg1NUwyNDYuNzczLDU5MS4xNzVaTTM5MC41MzQsMTAyLjk4MUw0MDYuOTM1LDExNC4yNzNMMzg2LjY1NywxMTUuOTQ0Wk00NTIuNTY3LDU0LjgyMkw0NzAuMDM4LDY1LjE4OEw0ODYuNjU0LDc2LjczNUw0ODYuMjg5LDgyLjMzMkw0NjkuOTA5LDY3LjkyWk00MTEuNDUyLDM5LjYyMkw0MjAuOTg4LDQ4LjMzNUw0MDYuNTYyLDQ0LjkwNlpNNTk0LjY3OSwyNzIuMDYyTDU5NC4yMDgsMjY4Ljc1OEw1OTMuODg0LDI3My43MzlMNTkyLjc2MiwyNzguNzkyTDU5MC44NDQsMjgzLjkwM0w1ODguMTM1LDI4OS4wNTdMNTg0LjQ5NSwyODAuOTU3TDU4MC4wODUsMjcyLjkwOUw1NjkuMDA2LDI1Ny4wNTNMNTYzLjMzOSwyMzUuMTEzTDU1Ni4xMDUsMjEzLjU1OEw1NTAuMzI5LDE4Ni4zOTdMNTQ4LjI3MywxNjUuNzQyTDU0Mi40NTYsMTUxLjQwN0w1MzUuODQsMTM3LjU2MUw1MzYuNjExLDEyNy43MjZMNTM1Ljk0MywxMjMuNTY5TDUzNC41NzQsMTE5LjkzN0w1NDYuMDE0LDEzNS40MTZMNTQ2LjI1LDEzNS43NTRMNTQ2LjI1LDEzNS43NTRMNTUxLjgzMiwxNDQuNDQ4TDU1Ny4xMDgsMTUzLjMzMkw1NjIuMDcsMTYyLjM5NEw1NjYuNzEyLDE3MS42MjRMNTcxLjAzLDE4MS4wMUw1NzUuMDE4LDE5MC41NDFMNTc4LjY3LDIwMC4yMDZMNTgxLjk4MywyMDkuOTkyTDU4NC45NTMsMjE5Ljg4OEw1ODcuNTc1LDIyOS44ODJMNTg5Ljg0NywyMzkuOTYxTDU5MS43NjYsMjUwLjExM0w1OTMuMzI5LDI2MC4zMjZMNTk0LjUzNSwyNzAuNTg3Wk01MDcuMzgyLDg4Ljc5Mkw1MDQuNTEyLDg2LjE2Mkw1MDkuMzgsOTAuNzczTDUwOS4zOCw5MC43NzNMNTE2LjU1NSw5OC4yMDhMNTIwLjE4OCwxMDIuMTc4TDUxMS4xMTksOTMuNjc3TDUxNi4wOTksMTAyLjE2Mkw1MjYuMzI0LDExNi4xOTZMNTM1LjU2MywxMzEuMDI5TDUyOS44NjksMTM0Ljk3Nkw1MjAuMDUsMTIyLjQ0OEw1MDkuNTkyLDExMC40MzVMNTEzLjQyNiwxMDQuMTEzTDQ5NC4yNzIsODUuMTA0TDQ4NC4zOTMsNzIuOTkyTDQ3My41MTcsNjIuMTA3TDQ2OC45MTksNTcuNDAzTDQ2My43OTcsNTMuNDUxTDQ2My43OTcsNTMuNDUxTDQ3Mi4zMDIsNTkuMzE3TDQ4MC41OTcsNjUuNDc3TDQ4OC42NzEsNzEuOTIzTDQ5Ni41MTYsNzguNjQ2TDUwNC4xMjIsODUuNjRaTTQ0MC43MTIsMzkuNTg1TDQzMC44NjcsMzQuNjM4TDQ0OS4xNDMsNDQuNzAzTDQ2Ni42MjcsNTYuMTI0TDQ0OS43MDcsNDYuNDcyTDQ1NC4yNTksNTAuOTA3TDQzOS4wOTIsNDIuNjg5TDQxOS40ODEsMzEuNDA4TDM5OS4wMTMsMjIuMDUyTDM4Ny43NjIsMTcuNTUxTDM4OS4xNCwxNy43NDFMMzg5LjE0LDE3Ljc0MUwzOTguOTM2LDIxLjAyNEw0MDguNjEyLDI0LjY0N0w0MTguMTU2LDI4LjYwNUw0MjcuNTU1LDMyLjg5NEw0MzYuNzk5LDM3LjUwOFpNMjIyLjAzOSwxNC40NTFMMjEyLjgsMTcuMjE0TDIwNS4wNjksMTkuNzA5TDIwMi40NjgsMjEuNTEyTDE5Ni41MDcsMjUuMTE5TDE5NC4xNTMsMjYuMzE2TDE5NC4xNTMsMjYuMzE2TDE3OS45NzIsMzUuNjA4TDE3MS41NzgsMzcuODA0TDE3NS4yODYsMzMuOTU4TDE3NS4yNjQsMzMuOTY2TDE2Ni4xODYsMzguMDE5TDE1Ni4zMTIsNDEuMzIxTDE1OC42NzgsMzkuOTE1TDE1OC42NzgsMzkuOTE1TDE2Ny44NDEsMzUuMTQyTDE3Ny4xNjUsMzAuNjkxTDE4Ni42MzgsMjYuNTY4TDE5Ni4yNSwyMi43NzhMMjA1Ljk4OCwxOS4zMjZMMjE1Ljg0MSwxNi4yMTZaTTIwNi41MTUsMjIuMTE0TDIwMy4xODQsMjMuMTg2TDIwNC42ODYsMjIuMzk2Wk0yODkuOTgsNDQuODgxTDI5NS4yOTcsNTEuMThMMjk5LjA3NSw0My45NjNMMzA3LjI1NCw1MS40MDNMMjk4LjQyLDUzLjAwMUwyNzYuODg0LDY5Ljk3TDI3OS41NzUsODIuOTg2TDMwOC4wNDcsOTAuMTI1TDMxMS4zOTUsMTAxLjI2OEwzMjQuMDA4LDg0Ljg2MUwzMTYuNSw2NS41NjZMMzM4LjA1OCw2OC44NzFMMzQ2LjQ5Nyw3OC4wNjNMMzUxLjEwNiw3MC41NDNMMzY0LjYzMiw4My41NThMMzg4LjkzNiw5Ny4zMzZMMzc5LjkwNiwxMDUuNzA1TDM2MC40MDYsMTA3LjExMkwzNzEuNzk1LDEyMi43NjVMMzg3LjY2OSwxMjIuOTQ5TDM3Mi4wOTgsMTM0LjI2NkwzNTQuOTgzLDEzNC41ODhMMzM3LjY0LDE2MC43OTFMMzM4LjgsMTcxLjc4NEwzMTUuNTY3LDE5NS4xNEwzMTcuODgxLDIyMi4yODNMMzA1Ljc3NSwxOTkuMDU3TDI4MS4xMzcsMTk5LjUwN0wyNTYuNjI5LDIwMC42NTNMMjQzLjcsMjEwLjUyNkwyMzkuMDUyLDIzNS4wMjNMMjUzLjkyOCwyNTcuNDA0TDI5MC4xNDgsMjQwLjczNkwyODAuNDg4LDI2OS41MjRMMzA5LjIzOSwyNzQuMTkzTDMxOC4xNzMsMzA2LjE3TDM2OC4zMjQsMjkzLjU4M0w0MTQuMjA0LDI5Mi4yNDRMNDM3LjUzNCwzMTQuODYyTDQ1Ni42NjksMzE1Ljg1Nkw0NzUuNTY2LDM0Mi41NzZMNTI0LjkzOSwzNjAuODFMNTIzLjU0MSwzNzguMzA1TDUwNi45NDMsNDA0LjE0OUw0OTcuMTE3LDQyNi43MDRMNDg1LjkwMiw0NDguMzY3TDQ2OC4zMjMsNDU1LjY4OUw0NTMuMDYyLDQ3Ni4zMDVMNDMzLjA0Myw0OTQuNjA2TDQxMS44OTMsNTExLjI1NEwzODguODUyLDUxOS43MkwzNzcuOTYzLDUzNC4wMDhMMzY2LjYyMSw1NDYuOTMzTDM1NC41NDcsNTU2LjM4NkwzNDIuMjQ0LDU2NC43NjNMMzMxLjYyMyw1NjEuNTAzTDMzMy4wMjcsNTQ2Ljc4MkwzNDYuMTg2LDUyNC40MzVMMzU4LjU5Nyw0OTguNDU1TDM2NS4yNjksNDY5Ljk5OEwzNzAuOTUzLDQzOC45NjlMMzQ0Ljc1Myw0MjIuODM2TDMxOC40NzQsMzc1LjE5NkwzMjUuMzIzLDM0Ny4yOTRMMzQwLjQ0NCwzMzEuMjMxTDMyNS41NDcsMzEyLjQ3MkwyODYuNTYsMjg0LjkyTDI1Mi4xNTcsMjY3LjMxOUwyMTAuODI3LDI1NC43ODlMMjAyLjA1OSwyMzEuMzk2TDE3My4zMDIsMTkyLjE0OEwxODcuNzAzLDIyNy4zNjJMMTcwLjQzNCwyMDYuODM4TDE2Ny40MzgsMTc3LjQ2TDE1NS45ODYsMTQ3LjkyN0wxNjQuOTE5LDEyNy41OEwxNzQuNzY5LDEwOC40MDNMMTc3LjczOCw4OC4zMDFMMTgxLjg4Nyw3MC4yNEwxNzIuNzAzLDU3LjAyNkwxNTYuNjk0LDYxLjI1M0wxNDEuMzI1LDY2LjU0OEwxNDguNDI1LDYyLjE0NUwxNjAuNDUyLDQ3LjYwOEwxNzcuNzc4LDQxLjY0NEwxNzguOTMyLDM2LjkyNkwyMDIuOTcsMjkuNDE5TDIxMC4yMjUsMjguOTg0TDIxNi41OTMsMzkuNTY0TDIzMi4zODYsMzcuNzc1TDI0Ny4zNDIsNDUuNTM3TDI2NC4zLDQ2LjU0N0wyODEuMzk0LDQ4LjUzMUwyODMuNzIsMzguNTg3Wk0yNTguMTE1LDM0LjA4N0wyNjkuMjY1LDM2LjA3NUwyNzIuMTY0LDQyLjkxM0wyNDguNjI5LDQ1LjI3MkwyNDcuMDk4LDM2Ljg4MlpNMjk3LjY2NCwzNS44ODdMMzAzLjg3OCwzNC41MDlMMzI3LjU1Myw0MS42MzFMMzI5Ljk2LDQ2LjI4NkwzNDUuNzI3LDUwLjUxN0wzNDYuNDQsNjMuMTk5TDMzOC4xNjksNjQuNzYyTDMxNS4yOTIsNTYuNDUyTDMyMi4zOTMsNDguMzg4TDMxMC41NzEsNDMuMTI5TDI5My42MjgsNDIuNTY2Wk0yNDUuMjI4LDM3LjA3OEwyMzkuNjU1LDM1LjA1N0wyNDguNTc1LDMwLjA1NkwyNTcuMjUyLDMzLjEzM1pNMjcyLjE3NSwyOC4xNzdMMjcyLjE2MiwzMC44MTNMMjU5LjIsMjkuMTY5Wk0yODguODg0LDI3LjE2OUwzMDQuMjI1LDMyLjk0M0wyODkuOTk5LDMxLjk3N1pNMzUxLjUwOSwxMS4wODdMMzY2LjA0MiwxMy43MjZMMzUyLjkyOCwxMi4zNjJaTTMwMS4yNDIsNC4wMDNMMzAzLjMwOSw0LjAyNEwyOTkuMjYyLDQuMDcyTDI5Ny4wMTksNC4wMTVMMjk3LjAxOSw0LjAxNVpNMjk4LjEyOSwyMi40NTJMMjkxLjgwNiwyNC43OTVMMjg5LjczMiwyMS4zODlMMjk0LjE5NiwxOS42MzJaTTMxMC4wOSwxNi41MTlMMzE1LjQzOSwxNy4zNjdMMzA1LjQ3NSwyOS4xODJMMjk0LjU3OCwyOC41NzFMMjk5LjkwOCwyMy4wMjVMMjk1LjIxMywxOC42MDdMMzAzLjUxMiwxNi43MDdaTTMyOC4yOTksMTMuNDQyTDMzMy43MjksMTMuNjhMMzMyLjEyNSwxNS4zODNMMzQwLjEzNywxNS42OThMMzQyLjgxNCwxNC4xNjFMMzUyLjQ1MiwxOC4yODZMMzcyLjk4LDI1LjEyTDM3Ny4yMTksMjkuMzU3TDM4OS4zNjIsMzMuODc3TDM4Ny4yMjEsNDkuODc3TDM5OC4wMSw2Ni40NTZMMzg2LjIxNyw2NS40NTVMMzcyLjgxNSw1Ni40ODZMMzU5LjE1Nyw0OC4zNzNMMzQ0LjY2OSwzNS4xNDFMMzMyLjkzMSwyOS4yNzJMMzIwLjI0OCwyOC45NTNMMzEyLjE4MSwyNC41MDZMMzE4Ljc1MywxNy4zNzhMMzI1LjA2NiwxMy45NTJaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzQzLjE2NSw1OTAuNTUyTDMzMS44NTQsNTkyLjM2MUwzNDQuNjUxLDU4OC43NFpNMjQ3LjM5LDU5MS4yODdMMjQ4LjI5Myw1OTEuMjUxTDI2Ni44OTgsNTkzLjM2OEwyNzMuMDU2LDU5My40NDFMMjkyLjYxMyw1OTQuOTQyTDI4Ni42NSw1OTMuMzdMMjk4LjA1NSw1OTQuMTYxTDMwOS45MDgsNTkzLjcwMUwzMjYuMzEzLDU5My42MDZMMzQxLjMyNiw1OTEuNjg5TDM1Mi4yNjMsNTg2LjU4N0wzNTIuOTM0LDU4OS42NjJMMzQzLjI5LDU5Mi4zNzhMMzI4LjI2Myw1OTQuNDI5TDMyMC43NSw1OTQuOTVMMzE3Ljc1NSw1OTUuNDY3TDMxNy43NTQsNTk1LjQ2N0wzMDcuNDMyLDU5NS45MDdMMjk3LjEsNTk1Ljk4NkwyODYuNzcyLDU5NS43MDRMMjc2LjQ2LDU5NS4wNjNMMjY2LjE3Nyw1OTQuMDYxTDI1NS45MzUsNTkyLjcwMlpNMTcuMzUxLDM4Ny4zNTlMMTcuNDU3LDM4OC4wMDRMMTYuODUzLDM4NS45OTJMMTYuNjQ0LDM4NC45ODFaTTQxNy42NzcsOTkuODE4TDQzNC42MjUsMTEwLjYwM0w0MTYuNTYsMTEyLjg1N1pNNDUzLjk3NSw1MC4xNjVMNDcwLjU4Nyw2MC4wMTNMNDg2LjM0MSw3MS4wNjlMNDg5LjYxNiw3Ni42MjFMNDcyLjI4Myw2Mi43MjFaTTQxNi42MTYsMzYuMTU3TDQyOC4zNTQsNDQuNTQ3TDQxNS4zMzksNDEuNTM1Wk0xNDkuMTc0LDQ1LjMwOUwxNTkuOTE3LDM5LjgyNUwxNjUuNjAxLDM2LjI3NUwxNjQuODEsMzYuNjc2TDE2NC44MSwzNi42NzZMMTc0LjA4MywzMi4xMThMMTgzLjUwOCwyNy44ODdMMTkzLjA3NiwyMy45ODdMMjAyLjc3NCwyMC40MjNMMjEyLjU5LDE3LjIwMUwyMjIuNTEzLDE0LjMyMkwyMjcuNzAxLDEyLjk2NUwyMjguMDk2LDEyLjg2N0wyMTcuMzAxLDE2LjAxM0wyMDYuNzM5LDE5Ljk1NkwxOTkuMTUyLDIyLjY4M0wxOTkuNTU1LDI0LjUyTDE5Ni4wNjMsMjguMjdMMTk0LjE1MywyOS41MzJMMTk0LjE1MywyOS41MzJMMTgzLjY1NywzOS4xOTlMMTczLjk2MSw0MS42N0wxNzUuMjg2LDM3Ljc0N0wxNzUuMjYxLDM3Ljc1NkwxNjUuOTI5LDQyLjA4OUwxNTEuOTY0LDQ1Ljc1M0wxNTQuMzcyLDQyLjc2MUwxMzMuODk1LDU1LjA0M0wxMzEuNTE4LDU2LjYyOEwxMzEuNTE4LDU2LjYyOEwxNDAuMTE0LDUwLjg5N0wxNDguOTA1LDQ1LjQ2OFpNNTk0Ljg3OCwyNzQuMjQ3TDU5NC44NjcsMjgwLjJMNTkzLjE4OSwyNzIuMTgxTDU5MC43MTksMjY0LjIzN0w1ODcuNDYxLDI1Ni4zOUw1ODMuNDI1LDI0OC42NjFMNTc3LjY1OCwyMjYuODk0TDU3MC4yMzgsMjA1LjU2Mkw1NjYuMzkyLDE5MS45NTJMNTYxLjg2OSwxNzguNjE2TDU1NS43MDIsMTU4LjA4Nkw1NDguMzQzLDE0My45NUw1NDAuMTY2LDEzMC4zMjlMNTM3Ljg0NCwxMjQuNjJMNTM0LjY0MywxMTkuNTZMNTM0LjY0MywxMTkuNTZMNTQwLjc5NywxMjcuODU5TDU0Ni42NTgsMTM2LjM2N0w1NTIuMjE5LDE0NS4wNzVMNTU3LjQ3MiwxNTMuOTcyTDU2Mi40MTEsMTYzLjA0Nkw1NjcuMDMxLDE3Mi4yODhMNTcxLjMyNiwxODEuNjg1TDU3NS4yODksMTkxLjIyNkw1NzguOTE4LDIwMC45TDU4Mi4yMDYsMjEwLjY5NEw1ODUuMTUxLDIyMC41OThMNTg3Ljc0OSwyMzAuNTk4TDU4OS45OTUsMjQwLjY4Mkw1OTEuODg5LDI1MC44MzlMNTkzLjQyNywyNjEuMDU2TDU5NC42MDcsMjcxLjMyWk01MTEuODg1LDkzLjMxTDUxNC4wNiw5NS42MjdMNTI2LjA3OSwxMDkuMzIzTDUzNy4xMTQsMTIzLjg0OEw1MzYuMjUzLDEyNy44OTRMNTI2LjMyOSwxMTUuNjY3TDUxNS43NDksMTAzLjk3M0w1MTQuNjcsOTcuNjA5TDQ5NS4yMzQsNzkuMTg3TDQ4Mi41NTEsNjcuNDE3TDQ2OC44OCw1Ni45MDVMNDY4LjUxLDU2LjY0OEw0NjguNTEsNTYuNjQ4TDQ3Ni45MDEsNjIuNjc3TDQ4NS4wNzUsNjguOTk1TDQ5My4wMjUsNzUuNTk1TDUwMC43MzksODIuNDY4TDUwOC4yMDgsODkuNjA3Wk00NTAuNjE0LDQ1LjE4M0w0NDQuOTk2LDQxLjk5NUw0NTEuNjA1LDQ2LjI2TDQzNi45ODIsMzguNDk1TDQxNS40ODcsMjcuODM4TDM5My4xNjQsMTkuMTMyTDM4My42ODEsMTYuMDc1TDM4My42ODEsMTYuMDc1TDM5My41MzksMTkuMTY4TDQwMy4yODMsMjIuNjA0TDQxMi45MDEsMjYuMzc3TDQyMi4zODIsMzAuNDg0TDQzMS43MTMsMzQuOTE5TDQ0MC44ODQsMzkuNjc4TDQ0OS44ODMsNDQuNzUzWk0yMDYuNTE1LDI0Ljk1NUwyMDMuMTg0LDI2LjEyOEwyMDQuMzE0LDI1LjI5OFpNMzA4LjA1MSw0NC45MTFMMzE1LjI3Miw1MS4wMTlMMzE2Ljc2OCw0My43MjJMMzI3LjA5Niw1MC44ODFMMzE4Ljg4OSw1Mi43MzhMMzAxLjkxLDcwLjI5MkwzMDcuNTg4LDgzLjE4MUwzMzcuMjY0LDg5LjQzN0wzNDIuNjkzLDEwMC40NDZMMzUxLjY3OSw4My43MTFMMzM5Ljk1NSw2NC43MDhMMzYxLjQ1Niw2Ny4zNkwzNzEuNjM1LDc2LjI2OUwzNzQuMTcxLDY4LjY0TDM4OS44MzYsODEuMjEyTDQxNS4wODcsOTQuMjM2TDQwOC40OTIsMTAyLjg0M0wzOTAuNjUyLDEwNC44MTdMNDAzLjk5OCwxMjAuMDk0TDQxOC42OTEsMTE5LjgxNEw0MDYuMDkzLDEzMS41NTlMMzkwLjA3MSwxMzIuMzg1TDM3Ny4wNzYsMTU5LjA0OEwzNzkuNDgzLDE2OS45ODdMMzU5LjQzLDE5NC4wMDFMMzY0LjAxNCwyMjEuMDM5TDM1MC4yMTgsMTk4LjIwN0wzMDEuMzk0LDIwMS4yOTFMMjg5LjEzOCwyMTEuNTQ2TDI4Ni4yOTEsMjM2LjE1N0wzMDIuODEyLDI1OC4wNjJMMzM4LjA3NiwyNDAuMzA4TDMzMC4xMDUsMjY5LjM2M0wzNTguNzIyLDI3My4xNjFMMzY4LjU5NiwzMDQuODUyTDQxNi4zMzIsMjkwLjc3OEw0NTguOTE1LDI4OC4wOTRMNDgwLjY0MywzMTAuMDI4TDQ5Ny42MjgsMzEwLjQ3NEw1MTQuMjgxLDMzNi42NTNMNTM2LjI3NiwzNDUuNDQ1TDU1NC41NzEsMzUzLjUyNUw1NTIuODY0LDM3MS4wNjhMNTQ2LjAwMiwzODQuMzQ0TDUzOC40NDYsMzk3LjM4M0w1MjguODcsNDIwLjIzM0w1MTcuNjgyLDQ0Mi4yMzZMNTAyLjQ3NCw0NTAuMDU2TDQ4Ny4xNjcsNDcxLjEzNkw0NjcuNTAyLDQ5MC4wNEw0NDYuNDEzLDUwNy4zMjlMNDI0LjQ1Miw1MTYuNDc5TDQxMS44MTksNTMxLjEyNEwzOTguNTM2LDU0NC40MjRMMzg0Ljk2NCw1NTQuMjY2TDM3MS4wMzUsNTYzLjA0MkwzNjIuMTE5LDU2MC4wNzlMMzY3LjM0MSw1NDUuMjU3TDM3NS45NzIsNTM0LjMzTDM4NC4yOTYsNTIyLjQ1M0wzOTIuMjc4LDUwOS42NzVMMzk5Ljg4Niw0OTYuMDQ3TDQwOS4zMSw0NjcuMzQ1TDQxNy4wODEsNDM2LjExMkwzOTMuMTkyLDQyMC43NEwzNjkuMzE3LDM3My44NjJMMzc2LjE0NSwzNDUuNzUzTDM5MC42MywzMjkuMjM5TDM3NS45MiwzMTAuOTNMMzM2LjgxMSwyODQuNTY1TDMwMS41MzgsMjY4LjAyMkwyNTguNDYzLDI1Ni43NzVMMjQ3Ljc4MywyMzMuNjc3TDIxMy44NCwxOTUuMzgyTDIzMi4zNzYsMjMwLjA5NkwyMTIuMjI2LDIxMC4xNEwyMDUuODcyLDE4MC45MDRMMTg5LjM1OCwxNTEuNzk2TDE5NS44MiwxMzEuMjE1TDIwMi45ODksMTExLjc4TDIwMS43NTEsOTEuNjUxTDIwMS40NjIsNzMuNTMyTDE4Ni4zMzQsNjAuNjg3TDE2OC44NCw2NS40MjNMMTUxLjkzMyw3MS4yMDhMMTU4LjkxNCw2Ni41OTFMMTY2LjM1Nyw1MS43NThMMTg1LjAxNCw0NS4yNDhMMTgzLjMxMiw0MC41MzhMMjA4LjM2MiwzMi4yODZMMjE2Ljc4LDMxLjYxMkwyMjkuMzc5LDQxLjkwNEwyNDUuOTQ0LDM5LjYyM0wyNjQuNzA5LDQ2Ljg3M0wyODIuNjI0LDQ3LjM1M0wzMDAuNjA1LDQ4LjgwNEwyOTkuNjY2LDM4Ljg0Wk0yNzEuNzg0LDM1LjE1MkwyODQuMDgsMzYuNzgzTDI4OS40NjcsNDMuNDk2TDI2NS45NjcsNDYuNTdMMjYxLjMxOCwzOC4yNzRaTTMxMi41ODYsMzUuNzMxTDMxOC4xODYsMzQuMTc0TDM0My41OSw0MC41NUwzNDcuNDE5LDQ1LjExTDM2My42MDMsNDguODU2TDM2Ny45MDksNjEuNDYyTDM2MC41MTksNjMuMjYzTDMzNi4zNjUsNTUuNjY3TDM0MC44NTEsNDcuNDI3TDMyNy43NTIsNDIuNTQ2TDMxMC45MjIsNDIuNDk3Wk0yNTkuNDE0LDM4LjUyNkwyNTIuNjU3LDM2LjY5M0wyNjAuMDI5LDMxLjQ0NEwyNzAuNDk3LDM0LjIzMVpNMjgzLjg2NSwyOC44NDVMMjg0Ljk3NCwzMS40NjRMMjcwLjg1LDMwLjIzMlpNMzAwLjM2NiwyNy4zMzJMMzE3LjkyNywzMi42MDZMMzAzLjQ4MywzMi4wNzZaTTM0OC42Miw5LjU2NkwzNjIuNTc2LDExLjc3MkwzNTEuMjQ3LDEwLjc3OVpNMjkxLjQxOCw0LjEyNEwyOTQuNjU0LDQuMDU1TDI5MS40NTUsNC4yMTNMMjg3LjQzMSw0LjI2N0wyODcuNDMxLDQuMjY3Wk0zMDcuMzc4LDIyLjM2OUwzMDIuMjE3LDI0Ljg4NkwyOTguNDkxLDIxLjU2OEwzMDIuMDMyLDE5LjY4OVpNMzE1Ljg1MSwxNi4xMjVMMzIxLjQ4OCwxNi44MDZMMzE3LjYzNSwyOC44MzFMMzA2LjY0NywyOC41NTJMMzA5LjQxMiwyMi44ODNMMzAyLjQ4NSwxOC42NDJMMzA5LjU3NiwxNi41MDhaTTMzMC45NTIsMTIuNTQyTDMzNi4wNTMsMTIuNjJMMzM1LjgyNiwxNC4zNTFMMzQzLjI1OSwxNC40MzFMMzQ0LjQ2NiwxMi44MzVMMzU1Ljg0NiwxNi42NDFMMzc3LjYxMiwyMi44MzJMMzgzLjU2NCwyNi45MTRMMzk2LjAzLDMxLjA2TDM5OC43MjksMzguMzk2TDQwMC45NDIsNDcuMDE4TDQxNS42NzYsNjMuMjFMNDA0Ljk2Niw2Mi41NTFMMzkwLjMwOSw1NC4wMDhMMzc1LjMzNSw0Ni4zM0wzNTcuMjc0LDMzLjU5M0wzNDMuOTQzLDI4LjEwNEwzMzEuODEyLDI4LjE2MkwzMjIuMDgzLDIzLjk4NUwzMjQuNjQ2LDE2LjcxOUwzMjguMzQ5LDEzLjE0WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzU3LjUxMiw1ODkuMDIzTDM0NS45MjUsNTkxLjE4TDM2MC43OTQsNTg3LjEzOFpNMjU0Ljg2Miw1OTIuNTM4TDI1OS42OTcsNTkyLjY0OUwyNzkuODk2LDU5NC4xNzZMMjg3LjA5Nyw1OTQuMDQ2TDMwNS43MDQsNTk0Ljk2OEwzMDIuMDMzLDU5My41NDJMMzEyLjU3OCw1OTRMMzI0LjY3OCw1OTMuMTc1TDMzOS4zNTIsNTkyLjYwOUwzNTQuNDA3LDU5MC4yMzVMMzY5LjA4Miw1ODQuNzQ0TDM2Ni4wMjMsNTg3Ljg1NEwzNTQuMTkxLDU5MC44OTdMMzM4LjY1NCw1OTMuNDEyTDMzMS42ODUsNTk0LjE1M0wzMjcuOTQxLDU5NC42NzhMMzI3Ljk0MSw1OTQuNjc4TDMxNy42NCw1OTUuNDc0TDMwNy4zMTcsNTk1LjkxTDI5Ni45ODYsNTk1Ljk4NUwyODYuNjU4LDU5NS42OTlMMjc2LjM0Niw1OTUuMDUzTDI2Ni4wNjMsNTk0LjA0OEwyNTUuODIyLDU5Mi42ODVaTTY0LjM1OSw0NzguOTExTDcyLjI3Myw0ODcuNzUyTDgxLjY4NCw0OTkuNzI5Wk0yNS45NCwzOTUuODE2TDI1LjQ5MiwzOTYuNDY3TDI0Ljk1LDM5NC40NzJMMjUuMjU0LDM5My40NlpNNDQxLjI0NCw5NS44ODRMNDU4LjIyNSwxMDYuMTU0TDQ0Mi45MjEsMTA4LjkxNVpNNDgzLjkwNCw2OC4wNjJMNDg3LjE4MSw3MC44OTZMNDY5LjQyMiw1Ny41M0w0NTAuNzA0LDQ1LjUzNkw0NTAuNzA0LDQ1LjUzNkw0NjcuODAyLDU2LjE1OUw0NjcuODAzLDU2LjE1OUw0NzYuMjEsNjIuMTY0Wk00MTguMjM2LDMyLjU4OUw0MzEuODIsNDAuNTk0TDQyMC42MTIsMzcuOTVaTTU5MS44OTksMjUwLjg5Nkw1ODkuMjMzLDIzOS45NjFMNTgzLjU0LDIxOC4zNjhMNTc2LjE2MSwxOTcuMjYxTDU3MS4xNTEsMTgzLjc4NUw1NjUuNDUzLDE3MC42MDVMNTYwLjcyNSwxNjAuMjkzTDU1NS4zNjEsMTUwLjMyMkw1NTIuMTQzLDE0NC45NTJMNTUyLjE0MywxNDQuOTUyTDU1Ny40MDEsMTUzLjg0Nkw1NjIuMzQ1LDE2Mi45MTlMNTY2Ljk2OSwxNzIuMTU4TDU3MS4yNjgsMTgxLjU1M0w1NzUuMjM2LDE5MS4wOTJMNTc4Ljg2OSwyMDAuNzY0TDU4Mi4xNjMsMjEwLjU1N0w1ODUuMTEzLDIyMC40NTlMNTg3LjcxNSwyMzAuNDU3TDU4OS45NjcsMjQwLjU0MUw1OTEuODY1LDI1MC42OTdaTTUzNC43NTUsMTE5LjcwNkw1MzUuNDU5LDEyMC43MjhMNTI1LjczMiwxMDguNzk5TDUxNS4zNSw5Ny40MjRMNTEyLjQzNCw5My44NzRMNTEyLjQzNCw5My44NzRMNTE5LjQ5OCwxMDEuNDE0TDUyNi4yOTUsMTA5LjE5NUw1MzIuODE2LDExNy4yMDlaTTIyOS4yODIsMTIuNTcyTDIxNC45MTIsMTYuNjVMMjIwLjU5NiwxNS4xNjVMMjExLjkzLDE4LjYwN0wyMDMuNTExLDIyLjgzOUwxOTYuMjk4LDI1Ljc5TDE5OS42OTMsMjcuNTY5TDE5OC43NzcsMzEuMzg3TDE5Ny4zNjksMzIuN0wxOTcuMzY5LDMyLjdMMTkwLjg3Niw0Mi42MjRMMTgwLjE3NCw0NS40MDVMMTc5LjA3NSw0MS40NzlMMTc5LjA0OCw0MS40ODhMMTY5Ljc0NSw0Ni4xMDRMMTUyLjExMyw1MC4yNDlMMTUxLjQ1OCw0Ny4yM0wxMjkuODIyLDYwLjE1MkwxMTUuNjczLDY4LjgwN0wxMzQuMTc3LDU1LjI1NUwxNDUuMzY5LDQ5LjE5NUwxNTcuMTcyLDQ0LjEyM0wxNTkuOTM1LDQwLjQ0NUwxNTMuNTUxLDQzLjMyNUwxNTYuNjY5LDQxLjAxN0wxNTYuNjY5LDQxLjAxN0wxNjUuNzk1LDM2LjE3M0wxNzUuMDg0LDMxLjY1TDE4NC41MjUsMjcuNDU0TDE5NC4xMDcsMjMuNTlMMjAzLjgxOCwyMC4wNjJMMjEzLjY0NywxNi44NzZMMjIzLjU4LDE0LjAzNVpNMjA5LjM1NSwyNy43NTJMMjA2LjEyNSwyOS4wMjVMMjA2Ljg1LDI4LjE2N1pNMzI1Ljg3Nyw0NC4zOTZMMzM0Ljc4Miw1MC4yNTlMMzMzLjk1Miw0Mi45NTJMMzQ2LjExNSw0OS43NjlMMzM4Ljc4NSw1MS44NjFMMzI2Ljg3Nyw2OS44NTVMMzM1LjM3LDgyLjUyOUwzNjUuMzUsODcuODc4TDM3Mi42OTMsOTguNjkzTDM3Ny43OCw4MS43NDRMMzYyLjE5NSw2My4xNTZMMzgyLjk4OCw2NS4xNjVMMzk0LjU5Niw3My43NDNMMzk0Ljk4MSw2Ni4wN0w0MTIuMzExLDc4LjE0MUw0MzcuNzQsOTAuMzk1TDQzMy43ODIsOTkuMTYyTDQxOC4xNDMsMTAxLjY0NUw0MzMuMDQyLDExNi40OTNMNDQ2LjEwOCwxMTUuNzkxTDQzNi44NjMsMTI3Ljg2OEw0MjIuNDIyLDEyOS4xNTdMNDE0LjE3LDE1Ni4xNDNMNDE3Ljc1MSwxNjYuOTkxTDQwMS40ODgsMTkxLjU1Nkw0MDguMjAxLDIxOC40MjJMMzkzLjEzNSwxOTYuMDI5TDM0Ni4xMTgsMjAwLjU2OUwzMzQuOTA2LDIxMS4xODFMMzMzLjk0NiwyMzUuODVMMzUxLjYxMSwyNTcuMjM1TDM4NC44NDcsMjM4LjQ0TDM3OC44MDcsMjY3LjcwOUw0MDYuNDIxLDI3MC42NTJMNDE2LjkzNCwzMDIuMDMzTDQ2MC44MDYsMjg2LjU2N0w0OTguNzk5LDI4Mi42Nkw1MTguMjY0LDMwMy45NjhMNTMyLjU4MywzMDMuOTM4TDUzOS45OSwzMTYuODI4TDU0Ni40ODUsMzI5LjY1M0w1NjMuNTQsMzM3Ljg1Mkw1NzYuNDY5LDM0NS40NThMNTc0LjUwNCwzNjMuMDU2TDU2OC45ODQsMzc2LjUyMUw1NjIuNzA0LDM4OS43NjlMNTUzLjY2OSw0MTIuOTAyTDU0Mi44NDgsNDM1LjIzOUw1MzAuNDcyLDQ0My40NzlMNTE1LjU4Niw0NjUuMDE3TDQ5Ni44NzIsNDg0LjUwNEw0NzYuNDg1LDUwMi40MjRMNDU2LjI3LDUxMi4yMTRMNDQyLjI3OCw1MjcuMjY0TDQyNy40NTcsNTQwLjk5MUw0MTIuNzk5LDU1MS4yNjJMMzk3LjY2Nyw1NjAuNDc5TDM5MC43MjcsNTU3Ljc1N0wzOTkuNjA5LDU0Mi43MjFMNDA5Ljk0OSw1MzEuNTA1TDQxOS44NDQsNTE5LjM1MUw0MjkuMjU0LDUwNi4zMDlMNDM4LjE0LDQ5Mi40MzFMNDQ0LjM1OCw0NzguMjU2TDQ1MC4wMyw0NjMuNDA2TDQ1NS4xMzQsNDQ3LjkzN0w0NTkuNjUxLDQzMS45MDhMNDM4Ljc5OCw0MTcuMjE2TDQyOS4wNDcsMzk0LjU3MUw0MTguMDU0LDM3MS4wMTZMNDI0LjY1NCwzNDIuNzAyTDQzOC4wNjMsMzI1Ljc2NUw0MjMuOTg2LDMwNy44OTNMMzg1Ljk0MywyODIuN0wzNTAuODczLDI2Ny4yMjZMMzA3LjM2MSwyNTcuMjk0TDI5NS4wOTQsMjM0LjU0NUwyNTYuOTk1LDE5Ny4zNDRMMjc5LjEwNCwyMzEuNDQxTDI1Ni42ODUsMjEyLjEzMkwyNDcuMTY3LDE4My4xMzZMMjI2LjA5MSwxNTQuNkwyMzQuMTU3LDExNC4yNTRMMjI0LjAzLDc2LjE4M0wyMDMuNDE5LDYzLjg4MUwxODQuOTcyLDY5LjE2M0wxNjcuMDQsNzUuNDc3TDE3My42OSw3MC42NTRMMTc2LjMyMyw1NS42NjhMMTk1Ljc0Myw0OC41NzhMMTkxLjIzOCw0My45NjNMMjE2LjUzOCwzNC45NDZMMjI1Ljg2NCwzNC4wMDJMMjM0Ljk1OSwzOC4zOTRMMjQ0LjMxMSw0My44MjNMMjYxLjE0Myw0MS4wMzVMMjgzLjE0OCw0Ny42NjVMMzAxLjQ3Niw0Ny41OTVMMzE5Ljc5OCw0OC40OTRMMzE1LjYyMiwzOC42MDhaTTI4Ni4zMDksMzUuNzg5TDI5OS4zNzksMzcuMDM1TDMwNy4wOSw0My41NDhMMjg0LjM0LDQ3LjMyNUwyNzYuNzEzLDM5LjIxNVpNMzI3LjEyNiwzNS4xMjhMMzMxLjk0MSwzMy40MTJMMzU4LjMwMywzOS4wMDJMMzYzLjQzNyw0My40MjZMMzc5LjU0OCw0Ni42ODFMMzg3LjMxNCw1OS4xMDRMMzgxLjAzLDYxLjExMkwzNTYuMzMzLDU0LjI1OUwzNTguMDY4LDQ1LjkyNEwzNDQuMDksNDEuNDU1TDMyNy44ODQsNDEuOTA3Wk0yNzQuODM0LDM5LjUyNUwyNjcuMDk4LDM3LjkxMkwyNzIuNjk3LDMyLjQ2NkwyODQuNjM5LDM0LjkxM1pNMjk2LjA0NSwyOS4xNUwyOTguMjQzLDMxLjcxOUwyODMuMzg3LDMwLjkyN1pNMzExLjgzNywyNy4xNDdMMzMxLjA4NCwzMS44NjJMMzE2Ljg2LDMxLjc2N1pNMzQ0LjI1NCw4LjE1NUwzNTcuMjA4LDkuOTUyTDM0OC4wMSw5LjI3MVpNMjc3LjIzMyw0Ljg3N0wyODYuMTYxLDQuMzQ3TDI4My45MDgsNC41ODdMMjc2LjM2NCw0Ljk0NUwyNzYuMzY0LDQuOTQ1Wk0zMTYuNDAzLDIyLjAwN0wzMTIuNTYxLDI0LjY2MUwzMDcuMjk1LDIxLjQ4TDMwOS44MDYsMTkuNTA5Wk0zMjEuMTMxLDE1LjU2M0wzMjYuODg0LDE2LjA3MUwzMjkuMjU5LDI4LjExOEwzMTguNTE0LDI4LjE3TDMxOC42MzEsMjIuNDU3TDMwOS42ODEsMTguNDU4TDMxNS4zNDksMTYuMTI5Wk0zMzIuNjY0LDExLjU3NUwzMzcuMjgzLDExLjUwNkwzMzguNDM4LDEzLjIyMkwzNDUuMDY3LDEzLjA4OUwzNDQuNzY3LDExLjQ3OUwzNTcuNTQyLDE0LjkxOEwzNzkuODg3LDIwLjQ0TDM4Ny4zNjksMjQuMzE3TDM5OS43OCwyOC4wODVMNDA1Ljk0OSwzNS4yODZMNDExLjU5Niw0My43OUw0MjkuODI3LDU5LjQ4TDQyMC41MjYsNTkuMTI1TDQwNS4wNiw1MS4wMzlMMzg5LjIyMyw0My44M0wzNjguMTM5LDMxLjY4N0wzNTMuNjIsMjYuNjIyTDM0Mi40MSwyNy4wMzVMMzMxLjMxNSwyMy4xNzRMMzI5Ljc5LDE1Ljg5MkwzMzAuNzcsMTIuMjQyWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzcwLjExMiw1ODcuMDg0TDM1OC42LDU4OS41OTJMMzc1LjA5LDU4NS4wNzRaTTI2MS45NTYsNTkzLjU0NUwyNjEuNzM5LDU5My41MTVMMjcyLjMyNyw1OTMuNjgxTDI5My41MDYsNTk0LjU4TDMwMS41MzEsNTk0LjIxOUwzMTguNjIyLDU5NC41OThMMzE3LjM1NCw1OTMuMjQ3TDMyNi43MTksNTkzLjQwM0wzMzguNjk5LDU5Mi4yMTNMMzUxLjE5NSw1OTEuMjMzTDM2NS44MzUsNTg4LjQwOEwzODMuODAzLDU4Mi40MjFMMzc3LjEwNiw1ODUuNjhMMzY2Ljg1LDU4OC4zNTJMMzY2Ljg1LDU4OC4zNTJMMzU2Ljc0NSw1OTAuNTFMMzQ2LjU3Miw1OTIuMzEzTDM0NS40NjUsNTkyLjQ4OEwzNDEuNjU4LDU5My4wMzlMMzM5Ljg0MSw1OTMuMzA3TDMzOS44NCw1OTMuMzA3TDMyOS41OCw1OTQuNTE4TDMxOS4yODMsNTk1LjM3MUwzMDguOTYzLDU5NS44NjRMMjk4LjYzMiw1OTUuOTk3TDI4OC4zMDMsNTk1Ljc2OUwyNzcuOTg4LDU5NS4xOEwyNjcuNyw1OTQuMjMyWk04Ny4zMDEsNTAyLjk0Nkw5NC44OTEsNTEyLjEzNEwxMDMuMTAzLDUyMC42NzlMOTUuNzA0LDUxNC4wOTRMOTEuMjEyLDUwOC44MTFaTTc0Ljg2OCw0ODUuOTExTDg1LjIzOSw0OTQuNDc1TDkyLjM3OCw1MDYuMlpNNDIuODU1LDQwMy44ODdMNDEuODY5LDQwNC41NTlMNDEuNDAzLDQwMi41OEw0Mi4yMTIsNDAxLjU1Wk00NjAuNTE5LDkxLjNMNDc3LjAxOCwxMDEuMDYxTDQ2NC45MzksMTA0LjIzOFpNNDE2LjI2NCwyOS4wMjZMNDMxLjI4LDM2LjU5N0w0MjIuMjE5LDM0LjI2MVpNMjU0LjA2MSw3LjU4N0wyNTAuOTkyLDguMTA3TDI0OC41NTMsOC41MDVMMjQ4LjU1Myw4LjUwNVpNMjM1LjUyNywxMS4xMDdMMjIyLjI1LDE0LjY1OUwyMDkuMjc0LDE5LjMyMUwyMTUuNTEsMTcuNjU1TDIwOS4yMzUsMjEuMzI0TDIwMy4yMTUsMjUuNzc1TDE5Ni41OTYsMjguOTM3TDIwMi44OCwzMC41NjlMMjA0LjU2NywzNC4zNzVMMjAzLjcwNCwzNS43MjJMMjAzLjcwNCwzNS43MjJMMjAxLjQxMSw0NS43OEwxOTAuMDI3LDQ4Ljg5NkwxODYuNTM5LDQ1LjA0TDE4Ni41MTEsNDUuMDVMMTc3LjUxOCw0OS45NDRMMTU2Ljc1Niw1NC42NzJMMTUzLjA1OCw1MS43MTlMMTMwLjkyMSw2NS4zMDZMMTEzLjg1Niw3NC40MzVMMTMxLjg0Myw2MC4zMjlMMTQ0Ljk5OSw1My44OTlMMTU4Ljc2Niw0OC40MzlMMTU4LjUyNCw0NC43MjJMMTUwLjkzMyw0Ny44MTVMMTUxLjUxMiw0NC4xNjlMMTQ2LjIyOSw0Ny4wNzZMMTQ2LjIyOSw0Ny4wNzZMMTU1LjE1LDQxLjg2NEwxNjQuMjQ3LDM2Ljk2NkwxNzMuNTA5LDMyLjM4OEwxODIuOTI2LDI4LjEzN0wxOTIuNDg1LDI0LjIxN0wyMDIuMTc1LDIwLjYzMkwyMTEuOTg1LDE3LjM4OEwyMjEuOTAxLDE0LjQ4OUwyMzEuOTEzLDExLjkzN1pNMjE0Ljk1LDMwLjQyMUwyMTEuOTE5LDMxLjc4OUwyMTIuMjE2LDMwLjkxNlpNMzQyLjkxNyw0My4zNTFMMzUzLjIzNSw0OC45MjFMMzUwLjEwNCw0MS42NzVMMzYzLjczMyw0OC4xTDM1Ny41MDIsNTAuMzk5TDM1MS4wMjgsNjguNjcxTDM2Mi4wNzgsODEuMDQ4TDM5MS40NSw4NS40OTVMNDAwLjQ4NSw5Ni4wNjJMNDAxLjUxOCw3OS4wMkwzODIuNTQ2LDYwLjk1N0w0MDEuOTk4LDYyLjM1NUw0MTQuNjgyLDcwLjU2NEw0MTIuOTA2LDYyLjkxMkw0MzEuMzczLDc0LjQzOUw0NTYuMjA5LDg1LjkyOUw0NTUuMDA3LDk0Ljc3NUw0NDIuMDQ1LDk3LjY5M0w0NTguMDQyLDExMi4wNzFMNDY5LjA4NSwxMTEuMDAyTDQ2My40NzYsMTIzLjMwNUw0NTEuMDUzLDEyNS4wMDJMNDQ3Ljc5NSwxNTIuMTYzTDQ1Mi40NDEsMTYyLjg4Nkw0NDAuNDYxLDE4Ny44ODFMNDQ5LjEsMjE0LjUxM0w0MzMuMjIyLDE5Mi41OUwzODkuNDQsMTk4LjUwOUwzNzkuNjE0LDIwOS40NDFMMzgwLjU2OSwyMzQuMTFMMzk4Ljg0MiwyNTQuOTQ5TDQyOS4wNCwyMzUuMTkxTDQyNS4xMTUsMjY0LjYxMUw0NTAuODg2LDI2Ni43NDNMNDYxLjcxOSwyOTcuOEw1MDAuMzk0LDI4MS4wOEw1MzIuNjQyLDI3Ni4xMDVMNTQ5LjI1MywyOTYuODY1TDU2MC40NzEsMjk2LjQ0N0w1NjYuMzQyLDMwOS4xMzVMNTcxLjE5OSwzMjEuNzg4TDU4Mi43OTcsMzI5LjU1Mkw1ODYuOTQ0LDMzMy4yNjdMNTg5Ljk2NiwzMzYuODUyTDU4Ny44MDMsMzU0LjUxM0w1ODMuNzkyLDM2OC4xMjNMNTc4Ljk4LDM4MS41NEw1NzAuNzYxLDQwNC45MzRMNTYwLjYzNSw0MjcuNTlMNTUxLjQ2OCw0MzYuMTU3TDUzNy40NTQsNDU4LjEzNUw1MjAuMjYsNDc4LjE2N0w1MDEuMTk0LDQ5Ni42ODZMNDgzLjM0MSw1MDcuMDU1TDQ2OC40MTMsNTIyLjU0NEw0NTIuNTA1LDUzNi43MzhMNDM3LjIwNiw1NDcuNDY0TDQyMS4zMzMsNTU3LjE1Mkw0MTYuNTc5LDU1NC42MDdMNDI4Ljg1LDUzOS4yNUw0NDAuNTg2LDUyNy42OTlMNDUxLjc1Miw1MTUuMjI1TDQ2Mi4zMDMsNTAxLjg4TDQ3Mi4xOTcsNDg3LjcxNkw0NzkuNTM0LDQ3My4zMzVMNDg2LjE5MSw0NTguMjk4TDQ5Mi4xNDQsNDQyLjY2MUw0OTcuMzcsNDI2LjQ4NEw0ODAuMTg4LDQxMi4zN0w0NzIuNTI2LDM4OS45ODlMNDYzLjIwNCwzNjYuNzQzTDQ2OS4zNzUsMzM4LjIzNUw0ODEuMywzMjAuOTEzTDQ2OC4yODUsMzAzLjQ1M0w0MzIuNDYzLDI3OS4zODJMMzk4LjY2MSwyNjQuOTU1TDM1Ni4wMzUsMjU2LjMzMUwzNDIuNTUzLDIzMy45NzNMMzAxLjQ1NywxOTcuOTc1TDMyNi40NjYsMjMxLjM1NkwzMDIuNDYsMjEyLjc1M0wyOTAuMDY2LDE4NC4wOUwyNjUuMDcsMTU2LjI1M0wyNjcuMzI2LDExNS43NTFMMjQ4LjkwNyw3OC4xMTNMMjM2LjA0OCw3MS44NjhMMjIzLjQzOCw2Ni41MTJMMjA0LjU5OSw3Mi4zNkwxODYuMTg3LDc5LjIyNkwxOTIuMzA0LDc0LjIwOUwxOTAuMDQ3LDU5LjIxN0wyMDkuNjQsNTEuNTM1TDIwMi40NjgsNDcuMDk4TDIyNy4yNSwzNy4zMTlMMjM3LjIwMSwzNi4wODNMMjQ4Ljk2Nyw0MC4xNThMMjYwLjkzNSw0NS4yNjJMMjc3LjUyNCw0MS45NjdMMzAyLjA5OSw0Ny44ODlMMzIwLjI4Myw0Ny4yNjRMMzM4LjM4OSw0Ny42MUwzMzEuMTAzLDM3Ljg5OFpNMzAxLjI1MSwzNS45NzhMMzE0LjY5NywzNi44MjFMMzI0LjQ5OCw0My4wNjlMMzAzLjE4OSw0Ny41MTRMMjkyLjgxNSwzOS42NzhaTTM0MC44NDEsMzQuMDk1TDM0NC43MjYsMzIuMjQ3TDM3MS4yNDQsMzcuMDM0TDM3Ny41MjgsNDEuMjg1TDM5My4wNzUsNDQuMDU5TDQwNC4wNjYsNTYuMTk3TDM5OS4wNzksNTguMzc2TDM3NC41OSw1Mi4yN0wzNzMuNTIxLDQzLjkyNUwzNTkuMDg4LDM5Ljg4N0wzNDMuOTk5LDQwLjgxNVpNMjkxLjAxOCw0MC4wNDRMMjgyLjUzOCwzOC42NzhMMjg2LjE5NSwzMy4wOTFMMjk5LjI0NywzNS4xNThaTTMwOC4zNDUsMjkuMDgzTDMxMS41NjYsMzEuNTdMMjk2LjQyOCwzMS4yMzNaTTMyMi45NDgsMjYuNjE4TDM0My4yOTYsMzAuNzMyTDMyOS43MjYsMzEuMDU5Wk0zMzguNTQ0LDYuODk3TDM1MC4xMDMsOC4zMjJMMzQzLjMxNCw3Ljg4NFpNMjY3LjMwNyw1Ljg0M0wyNzguMDg5LDQuODlMMjc2Ljg1LDUuMTgzWk0zMjQuOTI5LDIxLjM4TDMyMi41MjMsMjQuMTI4TDMxNS44NzgsMjEuMTI4TDMxNy4yODMsMTkuMDk4Wk0zMjUuNzY5LDE0Ljg1TDMzMS40NjQsMTUuMTg0TDMzNS43OTYsMjAuNjAyTDMzOS45OTUsMjcuMDY2TDMyOS44MTgsMjcuNDM2TDMyNy4yODIsMjEuNzU5TDMxNi41ODMsMTguMDU5TDMyMC42NTYsMTUuNTgyWk0zMzMuMzg0LDEwLjU3MkwzMzcuMzc5LDEwLjM3MUwzMzkuODgyLDEyLjAzMkwzNDUuNTA2LDExLjcxM0wzNDMuNzA4LDEwLjEzNUwzNTcuNDksMTMuMTcxTDM3OS43MzQsMTguMDE1TDM4OC41MiwyMS42NDVMNDAwLjQ5OSwyNS4wNDNMNDA5Ljk0OSwzMi4wMDZMNDE4Ljg1OSw0MC4yODhMNDQwLjAzNCw1NS4zOEw0MzIuNDI0LDU1LjI4Mkw0MTYuNjE4LDQ3LjY3Mkw0MDAuNCw0MC45NDlMMzc2LjkzNCwyOS40ODNMMzYxLjY2OCwyNC44N0wzNTEuNzE5LDI1LjYwNUwzMzkuNTk2LDIyLjA5N0wzMzQuMDI5LDE0LjkyMkwzMzIuMjU3LDExLjI4NVoiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzgwLjU4MSw1ODQuNzk1TDM2OS40OTUsNTg3LjY0NkwzODcuMTA0LDU4Mi42MDlaTTI3MS41NTgsNTk0LjYzTDI3MS4zNTQsNTk0LjUzMUwyODUuNzk3LDU5NC4zMTdMMzA3LjMxMiw1OTQuNTY4TDMxNS45MTgsNTkzLjk1NEwzMzAuOTczLDU5My44NDVMMzMyLjE0OCw1OTIuNDk1TDM0MC4wNDgsNTkyLjM4OEwzNTEuNTQzLDU5MC44NDJMMzYxLjQ4Myw1ODkuNTIxTDM3MC4zNDksNTg3LjUxOUwzNzAuMzQ5LDU4Ny41MTlMMzYwLjI3Miw1ODkuNzk5TDM1MC4xMjEsNTkxLjcyNkwzMzkuOTA5LDU5My4yOTdMMzI5LjY0OSw1OTQuNTExTDMxOS4zNTMsNTk1LjM2N0wzMDkuMDMzLDU5NS44NjJMMjk4LjcwMiw1OTUuOTk3TDI4OC4zNzMsNTk1Ljc3MkwyNzguMDU3LDU5NS4xODZaTTM3OC4wMzgsNTg1LjUyOEwzOTUuOTc3LDU3OS42OUwzODkuMjA1LDU4Mi4yMzhMMzg5LjIwNCw1ODIuMjM4TDM3OS4zLDU4NS4xOFpNMTAyLjU0OCw1MDkuMTc3TDEwOC4zOTksNTE4LjE2MUwxMTQuODMsNTI2LjQ4NEwxMDYuMzc4LDUyMC4xNEwxMDQuMTksNTE0Ljk1OFpNOTIuMjE3LDQ5Mi40ODhMMTA0LjczLDUwMC43MDRMMTA5LjM3OSw1MTIuMjVaTTY3LjU4Myw0MTEuMzI0TDY2LjA4OCw0MTIuMDM0TDY1LjcxNCw0MTAuMDY4TDY3LjAwMiw0MDkuMDA2Wk0yNS40NzksNDEwLjY5OUwzNC44MzIsNDMwLjc4TDQyLjIxLDQ0NS4wNzdMNTAuMzg0LDQ1OC45MjZMNTYuMDc3LDQ2Ny42ODNMNTYuMDc3LDQ2Ny42ODNMNTAuMzc0LDQ1OS4wNjhMNDQuOTc0LDQ1MC4yNTlMMzkuODg2LDQ0MS4yNjhMMzUuMTE0LDQzMi4xMDRMMzAuNjY1LDQyMi43NzlMMjYuNTQ0LDQxMy4zMDRaTTUuNDk0LDMyOS43MDVMOC4zNSwzNDkuNDM2TDcuOTIxLDM0OC4wMkw3LjkyMSwzNDguMDJMNi40MjMsMzM3Ljc5N1pNNjYuNDI4LDExOC4xNzVMNjguNTM0LDExNS43NUw2NC42MjgsMTIxLjExN0w2NC42MjgsMTIxLjExN0w1OC43NzIsMTI4Ljc0Nkw1OS4wNiwxMjguMDU4TDU5LjA2MSwxMjguMDU4TDY1LjIwOCwxMTkuNzU0Wk00NzQuOTE3LDg2LjIwNEw0OTAuNDMyLDk1LjQ3OEw0ODEuOTQ2LDk4Ljk2OFpNNDEwLjc2LDI1LjU3N0w0MjYuNzUyLDMyLjY3N0w0MjAuMTEzLDMwLjU3OVpNMjUxLjEzOCw4LjA2MUwyNDMuNTQsOS43MDlMMjM0LjM4OSwxMS4zODFMMjIwLjEzLDE1LjgyMkwyMDYuMzkzLDIyLjEyMkwyMTIuOTksMjAuMjYxTDIwNS44NiwyOC42NzZMMjAwLjAzNiwzMi4wMjZMMjA5LjAxNywzMy40MjZMMjEzLjI1NywzNy4xNDJMMjEyLjk2NCwzOC41MDdMMjEyLjk2NCwzOC41MDdMMjE0Ljk0Miw0OC41N0wyMDMuMjIyLDUyLjAzN0wxOTcuNDUsNDguMzIxTDE5Ny40MjEsNDguMzMyTDE4OS4wMTQsNTMuNDkxTDE2NS43NTEsNTguODg3TDE1OS4xMjIsNTYuMDkyTDEzNy4xNTYsNzAuMzQ5TDExNy42OTQsODAuMDMzTDEzNC42MTgsNjUuMzk2TDE0OS4zMzgsNTguNTQyTDE2NC42NTEsNTIuNjQxTDE2MS40MTIsNDguOTc3TDE1Mi44NDMsNTIuMzE1TDE0Ny45MSw0OC43MzVMMTM5LjU1Niw1Mi41MTFMMTMxLjYxLDU2LjkxN0wxMjIuNTkzLDY0Ljk1NUwxMDQuMzg3LDc4LjkyMkw5Ni42OTMsODUuMTQ1TDg5LjUwMSw5MS44OTlMODkuNTAxLDkxLjg5OUw5Ni44OTIsODQuNjc5TDEwNC41Myw3Ny43MjJMMTEyLjQwNyw3MS4wMzZMMTIwLjUxMiw2NC42MjhMMTI4LjgzNSw1OC41MDdMMTM3LjM2OCw1Mi42ODFMMTQ2LjA5OCw0Ny4xNTZMMTU1LjAxNiw0MS45MzlMMTY0LjExLDM3LjAzNkwxNzMuMzcsMzIuNDU0TDE4Mi43ODUsMjguMTk3TDE5Mi4zNDIsMjQuMjcyTDIwMi4wMywyMC42ODNMMjExLjgzOCwxNy40MzRMMjIxLjc1MywxNC41MjlMMjMxLjc2NCwxMS45NzNMMjQxLjg1Nyw5Ljc2N1pNMjIzLjEyOSwzMi44ODFMMjIwLjM5LDM0LjMzN0wyMjAuMjQ5LDMzLjQ2MVpNNTg5Ljk1MiwzNTkuNTI4TDU4Ni43NzksMzcyLjk0NUw1NzkuNjI1LDM5Ni41NzNMNTcwLjUwMyw0MTkuNTIxTDU2NC44MjMsNDI4LjMxM0w1NTIuMTA3LDQ1MC42OTdMNTM2Ljk1NSw0NzEuMjIxTDUxOS43ODksNDkwLjI5TDUwNC44NDEsNTAxLjE1N0w0ODkuNDMxLDUxNy4xMDdMNDcyLjkxOSw1MzEuNzk0TDQ1Ny40NDUsNTQyLjk4N0w0NDEuMzExLDU1My4xNjJMNDM4Ljg4OCw1NTAuNzI2TDQ1NC4xNzYsNTM0Ljk1TDQ2Ni45NSw1MjMuMDI3TDQ3OS4wNDgsNTEwLjJMNDkwLjQyMSw0OTYuNTIxTDUwMS4wMjIsNDgyLjA0Nkw1MDkuMjU1LDQ2Ny40MjhMNTE2LjY5Niw0NTIuMTc3TDUyMy4zMTYsNDM2LjM0OUw1MjkuMDkyLDQyMC4wMDVMNTE2LjEwMiw0MDYuMzQ5TDUxMC43NjMsMzg0LjE2Nkw1MDMuMzk1LDM2MS4xNzNMNTA4Ljk0OSwzMzIuNDg4TDUxOS4wMjksMzE0LjgzMUw1MDcuNDcxLDI5Ny43NDRMNDkxLjg0LDI4Ni4xODNMNDc0Ljk1OSwyNzQuNzExTDQ0My40NTIsMjYxLjI3Nkw0MDMuMDA2LDI1My45MTVMMzg4LjcyLDIzMS45NzlMMzY3LjU5MSwyMTQuMjQ1TDM0NS44NzUsMTk3LjI1NkwzNzMuMDI1LDIyOS44NDRMMzQ4LjE2LDIxMS45ODNMMzMzLjI2OCwxODMuNzM1TDMwNS4xMTEsMTU2LjcwNkwzMDEuNDg3LDExNi4yMjRMMjg4LjM1Niw5Ni43NjRMMjc1LjMzNyw3OS4yNjRMMjYwLjQ4Myw3My40NEwyNDUuNzg0LDY4LjQ5OEwyMjcuMTI1LDc0LjkxNkwyMDguNzkyLDgyLjM0MUwyMTQuMTksNzcuMTQ5TDIwNy4xMTEsNjIuMjk5TDIyNi4yODIsNTQuMDI4TDIxNi42NjIsNDkuODQ1TDI0MC4xNzMsMzkuMzMzTDI1MC40NDUsMzcuNzlMMjY0LjUyNSw0MS40NzJMMjc4Ljc0Niw0Ni4xNzlMMjk0LjU4Nyw0Mi4zOUwzMjAuOTg3LDQ3LjUzOEwzMzguNDc0LDQ2LjM3MkwzNTUuODEzLDQ2LjE3OUwzNDUuNjQsMzYuNzMyTDM1OC42NTQsNDEuODA4TDM1OC42NTQsNDEuODA4TDM3MC4wNzEsNDcuMDQ4TDM2NC43MzQsMzkuOTNMMzc5LjQxNCw0NS45MjZMMzc0LjQ3Miw0OC4zOTRMMzczLjYyOCw2Ni43NzdMMzg2Ljg5OSw3OC43ODVMNDE0Ljc3MSw4Mi4zNjNMNDI1LjIyMyw5Mi42MzNMNDIyLjE3MSw3NS42MjJMNDAwLjM4OSw1OC4xNzhMNDE3LjkwOCw1OS4wMTRMNDMxLjI4NCw2Ni44MjdMNDI3LjQwMSw1OS4yNjFMNDQ2LjQ0Myw3MC4yMThMNDY5LjkzMSw4MC45NzRMNDcxLjUyMiw4OS44MTRMNDYxLjYzMSw5My4wNzlMNDc4LjI0MSwxMDYuOTYyTDQ4Ni45MjQsMTA1LjU5NEw0ODUuMTIxLDExOC4wMDlMNDc1LjA5NSwxMjAuMDQ3TDQ3Ni4zNTQsMTMzLjMxNUw0NzYuOTI5LDE0Ny4yMjlMNDgyLjQ5OSwxNTcuNzk4TDQ3NS4xNjcsMTgzLjA4Nkw0ODUuNDY5LDIwOS40MzFMNDY5LjI2MiwxODcuOTk1TDQzMC4wNDQsMTk1LjE3NUw0MjEuOTAyLDIwNi4zOEw0MjQuNzQ1LDIzMC45OTFMNDQzLjA2OSwyNTEuMjc0TDQ2OS4zMTMsMjMwLjY1OEw0NjcuNjIxLDI2MC4xNjNMNDkwLjc2NiwyNjEuNTUyTDUwMS41OSwyOTIuMjhMNTE4LjU5NCwyODMuMzE2TDUzMy44OTIsMjc0LjQ4Mkw1NTkuNDE2LDI2OC42M0w1NjYuNDkzLDI3OC43NDdMNTcyLjY2OSwyODguOTM2TDU4MC40NDUsMjg4LjIzTDU4NC42LDMwMC43NjVMNTg3LjY3MywzMTMuMjk4TDU5MC45ODksMzE2Ljg5TDU5My4yNzcsMzIwLjQyM0w1OTQuNTMsMzIzLjg4M0w1OTQuNzQyLDMyNy4yNTlMNTk0Ljc0MiwzMjcuMjU5TDU5My42MTEsMzM3LjUyOUw1OTIuMTIzLDM0Ny43NTNMNTkwLjI3OCwzNTcuOTE5Wk0zMTYuMTU0LDM1LjcxM0wzMjkuNTY4LDM2LjE0OEwzNDEuMTYxLDQyLjA3MUwzMjEuOTQxLDQ3LjEzMkwzMDkuMTM2LDM5LjY0OFpNMzUzLjMxNiwzMi42NjVMMzU2LjE1MiwzMC43MTVMMzgyLjAyLDM0LjcwNkwzODkuMjYzLDM4Ljc1MUw0MDMuNzc0LDQxLjA2OEw0MTcuNjU2LDUyLjgyOEw0MTQuMTE3LDU1LjEzN0wzOTAuNTgsNDkuNzYxTDM4Ni43MzksNDEuNDlMMzcyLjI5MSwzNy44OTFMMzU4Ljc3NywzOS4yNTRaTTMwNy40NzUsNDAuMDY3TDI5OC41MDksMzguOTY2TDMwMC4xMTMsMzMuMjk5TDMxMy44NzgsMzQuOTU4Wk0zMjAuMzkyLDI4LjY0N0wzMjQuNTM3LDMxLjAyMkwzMDkuNTc3LDMxLjE0MlpNMzMzLjM2MiwyNS43NjNMMzU0LjE5NCwyOS4yNTFMMzQxLjY4OCwyOS45NzRaTTM0MC44MjksNi44MjlMMzM3LjMwMiw2LjY1OUwzMzEuNjYyLDUuODNMMzMxLjY2Miw1LjgzTDMzOS4zNDEsNi42MjZMMzM5LjM0Miw2LjYyNlpNMjU5LjY3OCw2Ljk1MkwyNzAuNjgzLDUuNjY4TDI3MC40OTUsNS45ODNaTTMzMi42OTksMjAuNTA0TDMzMS44LDIzLjMwM0wzMjMuOTc4LDIwLjUyM0wzMjQuMjM0LDE4LjQ2N1pNMzI5LjYyNCwxNC4wMDlMMzM1LjA4NywxNC4xNzNMMzQyLjM4LDE5LjQxNEwzNDkuNTE1LDI1LjcwNkwzNDAuMjE2LDI2LjM3MkwzMzUuMTA1LDIwLjgxMkwzMjIuOTgxLDE3LjQ1OEwzMjUuMzM1LDE0Ljg4NFpNMzMzLjA4OSw5LjU2MkwzMzYuMzQsOS4yNTJMMzQwLjExNSwxMC44MTdMMzQ0LjU2MiwxMC4zNDVMMzQxLjMyMSw4Ljg0M0wzNTUuNjkyLDExLjQ1MUwzNzcuMTU5LDE1LjYzMUwzODYuOTgxLDE4Ljk3OUwzOTguMTYzLDIyLjAyNEw0MTAuNjA5LDI4LjY1NUw0MjIuNTExLDM2LjYyMUw0NDUuOTg1LDUxLjAzNUw0NDAuMjk5LDUxLjEzOUw0MjQuNjMyLDQ0LjAwN0w0MDguNTI3LDM3Ljc3NUwzODMuMzkxLDI3LjA0OEwzNjcuODQyLDIyLjkwM0wzNTkuNDU3LDIzLjkxNkwzNDYuNjczLDIwLjc4NkwzMzcuMjM0LDEzLjgzOUwzMzIuNzYzLDEwLjI5N1oiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjg2LjQ1NCw1OTUuNjlMMjgwLjQ5MSw1OTUuMzUzTDI4MS44MzksNTk1LjI0MkwyOTkuNjk5LDU5NC41MzhMMzIwLjg5Nyw1OTQuMTM5TDMyOS44MjIsNTkzLjI1OUwzNDIuMzg0LDU5Mi43M0wzNDUuOTY1LDU5MS4zMDlMMzUyLjE2LDU5MC45ODhMMzYyLjgyMiw1ODkuMTA0TDM2Ni43NTEsNTg4LjM3NUwzNjYuNzUxLDU4OC4zNzVMMzU2LjY0Niw1OTAuNTI5TDM0Ni40NzIsNTkyLjMyOUwzMzYuMjQyLDU5My43NzNMMzI1Ljk2Nyw1OTQuODU5TDMxNS42NjEsNTk1LjU4NUwzMDUuMzM2LDU5NS45NTJMMjk1LjAwNCw1OTUuOTU4Wk0yMTguMzI4LDU4NC41MDlMMjI0Ljk5LDU4Ni4yODlMMjI3LjczLDU4Ny4wNDJMMjI3LjcyOSw1ODcuMDQyWk0xMjMuNzkzLDUxNC44NTRMMTI3LjcyOCw1MjMuNjg5TDEzMi4xODQsNTMxLjg0NkwxMjIuOTM2LDUyNS43NzFaTTExNS44OCw0OTguNDQyTDEzMC4xNTQsNTA2LjI1MUwxMzIuMTczLDUxNy42OTVaTTk5LjM3NCw0MTcuOTAzTDk3LjQxNSw0MTguNjY1TDk3LjE0NCw0MTYuNzA5TDk4Ljg3Miw0MTUuNjAyWk0xNS43NDEsMzgyLjU0TDE4Ljk4LDM5Mi4wMzlMMTQuNzgyLDM3Ni40NDJMMTEuNjE1LDM2MC41NjhMMTUuNzAyLDM3Ni43ODNMMTUuNzAyLDM3Ni43ODNMMjAuMjY4LDM5MC42NTlMMjUuNTY1LDQwNC4yOThMMzQuNjI1LDQyMS44NEw0NS4yMTQsNDM4LjY4TDUyLjMxNiw0NTIuNzU3TDYwLjE4NSw0NjYuMzYxTDY2LjIxNCw0NzcuMzAzTDcyLjkzOSw0ODcuNzE3TDc0LjU1NSw0OTEuNDI5TDcwLjYwNSw0ODcuMDY3TDcwLjYwNSw0ODcuMDY3TDY0LjIxNiw0NzguOTQ3TDU4LjExNSw0NzAuNjFMNTIuMzA4LDQ2Mi4wNjRMNDYuODAzLDQ1My4zMjFMNDEuNjA2LDQ0NC4zOTFMMzYuNzI1LDQzNS4yODVMMzIuMTY0LDQyNi4wMTVMMjcuOTI5LDQxNi41OTFMMjQuMDI2LDQwNy4wMjRMMjAuNDU5LDM5Ny4zMjhMMTcuMjMyLDM4Ny41MTNaTTQuMDk3LDMwNy41NzdMNS40MDYsMzE3LjkzN0w4Ljc5MywzMjguMTdMMTEuOTUyLDM0My4yNDhMMTYuMDg2LDM1OC4xOEwxMC40OTgsMzUzLjk3N0w3LjAwNCwzMzkuMzE1TDUuMDEyLDMyNC40NTFMNS4wMTIsMzI0LjQ1MUw0LjMzOCwzMTQuMTQxWk02NS4zMjgsMTI4LjI1OEw1OC45NTcsMTM2LjA3M0w1NC44NzgsMTM0LjQ4OUw2MC45MSwxMjguMjEyTDY4LjEyOSwxMjIuNzg5Wk00ODQuMDAxLDgwLjc1MUw0OTguMDU5LDg5LjU3Nkw0OTMuNDI1LDkzLjI2NVpNNDE1LjQ3NCwyNy40NTNMNDE0LjM1OCwyNy4wMTdMNDExLjEwNSwyNS42NDNMNDExLjEwNSwyNS42NDNaTTI0Ni42NSw4Ljg0OEwyMzcuODA0LDExLjUxMkwyMjcuMjI5LDEzLjQ4M0wyMTYuNTE5LDE4LjMwNEwyMDYuMzU2LDI0Ljk2N0wyMTMuMTE0LDIyLjkwM0wyMTEuMzY1LDMxLjQ1MkwyMDYuNTEzLDM0Ljk2NUwyMTcuOTE5LDM2LjA1NkwyMjQuNTgyLDM5LjYwNkwyMjQuODY5LDQwLjk3MUwyMjQuODY5LDQwLjk3MUwyMzEuMDU3LDUwLjkxTDIxOS4zNTcsNTQuNzMzTDIxMS40NzcsNTEuMjI0TDIxMS40NDksNTEuMjM2TDIwMy44ODEsNTYuNjM3TDE3OC44MjUsNjIuNzY4TDE2OS40NjcsNjAuMjE1TDE0OC4zMzksNzUuMTI3TDEyNy4wNzIsODUuNDI5TDE0Mi40MTksNzAuMzAyTDE1OC4yNTUsNjIuOTg1TDE3NC42NDksNTYuNjAxTDE2OC41MTEsNTMuMDhMMTU5LjIyNSw1Ni42ODlMMTQ4LjkyOCw1My4zNDFMMTM4Ljc5OCw1Ny4zOThMMTI5LjA3OSw2Mi4wNzJMMTIzLjMyMSw3MC4zMzRMMTA0LjQyNCw4NC44NjVMOTQuMzc0LDkxLjk0NUw4NC45MjcsOTkuNjM1TDc5LjI4NywxMDMuNzEzTDc0LjM3NiwxMDguNDM5TDY0LjA0NSwxMjEuNDY5TDYwLjgyLDEyNS42MTlMNjAuODIsMTI1LjYxOEw2Ny4wNTIsMTE3LjM3N0w3My41NjcsMTA5LjM1OUw4MC4zNTgsMTAxLjU3M0w4Ny40MTcsOTQuMDI4TDk0LjczNSw4Ni43MzVMMTAyLjMwMyw3OS43MDFMMTEwLjExMSw3Mi45MzVMMTE4LjE1MSw2Ni40NDdMMTI2LjQxMyw2MC4yNDNMMTM0Ljg4Niw1NC4zMzFMMTQzLjU2MSw0OC43MThMMTUyLjQyNiw0My40MTFMMTYxLjQ3LDM4LjQxN0wxNzAuNjg0LDMzLjc0MkwxODAuMDU1LDI5LjM5MUwxODkuNTcyLDI1LjM3TDE5OS4yMjQsMjEuNjgzTDIwOC45OTgsMTguMzM2TDIxOC44ODQsMTUuMzMyTDIyOC44NjgsMTIuNjc0TDIzOC45MzksMTAuMzY3Wk0yMzMuNjQzLDM1LjA1N0wyMzEuMjc5LDM2LjU5TDIzMC43MDUsMzUuNzI1Wk01NTEuNjcyLDQ1NS44MTFMNTQyLjE4OSw0NjkuOTcxTDUzMS43MDcsNDgzLjQzMUw1MjAuMTE3LDQ5NC43MDFMNTA0LjY5Myw1MTEuMTJMNDg4LjA3OSw1MjYuMzA5TDQ3Mi45LDUzNy45NjlMNDU2Ljk5Niw1NDguNjNMNDU2Ljk3OCw1NDYuMjMxTDQ3NC44MTgsNTI5Ljk1Mkw0ODguMjQyLDUxNy42MzFMNTAwLjkwNCw1MDQuNDI3TDUxMi43NTIsNDkwLjM5Nkw1MjMuNzM4LDQ3NS41OTNMNTMyLjYxNyw0NjAuNzE1TDU0MC42MTUsNDQ1LjIyOUw1NDcuNzAzLDQyOS4xOTNMNTUzLjg1Myw0MTIuNjY4TDU0NS40NSwzOTkuMzM3TDU0Mi41OTYsMzc3LjI3OUw1MzcuNDA2LDM1NC40NzdMNTQyLjE3NSwzMjUuNjM0TDU1MC4xMDMsMzA3LjcwNEw1NDAuMzUyLDI5MC45NDFMNTI2Ljk4NSwyNzkuODJMNTEyLjEzOSwyNjguODMxTDQ4My44ODQsMjU2LjMwM0w0NDYuODQ4LDI1MC4xMTlMNDMyLjE5MSwyMjguNjIzTDQxMS4wMjgsMjExLjUzMUwzODguODk5LDE5NS4yMDlMNDAzLjQwMSwyMTAuODQ5TDQxNy4zNjUsMjI2Ljk1MkwzOTIuMzk3LDIwOS44NDhMMzc1LjQ1OCwxODIuMDg0TDM0NC45OTYsMTU1Ljk0NUwzMzUuNjAzLDExNS42NjFMMzE5LjE1Miw5Ni42NUwzMDIuNTE1LDc5LjYwMUwyODYuMTE5LDc0LjI1MUwyNjkuNzc3LDY5Ljc4MUwyNTEuODY1LDc2Ljc1NUwyMzQuMTY4LDg0LjcyN0wyMzguNjg0LDc5LjM4NEwyMjYuOTk4LDY0LjgxOUwyNDUuMTY1LDU1Ljk4MUwyMzMuMzg3LDUyLjEyM0wyNTQuOTE0LDQwLjkyN0wyNjUuMTk1LDM5LjA3MUwyODEuMTYyLDQyLjI5N0wyOTcuMjAyLDQ2LjU0NEwzMTEuODE1LDQyLjI5M0wzMzkuMjM2LDQ2LjYyNEwzNTUuNDk2LDQ0Ljk0NEwzNzEuNTQyLDQ0LjI0NEwzNTguNzg5LDM1LjE0NUwzNzIuNjA4LDM5LjgxM0wzNzIuNjA4LDM5LjgxM0wzODQuNzc4LDQ0LjY5NkwzNzcuMzk2LDM3Ljc3MUwzOTIuNjgyLDQzLjMxMUwzODkuMTc5LDQ1LjkwN0wzOTMuOTkxLDY0LjIzMUw0MDkuMDgsNzUuODA3TDQzNC42MDUsNzguNTc0TDQ0Ni4xNTcsODguNTFMNDM5LjExMiw3MS42NTNMNDE1LjE4MSw1NC45MDNMNDMwLjIzNyw1NS4yNDRMNDQzLjg5Nyw2Mi42NDZMNDM4LjAyNCw1NS4yMjlMNDU3LjA2NCw2NS42MDdMNDc4LjQ5LDc1LjY4MUw0ODIuODI2LDg0LjQzMUw0NzYuMzA2LDg3Ljk0NUw0OTMuMDI0LDEwMS4zMjJMNDk5LjA4NCw5OS43MjlMNTAxLjE0MSwxMTIuMTQxTDQ5My44MTcsMTE0LjQ0Mkw0OTcuNjM2LDEyNy42MzNMNTAwLjY4OCwxNDEuNDkzTDUwNy4wMTMsMTUxLjg4TDUwNC41NSwxNzcuMzE3TDUxNi4yMDMsMjAzLjMyOEw1MDAuMTU4LDE4Mi4zODJMNDY2LjY5NywxOTAuNjY3TDQ2MC40ODcsMjAyLjA5TDQ2NS4xMywyMjYuNTg3TDQ4Mi45NDksMjQ2LjMyMUw1MDQuNDQxLDIyNC45OEw1MDUuMDM0LDI1NC41MDJMNTI0Ljg1MSwyNTUuMjM4TDUzMC40NTcsMjcwLjM5NEw1MzUuMzM3LDI4NS42NDJMNTQ4Ljc4MSwyNzYuMjE2TDU2MC4yODQsMjY2Ljk3NEw1NzguMzA4LDI2MC40NjFMNTgzLjUzMywyNzAuMzkxTDU4Ny44LDI4MC40MjJMNTkxLjg5NywyNzkuNTM0TDU5NC4yMTIsMjkxLjk3Mkw1OTUuNDA3LDMwNC40NEw1OTUuODg3LDMwOC4xNzNMNTk1Ljg4NywzMDguMTczTDU5NS40MjIsMzE4LjQ5NEw1OTQuNTk2LDMyOC43OTNMNTkzLjQxMiwzMzkuMDU3TDU5MS44NywzNDkuMjczTDU4OS45NzMsMzU5LjQyOUw1ODcuNzIyLDM2OS41MTNMNTg1LjEyMSwzNzkuNTEyTDU4Mi4xNzIsMzg5LjQxNEw1NzguODgsMzk5LjIwN0w1NzUuMjQ4LDQwOC44NzlMNTcxLjI4LDQxOC40MTlMNTY2Ljk4Miw0MjcuODE1TDU2Mi4zNTksNDM3LjA1NEw1NTcuNDE2LDQ0Ni4xMjdMNTUyLjE1OSw0NTUuMDIyWk0zMzAuNTY3LDM1LjAwNEwzNDMuNTQxLDM1LjAzOEwzNTYuNTc0LDQwLjU4NkwzNDAuMDI2LDQ2LjE5MUwzMjUuMTc5LDM5LjEyN1pNMzY0LjE3MSwzMC44OEwzNjUuODcyLDI4Ljg2MUwzOTAuMzA0LDMyLjA4OEwzOTguMjg2LDM1LjkwMUw0MTEuMzIsMzcuOEw0MjcuNjcyLDQ5LjEwMUw0MjUuNjg4LDUxLjQ5NEw0MDMuODE4LDQ2LjgwN0wzOTcuMzIyLDM4LjY5NEwzODMuMjk4LDM1LjUyOEwzNzEuNzY5LDM3LjI3Wk0zMjMuNzA1LDM5LjU5M0wzMTQuNTI1LDM4Ljc2N0wzMTQuMDI3LDMzLjA4NEwzMjguMDg3LDM0LjMyMVpNMzMxLjgxOSwyNy44NTRMMzM2Ljc2MiwzMC4wOTFMMzIyLjQzNiwzMC42NTZaTTM0Mi43NjIsMjQuNjA3TDM2My40NDQsMjcuNDYzTDM1Mi4zODQsMjguNTQ1Wk0zMzAuODI1LDUuNjA5TDMzMC4xNTYsNS42MzRMMzIzLjgxOCw0Ljk4N0wzMjMuODE4LDQuOTg3TDMyNi4yNzYsNS4xNjlMMzI2LjI3Niw1LjE2OVpNMjUzLjI3NCw4LjI3NUwyNjQuMTY3LDYuNjU4TDI2NS4wMzcsNi45NjJaTTMzOS40NzQsMTkuNDA4TDM0MC4xMTIsMjIuMjFMMzMxLjM1LDE5LjY4MkwzMzAuNDQ4LDE3LjYzNlpNMzMyLjU3OSwxMy4wNjRMMzM3LjY0NCwxMy4wNjhMMzQ3LjY3NiwxOC4wNDZMMzU3LjUzLDI0LjA4TDM0OS4zOTMsMjUuMDFMMzQxLjg2MiwxOS42NDJMMzI4LjY4MSwxNi42NzNMMzI5LjI0NCwxNC4wNTVaTTMzMS43ODksOC41NzZMMzM0LjE5Niw4LjE4TDMzOS4xMjgsOS42MTNMMzQyLjI2Myw5LjAyNkwzMzcuNjc4LDcuNjQzTDM1Mi4yMDEsOS44MTJMMzcyLjIzOSwxMy4zNjFMMzgyLjc5OSwxNi40TDM5Mi44NDUsMTkuMTIzTDQwNy45MDgsMjUuMzM2TDQyMi40NCwzMi45TDQzNS4xMzIsMzkuNDI3TDQ0Ny41MDEsNDYuNTc2TDQ0My45MSw0Ni44MjFMNDI4Ljg2LDQwLjE1NUw0MTMuMzU2LDM0LjQwNEwzODcuMzE0LDI0LjQ1NEwzNzEuOTU0LDIwLjc3OUwzNjUuMzg5LDIyLjAxOUwzNTIuMzMyLDE5LjI4MkwzMzkuMzA4LDEyLjY3N0wzMzIuMjc0LDkuMzA5WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjk4LjM0MSw1OTUuOTk1TDI5OC4zOTksNTk1Ljk5NUwyODkuOTMxLDU5NS44MDJMMjkyLjg3Nyw1OTUuNjI2TDMxMy42MSw1OTQuMzM2TDMzMy44NDcsNTkzLjMwOEwzNDIuODE5LDU5Mi4xNTVMMzUyLjUwNyw1OTEuMjg4TDM1OC4zODUsNTg5LjcyM0wzNjIuNjg3LDU4OS4yNDNMMzY5LjI2LDU4Ny43ODNMMzY5LjI2LDU4Ny43ODNMMzU5LjE3NCw1OTAuMDI1TDM0OS4wMTcsNTkxLjkxM0wzMzguNzk5LDU5My40NDZMMzI4LjUzNCw1OTQuNjIxTDMxOC4yMzUsNTk1LjQzOEwzMDcuOTEzLDU5NS44OTRaTTIwNC4xMjksNTgwLjA0NEwyMjIuNzIxLDU4NS41NDlMMjM1LjY2NCw1ODguNDA2TDI0MS4yODQsNTkwLjExOEwyNDEuMjg0LDU5MC4xMThMMjMxLjE5NSw1ODcuODkyTDIyMS4xODksNTg1LjMxNUwyMTEuMjgsNTgyLjM5MVpNMTUwLjM5Myw1MTkuODAzTDE1NC42MzcsNTM2LjYwNEwxNDQuODc0LDUzMC44MThaTTE0NS4xMzcsNTAzLjU5MkwxNjAuNzM5LDUxMC45NDdMMTYwLjA2Niw1MjIuMzcxWk0xMzcuMjYsNDIzLjQyM0wxMzQuODk3LDQyNC4yNTFMMTM0LjczNyw0MjIuMzAxTDEzNi44NTMsNDIxLjEzNlpNMTQuNDg5LDM3OC4xMDFMMTQuNDAzLDM3Ny43MTNMMTEuOTU2LDM2Mi43MTlMMTcuMTE5LDM3Mi43NTNMMTguNDM5LDM4My4wNDlMMjIuOTkxLDM5MS44NjNMMjguMjcsNDAwLjQzN0wyNC45NCwzODQuOTU0TDIyLjYwNCwzNjkuMTYzTDI3LjQ1MiwzODUuMjQzTDI3LjQ1MiwzODUuMjQzTDMzLjA0MywzOTguOTY1TDM5LjMzMiw0MTIuNDI4TDUwLjYxNiw0MjkuNjZMNjMuMzM3LDQ0Ni4xNDZMNjkuOTQ5LDQ2MC4wMTRMNzcuMjcyLDQ3My4zODhMODEuNzg3LDQ4NC4xN0w4Ni45NTIsNDk0LjQwM0w4NS44MTUsNDk4LjEwOEw3NS40NDEsNDkwLjQ2TDYxLjM3OCw0NzQuNDYxTDQ5LjE0Niw0NTcuMTI0TDQ5LjE5NCw0NTcuMjAxTDQ5LjE5NCw0NTcuMjAxTDQzLjg2LDQ0OC4zNTJMMzguODM5LDQzOS4zMjNMMzQuMTM2LDQzMC4xMjNMMjkuNzU2LDQyMC43NjZMMjUuNzA2LDQxMS4yNjFMMjEuOTksNDAxLjYyTDE4LjYxMywzOTEuODU2TDE1LjU3OSwzODEuOThaTTcuODIsMzE0LjAyNkwxMy41MjEsMzI1LjUzN0wyMS43NTUsMzM2LjgyMkwyNi42MzgsMzUxLjc3N0wzMi40NDgsMzY2LjU1OEwyMS42MjksMzYyLjYwNEwxNS44MDgsMzQ5LjYzMkwxMS4xNTQsMzM2LjQ1N0w3LjY4NCwzMjMuMTMyTDUuNDEzLDMwOS43MTJaTTQuMDkyLDI5Mi42MTJMNC4wOTQsMjkyLjk4OEw0LjA5NCwyOTIuOTg4TDQuMDgsMjkzLjEyNEw0LjA4LDI5My4xMjRaTTczLjE1OSwxMzUuMjY5TDY2LjQ2NywxNDMuMjgzTDU1LjYxNCwxNDEuOTI2TDY0LjYwNywxMzUuNDIxTDc0Ljc2OSwxMjkuNzMzWk00ODcuNDkzLDc1LjEwN0w0OTkuNjY5LDgzLjUzNEw0OTkuMDI2LDg3LjMwM1pNMjM5LjI3MywxMC4yOTZMMjM5Ljk1MiwxMC4xNzlMMjM2Ljg2OSwxMS40MjZMMjMzLjk1OCwxMy40NkwyMjIuMjgsMTUuNzdMMjE1LjQ0NiwyMC44NTdMMjA5LjE2NCwyNy43NjlMMjE1Ljg3OSwyNS41MDFMMjE5LjU2NCwzNC4wMjFMMjE1LjgzLDM3LjY2NEwyMjkuMzE1LDM4LjM3N0wyMzguMTk5LDQxLjY5TDIzOS4wNTcsNDMuMDM4TDIzOS4wNTcsNDMuMDM4TDI0OS4yNjYsNTIuNzI4TDIzNy45NDMsNTYuOTAxTDIyOC4xOTQsNTMuNjZMMjI4LjE2Nyw1My42NzNMMjIxLjY2OSw1OS4yODhMMTk1LjU4MSw2Ni4xOTVMMTgzLjc3OCw2My45NjRMMTY0LjEzMSw3OS40OTVMMTQxLjcwNCw5MC40NjJMMTU1LjAwNyw3NC44OTlMMTcxLjQ3OCw2Ny4wOTFMMTg4LjQ1Niw2MC4yTDE3OS42MDUsNTYuOTA2TDE2OS44ODUsNjAuODA1TDE1NC41MzcsNTcuODQ2TDE0Mi45MzksNjIuMjMzTDEzMS43NCw2Ny4yMjVMMTI5LjQxOCw3NS42MUwxMTAuNDAzLDkwLjcxNkw5OC45NjEsOTguMTIzTDg4LjEwOSwxMDYuMTIyTDgwLjAyNiwxMTAuNDA4TDcyLjY2OSwxMTUuMzJMNjMuNjU1LDEyOC42NDVMNTUuODE5LDEzNi40NTJMNjQuMTIyLDEyNC4yTDczLjAzMSwxMTIuNEw3MS4wNzQsMTEyLjM3OEw1Ni40NDgsMTMxLjk1NUw0My41NTQsMTUyLjcyOUwzOC4xMjUsMTYyLjAyM0wzOC4xMjYsMTYyLjAyMkw0My4xLDE1Mi45NjdMNDguMzg4LDE0NC4wOTFMNTMuOTgzLDEzNS40MDVMNTkuODc3LDEyNi45MTlMNjYuMDY0LDExOC42NDVMNzIuNTM1LDExMC41OTFMNzkuMjg0LDEwMi43NjhMODYuMzAyLDk1LjE4NUw5My41OCw4Ny44NTJMMTAxLjExLDgwLjc3N0wxMDguODgyLDczLjk3TDExNi44ODYsNjcuNDM3TDEyNS4xMTQsNjEuMTg4TDEzMy41NTUsNTUuMjNMMTQyLjE5OSw0OS41NzFMMTUxLjAzNSw0NC4yMTZMMTYwLjA1MiwzOS4xNzNMMTY5LjI0LDM0LjQ0OEwxNzguNTg4LDMwLjA0NkwxODguMDgzLDI1Ljk3M0wxOTcuNzE0LDIyLjIzNUwyMDcuNDcxLDE4LjgzNEwyMTcuMzQsMTUuNzc2TDIyNy4zMDksMTMuMDY0TDIzNy4zNjcsMTAuNzAyWk0yNDYuMTc0LDM2Ljg4M0wyNDQuMjU2LDM4LjQ4MUwyNDMuMjY3LDM3LjY0Wk00OTIuODE4LDUyNC41ODJMNDgwLjYyOCw1MzQuNDhMNDY3LjkxMSw1NDMuNjk0TDQ3MC4yOTcsNTQxLjI1OUw0ODAuNDQxLDUzMy4xMTVMNDkwLjE0OCw1MjQuNDA4TDUwMy44MTUsNTExLjY3NEw1MTYuNjU2LDQ5OC4wODRMNTI4LjYyLDQ4My42OUw1MzkuNjU3LDQ2OC41NTNMNTQ4LjkxMiw0NTMuNEw1NTcuMjI0LDQzNy42NjZMNTY0LjU2Myw0MjEuNDExTDU3MC45MDEsNDA0LjY5Nkw1NjkuNTYxLDM5OC4yODJMNTY3LjM0MSwzOTEuNTQ3TDU2Ny4wNTcsMzY5LjUzNkw1NjQuMjA0LDM0Ni44NTZMNTY4LjA0MiwzMTcuODgzTDU3My41NzgsMjk5Ljc0OEw1NjUuOTMxLDI4My4yNDlMNTU1LjIzMywyNzIuNDk0TDU0Mi44NzMsMjYxLjkxOEw1MTguNzI5LDI1MC4xODdMNDg2LjIyNywyNDUuMDU5TDQ3MS42NDUsMjI0LjAwN0w0NTEuMDkxLDIwNy41NDlMNDI5LjIyMiwxOTEuODk1TDQ0NC4wNTQsMjA3LjA4OUw0NTguMTM5LDIyMi43NjZMNDMzLjgyNiwyMDYuNDExTDQxNS4zNTYsMTc5LjE4NUwzOTkuNjcsMTY2LjI3NEwzODMuNTE0LDE1My45OTJMMzc2LjMzNSwxMzMuNDY5TDM2OC42MzgsMTE0LjA3N0wzNDkuMzY2LDk1LjYwOUwzMjkuNjE4LDc5LjExM0wzMTIuMTc3LDc0LjI3N0wyOTQuNjg4LDcwLjMyMUwyNzguMDY3LDc3LjgxOUwyNjEuNTQ0LDg2LjMxMUwyNjUuMDQsODAuODQ2TDI0OS4xMDQsNjYuNzAxTDI2NS43MTMsNTcuMzM1TDI1Mi4xMzcsNTMuODYzTDI3MS4wMjQsNDIuMDUyTDI4MS4wMDMsMzkuODg5TDI5OC4zNyw0Mi42MDhMMzE1Ljc0NCw0Ni4zNDhMMzI4LjY4NCw0MS42NzhMMzU2LjI5NCw0NS4xNzJMMzcwLjgzMSw0My4wMjVMMzg1LjA5Nyw0MS44NjRMMzcwLjE1MiwzMy4xODZMMzg0LjM1NSwzNy40MjlMMzg0LjM1NSwzNy40MjlMMzk2LjkwOCw0MS45MzVMMzg3LjcwOCwzNS4yNjNMNDAzLjEzNSw0MC4zMzZMNDAxLjE3Niw0My4wMTZMNDA2LjUyMyw1MS42MjhMNDExLjQ5OCw2MS4xMDlMNDI3Ljk0Nyw3Mi4yMDdMNDUwLjM0OSw3NC4yNDVMNDYyLjY0OSw4My44MTlMNDUxLjgyNiw2Ny4yMzNMNDM5LjMzMSw1OC45MTlMNDI2LjQ3NCw1MS4yMzJMNDM4LjYwOCw1MS4xNkw0NTIuMTM4LDU4LjE0OUw0NDQuNDUzLDUwLjkzN0w0NjIuOTEyLDYwLjc0Nkw0ODEuNjI1LDcwLjIxTDQ4OC41NzQsNzguNzg4TDQ4NS42MjQsODIuNDQ2TDUwMS45NDIsOTUuMzIxTDUwNS4xOTQsOTMuNTg4TDUxMS4wNSwxMDUuODc5TDUwNi42NSwxMDguMzU4TDUxMi45MTIsMTIxLjM5Nkw1MTguMzQ4LDEzNS4xMjZMNTI1LjIzNiwxNDUuMzEzTDUyNi44NzksMTU3Ljc4TDUyNy43MTgsMTcwLjc1TDU0MC4zNjgsMTk2LjM5Mkw1MjQuOTczLDE3NS45MjRMNDk4LjI4NSwxODUuMTIyTDQ5NC4xOTUsMTk2LjcwMUw1MDAuNDk4LDIyMS4wMzJMNTE3LjI3LDI0MC4yNDFMNTMzLjM1NywyMTguMzI5TDUzNi4yMTcsMjQ3Ljc5OEw1NTIuMTAzLDI0Ny45OTJMNTU3LjQyMywyNjIuOTgyTDU2MS45MzIsMjc4LjA4OEw1NzEuNDA5LDI2OC4zMTNMNTc4Ljc2OCwyNTguNzg1TDU4NC43MDQsMjU1LjE2Nkw1ODguNzQ0LDI1MS44NDZMNTkxLjk1OCwyNjEuNjQ4TDU5NC4xODYsMjcxLjU4TDU5NC41NjMsMjcwLjg2NEw1OTQuNTYzLDI3MC44NjRMNTk1LjQsMjgxLjE2Mkw1OTUuODc3LDI5MS40ODNMNTk1Ljk5NCwzMDEuODE0TDU5NS43NTEsMzEyLjE0M0w1OTUuMTQ3LDMyMi40NTdMNTk0LjE4MywzMzIuNzQ0TDU5Mi44NjEsMzQyLjk5MUw1OTEuMTgzLDM1My4xODVMNTg5LjE0OSwzNjMuMzE1TDU4Ni43NjMsMzczLjM2OEw1ODQuMDI4LDM4My4zMzFMNTgwLjk0NywzOTMuMTkyTDU3Ny41MjMsNDAyLjk0MUw1NzMuNzYyLDQxMi41NjNMNTY5LjY2Nyw0MjIuMDQ5TDU2NS4yNDMsNDMxLjM4Nkw1NjAuNDk2LDQ0MC41NjNMNTU1LjQzMiw0NDkuNTY4TDU1MC4wNTYsNDU4LjM5MUw1NDQuMzc2LDQ2Ny4wMjJMNTM4LjM5OCw0NzUuNDQ5TDUzMi4xMyw0ODMuNjYyTDUyNS41NzksNDkxLjY1MUw1MTguNzUzLDQ5OS40MDdMNTExLjY2MSw1MDYuOTJMNTA0LjMxLDUxNC4xODFMNDk2LjcxMSw1MjEuMThaTTM0NC4wNTEsMzMuODdMMzU2LjE5MSwzMy41MjJMMzcwLjI2NywzOC42NTlMMzU2Ljg5NSw0NC43MTlMMzQwLjQ1OCwzOC4xM1pNMzczLjA3NSwyOC43OTVMMzczLjU5MSwyNi43NDJMMzk1Ljg0NCwyOS4yNkw0MDQuMzIyLDMyLjgyM0w0MTUuNDgzLDM0LjM1NUw0MzMuODA4LDQ1LjEyOUw0MzMuNDQsNDcuNTU3TDQxMy45MDIsNDMuNUw0MDQuOTQ4LDM1LjYyMUwzOTEuNzczLDMyLjg2OEwzODIuNTgxLDM0LjkyNVpNMzM5LjIxNSwzOC42MzdMMzMwLjEsMzguMDlMMzI3LjUxNCwzMi40NTNMMzQxLjQ0MywzMy4yNjRaTTM0Mi4yNzksMjYuNzI4TDM0Ny44NzEsMjguODA1TDMzNC42MTMsMjkuNzg5Wk0zNTAuODYzLDIzLjE4NEwzNzAuNzY3LDI1LjQyNEwzNjEuNDg4LDI2LjgxNVpNMzIxLjg1Myw0LjgwOEwzMjIuMDk0LDQuODRMMzE1LjI1LDQuMzk0TDMxNS4yNSw0LjM5NEwzMTUuNTE1LDQuNDA3TDMxNS41MTUsNC40MDdaTTI0OC4yODksOS43N0wyNTguNzQxLDcuODI5TDI2MC42NDEsOC4wOTFaTTM0NS4wNSwxOC4xMjNMMzQ3LjIwNSwyMC44ODRMMzM3Ljc2OSwxOC42MzJMMzM1LjczOCwxNi42MzFaTTMzNC41NDQsMTIuMDQ0TDMzOS4wNTcsMTEuOTAzTDM1MS41MjQsMTYuNTM5TDM2My43OTgsMjIuMjM3TDM1Ny4wNjgsMjMuMzkzTDM0Ny4zNDYsMTguMjg3TDMzMy41MDksMTUuNzI4TDMzMi4yNjUsMTMuMTJaTTM5My41LDE5LjE1NUw0MDYuMjIsMjMuODE4TDQxOC42NDksMjkuMjM3TDQzMS43NDksMzUuMzcyTDQ0NC41MzUsNDIuMTRMNDQzLjE0OSw0Mi40Nkw0MjkuMTcyLDM2LjIzNUw0MTQuNzQxLDMwLjkzOUwzODguNTg0LDIxLjc4MkwzNzMuODgsMTguNTY0TDM2OS4zMzMsMTkuOTcyTDM1Ni40MDEsMTcuNjNMMzQwLjE4NywxMS40NjlMMzMwLjgwNCw4LjM1TDMyOS41MjMsNy42NDVMMzI5LjUyMyw3LjY0NUwzMzEuMDE0LDcuMTg5TDMzNi45NTMsOC40NTdMMzM4LjY4MSw3Ljc5NkwzMzIuODkxLDYuNTcxTDM0Ny4xMjQsOC4zMDNMMzY1LjEyNCwxMS4yNzVMMzc2LjEwMiwxMy45ODZMMzgwLjE1MSwxNS4wNThMMzgwLjE1MSwxNS4wNThMMzkwLjA0NiwxOC4wMjlaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzA3LjE3OSw1OTUuOTEzTDI5OS42NzgsNTk1Ljk2TDMwNC4xMyw1OTUuNjcyTDMyNy4xMDcsNTkzLjcxN0wzNDUuNzY4LDU5Mi4wOThMMzU0LjUxNiw1OTAuNjc2TDM1OC43ODUsNTkwLjEwNEwzNTguNzg1LDU5MC4xMDRMMzQ4LjYyNSw1OTEuOTc5TDMzOC40MDUsNTkzLjQ5OEwzMjguMTM5LDU5NC42NTlMMzE3LjgzOCw1OTUuNDYyTDMwNy41MTYsNTk1LjkwNVpNMzY1LjQ2NSw1ODguNjdMMzY5LjAzMiw1ODcuNzg4TDM3MC4wNzMsNTg3LjU4NkwzNzAuMDczLDU4Ny41ODZaTTE5Mi41NTgsNTc1LjgxMkwxOTkuOTg4LDU3OC4zODZMMjE2Ljk1OCw1ODMuNjIyTDIzNC4yNjIsNTg3LjcyMkwyNDguMjkzLDU5MC4xNjlMMjUxLjQ3Myw1OTEuOTRMMjU3Ljk4Nyw1OTMuMDAzTDI1Ny45ODYsNTkzLjAwM0wyNDcuNzg2LDU5MS4zNThMMjM3LjY1LDU4OS4zNTlMMjI3LjU4OSw1ODcuMDA2TDIxNy42MTcsNTg0LjMwNEwyMDcuNzQ1LDU4MS4yNTZMMTk3Ljk4Niw1NzcuODY1Wk0xODEuNTM4LDUyMy44NzZMMTgxLjUwNiw1NDAuNjEzTDE3MS41MjUsNTM1LjEyN1pNMTc5LjA5OSw1MDcuNzgxTDE5NS41NTUsNTE0LjY0OUwxOTIuMjExLDUyNi4xMzRaTTE4MC4wOTEsNDI3LjcxN0wxNzcuMzk2LDQyOC42MjJMMTc3LjM1Miw0MjYuNjc2TDE3OS43OTEsNDI1LjQ0MVpNMjMuMTAxLDQwNC42MDdMMjIuNzUxLDQwMy4xMjRMMTguODIyLDM4OS4yMDJMMjEuNjU1LDM4Ni4yODFMMjIuNzkxLDM3MS4zMDZMMzEuODEzLDM4MS4xMjVMMzEuNzE0LDM5MS40MDNMNDUuODE3LDQwOC40MjdMNDMuNDU2LDM5My4wM0w0Mi4wMjEsMzc3LjI5N0w0Ny40ODQsMzkzLjIyTDQ3LjQ4NCwzOTMuMjJMNjEuMDE5LDQyMC4wMThMNzQuMTg1LDQzNi44OEw4OC42NTEsNDUyLjk1Mkw5NC41NzEsNDY2LjYzTDEwMS4xMjYsNDc5Ljc5M0wxMDMuOTksNDkwLjQ2M0wxMDcuNDM4LDUwMC41NjVMMTAzLjU4NCw1MDQuMzQ2TDg5Ljc2OCw0OTcuMDY1TDcyLjkwNiw0ODEuNTM3TDU3Ljc4Nyw0NjQuNjE1TDU2LjcyNSw0NjcuMjM2TDU2Ljk2Miw0NjguOTYzTDU2Ljk2Miw0NjguOTYzTDUxLjIxMyw0NjAuMzc4TDQ1Ljc2OCw0NTEuNTk4TDQwLjYzMiw0NDIuNjMzTDM1LjgxMiw0MzMuNDk0TDMxLjMxNCw0MjQuMTkzTDI3LjE0NCw0MTQuNzRMMjMuMzA1LDQwNS4xNDhaTTIwLjQyNCwzMjIuNzEzTDMwLjYwNywzMzMuOTgyTDQzLjE3LDM0NC45NTFMNDkuNjMxLDM1OS43MzRMNTYuOTQsMzc0LjMxNUw0MS4yMTgsMzcwLjc2NUwzMi45NSwzNTguMDA3TDI1Ljc3OCwzNDUuMDExTDE5LjczMSwzMzEuODMxTDE0LjgzMywzMTguNTJaTTguODA0LDMwMS45MDhMNS4yMTIsMzAzLjQzNEw2LjI5NSwzMTguOTQ2TDguMjcxLDMzNC40MDFMNC45OTMsMzE3LjYyNEw1LjYzOCwyOTguNjEyWk00Ljg1OCwyNzcuNDg1TDYuMzY0LDI2Ni43MzNMNC41MjMsMjkzLjI4M0w0LjUyMywyOTMuMjgzTDQuMjM2LDMwNy4zNjVMNC43ODUsMzIxLjQyNkw0LjcxOCwzMjAuNjA2TDQuNzE4LDMyMC42MDVMNC4xNzksMzEwLjI4OEw0LDI5OS45NTdMNC4xODIsMjg5LjYyN0w0LjcyNCwyNzkuMzFaTTg3Ljg4MiwxNDEuOTM4TDgxLjA3MiwxNTAuMTU3TDYzLjc3NywxNDkuMjI3TDc1LjQ1NywxNDIuNDA4TDg4LjI1MywxMzYuMzcyWk00OTUuOTI3LDc4LjEyNUw0OTguNTgsODEuMjYyTDQ4NS4yODksNjkuNDQ0TDQ4NS4yODksNjkuNDQ0TDQ5Mi42MjEsNzUuMjQ5TDQ5Mi42MjEsNzUuMjQ5Wk0yMjcuNDY3LDEzLjAyNEwyMzIuNzY3LDEyLjExM0wyMzIuMTE5LDE1LjQ5NUwyMTkuNjkyLDE4LjE3TDIxNi45NDEsMjMuNDAzTDIxNC43MzIsMzAuNDQ1TDIyMS4xOTksMjcuOTc2TDIzMC4yMDYsMzYuMzAzTDIyNy43MDUsNDAuMDQxTDI0Mi44NTksNDAuMzE5TDI1My42OTQsNDMuMzMzTDI1NS4wOTYsNDQuNjQ2TDI1NS4wOTYsNDQuNjQ2TDI2OS4wMTgsNTMuOTY5TDI1OC40MTQsNTguNDc1TDI0Ny4wOTIsNTUuNTU1TDI0Ny4wNjgsNTUuNTY4TDI0MS44MzcsNjEuMzYxTDIxNS41MSw2OS4wNjVMMjAxLjYyLDY3LjIyNEwxODQuMDUxLDgzLjMyMUwxNjEuMTQ2LDk0Ljk3NkwxNzIuMDAyLDc5LjA0N0wxODguNjA3LDcwLjczNUwyMDUuNjUyLDYzLjMyOEwxOTQuMzU3LDYwLjM0TDE4NC40OTgsNjQuNTM2TDE2NC41NjYsNjIuMTE0TDEzOS41MTUsNzIuMjE5TDE0MC42OTcsODAuNjIyTDEyMi4xNDMsOTYuMjk5TDEwOS42NTcsMTA0LjA2OUw5Ny43MywxMTIuNDE0TDg3LjQ0OSwxMTYuOTc5TDc3Ljg2OSwxMjIuMTQ5TDcwLjQ0NiwxMzUuNzIzTDYwLjYyOCwxNDMuNzk4TDY4LjAwMiwxMzEuMzA4TDc1Ljk3MywxMTkuMjUyTDY5LjM0MSwxMTkuMzZMNTYuMzk5LDEzOS4zNTZMNDUuMTg5LDE2MC40OTZMMzUuMzQ2LDE3My43OUwyNy4xMjYsMTg3Ljg1N0wyNi40NDcsMTg2LjkzMUwyNi40NDcsMTg2LjkzMUwzMC41NTksMTc3LjQ1M0wzNSwxNjguMTI0TDM5Ljc2NCwxNTguOTU2TDQ0Ljg0NSwxNDkuOTZMNTAuMjM3LDE0MS4xNDdMNTUuOTMzLDEzMi41MjdMNjEuOTI2LDEyNC4xMTFMNjguMjEsMTE1LjkxTDc0Ljc3NiwxMDcuOTMyTDgxLjYxNiwxMDAuMTg5TDg4LjcyMiw5Mi42ODlMOTYuMDg2LDg1LjQ0MkwxMDMuNjk4LDc4LjQ1NkwxMTEuNTQ5LDcxLjc0MUwxMTkuNjMsNjUuMzAzTDEyNy45MzEsNTkuMTUxTDEzNi40NDEsNTMuMjkzTDE0NS4xNTEsNDcuNzM1TDE1NC4wNDksNDIuNDg0TDE2My4xMjUsMzcuNTQ4TDE3Mi4zNjgsMzIuOTMxTDE4MS43NjYsMjguNjM5TDE5MS4zMDksMjQuNjc4TDIwMC45ODQsMjEuMDUyTDIxMC43NzksMTcuNzY3TDIyMC42ODMsMTQuODI1Wk0yNjAuMzQsMzguMzAzTDI1OC45MjcsMzkuOTUyTDI1Ny41NTMsMzkuMTQ3Wk01NDUuMTg3LDQ2NS44M0w1NDguMjk0LDQ2MS4xNEw1NTcuNjQzLDQ0NS43MDRMNTY2LjAxOCw0MjkuNzE3TDU3My4zODUsNDEzLjIzOEw1NzkuNzE3LDM5Ni4zMzFMNTgwLjg3MSwzODkuOTJMNTgxLjEwOCwzODMuMjE1TDU4My40MDUsMzYxLjE3M0w1ODIuOTczLDMzOC41NDNMNTg1Ljc2NSwzMDkuNDY5TDU4OC43NCwyOTEuMjA1TDU4My40MywyNzQuOTAzTDU3NS43MjcsMjY0LjQyOEw1NjYuMjI3LDI1NC4xODRMNTU3LjEzNiwyNDguNTM2TDU0Ni45MjgsMjQzLjExMkw1MTkuOTQ5LDIzOC44ODhMNTA1Ljg4NCwyMTguMjcxTDQ4Ni41NjMsMjAyLjQxOUw0NjUuNjE5LDE4Ny40MTZMNDgwLjMzMSwyMDIuMTYxTDQ5NC4xMDcsMjE3LjQxNUw0NzEuMTg5LDIwMS43NzdMNDUxLjc0OSwxNzUuMTI3TDQzNS45NDIsMTYyLjY5NEw0MTkuNDk0LDE1MC45MDhMNDA5LjkxNCwxMzAuNjRMMzk5LjU4NywxMTEuNTIyTDM3OC4wOCw5My42NzNMMzU1LjgyLDc3LjgxNUwzMzcuODY0LDczLjUxN0wzMTkuNzYxLDcwLjEwMkwzMDQuOTM2LDc4LjA3OEwyOTAuMDg5LDg3LjA0NkwyOTIuNDU5LDgxLjQ5MkwyNzIuNzU1LDY3Ljg4OEwyODcuMzAzLDU4LjA0OUwyNzIuMzQxLDU1LjAxTDI4OC4wMTUsNDIuNjc1TDI5Ny4zODgsNDAuMjE3TDMxNS42MjksNDIuMzk2TDMzMy44MDcsNDUuNTk1TDM0NC42ODEsNDAuNTYzTDM3MS42NDEsNDMuMjI5TDM4NC4wMTUsNDAuNjcyTDM5Ni4wNjYsMzkuMTEyTDM3OS4zODQsMzAuOTE1TDM5My41NCwzNC43MjZMMzkzLjU0LDM0LjcyNkw0MDYuMDk1LDM4Ljg1MUwzOTUuMzU0LDMyLjQ4Mkw0MTAuNDUzLDM3LjA5MUw0MTAuMSwzOS44MDZMNDE4LjA2NSw0OC4yMTZMNDI1LjYxNyw1Ny41MDdMNDQyLjkyNiw2OC4wOTFMNDYxLjUyNSw2OS41MDdMNDc0LjIsNzguNzAxTDQ1OS45MjcsNjIuNDk2TDQ0Ny4xMTcsNTQuNTY3TDQzMy45MjQsNDcuMjc2TDQ0Mi43NjcsNDYuODg1TDQ1NS43NTYsNTMuNDcxTDQ0Ni40OTQsNDYuNTE3TDQ2My44MSw1NS43ODJMNDc5LjI0Miw2NC43MjhMNDg4LjU5Myw3My4wNThMNDg5LjMwMSw3Ni43NTFMNTA0LjcyNCw4OS4xNDNMNTA1LjA3LDg3LjM1NUw1MTQuNTQ2LDk5LjQxM0w1MTMuMjAzLDEwMS45OEw1MjEuNzE5LDExNC43OTNMNTI5LjM3NCwxMjguMzI1TDUzNi42MTUsMTM4LjI5N0w1NDAuNzE3LDE1MC42NzZMNTQzLjk2NywxNjMuNTg0TDU1Ny4yMjksMTg4LjgzMkw1NDIuOTUxLDE2OC44MTVMNTIzLjg0OCwxNzguNzA5TDUyMi4wMDMsMTkwLjM3OEw1MjkuNzc0LDIxNC40OTVMNTQ0Ljk5LDIzMy4yMThMNTUwLjY1NSwyMjEuODg1TDU1NS4xODIsMjEwLjkwN0w1NTguMDQ4LDIyNS40ODJMNTYwLjIyMiwyNDAuMjU2TDU3MS42OTUsMjQwLjAzNEw1NzYuNTY4LDI1NC44NjlMNTgwLjU2OSwyNjkuODQ2TDU4NS43OSwyNTkuODQ4TDU4OC43ODEsMjUwLjE2M0w1OTAuNDQ0LDI0Ni44NzlMNTkwLjYyOCwyNDMuODY1TDU5MC42MjgsMjQzLjg2NUw1OTIuNDEsMjU0LjA0Mkw1OTMuODM2LDI2NC4yNzVMNTk0LjkwNCwyNzQuNTUxTDU5NS42MTIsMjg0Ljg1OUw1OTUuOTYxLDI5NS4xODVMNTk1Ljk0OSwzMDUuNTE3TDU5NS41NzYsMzE1Ljg0Mkw1OTQuODQzLDMyNi4xNDhMNTkzLjc1MSwzMzYuNDIyTDU5Mi4zMDEsMzQ2LjY1MUw1OTAuNDk0LDM1Ni44MjRMNTg4LjMzNCwzNjYuOTI3TDU4NS44MjMsMzc2Ljk0OUw1ODIuOTYzLDM4Ni44NzdMNTc5Ljc1OSwzOTYuN0w1NzYuMjE0LDQwNi40MDRMNTcyLjMzMiw0MTUuOTc5TDU2OC4xMTksNDI1LjQxM0w1NjMuNTc4LDQzNC42OTRMNTU4LjcxNyw0NDMuODFMNTUzLjU0MSw0NTIuNzUyTDU0OC4wNTUsNDYxLjUwN1pNMzU2LjE5NywzMi4zNDdMMzY3LjEzMywzMS42NDlMMzgxLjgyNiwzNi4zNDlMMzcyLjAzNSw0Mi43NkwzNTQuNTA2LDM2LjY4N1pNMzc5Ljc2LDI2LjQ3M0wzNzkuMDczLDI0LjQyM0wzOTguNDcyLDI2LjMwOEw0MDcuMTg4LDI5LjYxTDQxNi4xMzgsMzAuODM2TDQzNS44NzgsNDEuMDMxTDQzNy4xMzgsNDMuNDQ2TDQyMC41MjUsMzkuOTM4TDQwOS4zODYsMzIuMzY1TDM5Ny40NiwyOS45OTNMMzkwLjg4MywzMi4yOVpNMzUzLjUzMywzNy4yMjhMMzQ0Ljc2MSwzNi45NTJMMzQwLjE2NiwzMS40MjVMMzUzLjU0LDMxLjgyMVpNMzUxLjQ1NSwyNS4zMDRMMzU3LjUyNSwyNy4yMDRMMzQ1LjczOCwyOC41NjhaTTI1NS4wNjEsNy40MzFMMjU0LjI0Niw3LjU2NUwyNTQuMjU2LDcuNTU2TDI1NC4yNTcsNy41NTZaTTM1Ny40MTgsMjEuNTM5TDM3NS45MzksMjMuMTk2TDM2OC43MjQsMjQuODM3Wk0yNDQuODc2LDExLjM5M0wyNTQuNTY4LDkuMTQ2TDI1Ny40NDEsOS4zMzZaTTM0OS4yNTgsMTYuNjkxTDM1Mi44NjMsMTkuMzYzTDM0My4wNDEsMTcuNDA0TDMzOS45NDIsMTUuNDgxWk0zMzUuNDU5LDEwLjk4MUwzMzkuMjg0LDEwLjcxM0wzNTMuODA2LDE0LjkzOEwzNjguMTI3LDIwLjIzM0wzNjMuMDEsMjEuNTY5TDM1MS4zOTIsMTYuNzg3TDMzNy4zMTksMTQuNjUyTDMzNC4zMDYsMTIuMTA5Wk00MzcuODAxLDM4LjAzM0w0MzguMDM4LDM4LjE4OEw0MjUuNTYsMzIuMzY1TDQxMi42NCwyNy40ODRMMzg3LjE2MywxOS4xMTJMMzczLjU2MiwxNi4zMjRMMzcxLjE3MSwxNy44MzhMMzU4Ljc1NiwxNS44ODFMMzM5Ljg0NSwxMC4yNTNMMzI4LjM5OSw3LjQ1MUwzMjYuMzYsNi43OTZMMzI2LjM2LDYuNzk2TDMyNi44ODksNi4zMUwzMzMuNjU1LDcuMzg1TDMzMy45MjQsNi42OTNMMzI3LjEwNCw1LjY1OUwzNDAuNjE1LDYuOTdMMzQ5Ljc2Myw4LjIxM0wzNDkuNzY0LDguMjEzTDM1OS45MTcsMTAuMTI4TDM2OS45OTYsMTIuMzk1TDM3OS45OTEsMTUuMDEzTDM4OS44ODgsMTcuOTc5TDM5OS42NzYsMjEuMjg3TDQwOS4zNDIsMjQuOTM2TDQxOC44NzUsMjguOTE5TDQyOC4yNjMsMzMuMjMzTDQzNy40OTUsMzcuODcyWiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzEzLjgyOSw1OTUuNjc3TDMwOS40MzQsNTk1LjgyMkwzMTUuMjU5LDU5NS4zNzdMMzM5Ljc4MSw1OTIuNzAxTDM1Ni4yOTgsNTkwLjU0OEwzNjQuNTU2LDU4OC44NjdMMzY0Ljg5NSw1ODguNzk5TDM2NC44OTUsNTg4Ljc5OUwzNTQuNzc2LDU5MC44ODhMMzQ0LjU5MSw1OTIuNjIyTDMzNC4zNTIsNTk0TDMyNC4wNyw1OTUuMDJaTTE5My40ODMsNTc2LjE3TDE5Ni4zNDYsNTc3LjAyNkwyMTEuNzMzLDU4MS4yNDZMMjI5LjYyNSw1ODUuOTUzTDI0Ny44LDU4OS41MTRMMjYyLjQ5NCw1OTEuNTI1TDI2MS45ODUsNTkzLjI1NUwyNzIuNzIsNTk0Ljc0TDI3Mi43Miw1OTQuNzRMMjYyLjQ1MSw1OTMuNjA5TDI1Mi4yMjcsNTkyLjExOUwyNDIuMDYxLDU5MC4yNzRMMjMxLjk2Niw1ODguMDc1TDIyMS45NTQsNTg1LjUyNUwyMTIuMDM2LDU4Mi42MjhMMjAyLjIyNiw1NzkuMzg2Wk0yMTYuMjgzLDUyNi45NDhMMjExLjk3Niw1NDMuNzVMMjAyLjA4LDUzOC41NjZaTTIxNi43MzUsNTEwLjg4M0wyMzMuNTQ1LDUxNy4yNDZMMjI3LjYzMSw1MjguODcxWk0yMjYuNTY2LDQzMC42NTVMMjIzLjYyLDQzMS42NDVMMjIzLjY5Myw0MjkuNjk4TDIyNi4zODIsNDI4LjM4NVpNNzUuMTg4LDQwMC40NzJMODkuOTY3LDQyNi44NEwxMDQuNjE0LDQ0My4yNzlMMTIwLjM4Nyw0NTguODkyTDEzMS4wMjQsNDg1LjM4MkwxMzMuNzc0LDUwNi4wMTZMMTI3LjMyLDUwOS45NTNMMTEwLjQ4Miw1MDMuMTM4TDkxLjMzNCw0ODguMTU3TDczLjc4OCw0NzEuNzMxTDYzLjk1NSw0NzYuOTQ5TDU1LjM2LDQ2NS4wODlMNDcuMzcyLDQ1Mi44MjFMNDAuMDA5LDQ0MC4xNzRMMzMuMjksNDI3LjE4TDI4LjU4LDQxNS42MzVMMzEuOSw0MTEuNDA5TDI5Ljk2NiwzOTcuNTc2TDM3LjM2MywzOTQuNDk5TDQyLjA0OCwzNzkuNDM2TDU0LjY1NywzODguOTI3TDUzLjE0MiwzOTkuMjI5TDcxLjA4Nyw0MTUuNzY2TDY5Ljc2Niw0MDAuNDI1TDY5LjI3NywzODQuNzIxWk00MS41MjMsMzMwLjg4N0w1NS44NzgsMzQxLjc4M0w3Mi4zOSwzNTIuMzFMODAuMjMxLDM2Ni44NzZMODguODE3LDM4MS4yMTZMNjguNjcsMzc4LjIxMUw1OC4yMDYsMzY1LjczN0w0OC43MzQsMzUyLjk5NEw0MC4yOTMsMzQwLjAzNEwzMi45MTcsMzI2LjkxWk0yMi4zNjMsMzEwLjU0OUwxNC4zMzMsMzEyLjI1MkwxNi43MiwzMjcuNzEyTDE5Ljk2OSwzNDMuMDg3TDEyLjg0NywzMjYuNDY5TDE1LjM4MSwzMDcuNDA4Wk0xMS41ODgsMzAyLjE1NEwxMC41MzUsMzE2LjI1NkwxMC4yOTksMzMwLjMxM0w3LjU1NSwzMjQuOTg5TDUuNjE2LDMxOS41OTZMNC43NjMsMzA2LjAwNUw3LjQxOCwyOTAuNzRMMTIuNzIxLDI3NS41NThaTTEwOS4wNSwxNDguMDYxTDEwMi4zMjksMTU2LjQ4Nkw3OS4xMTYsMTU2LjE3Mkw5My4xMywxNDguOTYzTDEwOC4xNzEsMTQyLjUwM1pNMjIxLjY5NywxNC41NDVMMjE4Ljc2LDE1LjU4MkwyMjcuNjI0LDE0LjIzNEwyMzIuMzQyLDE3LjU1NEwyMTkuNTQ1LDIwLjYxM0wyMjIuODkxLDMyLjkxMUwyMjguOTEzLDMwLjI1M0wyNDIuOTY5LDM4LjIzTDI0MS43NzcsNDIuMDI0TDI1OC4xMzksNDEuODIzTDI3MC41OTYsNDQuNDgzTDI3Mi41LDQ1Ljc0NkwyNzIuNSw0NS43NDZMMjg5LjcxLDU0LjU5NkwyODAuMTQ5LDU5LjQwOUwyNjcuNTk4LDU2Ljg1MUwyNjcuNTc3LDU2Ljg2NUwyNjMuNzczLDYyLjc5NUwyMzguMDA2LDcxLjI5TDIyMi40NTIsNjkuODk3TDIwNy40OTMsODYuNDg4TDE4NC44MDcsOTguODM1TDE5Mi44ODUsODIuNjE4TDIwOS4xMjEsNzMuODA4TDIyNS43MTUsNjUuODlMMjEyLjMxOSw2My4yNzhMMjAyLjYyLDY3Ljc3TDE3OC43MSw2Ni4wMTRMMTUyLjE2NSw3Ni45MDNMMTU2LjgxNyw4NS4yMTdMMTM5LjI4NywxMDEuNDQyTDEyNi4xMzcsMTA5LjYwMkwxMTMuNDk3LDExOC4zMkwxMDEuMzMsMTIzLjIyN0w4OS44MTgsMTI4LjcxNkw4NC4yMTIsMTQyLjQ4OEw3Mi43MTEsMTUwLjg4OEw4NS43MjIsMTI1LjkxTDc0LjYxNywxMjYuMjg4TDYzLjc1MSwxNDYuNjQ2TDU0LjU2NiwxNjguMDk2TDQyLjQ5OCwxODEuNzIyTDMyLjAwOCwxOTYuMDc0TDI1LjUyNywxOTUuMDc0TDIwLjI0NCwyMDUuMzc1TDE0Ljg1MSwyMjQuODY3TDEwLjg5NSwyNDQuNzM4TDguNDI1LDI0OS44NTRMMTAuMDQ4LDI0MC40NjhMMTAuMDQ5LDI0MC40NjdMMTIuMzAzLDIzMC4zODRMMTQuOTA4LDIyMC4zODZMMTcuODYsMjEwLjQ4NUwyMS4xNTYsMjAwLjY5M0wyNC43OTEsMTkxLjAyMkwyOC43NjIsMTgxLjQ4NEwzMy4wNjQsMTcyLjA5TDM3LjY5LDE2Mi44NTJMNDIuNjM2LDE1My43ODFMNDcuODk2LDE0NC44ODhMNTMuNDYzLDEzNi4xODVMNTkuMzMsMTI3LjY4TDY1LjQ5MSwxMTkuMzg2TDcxLjkzNywxMTEuMzEyTDc4LjY2MSwxMDMuNDY3TDg1LjY1NSw5NS44NjNMOTIuOTEsODguNTA2TDEwMC40MTcsODEuNDA4TDEwOC4xNjcsNzQuNTc2TDExNi4xNTEsNjguMDE4TDEyNC4zNTksNjEuNzQzTDEzMi43ODEsNTUuNzU5TDE0MS40MDcsNTAuMDcxTDE1MC4yMjYsNDQuNjg5TDE1OS4yMjcsMzkuNjE3TDE2OC40LDM0Ljg2M0wxNzcuNzM0LDMwLjQzMkwxODcuMjE2LDI2LjMyOUwxOTYuODM2LDIyLjU2TDIwNi41ODEsMTkuMTI4TDIxNi40NCwxNi4wMzlaTTI3NS43MTIsMzkuMjc1TDI3NC44NDYsNDAuOTU4TDI3My4xMjgsNDAuMlpNNDg0Ljg0OSw2OC44MTRMNDg3LjIyNyw3MS4wM0w1MDEuMjg2LDgyLjk3NUw1MDEuMjQ4LDgyLjkzOUw1MDEuMjQ4LDgyLjk0TDUwOC43MDEsOTAuMDk1TDUxMS40OTEsOTIuOTA3TDUxMS41MjQsOTIuOTRMNTEzLjI3OSw5NS41MDFMNTIzLjc4OSwxMDguMDI1TDUzMy40MzEsMTIxLjI5M0w1NDAuODA1LDEzMS4wNDRMNTQ3LjI0MiwxNDMuMjYzTDU1Mi44MDQsMTU2LjAzN0w1NjYuMjc0LDE4MC44NzlMNTUzLjU0OCwxNjEuMjcyTDU0Mi42MSwxNzEuNjIyTDU0My4wNjUsMTgzLjMxM0w1NTIuMDY4LDIwNy4xNzVMNTY1LjI2NiwyMjUuNDY2TDU2Ny44NjgsMjE0LjAwN0w1NjkuMjU0LDIwMi45MzlMNTczLjE1MywyMTcuNDEyTDU3Ni4zMjEsMjMyLjEwNUw1ODMuMDMyLDIzMS42MDdMNTg3LjMwOSwyNDYuMzAzTDU5MC42ODEsMjYxLjE2N0w1OTEuNTExLDI1Mi43NTZMNTkwLjc2OSwyNDQuNTk5TDU5MC43NjksMjQ0LjZMNTkyLjUyNiwyNTQuNzgxTDU5My45MjYsMjY1LjAxOEw1OTQuOTY3LDI3NS4yOTdMNTk1LjY1LDI4NS42MDZMNTk1Ljk3MiwyOTUuOTMzTDU5NS45MzQsMzA2LjI2NUw1OTUuNTM1LDMxNi41ODlMNTk0Ljc3NiwzMjYuODkzTDU5My42NTgsMzM3LjE2NEw1OTIuMTgyLDM0Ny4zOUw1OTAuMzUsMzU3LjU1OEw1ODguODAzLDM2NC44NzVMNTkxLjgyNiwzNDcuNDcxTDU5My4xNDUsMzI5Ljc5MUw1OTQuMzM0LDMxNS4yMzhMNTk0LjgwNSwzMDAuNjQ5TDU5NS4xMjgsMjgyLjMzNUw1OTIuMzE2LDI2Ni4xNTZMNTg3Ljg0MiwyNTUuODY2TDU4MS40OTMsMjQ1Ljg2Mkw1NzUuMTU1LDI0MC40NUw1NjcuNjI1LDIzNS4yOTVMNTQ2Ljk4NywyMzEuNzk1TDUzMy44NjcsMjExLjU5MUw1MTYuMzY2LDE5Ni4yOThMNDk2Ljk4MywxODEuOTA3TDUxMS4xMjksMTk2LjIxNEw1MjQuMTc4LDIxMS4wNkw1MDMuMzUxLDE5Ni4wODdMNDgzLjUzMSwxNzAuMDMzTDQ2OC4wODMsMTU4LjA3NUw0NTEuODQ0LDE0Ni43ODZMNDQwLjE1MywxMjYuODQxTDQyNy41MSwxMDguMDcxTDQwNC40MjIsOTAuOUwzODAuMzI3LDc1Ljc0NkwzNjIuNDAyLDcxLjk5NEwzNDQuMjMzLDY5LjEyOUwzMzEuNjU1LDc3LjUyMkwzMTguOTM1LDg2LjkwOUwzMjAuMTA3LDgxLjMwMUwyOTcuMjM1LDY4LjM0NEwzMDkuMjc5LDU4LjFMMjkzLjM4Niw1NS41MzFMMzA1LjM3LDQyLjc3NUwzMTMuODUyLDQwLjA0NkwzMzIuNDEyLDQxLjY2NkwzNTAuODQzLDQ0LjMwOUwzNTkuMzIxLDM4Ljk4M0wzODQuODExLDQwLjg1MkwzOTQuNjQ2LDM3Ljk1OEw0MDQuMTE2LDM2LjA3MUwzODYuMjA0LDI4LjM5OUwzOTkuODgzLDMxLjc4OEwzOTkuODgzLDMxLjc4OEw0MTIuMDU3LDM1LjUzN0w0MDAuMTAzLDI5LjUxMkw0MTQuNDE2LDMzLjY3NUw0MTUuNjc4LDM2LjM3Nkw0MjYuMDE5LDQ0LjUwOEw0MzUuOTIsNTMuNTMzTDQ1My41NjMsNjMuNTg3TDQ2Ny43OTMsNjQuNTA0TDQ4MC40NTgsNzMuMzEzTDQ2My4xNjksNTcuNTg4TDQ1MC40MzIsNTAuMDQ3TDQzNy4zMDUsNDMuMTU1TDQ0Mi41ODksNDIuNTVMNDU0LjY0Miw0OC43NTZMNDQ0LjA4Myw0Mi4xMDNMNDU5LjczMSw1MC44NjdMNDYyLjY3OCw1Mi43MTFMNDYyLjY3OCw1Mi43MTFMNDcxLjIxLDU4LjUzOUw0NzkuNTMyLDY0LjY2MVpNMzY2LjYzNSwzMC40ODFMMzc2LjAzNiwyOS40NzRMMzkwLjg5OSwzMy43MjRMMzg0Ljk4Niw0MC4zNzRMMzY2Ljg5OSwzNC44NDNaTTM4NC4wMjEsMjMuOTg1TDM4Mi4xNTMsMjEuOTc0TDM5OC4xMDgsMjMuMzIxTDQwNi43OTgsMjYuMzU5TDQxMy4yNjQsMjcuMzUxTDQzMy44MiwzNi45MzRMNDM2LjY2OSwzOS4yODdMNDIzLjQ4NiwzNi4yMzFMNDEwLjQ5OSwyOS4wMjRMNDAwLjE4NiwyNi45OUwzOTYuNDI0LDI5LjQ0NVpNMzY2LjIyNCwzNS40MDlMMzU4LjA2MSwzNS4zOUwzNTEuNTk3LDMwLjAzMUwzNjQuMDEsMzAuMDM1Wk0zNTkuMDY3LDIzLjYyNUwzNjUuNDMxLDI1LjMzNkwzNTUuNDczLDI3LjAzMVpNMjQ4Ljc1NSw4LjQ3TDI0Ni40NjgsOS4wNzNMMjQ0LjcxOSw5LjIwOEwyNDQuNzE5LDkuMjA4Wk0zNjIuMjI5LDE5LjcyMUwzNzguODA1LDIwLjg0NUwzNzMuODcyLDIyLjY3MVpNMjQzLjEzOCwxMy4wOTVMMjUxLjc3NSwxMC41NjlMMjU1LjUzNCwxMC42NThaTTM1MS45NjgsMTUuMTUzTDM1Ni45MTUsMTcuNjk2TDM0Ny4wMDUsMTYuMDM2TDM0Mi45MzIsMTQuMjIyWk0zMzUuMjk3LDkuOTA2TDMzOC4zMTcsOS41MzRMMzU0LjQ1MywxMy4yOTRMMzcwLjM4NiwxOC4xMjhMMzY3LjAzNywxOS41OTNMMzUzLjg3NiwxNS4xODhMMzM5Ljk5NiwxMy40NzdMMzM1LjMwNCwxMS4wNTFaTTQxMi45ODksMjYuNDE0TDQwNy4xMTYsMjQuMTQ2TDM4My4wOTMsMTYuNTI1TDM3MS4wMDgsMTQuMTI3TDM3MC44NDYsMTUuNjhMMzU5LjMyNiwxNC4wODdMMzM4LjI5Myw5LjA2NkwzMjUuMTMsNi42MzhMMzIyLjM5Niw2LjA1NUwzMjIuMzk2LDYuMDU1TDMyMS45NDcsNS41NjhMMzI5LjMzNCw2LjQyOEwzMjguMTM1LDUuNzVMMzIwLjQ5NCw0LjkzNkwzMzIuODcyLDUuODU0TDMzNS4yMzcsNi4xMDVMMzM1LjIzNyw2LjEwNUwzNDUuNDczLDcuNTE0TDM1NS42NTMsOS4yNzlMMzY1Ljc2NSwxMS4zOThMMzc1Ljc5NywxMy44NjlMMzg1LjczNiwxNi42ODlMMzk1LjU3MiwxOS44NTNMNDA1LjI5LDIzLjM2WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzIwLjEzNiw1OTUuMzE0TDMxOC45MDMsNTk1LjM5MUwzMjUuOTIzLDU5NC43NTJMMzUxLjI0Niw1OTEuMzE4TDM2MC43ODMsNTg5LjY5MkwzNjAuNzgzLDU4OS42OTJMMzUwLjYzNSw1OTEuNjM3TDM0MC40MjcsNTkzLjIyNkwzMzAuMTY5LDU5NC40NTlaTTE5NC42ODgsNTc2LjYzMkwxOTYuNzQyLDU3Ny4zOTlMMjA4LjIxMiw1NzkuOTk1TDIyNi4xNiw1ODMuNzA5TDI0NC40MzEsNTg3Ljg2NkwyNjIuOTI1LDU5MC44N0wyNzcuODM0LDU5Mi40MzFMMjczLjY1Miw1OTQuMjMyTDI4Mi4xNTMsNTk1LjQzOUwyODEuNTg0LDU5NS40MjdMMjgxLjU4Myw1OTUuNDI3TDI3MS4yODQsNTk0LjYwNEwyNjEuMDIsNTkzLjQyMkwyNTAuODA0LDU5MS44ODNMMjQwLjY0Nyw1ODkuOTg4TDIzMC41NjMsNTg3Ljc0TDIyMC41NjMsNTg1LjE0MkwyMTAuNjYsNTgyLjE5NkwyMDAuODY2LDU3OC45MDZaTTI1My41NzEsNTI4LjkyNUwyNDUuMTIxLDU0NS45MjFMMjM1LjYxMSw1NDEuMDMyWk0yNTYuOTAxLDUxMi44MDNMMjczLjU1NCw1MTguNjU3TDI2NS4yNSw1MzAuNDk5Wk0yNzUuMjcxLDQzMi4xNDZMMjcyLjE2NSw0MzMuMjI4TDI3Mi4zNTMsNDMxLjI3N0wyNzUuMjEsNDI5Ljg4Wk0xMDkuNzIzLDQwNi43NzhMMTI1LjI5Nyw0MzIuNjg1TDE0MC45OCw0NDguNjYzTDE1Ny41OCw0NjMuNzg0TDE2Ni4wNTUsNDg5Ljk4NEwxNjUuMTYyLDUxMC41OUwxNTYuMzAzLDUxNC43NkwxMzYuOTU0LDUwOC40OTRMMTE2LjEwMiw0OTQuMTIxTDk2LjY2Miw0NzguMjU3TDg1LjczMyw0ODIuMDMyTDc3LjAyMyw0ODMuOTIyTDY3LjkyOCw0NzIuMzMyTDU5LjQwOCw0NjAuMzE0TDUxLjQ4Myw0NDcuOUw0NC4xNzUsNDM1LjExOUw0MC4yOTMsNDIzLjcwNEw0OS4xOTUsNDE5LjI5M0w0OS4zMTQsNDA1LjQ4N0w2MS4wNTIsNDAyLjExOUw2OS4xNDIsMzg2Ljg2M0w4NC45NTUsMzk1LjkyMUw4Mi4wNyw0MDYuMjlMMTAzLjMxMyw0MjIuMjMyTDEwMy4wNzIsNDA2LjkxNUwxMDMuNTQzLDM5MS4yMTFaTTcwLjQ3NiwzMzguMzAxTDg4LjU2NiwzNDguNzA0TDEwOC41MjUsMzU4LjY3N0wxMjcuMTExLDM4Ny4wNTFMMTAzLjE1MSwzODQuNzE2TDkwLjgwOSwzNzIuNTg5TDc5LjMyNiwzNjAuMTY0TDY4Ljc0NywzNDcuNDkzTDU5LjExNywzMzQuNjI3Wk00NC4zNTcsMzE4LjY1MUwzMi4xMzMsMzIwLjY2MkwzNS43NTMsMzM2LjAzTDQwLjE3NiwzNTEuMjg5TDI5LjQyNywzMzQuOTQyTDMzLjc3MiwzMTUuNzc3Wk0xMC43NzUsMzM5LjMyTDcuMzg2LDMyOC4yMkw1LjY3MiwzMTQuOTU4TDQuNzIyLDMwMS42NThMNC41MzgsMjg4LjM1M0w1LjEyLDI3NS4wNzhMNS41MTcsMjc1LjU2Nkw1Ljc2OSwyOTEuNDQ2TDcuNTE1LDMwNy4zNjlMOC43MDgsMzIzLjM3OVpNMjcuNDE2LDMxMC42NzdMMjUuNjI4LDMyNC44MjJMMjQuNjE1LDMzOC44OThMMTQuNzYyLDMyOC40MDJMMTIuOTE1LDMxNC44NTJMMTkuMDg5LDI5OS40NTJMMjcuODA2LDI4NC4wNThaTTEzNi4wMjEsMTUzLjQ1NEwxMjkuNTkzLDE2Mi4wNzhMMTAxLjE2OCwxNjIuNTQ4TDExNy4wODgsMTU0Ljg4NEwxMzMuOTE3LDE0Ny45NDFaTTIwMy43MjEsMjAuMDk2TDIxNS4yNzcsMTYuNDA4TDIxMy4zMTEsMTguMTMzTDIyNC42OCwxNi40NzdMMjM0LjYyLDE5LjU3NUwyMjEuODQyLDIzLjAyMkwyMjcuMzgsMjguMTdMMjMzLjM5MywzNS4wOTVMMjM4Ljc4OCwzMi4yNjNMMjU3LjQ2NSwzOS43NDNMMjU3LjYxOCw0My41NTNMMjc0LjY5MSw0Mi44NDNMMjg4LjM5MSw0NS4xMDZMMjkwLjc0LDQ2LjMwNEwyOTAuNzQsNDYuMzA0TDMxMC43MTYsNTQuNTlMMzAyLjQ4Nyw1OS42NzNMMjg5LjA4OSw1Ny41MDlMMjg5LjA3MSw1Ny41MjRMMjg2LjgwOSw2My41NDZMMjYyLjM4NSw3Mi44MDRMMjQ1LjY0LDcxLjkwMUwyMzMuNzQ3LDg4LjlMMjExLjk2NywxMDEuOTIzTDIxNy4wMjMsODUuNTA2TDIzMi4zOTUsNzYuMjE2TDI0OC4wMzQsNjcuODA4TDIzMi45NDYsNjUuNjI4TDIyMy43MDEsNzAuNDA5TDE5Ni41MzksNjkuNDI4TDE2OS4zMDcsODEuMTM1TDE3Ny4yODcsODkuMjU3TDE2MS4zMTQsMTA1Ljk5MUwxMzQuOTMsMTIzLjY2MUwxMjEuMjQ3LDEyOC45NjFMMTA4LjE1NCwxMzQuODI0TDEwNC41MzQsMTQ4LjczNkw5MS42OTksMTU3LjUwNUwxMDEuOTgxLDEzMi4xNzRMODYuNzQxLDEzMi45NTJMNzguMjgyLDE1My42MDRMNzEuNDAxLDE3NS4yOTdMNTcuNDc0LDE4OS4zMTlMNDUuMDMzLDIwNC4wMTlMMzIuNjI5LDIwMy4zMDZMMjUuMDU2LDIxMy44MDJMMjEuMzEzLDIzMy40MzNMMTguOTc1LDI1My4zOTlMMTIuOTIyLDI1OC42NDVMMTIuNjcxLDI0Ny42NzZMMTMuMjA2LDIzNi44NTFMOS4yMywyNTMuMjM0TDguMjM2LDI2Ny45NjFMOC4yMTEsMjgyLjc5NEw3LjMzNCwzMDEuMzc3TDYuNTcxLDI4MC44NjJMNy41OCwyNjAuNDYyTDExLjQ4NiwyMzguNTQzTDE3LjAyOSwyMTYuOTcyTDIxLjY0MSwyMDAuMzY1TDI3LjU5MywxODQuMjM4TDI3LjQ1NywxODQuNTE2TDI3LjQ1NywxODQuNTE2TDMxLjY1NCwxNzUuMDc1TDM2LjE3NywxNjUuNzg2TDQxLjAyMiwxNTYuNjZMNDYuMTgyLDE0Ny43MDlMNTEuNjUyLDEzOC45NDRMNTcuNDI0LDEzMC4zNzVMNjMuNDkxLDEyMi4wMTJMNjkuODQ3LDExMy44NjdMNzYuNDgzLDEwNS45NDhMODMuMzkyLDk4LjI2NUw5MC41NjQsOTAuODI5TDk3Ljk5Miw4My42NDdMMTA1LjY2NSw3Ni43MjlMMTEzLjU3Niw3MC4wODNMMTIxLjcxMyw2My43MTdMMTMwLjA2OCw1Ny42MzhMMTM4LjYzLDUxLjg1NkwxNDcuMzg4LDQ2LjM3NUwxNTYuMzMzLDQxLjIwM0wxNjUuNDUyLDM2LjM0N0wxNzQuNzM1LDMxLjgxMkwxODQuMTcxLDI3LjYwNEwxOTMuNzQ4LDIzLjcyN0wyMDMuNDU1LDIwLjE4OFpNMjkxLjgyMSwzOS43NjhMMjkxLjUzLDQxLjQ2OUwyODkuNTIsNDAuNzY3Wk01NDUuMTQyLDEzNC4xMDRMNTUzLjk1OSwxNDguMzM4TDU2Ny4yMjksMTcyLjc3NEw1NTYuNDQxLDE1My41MjRMNTU2LjEwOSwxNTguMzA5TDU1NCwxNjQuMDc3TDU1Ni43NDIsMTc1LjcyTDU2Ni43MDQsMTk5LjI5NEw1NzcuNDgyLDIxNy4yMjFMNTc2Ljk0MiwyMDUuNzMxTDU3NS4xNDUsMTk0LjY2OUw1NzkuOTU5LDIwOS4wMDlMNTg0LjAyNSwyMjMuNTkyTDU4NS43NjksMjIyLjk2Nkw1ODcuOTcyLDIzMS41MzJMNTg3Ljk3MiwyMzEuNTMyTDU5MC4xODYsMjQxLjYyNEw1OTEuNDkzLDI0OC41NDVMNTg4LjIwNSwyMzcuMjA3TDU4NC44MTUsMjMxLjk0Mkw1ODAuMTg5LDIyNi45NzNMNTc0LjEzOSwyMjUuMjY5TDU2Ni41MjEsMjIzLjk5M0w1NTQuNzQ1LDIwNC4xNjdMNTM5LjU5NSwxODkuMzcxTDUyMi4zNjIsMTc1LjUzNkw1MzUuNTExLDE4OS40MjlMNTQ3LjQzOCwyMDMuODk1TDUyOS4zMzQsMTg5LjUxNEw1MTkuODc3LDE3Ni41OTRMNTA5LjczNiwxNjQuMDU5TDQ5NS4xMTgsMTUyLjU1N0w0NzkuNTgsMTQxLjc1MUw0NjYuMTMzLDEyMi4xODhMNDUxLjU1OCwxMDMuODMyTDQyNy41OTEsODcuMzc1TDQwMi4zOTIsNzIuOTdMMzg1LjA0Myw2OS43NTRMMzY3LjM2Miw2Ny40MzRMMzQ3LjIwNiw4NS45MDRMMzQ3LjE0NCw4MC4yOEwzMjEuNzk4LDY4LjA1NUwzMzAuOTc0LDU3LjQ4OUwzMTQuNjMxLDU1LjQwOUwzMjIuNTYyLDQyLjM1MUwzMjkuODk2LDM5LjM4MUwzNDguMjExLDQwLjQ0MUwzNjYuMzM1LDQyLjUyOUwzNzIuMTU4LDM2Ljk4NkwzOTUuNDA0LDM4LjExNEw0MDIuNCwzNC45NjRMNDA5LjAwMywzMi44MzNMMzkwLjQwNCwyNS43MTZMNDAzLjE5LDI4LjcwMkw0MDMuMTksMjguNzAyTDQxNC42MTUsMzIuMDk0TDQwMS44MSwyNi40NDVMNDE0LjkwMiwzMC4xOTFMNDE3Ljc0MSwzMi44M0w0MzAuMTQ0LDQwLjYxNkw0NDIuMDkzLDQ5LjMxTDQ1OS41MzMsNTguODNMNDY4Ljk2Miw1OS4zODhMNDgxLjIzMiw2Ny44MThMNDYxLjQ1Myw1Mi42NTZMNDQ5LjE3Nyw0NS40OTVMNDM2LjUxMywzOC45OTVMNDM4LjA3OCwzOC4yODZMNDQ2LjUxMiw0Mi44MDNMNDQ2LjUxMiw0Mi44MDNMNDU1LjM5OSw0OC4wNzNMNDY0LjA5Niw1My42NUw0NzIuNTk0LDU5LjUyN0w0ODAuODgxLDY1LjY5N0w0ODguOTQ4LDcyLjE1Mkw0OTYuNzg1LDc4Ljg4NUw1MDQuMzgxLDg1Ljg4N0w1MTEuNzI5LDkzLjE1MUw1MTguODE5LDEwMC42NjZMNTI1LjY0MywxMDguNDI0TDUzMi4xOTEsMTE2LjQxNkw1MzguNDU3LDEyNC42MzFMNTQ0LjQzMiwxMzMuMDZaTTM3NS4wNDgsMjguMzI4TDM4Mi42MjksMjcuMDYzTDM5Ny4yMDksMzAuODY3TDM5NS4zNTUsMzcuNjM1TDM3Ny4yNTksMzIuNjUzWk00MjcuNzM0LDMyLjk4TDQzMi4wNDcsMzUuMjA0TDQyMi42OTQsMzIuNDkxTDQwOC4yNTUsMjUuNzAxTDM5OS44NjgsMjMuOTUxTDM5OS4wMzUsMjYuNDc1TDM4NS43MjksMjEuNDA2TDM4NS43MjksMjEuNDA2TDM4Mi43MzYsMTkuNDY5TDM5NC43NjMsMjAuMzkxTDQwMy4xNjMsMjMuMTY5TDQwNi45NDgsMjQuMDA1TDQyNy4wNzUsMzIuNjY1TDQyNy4wNzUsMzIuNjY1Wk0zNzYuOTA0LDMzLjIzNEwzNjkuNTk3LDMzLjQ1MUwzNjEuNDYxLDI4LjMxM0wzNzIuNTM1LDI3Ljk2MVpNMzY0Ljg4NSwyMS43NDJMMzcxLjM0OSwyMy4yNThMMzYzLjUyMywyNS4yMjNaTTIzOS45MjQsMTAuMTYxTDI0MS4wODQsOS45M0wyNDAuMzE2LDEwLjc5M0wyMzMuMzIxLDExLjYwOEwyMzMuMzIxLDExLjYwOFpNMzY1LjE0OSwxNy43ODZMMzc5LjI3NSwxOC40NDNMMzc2Ljc3NSwyMC4zODJaTTI0My4xMjcsMTQuODIzTDI1MC40NDgsMTIuMDU1TDI1NC45NzgsMTIuMDE4Wk0zNTMuMSwxMy41NTdMMzU5LjIzOCwxNS45MzFMMzQ5LjU0MSwxNC41N0wzNDQuNjE3LDEyLjg5MlpNMzM0LjA2Miw4Ljg1MkwzMzYuMTg2LDguNDAyTDM1My40NDYsMTEuNjU1TDM3MC41MDYsMTUuOTg4TDM2OS4wMjgsMTcuNTI2TDM1NC43MjQsMTMuNTM4TDM0MS40NTcsMTIuMjRMMzM1LjIyOSw5Ljk4Wk0zODMuNTA2LDE2LjAyM0wzNzYuNDk5LDE0LjEwMUwzNjYuMjk3LDEyLjA0MUwzNjguMzY5LDEzLjU2NUwzNTguMDk0LDEyLjMwM0wzMzUuNTc3LDcuOTQ0TDMyMS4wOTgsNS45MzVMMzE3Ljc1Miw1LjQ0NUwzMTcuNzUyLDUuNDQ1TDMxNi4zMzgsNC45ODZMMzI0LjEyMiw1LjYxNkwzMjEuNDkyLDQuOTk2TDMxMy4yNjEsNC40MjRMMzIyLjc2Nyw0Ljg3N0wzMjIuNzY4LDQuODc3TDMzMy4wNTMsNS44NTFMMzQzLjI5OSw3LjE4NEwzNTMuNDkyLDguODczTDM2My42MTksMTAuOTE4TDM3My42NjksMTMuMzE0WiIvPjwvc3ZnPg==",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzMxLjUzMSw1OTQuMzE2TDMzNS44LDU5My44MTRMMzYxLjE1NCw1ODkuNjFMMzYyLjAxMiw1ODkuNDMxTDM2Mi4wMTIsNTg5LjQzMUwzNTEuODczLDU5MS40MTlMMzQxLjY3MSw1OTMuMDUyWk0xOTIuMDksNTc1LjYyOUwxOTMuNzkyLDU3Ni4xMDRMMjA3LjAwNiw1ODAuMzhMMjIyLjg2Nyw1ODIuNTYyTDI0Mi44MzEsNTg1LjdMMjYwLjkyNSw1ODkuMzA0TDI3OS4xNzYsNTkxLjc1TDI5My44NDcsNTkyLjg2MUwyODYuMTE5LDU5NC44NDRMMjkxLjk2LDU5NS44MzJMMjg5Ljk2OCw1OTUuODNMMjg5Ljk2Nyw1OTUuODNMMjc5LjY0OSw1OTUuM0wyNjkuMzU2LDU5NC40MDlMMjU5LjEsNTkzLjE2MUwyNDguODkzLDU5MS41NTVMMjM4Ljc0OSw1ODkuNTkzTDIyOC42OCw1ODcuMjc5TDIxOC42OTgsNTg0LjYxNUwyMDguODE0LDU4MS42MDVMMTk5LjA0Miw1NzguMjUxWk0yOTIuMjcsNTI5Ljc0OEwyNzkuOTMzLDU0Ny4wNkwyNzEuMDk3LDU0Mi40NDlaTTI5OC4zNzYsNTEzLjQ4MkwzMTQuMzY3LDUxOC44NDFMMzAzLjkyNSw1MzAuOTY3Wk0zMjQuNzI5LDQzMi4xNDZMMzIxLjU1Niw0MzMuMzI0TDMyMS44NTMsNDMxLjM2NUwzMjQuNzksNDI5Ljg4Wk0xNTAuMDQsNDExLjk0N0wxNjUuOTM1LDQzNy4zNzZMMTgyLjE3OCw0NTIuODY5TDE5OS4xMDEsNDY3LjQ4MUwyMDUuMTU3LDQ5My40NkwyMDAuNjQ2LDUxNC4xNDhMMTg5LjY1Miw1MTguNjE5TDE2OC4zODEsNTEyLjk3MUwxNDYuNDU4LDQ5OS4yNDdMMTI1LjcxNSw0ODMuOTk0TDExMC4zMDgsNDg4LjE2OUw5Ni44NjYsNDkwLjM5Nkw3OC43NTQsNDY3LjMzMUw2Mi44MzIsNDQyLjYwOEw1OS44OTgsNDMxLjI5N0w3NC4xMSw0MjYuNTM1TDc2LjI4LDQxMi42OTRMOTIuMDAxLDQwOC45MUwxMDMuMjUyLDM5My4zNTlMMTIxLjc4Nyw0MDEuODk2TDExNy42Miw0MTIuMzcyTDE0MS41MTUsNDI3LjYyOEwxNDMuNzc4LDM5Ni41NjlaTTEwNi40MDMsMzQ0LjcyOUwxMjcuNjc5LDM1NC41MzRMMTUwLjQ3OCwzNjMuODU4TDE3MC42NTgsMzkxLjY0MkwxNDMuNjEzLDM5MC4wODJMMTI5Ljc2OCwzNzguMzUzTDExNi42MjIsMzY2LjMwM0wxMDQuMjI4LDM1My45ODFMOTIuNjM2LDM0MS40MzdaTTc0LjExOSwzMjUuOTY3TDU4LjA3MywzMjguNDA2TDYyLjgxNCwzNDMuNjQ4TDY4LjI3OCwzNTguNzU3TDU0LjIyOCwzNDIuNzg2TDYwLjI1MiwzMjMuNDY0Wk0yNC43NjYsMzQ3Ljg5NUwxOC41OTcsMzM2Ljk0MUwxNS4zMTksMzIzLjc1NUwxMi43OCwzMTAuNTA3TDEwLjk4NSwyOTcuMjMyTDkuOTQxLDI4My45NjVMMTIuMjA4LDI4NC40MTJMMTUuMzA5LDMwMC4yNDFMMTkuODU1LDMxNi4wNjhMMjEuODk0LDMzMi4wM1pNNTEuNTI2LDMxOC41OTNMNDcuMjk5LDM0Ni45MkwzMi41NzUsMzM2Ljc5OEwyOS43ODksMzIzLjMxOUwzOS4yOTYsMzA3LjY4MUw1MS4xNjIsMjkxLjk3M1pNMTY3Ljk3MywxNTcuOTUxTDE2Mi4wMzQsMTY2Ljc2M0wxMjkuMjYsMTY4LjE2M0wxNDYuNjA0LDE1OS45OTNMMTY0LjcxLDE1Mi41MTlaTTIwOC4yNjQsMTguNTc0TDIwNy4xODEsMTkuMDA5TDE5NC4xMDEsMjQuMTA0TDIwOC42NDEsMTkuMDgzTDIxMC40OTcsMjAuODFMMjI0LjAyNSwxOC43NzZMMjMxLjM2MSwxOS43NTRMMjM4Ljg4NiwyMS40OTdMMjI2LjUxNCwyNS4zMjZMMjM2LjAwOCwzMC4yNDVMMjQ1LjkxOSwzNi45MjhMMjUwLjUyMiwzMy45NDRMMjczLjI1Myw0MC43OTVMMjc0Ljc0Niw0NC41OEwyOTIuMDExLDQzLjM0OUwzMDYuNTM4LDQ1LjE4M0wzMDkuMjYsNDYuMzA0TDMwOS4yNiw0Ni4zMDRMMzMxLjM5Niw1My45NUwzMjQuNzQ5LDU5LjI1OUwzMTAuOTExLDU3LjUwOUwzMTAuODk3LDU3LjUyNEwzMTAuMjQ2LDYzLjU5MUwyODcuOTA4LDczLjU1OUwyNzAuNDc5LDczLjE3NUwyNjIuMDE0LDkwLjQ4M0wyNDEuODAzLDEwNC4xNDRMMjQzLjY4Miw4Ny42MjNMMjU3LjcyNCw3Ny44ODVMMjcxLjkzMyw2OS4wMjRMMjU1LjYxLDY3LjMyMUwyNDcuMSw3Mi4zNzJMMjE3LjUxMiw3Mi4yNTNMMTkwLjQyMSw4NC43ODVMMjAxLjQ4Niw5Mi42MThMMTg3LjU1NSwxMDkuODA2TDE2MS4zNzksMTI4LjI3NUwxMzIuMzE5LDE0MC4yODZMMTMwLjc5NiwxNTQuMjc2TDExNy4wMTcsMTYzLjQ1TDEyNC4yNTgsMTM3Ljg1MkwxMDUuMzQ0LDEzOS4xNDlMOTkuNTUsMTYwLjAxOEw5NS4xODEsMTgxLjg4Mkw3OS44MTgsMTk2LjM0OEw2NS44MDUsMjExLjQ1TDQ3Ljg1NiwyMTEuMTk5TDM4LjIyMywyMjEuOTU2TDM2LjI0MywyNDEuNjc0TDM1LjU5NCwyNjEuNjg1TDI2LjE0MSwyNjcuMTY3TDIzLjY5NSwyNTYuMjM5TDIyLjAwNSwyNDUuNDMxTDE3LjMxNCwyNjEuOTQ2TDE4LjI0MywyNzYuNjc0TDIwLjEwOSwyOTEuNDc5TDE5LjM5NSwzMTAuMDg2TDE2LjI0OSwyODkuNjMxTDE0LjgxNywyNjkuMjM3TDE4LjIwMSwyNDcuMjA3TDIzLjE4NCwyMjUuNDc2TDI1LjMxNiwyMDguNzY3TDI4Ljc3LDE5Mi40OTdMMjQuNzUzLDE5NC44MzFMMjAuODAyLDIwMi43MDlMMTcuNzMxLDIxMC44OTRMMTcuNzMxLDIxMC44OTNMMjEuMDEyLDIwMS4wOTZMMjQuNjM0LDE5MS40MkwyOC41OTEsMTgxLjg3NkwzMi44NzksMTcyLjQ3NkwzNy40OTIsMTYzLjIzMUw0Mi40MjUsMTU0LjE1M0w0Ny42NzIsMTQ1LjI1M0w1My4yMjYsMTM2LjU0MUw1OS4wODEsMTI4LjAyOEw2NS4yMywxMTkuNzI1TDcxLjY2NCwxMTEuNjQyTDc4LjM3NywxMDMuNzg4TDg1LjM2LDk2LjE3M0w5Mi42MDQsODguODA2TDEwMC4xMDEsODEuNjk3TDEwNy44NDEsNzQuODUzTDExNS44MTYsNjguMjg0TDEyNC4wMTUsNjEuOTk3TDEzMi40MjgsNTYuMDAxTDE0MS4wNDYsNTAuMzAxTDE0OS44NTcsNDQuOTA2TDE1OC44NTEsMzkuODIxTDE2OC4wMTcsMzUuMDU0TDE3Ny4zNDQsMzAuNjA5TDE4Ni44MjEsMjYuNDkyTDE5Ni40MzUsMjIuNzA5TDIwNi4xNzUsMTkuMjY0Wk0zMDguMTc5LDM5Ljc2OEwzMDguNDcsNDEuNDY5TDMwNi4yMzEsNDAuODMyWk00NDEuODcsNDAuMjE0TDQzMS41NzQsMzQuOTIyTDQzMS4wMjEsMzQuNTc3TDQzMS4wMjEsMzQuNTc3TDQ0MC4yMDQsMzkuMzExWk01NTUuNDg2LDE1MC41MjRMNTU3LjY3MywxNTYuMzA0TDU2Mi42MTgsMTY3LjgyOUw1NzMuMjM1LDE5MS4wOTFMNTgxLjI2NywyMDguNzMyTDU3OC4zMTEsMTk5LjIwOUw1NzguMzExLDE5OS4yMDlMNTgxLjY1OSwyMDguOTgzTDU4NC42NjQsMjE4Ljg2OUw1ODUuNDUyLDIyMS42ODVMNTg0LjI0LDIxOC4zOThMNTgxLjkwNCwyMTYuODIyTDU3Ny45NTYsMjE1LjcyMUw1NjcuODgyLDE5Ni4yMjhMNTU1LjU0NCwxODEuODQ4TDU0MC45ODUsMTY4LjQ5N0w1NTIuNzM4LDE4Mi4wMTFMNTYzLjE3OSwxOTYuMTM4TDU0OC4zNDgsMTgyLjI1N0w1MzkuMzMxLDE2OS42MThMNTI5LjU2OSwxNTcuMzg1TDUxNi4yMjMsMTQ2LjMwOEw1MDEuODU5LDEzNS45NTZMNDg3LjA2NiwxMTYuODIyTDQ3MS4wMDIsOTguOTMxTDQ0Ni44ODMsODMuMjA2TDQyMS4zNDcsNjkuNTcxTDQwNS4xLDY2Ljg2NUwzODguNDQzLDY1LjA2N0wzNzQuMDQyLDg0LjA2MkwzNzIuNzQ4LDc4LjQ1OEwzNDUuNjk5LDY3LjAzTDM1MS43MjcsNTYuMjMzTDMzNS40MzIsNTQuNjQ4TDMzOS4wNjgsNDEuNDE0TDM0NS4wMzEsMzguMjQzTDM2Mi41NDQsMzguNzU4TDM3OS44MSw0MC4zMDhMMzgyLjgwMywzNC42MzFMNDAzLjA5OSwzNS4wOThMNDEwLjU3OCwyOS40OTdMMzkxLjg1OCwyMi45NDdMNDAzLjM2MywyNS41NjRMNDAzLjM2MywyNS41NjRMNDEzLjY5LDI4LjYyNUw0MDAuNDI0LDIzLjM3Mkw0MTEuODk3LDI2Ljc0Nkw0MTYuMjI2LDI5LjI3NUw0MzAuMzE1LDM2LjY1OUw0NDMuOTQ4LDQ0Ljk2NEw0NjAuNjU2LDUzLjk2Nkw0NjQuOTk4LDU0LjMxNEw0NzQuMTMxLDYwLjYzN0w0NzQuMTMxLDYwLjYzN0w0ODIuMzc4LDY2Ljg2TDQ5MC40MDQsNzMuMzY3TDQ5OC4xOTcsODAuMTVMNTA1Ljc0OSw4Ny4yMDFMNTEzLjA1LDk0LjUxMUw1MjAuMDkyLDEwMi4wNzJMNTI2Ljg2NSwxMDkuODczTDUzMy4zNjMsMTE3LjkwN0w1MzkuNTc1LDEyNi4xNjJMNTQ1LjQ5NiwxMzQuNjI5TDU1MS4xMTgsMTQzLjI5N1pNMzgxLjE4MSwyNS45NTVMMzg2LjcxLDI0LjQ5MUw0MDAuNTY2LDI3Ljg2Mkw0MDIuODI3LDM0LjYyNEwzODUuMjcyLDMwLjE4M1pNNDIwLjU3LDI5LjY2OUw0MTguMTc1LDI4LjgzMkw0MDIuNzIyLDIyLjQ5NkwzOTYuNTE1LDIwLjk2OEwzOTguNjM3LDIzLjQ3MkwzODQuODMyLDE4LjgxNUwzODQuODMyLDE4LjgxNUwzODAuODA2LDE2Ljk4NEwzODguNTM5LDE3LjYwNkwzOTYuMzkzLDIwLjEzOEwzOTYuNDc1LDIwLjE2M0wzOTYuNDc1LDIwLjE2M0w0MDYuMTgyLDIzLjcwMUw0MTUuNzYsMjcuNTc1Wk0zODUuMjQ2LDMwLjc3MUwzNzkuMDE5LDMxLjE5M0wzNjkuNDU3LDI2LjMyNEwzNzguODU2LDI1LjY2MVpNMzY4LjczMSwxOS43MTJMMzc1LjA5OSwyMS4wMzNMMzY5LjY0MywyMy4yWk0yMjMuMjYxLDE0LjEyTDIzMy41ODYsMTEuODM0TDIzNS45NzgsMTIuNjcyTDIyOC45MjIsMTMuMjM5TDIyMi4wMzksMTQuNTAzTDIxMy4yODUsMTcuMDE3TDIxMy4yODUsMTcuMDE3TDIxOC41NzksMTUuNDE5TDIxOC41NzksMTUuNDE5Wk0zNjYuMDksMTUuNzkyTDM3Ny4zMzcsMTYuMDY0TDM3Ny4zNDUsMTguMDQxWk0yODUuNzQ4LDQuMzQzTDI4NS44NCw0LjMzOUwyNzkuMTExLDQuNzVMMjc5LjExMSw0Ljc1TDI3OC4yNSw0LjhMMjc4LjI1LDQuOFpNMjQ0Ljg0NCwxNi41MjVMMjUwLjYyNiwxMy41NTdMMjU1Ljc5LDEzLjM3M1pNMzUyLjYxOCwxMS45NTFMMzU5Ljc2MSwxNC4xMjNMMzUwLjU3MSwxMy4wNDlMMzQ0Ljk0NywxMS41MzFaTTMzMS43OTMsNy44NTFMMzMyLjk1NSw3LjM1MkwzNTAuODE1LDEwLjA3MUwzNjguNDg0LDEzLjg3NkwzNjguOTIsMTUuNDNMMzUzLjkwOCwxMS44ODdMMzQxLjY1OCwxMC45NzdMMzM0LjA4NCw4LjkyN1pNMzYzLjM0OCwxMC44NThMMzU5LjU3MSwxMC4xMjlMMzYzLjgxNCwxMS41NTdMMzU1LjA5NiwxMC41ODNMMzMxLjc4LDYuOTJMMzE2LjQyNSw1LjM2NUwzMTIuNTY4LDQuOTg1TDMxMi41NjgsNC45ODVMMzEwLjIzMyw0LjU4MkwzMTguMTc3LDQuOTczTDMxNC4xOTYsNC40NTRMMzA1LjYyNSw0LjEzN0wzMTEuMDksNC4yMDhMMzExLjA5LDQuMjA4TDMyMS40MDcsNC43NzVMMzMxLjY5Nyw1LjcwMkwzNDEuOTQ4LDYuOTg3TDM1Mi4xNDksOC42M0wzNjIuMjg2LDEwLjYyN1oiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTk2LjA5OCw1NzcuMTY1TDIwMC42NjEsNTc4LjQ5NUwyMDUuNDYzLDU3OS4xNTRMMjIwLjA5NSw1ODMuMDA3TDIzOS44NjUsNTg0LjY0N0wyNjEuMjM5LDU4Ny4xNTdMMjc4LjYwNiw1OTAuMjIzTDI5Ni4wNiw1OTIuMTI2TDMxMC4wNDgsNTkyLjgwMkwyOTkuMDA4LDU5NS4wN0wzMDIuMDEyLDU5NS45MjRMMjk4LjUyNiw1OTUuOTk2TDI5OC41MjYsNTk1Ljk5NkwyODguMTk3LDU5NS43NjVMMjc3Ljg4Miw1OTUuMTcyTDI2Ny41OTQsNTk0LjIyMUwyNTcuMzQ1LDU5Mi45MTFMMjQ3LjE0OSw1OTEuMjQzTDIzNy4wMTcsNTg5LjIyMkwyMjYuOTYyLDU4Ni44NDdMMjE2Ljk5NSw1ODQuMTI0TDIwNy4xMyw1ODEuMDU0TDE5Ny4zNzgsNTc3LjY0MVpNMzMxLjIwNCw1MjkuMzkxTDMxNS4zNTQsNTQ3LjEzMUwzMDcuNDYyLDU0Mi43NzVaTTMzOS45MDEsNTEyLjkwMUwzNTQuNzQzLDUxNy43OTFMMzQyLjQ4LDUzMC4yNjJaTTM3My40MzQsNDMwLjY1NUwzNzAuMjkyLDQzMS45MjhMMzcwLjY4OCw0MjkuOTZMMzczLjYxOCw0MjguMzg1Wk0xOTQuOTEzLDQxNS44MjFMMjEwLjY0Niw0NDAuNzdMMjI2Ljk1Niw0NTUuNzY4TDI0My42ODcsNDY5Ljg2OUwyNDcuMTQsNDk1LjcwNEwyMzkuMTQ5LDUxNi41ODJMMjI2LjM1NSw1MjEuNDE0TDIwMy44MDYsNTE2LjQzMkwxODEuNDgsNTAzLjM4TDE2MC4wNjMsNDg4Ljc2OEwxNDAuNjQ3LDQ5My40NzJMMTIyLjg4Miw0OTYuMTczTDEwNC44MjIsNDczLjY1N0w4OC42OTYsNDQ5LjQyMkw4Ni43OTcsNDM4LjE4NEwxMDUuODksNDMyLjkxNUwxMTAuMDQzLDQxOC45NzlMMTI5LjI3MSw0MTQuNjYzTDE0My4zMzksMzk4LjcyOEwxNjQuMDM0LDQwNi42NjlMMTU4LjcxMSw0MTcuMjg5TDE4NC41MzIsNDMxLjc5TDE4OC43Niw0MDAuNjMzWk0xNDguMjEyLDM0OS45NzZMMTcyLjAyOCwzNTkuMDk2TDE5Ni45NzQsMzY3LjY5NEwyMTguMTM0LDM5NC44NTFMMTg4LjgyNywzOTQuMTQ3TDE1OS40OSwzNzEuMjIzTDEzMi40NTYsMzQ3LjEzMlpNMTEwLjc0NCwzMzIuMjczTDkxLjM2MywzMzUuMjUyTDEwMy40MiwzNjUuMjYzTDg2LjQ5NywzNDkuNzY0TDk0LjAxNywzMzAuMjM1Wk00Ny4xMTksMzU1LjkxOEwzOC4zNTksMzQ1LjE5MUwyOS41NjUsMzE4Ljk3OUwyMy41NzUsMjkyLjU3MUwyNy42NDUsMjkyLjkyMkwzMy41LDMwOC42MTVMNDAuNzA3LDMyNC4yNjNMNDMuNTI5LDM0MC4xNTFaTTgzLjE4NywzMjUuNjYxTDc3LjY2MSwzNTQuMTM3TDU4LjUxNCwzNDQuNTNMNTQuODczLDMzMS4xNDhMNjcuNDI0LDMxNS4xNzVMODIuMDc4LDI5OS4wNjVaTTIwMy45MzcsMTYxLjQxNkwxOTguNjY3LDE3MC4zOThMMTYyLjU0MSwxNzIuODQ1TDE4MC43ODEsMTY0LjEzNUwxOTkuNjEzLDE1Ni4xWk0yMDEuMTY3LDIwLjk4N0wyMDEuMjYzLDIxLjkxOUwxOTAuMjY2LDI3LjM4TDIwNC43ODEsMjEuOTE3TDIxMC40MDIsMjMuNTMxTDIyNS42NzgsMjEuMDU5TDIzNS4yNTQsMjEuNzhMMjQ1LjAwOCwyMy4yNkwyMzMuNDE5LDI3LjQ1NEwyNDYuNTc5LDMyLjAyOUwyNjAuMDg4LDM4LjM1NkwyNjMuNzYsMzUuMjQ3TDI3Ni43NzUsMzcuOTMzTDI4OS44NTQsNDEuMzU2TDI5Mi42NDIsNDUuMDc2TDMwOS41NzUsNDMuMzI1TDMyNC40ODgsNDQuNzEyTDMyNy41LDQ1Ljc0NkwzMjcuNSw0NS43NDZMMzUxLjEyMSw1Mi42OTZMMzQ2LjI1OSw1OC4xOEwzMzIuNDAyLDU2Ljg1MUwzMzIuMzkzLDU2Ljg2NkwzMzMuMzcxLDYyLjkyOEwzMTMuNzk4LDczLjUzM0wyOTYuMjE2LDczLjY4MUwyOTEuNDM1LDkxLjE5TDI3My40MDcsMTA1LjQzM0wyNzIuMDUyLDg4LjkwM0wyODQuMzM4LDc4Ljc2NkwyOTYuNjg1LDY5LjUwMUwyNzkuNjIyLDY4LjMwNUwyNzIuMTA3LDczLjU5OUwyNDAuOTkxLDc0LjQwM0wyMTQuODY0LDg3Ljc0M0wyMjguNjc4LDk1LjE5OEwyMTcuMjEzLDExMi43NzJMMTkyLjA0MSwxMzIuMDIxTDE2MS41NzgsMTQ0LjkzN0wxNjIuMTk5LDE1OC45NDFMMTQ3Ljg5NCwxNjguNTQxTDE1MS44NzQsMTQyLjc3M0wxMjkuODYyLDE0NC42OTFMMTI2LjkwOCwxNjUuNjkzTDEyNS4xODUsMTg3LjY0OUwxMDguODUzLDIwMi41OTdMOTMuNjkzLDIxOC4xNDNMNzAuNzQ0LDIxOC41MTJMNTkuMzQzLDIyOS41ODlMNTkuMTg4LDI0OS4zMzlMNjAuMjQ3LDI2OS4zNDVMNDcuNjgyLDI3NS4xNjFMMzkuMjUxLDI1My42MTZMMzMuOTg4LDI3MC4yODJMMzYuODEyLDI4NC45NTNMNDAuNTEsMjk5LjY3NEwzOS45ODEsMzE4LjNMMzQuNTQ4LDI5Ny45NzRMMzAuNzE5LDI3Ny42NjFMMzMuNDc4LDI1NS41MzdMMzcuNzUsMjMzLjY2NkwzNy4zMzcsMjE2LjkzMUwzOC4xODgsMjAwLjU5NkwzMC41ODIsMjAzLjEwNUwyMi44MTksMjEzLjY4N0wxNi41NTIsMjI0LjczNEwxMS4wNzQsMjQzLjE0NEw3LjE0NCwyNjEuODU4TDEwLjQ2NiwyMzkuOTY0TDE1LjU0NiwyMTguNDM0TDI0LjU2LDE5MS44NjdMMjcuNDczLDE4NC40NzlMMjcuNDczLDE4NC40NzlMMzEuNjcxLDE3NS4wMzhMMzYuMTk1LDE2NS43NUw0MS4wNDEsMTU2LjYyNUw0Ni4yMDMsMTQ3LjY3NUw1MS42NzMsMTM4LjkxTDU3LjQ0NywxMzAuMzQyTDYzLjUxNSwxMjEuOThMNjkuODcyLDExMy44MzVMNzYuNTEsMTA1LjkxN0w4My40MTksOTguMjM2TDkwLjU5Miw5MC44TDk4LjAyMSw4My42MkwxMDUuNjk2LDc2LjcwMkwxMTMuNjA3LDcwLjA1N0wxMjEuNzQ1LDYzLjY5MkwxMzAuMTAxLDU3LjYxNUwxMzguNjY0LDUxLjgzNEwxNDcuNDIzLDQ2LjM1NEwxNTYuMzY4LDQxLjE4NEwxNjUuNDg4LDM2LjMyOUwxNzQuNzcyLDMxLjc5NUwxODQuMjA4LDI3LjU4OEwxOTMuNzg2LDIzLjcxM1pNMzI0LjI4OCwzOS4yNzVMMzI1LjE1NCw0MC45NThMMzIyLjc1Miw0MC4zOTJaTTU4MS4yMDIsMjA3LjU3OUw1ODAuOTQ2LDIwNy4yM0w1NzIuODgsMTg4LjAxMkw1NjMuNzI5LDE3My45Nkw1NTIuMjg1LDE2MS4wMDNMNTYyLjI4NSwxNzQuMTg3TDU3MC45MjMsMTg4LjAyNEw1NjUuNzI2LDE4MS4xMjFMNTU5LjgxNywxNzQuNTM3TDU1MS41MTMsMTYyLjE2MUw1NDIuNDI2LDE1MC4yMTRMNTMwLjc1OSwxMzkuNTE4TDUxOC4wMDUsMTI5LjU3N0w1MDIuMzE1LDExMC45MDZMNDg1LjI1LDkzLjUxOUw0NjEuNzEyLDc4LjUxN0w0MzYuNjE0LDY1LjY1Mkw0MjEuOTY0LDYzLjQxNUw0MDYuODM4LDYyLjFMMzk4LjYyOSw4MS40MzlMMzk2LjE0Miw3NS44OTJMMzY4LjIxMiw2NS4yOTlMMzcwLjkwOCw1NC4zNjlMMzU1LjE1Nyw1My4yNzJMMzU0LjM4OCwzOS45OTVMMzU4Ljc5OCwzNi42NjZMMzc0Ljk3OCwzNi42NjlMMzkwLjg2MSwzNy43MTVMMzkwLjkzMiwzMS45OTJMNDA3LjY2MSwzMS44OTZMNDA4Ljc5MywyNi4xNjRMMzkwLjUyLDIwLjE3Nkw0MDAuMzk0LDIyLjQ2OUw0MDAuMzk0LDIyLjQ2OUw0MDkuMzExLDI1LjIzN0wzOTUuOTg3LDIwLjM4OEw0MDUuNDkyLDIzLjQ0M0w0MTEuMTgxLDI1LjgyTDQyNi41MjYsMzIuNzU3TDQ0MS40MjksNDAuNjI4TDQ1Ni44OTgsNDkuMTQyTDQ1Ni44MjQsNDguOTU4TDQ1Ni44MjQsNDguOTU4TDQ2NS40OSw1NC41ODRMNDczLjk1NCw2MC41MDlMNDgyLjIwNiw2Ni43MjZMNDkwLjIzNiw3My4yMjdMNDk4LjAzNSw4MC4wMDRMNTA1LjU5Miw4Ny4wNDlMNTEyLjg5OCw5NC4zNTRMNTE5Ljk0NiwxMDEuOTA5TDUyNi43MjUsMTA5LjcwNkw1MzMuMjI4LDExNy43MzRMNTM5LjQ0NywxMjUuOTg1TDU0NS4zNzQsMTM0LjQ0OEw1NTEuMDAyLDE0My4xMTJMNTU2LjMyNSwxNTEuOTY3TDU2MS4zMzUsMTYxLjAwM0w1NjYuMDI2LDE3MC4yMDhMNTcwLjM5NCwxNzkuNTcxTDU3NC40MzIsMTg5LjA4MUw1NzguMTM2LDE5OC43MjdaTTM4NC44NDgsMjMuNDMzTDM4OC4xNTgsMjEuODM0TDQwMC44NjcsMjQuODAyTDQwNy4xNzUsMzEuNDMzTDM5MC42OTMsMjcuNTFaTTM5MS41NjcsMTguNTE5TDM5MC4yMjksMTguMTMxTDM5NS4yNDIsMjAuNTI3TDM4MS4zNTgsMTYuMjlMMzgxLjM1OCwxNi4yOUwzNzYuNDIxLDE0LjU5NUwzNzguNjI5LDE0LjYzNEwzNzguNjI5LDE0LjYzNEwzODguNTQsMTcuNTUyWk0zOTAuOTk5LDI4LjA5M0wzODYuMDM5LDI4LjY4NUwzNzUuMzQzLDI0LjEyNEwzODIuNzgxLDIzLjIwNVpNMzcwLjQ4OSwxNy41OTdMMzc2LjU2NywxOC43MjlMMzczLjY0NywyMS4wMjNaTTIwNi43NzUsMTkuNzUxTDIxMy42ODUsMTcuMTE3TDIyOC4xMDUsMTMuOTM1TDIzMy41ODUsMTQuNjU0TDIyNC40NywxNS40NjZMMjE1LjUzOSwxNi45N1pNMzY1LjAyMiwxMy44MDFMMzczLjA0OSwxMy43NzlMMzc1LjU2NSwxNS43MThaTTI3Mi42NjcsNS4yNjVMMjc3LjE1Niw0LjkwMUwyNzAuOTg1LDUuNTA4TDI3MC45ODUsNS41MDhMMjY3LjM0NSw1LjgwN0wyNjcuMzQ1LDUuODA3Wk0yNDguMjM4LDE4LjE0OUwyNTIuMzA0LDE1LjAzMkwyNTcuOTQ2LDE0LjY4NFpNMzUwLjUzOCwxMC4zODNMMzU4LjQ2OCwxMi4zMjdMMzUwLjA2NSwxMS41MkwzNDMuOTExLDEwLjE4MVpNMzI4LjU1Nyw2LjkzNUwzMjguNzIzLDYuNDE1TDM0Ni42NCw4LjU5TDM2NC4zODIsMTEuODU4TDM2Ni43MTksMTMuMzdMMzUxLjQ1NSwxMC4yODdMMzQwLjU5NCw5LjcyOEwzMzEuOTAzLDcuOTI0Wk0zNTIuNzU3LDguNzM5TDM1Ny4zMjEsOS43MTdMMzUwLjQyNCw4Ljk4TDMyNy4wMTgsNi4wMjdMMzExLjI1Myw0Ljk0NUwzMDcuMDAyLDQuNjg3TDMwNy4wMDIsNC42ODdMMzAzLjgxNyw0LjM2OUwzMTEuNjgsNC41MTlMMzA2LjQ2OSw0LjE0TDI5Ny44MTgsNC4wODRMMzAxLjQwMSw0LjAwM0wzMDEuNDAxLDQuMDAzTDMxMS43MzEsNC4yMzNMMzIyLjA0Niw0LjgyMkwzMzIuMzM0LDUuNzcxTDM0Mi41ODMsNy4wNzlaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTkxLjA0Myw1NzUuMjE3TDIwNS45MDcsNTgwLjE0M0wyMTIuODQ5LDU4MS4zMTlMMjIwLjAwNiw1ODEuODA1TDIzNS42MTIsNTg1LjE5OUwyNTguNjksNTg2LjE4OEwyODAuODI0LDU4OC4wMzdMMjk2LjkzOCw1OTAuNTk1TDMxMy4wNjMsNTkxLjk4N0wzMjUuOTQzLDU5Mi4yNTVMMzExLjkyOCw1OTQuOTAzTDMxMi4wMDIsNTk1LjcxMUwzMDcuODgzLDU5NS44OTVMMzA3Ljg4Miw1OTUuODk1TDI5Ny41NTEsNTk1Ljk5TDI4Ny4yMjMsNTk1LjcyNEwyNzYuOTEsNTk1LjA5OEwyNjYuNjI1LDU5NC4xMTJMMjU2LjM4MSw1OTIuNzY4TDI0Ni4xOSw1OTEuMDY4TDIzNi4wNjUsNTg5LjAxM0wyMjYuMDE3LDU4Ni42MDVMMjE2LjA2LDU4My44NDlMMjA2LjIwNSw1ODAuNzQ2TDE5Ni40NjQsNTc3LjMwMlpNMzY5LjE5LDUyNy44NjZMMzUwLjMxLDU0Ni4xMzRMMzQzLjYsNTQxLjk5OVpNMzgwLjIxMyw1MTEuMDc2TDM5My40NTYsNTE1LjUzOUwzNzkuNzQ1LDUyOC40MDVaTTQxOS45MDksNDI3LjcxN0w0MTYuODkxLDQyOS4wODVMNDE3LjM3Niw0MjcuMTAyTDQyMC4yMDksNDI1LjQ0MVpNMjQyLjk3OSw0MTguMjg0TDI1OC4wNzMsNDQyLjc2NUwyNzMuOTU0LDQ1Ny4yNzRMMjg5Ljk4NSw0NzAuODc3TDI5MC43MjksNDk2LjY0N0wyNzkuNTAxLDUxNy44MThMMjY1LjI5NCw1MjMuMDYxTDI0Mi4xNTUsNTE4Ljc3MkwyMjAuMTAyLDUwNi4zOTVMMTk4LjY2Myw0OTIuNDMzTDE3NS44MjgsNDk3Ljc4TDE1NC4yNzksNTAxLjA3N0wxMzYuODIxLDQ3OS4xMDFMMTIwLjk4LDQ1NS4zNTFMMTIwLjE3NSw0NDQuMTU1TDE0My41NjcsNDM4LjI0MUwxNDkuNTc4LDQyNC4xNUwxNzEuNzI3LDQxOS4yMDZMMTg4LjE4Nyw0MDIuODA3TDIxMC40MTIsNDEwLjA5NUwyMDQuMDk1LDQyMC44OTJMMjMxLjA1Nyw0MzQuNTkxTDIzNy4xMjMsNDAzLjI3OFpNMTk0LjYzMywzNTMuODgzTDIyMC4yNjUsMzYyLjI1MkwyNDYuNjAxLDM3MC4wNzFMMjY4LjA5OSwzOTYuNThMMjM3LjQxOCwzOTYuNzg3TDIwNi42MjcsMzc0Ljc3N0wxNzcuMzY2LDM1MS41NDFaTTE1My4xMiwzMzcuMzhMMTMwLjk5MywzNDAuOTg5TDE0NC41MzUsMzcwLjYxMkwxMjUuMjUyLDM1NS42NjJMMTM0LjA0LDMzNS44ODZaTTc3LjE1NywzNjMuMTQ1TDY2LjA3MSwzNTIuNzJMNTQuNTY3LDMyNi44MTZMNDUuNjA3LDMwMC42MzVMNTEuMzU2LDMwMC44MzdMNTkuNzg3LDMxNi4zMTNMNjkuNDM4LDMzMS43MDVaTTEyMS40MzUsMzMxLjY2OEwxMTQuNzc4LDM2MC4zMjlMOTEuNzksMzUxLjM2Mkw4Ny40MDYsMzM4LjEwMkwxMDIuNjE4LDMyMS43MDdMMTE5LjYxNywzMDUuMTE2Wk0yNDIuODIsMTYzLjc0NEwyMzguMzc5LDE3Mi44NzRMMTk5Ljk5OCwxNzYuNDUzTDIxOC41OCwxNjcuMTgzTDIzNy41NjYsMTU4LjU3M1pNMjAzLjcsMjAuMTAzTDE5OC45NzYsMjEuNzhMMTk3Ljk4NywyMi4xMzRMMTk3Ljk4OCwyMi4xMzRaTTE5MS41NTMsMjQuNTgyTDE5NC42OTYsMjQuMTA5TDE5OC4zNDUsMjQuOTY0TDE4OS43NjYsMzAuNzIyTDIwMy44MTUsMjQuODI1TDIxMy4wMjksMjYuMjE0TDIyOS41ODksMjMuMjU4TDI0MS4xMTUsMjMuNjU4TDI1Mi44MDEsMjQuODEzTDI0Mi4zNDcsMjkuMzQxTDI1OC43NzQsMzMuNDY3TDI3NS40NywzOS4zMzVMMjc4LjA5OSwzNi4xM0wyOTIuNDIxLDM4LjQwMUwzMDYuNzYzLDQxLjQwN0wzMTAuNzYxLDQ1LjAyNEwzMjYuODQ3LDQyLjc3MUwzNDEuNjkzLDQzLjcwNkwzNDQuOTA0LDQ0LjY0NkwzNDQuOTA0LDQ0LjY0NkwzNjkuMjk0LDUwLjg2N0wzNjYuMzY0LDU2LjQ2OUwzNTIuOTA4LDU1LjU1NUwzNTIuOTA0LDU1LjU3MUwzNTUuNDgzLDYxLjU3OEwzMzkuMjY5LDcyLjcyN0wzMjIuMDY3LDczLjQwM0wzMjEuMTE2LDkxTDMwNS44MTksMTA1Ljc0OEwzMDEuMjcyLDg5LjMwOEwzMjEuNTM3LDY5LjIyNEwzMDQuMjU0LDY4LjU1TDI5Ny45NjIsNzQuMDU0TDI2Ni4yNjMsNzUuODEyTDI0MS44OTMsODkuOTE5TDI1OC4wMzgsOTYuOTE5TDI0OS4zODYsMTE0Ljc5OUwyMjUuOTgyLDEzNC43ODZMMTk1LjA0NCwxNDguNjM0TDE5Ny43ODksMTYyLjU4N0wxODMuMzkzLDE3Mi42MjNMMTgzLjk5MSwxNDYuNzg1TDE1OS41NSwxNDkuNDFMMTU5LjUyNiwxNzAuNDU2TDE2MC41MDEsMTkyLjQyNEwxNDMuNjk2LDIwNy44NzZMMTI3Ljg0OSwyMjMuODkyTDEwMC41OTgsMjI1LjAyNUw4Ny43NzUsMjM2LjQ3TDg5LjQ0OSwyNTYuMTk3TDkyLjE4NSwyNzYuMTQ0TDc2Ljg4OSwyODIuMzg0TDY0LjQyLDI2MS4xNTZMNTguNzQ1LDI3Ny45ODhMNjMuMzc3LDI5Mi41NDZMNjguNzk2LDMwNy4xMjhMNjguNDY4LDMyNS43NjdMNjAuOTEzLDMwNS42MzlMNTQuODAyLDI4NS40NzdMNTYuODU0LDI2My4yOEw2MC4yODUsMjQxLjI5Mkw1Ny4zMzksMjI0LjYwOEw1NS41NjEsMjA4LjI4N0w0NC41OTgsMjExLjA3OEwzNC4zMDUsMjIxLjkzNEwyNS40NDYsMjMzLjIxMkwxOC44OTUsMjUxLjgwNEwxMy44NDgsMjcwLjY1NUwxNS4zNjIsMjQ4LjY4N0wxOC42MDIsMjI3LjAzTDI2Ljc2NCwyMDAuMjAzTDI5LjI0NCwxODcuODcyTDMyLjc0NCwxNzUuOTYzTDMyLjQwMywxNzMuNjA0TDM0LjEyMSwxNjkuOTA2TDM0LjEyMSwxNjkuOTA1TDM4LjgyNCwxNjAuNzA2TDQzLjg0NCwxNTEuNjc2TDQ5LjE3NywxNDIuODI2TDU0LjgxNSwxMzQuMTY4TDYwLjc1MSwxMjUuNzEzTDY2Ljk4LDExNy40NjlMNzMuNDkyLDEwOS40NDhMODAuMjgsMTAxLjY1OUw4Ny4zMzYsOTQuMTEyTDk0LjY1MSw4Ni44MTVMMTAyLjIxNiw3OS43NzlMMTEwLjAyMiw3My4wMUwxMTguMDYsNjYuNTE4TDEyNi4zMTksNjAuMzExTDEzNC43OSw1NC4zOTZMMTQzLjQ2Miw0OC43NzlMMTUyLjMyNSw0My40NjlMMTYxLjM2NywzOC40NzJMMTcwLjU3OSwzMy43OTNMMTc5Ljk0OCwyOS40MzhMMTg5LjQ2NCwyNS40MTNaTTMzOS42NiwzOC4zMDNMMzQxLjA3MywzOS45NTJMMzM4LjU4MSwzOS40NlpNNTY0LjI1LDE2Ni42MjhMNTYwLjM5OCwxNTkuNzg2TDU1NS45MiwxNTMuMjgyTDU2Mi40NjksMTYzLjcwNEw1NjguMTIsMTc0LjU5MUw1NjguMTIxLDE3NC41OTFMNTY5LjE3OSwxNzYuODc5TDU2My4zOTIsMTY2LjU4OEw1NTYuMDUzLDE1NC40NUw1NDcuOTE4LDE0Mi43NjRMNTM4LjI4NCwxMzIuMzkyTDUyNy41MjcsMTIyLjgwOUw1MTEuNDE2LDEwNC42MjFMNDkzLjg2OSw4Ny43NTlMNDcxLjYyOCw3My40NTNMNDQ3LjczMSw2MS4zMzJMNDM1LjEyMSw1OS41MUw0MjEuOTg2LDU4LjYyNEw0MjAuMjE5LDc4LjExNEw0MTYuNjE1LDcyLjY2TDM4OC42NTIsNjIuOTE2TDM4Ny45MzUsNTEuOTU2TDM3My4yMDUsNTEuMzIyTDM2OC4wNTUsMzguMTM0TDM3MC43NzgsMzQuNjk3TDM4NS4xMzMsMzQuMjM3TDM5OS4xNTEsMzQuODI5TDM5Ni4yOTgsMjkuMTQ4TDQwOC45NTIsMjguNjA1TDQwNi41MzIsMjUuMjQzTDQwMy43MDIsMjIuOTM2TDM4Ni40MzIsMTcuNDg4TDM5NC4zNzYsMTkuNTFMMzk0LjM3NiwxOS41MUwzOTguMjk1LDIwLjc5N0wzOTguMjk1LDIwLjc5N0w0MDcuOTc5LDI0LjM5OEw0MTcuNTMyLDI4LjMzNEw0MjYuOTQxLDMyLjYwMkw0MzYuMTk2LDM3LjE5NUw0NDUuMjg1LDQyLjEwOEw0NTQuMTk3LDQ3LjMzNUw0NjIuOTIxLDUyLjg3MUw0NzEuNDQ2LDU4LjcwN0w0NzkuNzYzLDY0LjgzN0w0ODcuODYsNzEuMjU0TDQ5NS43MjksNzcuOTVMNTAzLjM1OSw4NC45MTZMNTEwLjc0MSw5Mi4xNDRMNTE3Ljg2Nyw5OS42MjVMNTI0LjcyNywxMDcuMzUxTDUzMS4zMTQsMTE1LjMxMUw1MzcuNjE4LDEyMy40OTZMNTQzLjYzNCwxMzEuODk3TDU0OS4zNTIsMTQwLjUwMkw1NTQuNzY2LDE0OS4zMDFMNTU5Ljg3LDE1OC4yODRaTTM4NS45MzYsMjAuODM4TDM4Ni45MjYsMTkuMTc0TDM5OC4xMDQsMjEuNzc5TDQwOC4yNjYsMjguMTZMMzkzLjM1OSwyNC43MTRaTTM4Ni4zNDEsMTYuODcyTDM4OC45NTMsMTcuNzI4TDM3NS40MTIsMTMuOTA4TDM3NS40MTIsMTMuOTA4TDM2OS43MTMsMTIuMzc1TDM2OS40OCwxMi4yN0wzNjkuNDgsMTIuMjdMMzc5LjQ3OSwxNC44N1pNMzkzLjk4NiwyNS4yODNMMzkwLjQ0NiwyNi4wMDRMMzc4LjkzOSwyMS43OEwzODQuMTkxLDIwLjY2OVpNMzcwLjEwNSwxNS40NjFMMzc1LjcwOSwxNi40MTVMMzc1LjQxMywxOC43NTlaTTIwMy4wOTcsMjIuNjM5TDIwOC41MSwxOS44MThMMjI0LjgwOSwxNi4xN0wyMzMuMjEsMTYuNjc4TDIyMi4zMTMsMTcuNzk0TDIxMS42MDYsMTkuNTk2Wk0zNjEuOTc5LDExLjg3MUwzNjYuNTQyLDExLjY1OEwzNzEuNDg5LDEzLjQ4M1pNMjYzLjc0MSw2LjVMMjU0LjY5Nyw3LjQ4OEwyNjkuMTY3LDUuNzE3Wk0yNTMuMjA0LDE5LjY0NkwyNTUuNDMyLDE2LjQzNEwyNjEuMzc5LDE1LjkwOVpNMzQ2LjkyMiw4LjkwM0wzNTUuMzk5LDEwLjU5N0wzNDguMDM3LDEwLjAyOUwzNDEuNTQxLDguODgzWk0zMjQuNDU0LDYuMTI5TDMyMy42MTgsNS42MkwzNDEuMDQ3LDcuMjU4TDM1OC4zMjMsOS45OTRMMzYyLjQ5MSwxMS40MDdMMzQ3LjQzOCw4Ljc4NEwzMzguMjk2LDguNTI5TDMyOC43NTMsNy4wMDNaTTM0OC42NzksOC4wM0wzNDQuMjIsNy41NDJMMzIxLjQzNCw1LjI5MUwzMDUuNzM5LDQuNjg3TDMwMS4yMjQsNC41NjJMMzAxLjIyNCw0LjU2MkwyOTcuMjg1LDQuMzUyTDMwNC44MjgsNC4yNjlMMjk4LjU0NSw0LjA2NEwyOTAuMDc3LDQuMjY4TDI5Mi42MjksNC4wOTJMMjkyLjYyOSw0LjA5MkwzMDIuOTYsNC4wMTVMMzEzLjI4OCw0LjI5OEwzMjMuNiw0Ljk0MkwzMzMuODgzLDUuOTQ2TDM0NC4xMjUsNy4zMDdaIi8+PC9zdmc+",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNjAwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMjAzLjQxNiw1NzkuNzk5TDE5OS44NDgsNTc4LjAyNEwyMTguNjU4LDU4Mi44MDhMMjI3LjczLDU4My43NDFMMjM2Ljk4LDU4My45NzhMMjUzLjA4NSw1ODYuODlMMjc4Ljc3MSw1ODcuMTM4TDMwMC45OTMsNTg4LjMxM0wzMTUuMzYyLDU5MC40MDhMMzI5LjY3LDU5MS4zMzhMMzQxLjA1LDU5MS4yMzhMMzI0LjQ4NCw1OTQuMzVMMzIxLjYyOCw1OTUuMkwzMTkuMDQ4LDU5NS4zODZMMzE5LjA0OCw1OTUuMzg3TDMwOC43MjcsNTk1Ljg3MUwyOTguMzk2LDU5NS45OTZMMjg4LjA2Nyw1OTUuNzU5TDI3Ny43NTIsNTk1LjE2M0wyNjcuNDY1LDU5NC4yMDdMMjU3LjIxNyw1OTIuODkyTDI0Ny4wMjEsNTkxLjIyTDIzNi44OSw1ODkuMTk0TDIyNi44MzYsNTg2LjgxNUwyMTYuODcxLDU4NC4wODdMMjA3LjAwNyw1ODEuMDEzWk00MDUuMDc0LDUyNS4yMThMMzk0LjU0OCw1MzUuMDE0TDM4My43MzYsNTQ0LjA5N0wzNzguNDEzLDU0MC4xNDVaTTQxOC4wODksNTA4LjA2M0w0MjkuMzI5LDUxMi4xNTVMNDE0LjU4Nyw1MjUuNDUzWk00NjIuNzQsNDIzLjQyM0w0NTkuOTQsNDI0Ljg3OUw0NjAuNDk4LDQyMi44ODFMNDYzLjE0Nyw0MjEuMTM2Wk0yOTIuNzc3LDQxOS4yNkwzMDYuNzc0LDQ0My4yOTlMMzM2LjU4Niw0NzAuNDczTDMzNC42LDQ5Ni4yNjNMMzIwLjQ3Niw1MTcuODE4TDMwNS4yODksNTIzLjUwN0wyODIuMjYxLDUxOS45MkwyNjEuMTUyLDUwOC4xOTlMMjQwLjM0Miw0OTQuODc5TDIxNC43ODEsNTAwLjk2MUwxOTAuMTAzLDUwNC45NjFMMTczLjc3OSw0ODMuNDk4TDE1OC43MDQsNDYwLjIxOEwxNTkuMDE3LDQ0OS4wMjlMMTg1Ljk5Nyw0NDIuMzQ5TDE5My42ODMsNDI4LjA1TDIxOC4wODEsNDIyLjM5OUwyMzYuNDMyLDQwNS40NzFMMjU5LjUxMiw0MTIuMDcyTDI1Mi4zOTQsNDIzLjA3M0wyNzkuNjc4LDQzNS45NDdMMjg3LjM5NSw0MDQuNDI1Wk0yNDQuMjU2LDM1Ni4zM0wyOTcuODUsMzcwLjkxNUwzMTkuMDMyLDM5Ni43NzVMMjg3LjkxMSwzOTcuOTIxTDI1Ni42MDIsMzc2Ljg1NEwyMjYuMDAzLDM1NC41MjhaTTE5OS45NTgsMzQxLjEzMUwxNzUuNzU4LDM0NS40NDRMMTkwLjM3NCwzNzQuNjM5TDE2OS4zMTgsMzYwLjMwMkwxNzkuMTA2LDM0MC4yNDRaTTExMy45NjUsMzY5LjM1N0wxMDAuODksMzU5LjI5OEw4Ny4wMjYsMzMzLjc4MUw3NS4zNywzMDcuOTEzTDgyLjYyMywzMDcuOTE3TDkzLjM3NCwzMjMuMTAxTDEwNS4xNzUsMzM4LjE2OFpNMTY1LjEwOSwzMzYuNDNMMTU3LjUyNCwzNjUuMzA4TDEzMS4zOTIsMzU3LjA4NkwxMjYuMzk4LDM0My45NjlMMTQzLjgxLDMyNy4wNzhMMTYyLjYzNSwzMDkuOTQzWk0yODMuNDQxLDE2NC44NjRMMjc5Ljk2NCwxNzQuMTE1TDI0MC40OTMsMTc4Ljg3NkwyNzcuNDE3LDE1OS44NjVaTTc4LjczOSwxMDMuNzEyTDY2LjYyNywxMTguMDk2TDYzLjU0MywxMjMuODcyTDc2LjIwNCwxMDcuNjAxTDg5Ljk4Miw5Mi4yOUw5MS40OTEsODkuOTkzWk0zNy44OTgsMTYyLjQ1NUwzMC4wNTUsMTc4LjcxOUwzMS42NSwxNzguMjg2TDI3LjEyMSwxOTMuMzIzTDIwLjU3MSwyMDcuMTM3TDE3Ljc3MiwyMTIuMDUzTDE1LjgwOCwyMTcuMjI5TDE1LjgwOCwyMTcuMjI5TDE4Ljg3LDIwNy4zNjFMMjIuMjc0LDE5Ny42MDZMMjYuMDE3LDE4Ny45NzZMMzAuMDk0LDE3OC40ODJMMzQuNDk5LDE2OS4xMzdaTTIxNS42NjMsMTYuMjY5TDIxNC44MjIsMTYuNTg5TDE5Mi40MzksMjQuOTQ4TDE3OS45MjEsMjkuNDY5TDE4OC42ODYsMjcuNDU0TDE5OC41MTYsMjguMDVMMTkyLjYxNSwzNC4wMjhMMjA1Ljc3MSwyNy43MThMMjE4LjI5OSwyOC43NzZMMjM1LjY0LDI1LjMwNkwyNDguNzY0LDI1LjMzMUwyNjIuMDI4LDI2LjEwN0wyNTMuMDI3LDMwLjkzMUwyNzIuMjIxLDM0LjUxNUwyOTEuNTk3LDM5LjgzNkwyOTMuMTAzLDM2LjU2N0wzMDguMjk3LDM4LjM5TDMyMy40NjcsNDAuOTQ4TDMyOC41NTQsNDQuNDI3TDM0My4zMDQsNDEuNzA2TDM1Ny42MzEsNDIuMTk3TDM2MC45NDMsNDMuMDM4TDM2MC45NDMsNDMuMDM4TDM4NS4zNjEsNDguNTE4TDM4NC40NTMsNTQuMTc4TDM3MS44MDYsNTMuNjZMMzcxLjgwNyw1My42NzZMMzc1LjkwOSw1OS41ODJMMzYzLjU0Niw3MS4xNjVMMzQ3LjI0OCw3Mi4zNUwzNTAuMTU1LDg5LjkxN0wzMzguMDU0LDEwNS4wODJMMzMwLjQ1Myw4OC44MjZMMzQ1LjczNSw2OC4yMDJMMzI4Ljc1Niw2OC4wNDlMMzIzLjg3OCw3My43MjJMMjkyLjU2MSw3Ni40MzdMMjcwLjY4OSw5MS4yNDdMMjg4LjY3Miw5Ny43MjhMMjgzLjA5NywxMTUuODI1TDI2Mi4xNzIsMTM2LjQ4NUwyMzEuNjk5LDE1MS4yNjZMMjM2LjQ4NSwxNjUuMTA1TDIyMi40MzYsMTc1LjU3M0wyMTkuNjMzLDE0OS43NjlMMTkzLjUwNSwxNTMuMTYxTDIwMC4wNTUsMTk2LjA2MkwxODMuMjg4LDIxMi4wMjRMMTY3LjIzNywyMjguNTI1TDEzNi41MSwyMzAuNTM4TDEyMi42NTYsMjQyLjM4OEwxMjYuMTA4LDI2Mi4wMzdMMTMwLjQzNywyODEuODc3TDExMi44NzYsMjg4LjYxNkw5Ni43NDYsMjY3LjgyM0w5MC44MzEsMjg0LjgzMUwxMDQuMTA4LDMxMy42MTdMMTAzLjk5LDMzMi4yNjNMOTQuNTQzLDMxMi4zOTNMODYuMzM2LDI5Mi40NDhMODcuNjE3LDI3MC4yMDFMOTAuMTAyLDI0OC4xMjJMODQuNzE0LDIzMS41NjVMODAuMzYxLDIxNS4zMzdMNjYuMzc1LDIxOC41MDhMNTMuODY0LDIyOS43MUw0Mi42ODMsMjQxLjI5MkwzNS4yNTYsMjYwLjA5N0wyOS4yNDcsMjc5LjExNkwyOC45MDUsMjU3LjEzTDMwLjIwOCwyMzUuNDA0TDM3LjI3LDIwOC4zNDVMMzcuMDk3LDE5NS45NzlMMzcuOTE1LDE4NC4wMDVMMzMuNjI1LDE4MS43MTZMMzUuMTUsMTczLjY2N0wzNy4zNzQsMTY1Ljk1TDQwLjI5LDE1OC41ODdMNDMuODksMTUxLjU5Nkw0My44OSwxNTEuNTk2TDQ5LjIyNiwxNDIuNzQ4TDU0Ljg2NiwxMzQuMDkyTDYwLjgwNiwxMjUuNjM4TDY3LjAzNywxMTcuMzk2TDczLjU1MSwxMDkuMzc3TDgwLjM0MiwxMDEuNTlMODcuNCw5NC4wNDVMOTQuNzE3LDg2Ljc1MUwxMDIuMjg1LDc5LjcxN0wxMTAuMDkzLDcyLjk1MUwxMTguMTMzLDY2LjQ2MUwxMjYuMzk0LDYwLjI1N0wxMzQuODY2LDU0LjM0NEwxNDMuNTQsNDguNzNMMTUyLjQwNSw0My40MjNMMTYxLjQ0OSwzOC40MjhMMTcwLjY2MiwzMy43NTJMMTgwLjAzMywyOS40MDFMMTg5LjU1LDI1LjM3OUwxOTkuMjAxLDIxLjY5MkwyMDguOTc1LDE4LjM0M1pNMzUzLjgyNiwzNi44ODNMMzU1Ljc0NCwzOC40ODFMMzUzLjIzOSwzOC4wNjVaTTU0My44MzksMTMyLjE5NEw1MzcuMzk0LDEyMy43MjNMNTMwLjEzNiwxMTUuODU2TDUxNC4wOTQsOTguMTU2TDQ5Ni41OTgsODEuODI3TDQ4Ni42ODksNzQuNzI1TDQ3Ni4zMjksNjguMTY3TDQ1NC4zNTksNTYuNzQzTDQ0NC4xNzQsNTUuMjY3TDQzMy40MjcsNTQuNzQ0TDQzNi4wOTYsNjMuOTM4TDQzOC4xNTYsNzQuMTg5TDQzMy41NDUsNjguODZMNDA2LjM5OCw1OS45NTNMNDAyLjI5LDQ5LjA2NkwzODkuMDI5LDQ4Ljg1N0wzNzkuNjUzLDM1Ljg5TDM4MC42MDgsMzIuMzk3TDM5Mi43MDIsMzEuNTM1TDQwNC40MjgsMzEuNzM2TDM5OC43MzcsMjYuMTg1TDQwNi45MzIsMjUuMzI2TDQwMi41OTYsMjIuNjgxTDM5OC4wMTYsMjAuNjk5TDM5OC4wMTYsMjAuNjk5TDQwNy43MDQsMjQuMjlMNDE3LjI2LDI4LjIxN0w0MjYuNjc0LDMyLjQ3NUw0MzUuOTMzLDM3LjA1OUw0NDUuMDI3LDQxLjk2M0w0NTMuOTQ0LDQ3LjE4MUw0NjIuNjczLDUyLjcwOEw0NzEuMjA1LDU4LjUzNkw0NzkuNTI3LDY0LjY1OEw0ODcuNjMxLDcxLjA2N0w0OTUuNTA3LDc3Ljc1NEw1MDMuMTQ0LDg0LjcxM0w1MTAuNTMzLDkxLjkzNEw1MTcuNjY3LDk5LjQwOEw1MjQuNTM1LDEwNy4xMjZMNTMxLjEyOSwxMTUuMDhMNTM3LjQ0MiwxMjMuMjU5TDU0My40NjUsMTMxLjY1M1pNMzg1LjI2NSwxNi41NDZMMzc5LjcxOCwxNC45NjRMMzgxLjQwOSwxNS40MTVMMzgxLjQwOSwxNS40MTVaTTM4NC40MTMsMTguMjVMMzgzLjA1MywxNi41OTJMMzkyLjM1OSwxOC44ODVMNDA2LjA2NywyNC45MDRMMzkzLjE4OCwyMS44OFpNMzk0LjExOCwyMi40MjVMMzkyLjEwNCwyMy4yMzFMMzgwLjEzNywxOS4zNjRMMzgzLjA0MywxOC4xMjhaTTM2Ny41OTEsMTMuMzY5TDM3Mi41NTEsMTQuMTYzTDM3NC44ODcsMTYuNDc1Wk0yMDIuMzY0LDI1LjU5NUwyMDYuMTE2LDIyLjYzNUwyMjMuNzk3LDE4LjQ3TDIzNC44NjUsMTguNjgyTDIyMi41MTcsMjAuMTUxTDIxMC4zNTgsMjIuMzAxWk0zNjAuMjczLDEwLjIwMkwzNjUuMjQxLDExLjQwNkwzNTcuMDUyLDEwLjA2M0wzNTcuMDUyLDEwLjA2M0wzNTcuODU5LDkuNzFMMzU3Ljg2LDkuNzFaTTI1Ny41OTksNy42OTVMMjQ2LjY4NSw4Ljk4NkwyNjIuMTE0LDYuNzYxWk0yNTkuNTkyLDIwLjk3MUwyNTkuOTE0LDE3LjcyTDI2NS45ODYsMTcuMDEzWk0zNDEuODgsNy41NTRMMzUwLjY0Niw4Ljk4NkwzNDQuNTUsOC42MjNMMzM3LjkwOSw3LjY3NlpNMzE5LjYwNyw1LjQ2TDMxNy43OTYsNC45OUwzMzQuMjA4LDYuMTE1TDM1MC40OTIsOC4zNEwzNTYuMzY0LDkuNjAxTDM0MS45OCw3LjQyNkwzMzQuODM1LDcuNDE4TDMyNC43Myw2LjE5Wk0zMzcuNTg1LDYuMzk2TDMzNi42NzMsNi4zMTNMMzE1LjIsNC43MzRMMzAwLjA1LDQuNTk5TDI5NS40MDgsNC42MTNMMjk1LjQwOCw0LjYxM0wyOTAuODM2LDQuNTMzTDI5Ny44MjksNC4yMjhMMjkwLjY2NSw0LjIyOEwyODIuNjM4LDQuNjgzTDI4NC4xMTYsNC40MjdMMjg0LjExNiw0LjQyNkwyOTQuNDQxLDQuMDUyTDMwNC43NzMsNC4wMzhMMzE1LjA5OSw0LjM4NUwzMjUuNDA3LDUuMDkyTDMzNS42ODMsNi4xNTlaIi8+PC9zdmc+",
];
const GLOBE_EDGE_MASK = "radial-gradient(circle, #000 65%, rgba(0,0,0,.85) 78%, rgba(0,0,0,.25) 92%, transparent 100%)";

const GLOBE_STYLE_CSS = `
  .globe-btn{transition:background .15s ease, transform .1s ease}
  .globe-btn:active{transform:scale(0.98)}
  @media (hover:hover) { .globe-btn:hover{background:rgba(0,229,200,0.06)} }
`;

// 自転パラメータ(無限ループは使わない。初回に一度だけ・タップ時に一度だけの
// 有限アニメーション)。
const GLOBE_INTRO_DELAY_MS = 700;
const GLOBE_INTRO_DURATION_MS = 7000;
const GLOBE_INTRO_DEGREES = 45;
const GLOBE_TAP_DURATION_MS = 3000;
const GLOBE_TAP_DEGREES = 25;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// KabuBocchi独自の抽象デジタル地球。GLOBE_FRAMES(36方向の正射図法シルエット)
// を2枚のスロット(A/B)でクロスフェードしながら切り替えることで、隣接フレーム
// 間(10度)の間もなめらかに見せる。requestAnimationFrameで角度を直接DOM
// スタイルへ書き込み、Reactの再レンダーを走らせない(パフォーマンス優先)。
// 球体本体・光源・影・リムライト・軌道線・HUDは一切動かさない
// (transform:rotate()は使用しない。動くのは陸地マスクの中身だけ)。
function SpinningEarth({ size = 108, onClick, title, opacity = 1, ringPower = 1, glowPower = 1 }) {
  const slotARef = useRef(null);
  const slotBRef = useRef(null);
  const angleRef = useRef(0); // 現在の累積回転角(度)。一方向にのみ増える。
  const lastIdxRef = useRef({ a: -1, b: -1 });
  const reducedMotionRef = useRef(false);
  const rafRef = useRef(null);
  const introTimerRef = useRef(null);

  const applyAngle = (deg) => {
    const stepPos = deg / GLOBE_FRAME_STEP_DEG;
    const lowIdx = ((Math.floor(stepPos) % GLOBE_FRAME_COUNT) + GLOBE_FRAME_COUNT) % GLOBE_FRAME_COUNT;
    const highIdx = (lowIdx + 1) % GLOBE_FRAME_COUNT;
    const frac = stepPos - Math.floor(stepPos);
    const a = slotARef.current, b = slotBRef.current;
    if (!a || !b) return;
    if (lastIdxRef.current.a !== lowIdx) {
      a.style.webkitMaskImage = `url("${GLOBE_FRAMES[lowIdx]}")`;
      lastIdxRef.current.a = lowIdx;
    }
    if (lastIdxRef.current.b !== highIdx) {
      b.style.webkitMaskImage = `url("${GLOBE_FRAMES[highIdx]}")`;
      lastIdxRef.current.b = highIdx;
    }
    a.style.opacity = String(1 - frac);
    b.style.opacity = String(frac);
  };

  const animateTo = (fromDeg, toDeg, durationMs, ease, onDone) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = ease(t);
      const deg = fromDeg + (toDeg - fromDeg) * eased;
      angleRef.current = deg;
      applyAngle(deg);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        if (onDone) onDone();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    applyAngle(0); // 初期フレーム(経度135°=日本・東アジア)を即座に表示
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotionRef.current) {
      introTimerRef.current = setTimeout(() => {
        animateTo(0, GLOBE_INTRO_DEGREES, GLOBE_INTRO_DURATION_MS, easeInOutCubic);
      }, GLOBE_INTRO_DELAY_MS);
    }
    return () => {
      clearTimeout(introTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (!reducedMotionRef.current) {
      const from = angleRef.current;
      animateTo(from, from + GLOBE_TAP_DEGREES, GLOBE_TAP_DURATION_MS, easeOutCubic);
    }
    if (onClick) onClick();
  };

  // 陸地スロット(A/B)共通のスタイル。ドット(輪郭内部)+輪郭グロー
  // (drop-shadowでシアンの縁取りを表現、別レイヤーの縁取り画像を持たずに
  // 済ませている)を1枚の要素にまとめている。
  const slotStyle = {
    position: "absolute", inset: 0,
    backgroundImage:
      "radial-gradient(circle, rgba(215,238,255,0.92) 0.5px, transparent 0.95px), " +
      "radial-gradient(circle at 30% 26%, rgba(150,205,255,0.14) 0%, transparent 70%)",
    backgroundSize: "3.4px 3.4px, 100% 100%",
    backgroundRepeat: "repeat, no-repeat",
    WebkitMaskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    filter: "drop-shadow(0 0 0.9px rgba(125,220,255,0.9)) drop-shadow(0 0 0.4px rgba(255,255,255,0.5))",
    willChange: "opacity",
  };

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
          内部の陸地スロットA/Bだけが、正射図法フレームを切り替えながら
          クロスフェードして自転しているように見せる。 */}
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
            "repeating-linear-gradient(90deg, rgba(150,205,255,0.04) 0px, rgba(150,205,255,0.04) 1px, transparent 1px, transparent 15px), " +
            "repeating-linear-gradient(0deg, rgba(150,205,255,0.025) 0px, rgba(150,205,255,0.025) 1px, transparent 1px, transparent 19px)",
          backgroundSize: "15px 100%, 100% 19px",
          backgroundRepeat: "repeat",
        }} />
        {/* 陸地スロットA/B(正射図法フレームをクロスフェードしながら自転) */}
        <div ref={slotARef} style={{ ...slotStyle, opacity: 1 }} />
        <div ref={slotBRef} style={{ ...slotStyle, opacity: 0 }} />
        {/* 左右端を暗く落として球面のカーブを強調(中央70%は輪郭をシャープに保つ) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to right, rgba(0,0,0,.5) 0%, transparent 14%, transparent 86%, rgba(0,0,0,.55) 100%)",
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
        {/* リムライト(球の輪郭に沿う、シアン〜青の細い縁取り。固定) */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
          boxShadow: "inset 0 0 0 1px rgba(130,215,255,0.28), inset 0 0 6px rgba(80,190,255,0.12)",
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
            <SpinningEarth size={224} onClick={() => {}} title="タップで少し自転" />
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

// タブバーの既定の並び順(タブID)。「stocks」は日本株/米国株を束ねた
// 疑似タブ(実際に表示されるのはflagSideに連動した"jp"か"us")。
const DEFAULT_TAB_ORDER = ["briefing", "stocks", "events", "history"];

export default function SwingStation() {
  const [tab, setTab] = useState("briefing");
  const [highlightTarget, setHighlightTarget] = useState(null); // { market: 'jp'|'us', code: string }
  const [flagSide, setFlagSide] = useState("jp"); // 'jp' | 'us' — which flag is currently up front
  const [showIntro, setShowIntro] = useState(false); // 初回セッションのみ地球ビジュアルで日本株/米国株を選ぶオープニング画面を表示

  // タブの並び替え・表示/非表示(自由に移動・追加/削除したいという要望への対応)。
  // データ取得やAPI・ルーティングには一切影響しない、見た目の並び順だけを
  // 端末のlocalStorageに保存する軽量な機能。SSRとの不一致を避けるため、
  // 初回描画は常に既定値で揃え、マウント後にlocalStorageを見て復元する。
  const [tabOrder, setTabOrder] = useState(DEFAULT_TAB_ORDER);
  const [hiddenTabIds, setHiddenTabIds] = useState([]);
  const [editingTabs, setEditingTabs] = useState(false);
  // localStorageからの復元が終わるまでは保存用useEffectを走らせない(state)。
  // ref ではなく state にしているのは重要で、復元effect内でこれをtrueにした
  // 直後の「同じコミット」ではまだ古いレンダーの値のまま判定させ、復元が
  // 実際に反映された次のコミットで初めて保存を許可するため。refだと復元と
  // 同じコミット内で即trueになってしまい、復元前の既定値でlocalStorageを
  // 上書きしてしまう(=並び替えがリロードで消える)不具合になる。
  const [tabPrefsHydrated, setTabPrefsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") { setTabPrefsHydrated(true); return; }
    try {
      const savedOrder = JSON.parse(localStorage.getItem("kb_tab_order") || "null");
      if (Array.isArray(savedOrder) && savedOrder.length) {
        // 保存後にタブ構成が変わっていても壊れないよう、未知のIDは捨て、
        // 新しく増えた既定タブは末尾に足す。
        const known = savedOrder.filter((id) => DEFAULT_TAB_ORDER.includes(id));
        const missing = DEFAULT_TAB_ORDER.filter((id) => !known.includes(id));
        setTabOrder([...known, ...missing]);
      }
      const savedHidden = JSON.parse(localStorage.getItem("kb_tab_hidden") || "null");
      if (Array.isArray(savedHidden)) {
        setHiddenTabIds(savedHidden.filter((id) => DEFAULT_TAB_ORDER.includes(id)));
      }
    } catch (e) {
      // 壊れた保存データは無視して既定値のまま使う
    } finally {
      setTabPrefsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!tabPrefsHydrated || typeof window === "undefined") return;
    localStorage.setItem("kb_tab_order", JSON.stringify(tabOrder));
  }, [tabOrder, tabPrefsHydrated]);

  useEffect(() => {
    if (!tabPrefsHydrated || typeof window === "undefined") return;
    localStorage.setItem("kb_tab_hidden", JSON.stringify(hiddenTabIds));
  }, [hiddenTabIds, tabPrefsHydrated]);

  const moveTab = (id, dir) => {
    setTabOrder((prev) => {
      const idx = prev.indexOf(id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const toggleTabHidden = (id) => {
    setHiddenTabIds((prev) => {
      const isHidden = prev.includes(id);
      if (!isHidden && prev.length >= tabOrder.length - 1) return prev; // 最低1つは表示に残す
      return isHidden ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  // 表示中のタブが非表示にされたら、先頭の表示中タブへ自動的に退避する。
  useEffect(() => {
    const activeId = tab === "jp" || tab === "us" ? "stocks" : tab;
    if (!hiddenTabIds.includes(activeId)) return;
    const fallback = tabOrder.find((id) => !hiddenTabIds.includes(id));
    if (!fallback) return;
    setTab(fallback === "stocks" ? flagSide : fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenTabIds, tabOrder]);

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
  // ユーザーが並び替えた順・非表示設定を反映した、実際にタブバーへ出す一覧。
  const visibleTabs = tabOrder
    .map((id) => TABS.find((t) => t.id === id))
    .filter((t) => t && !hiddenTabIds.includes(t.id));

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
        <div style={{ display:"flex", alignItems:"stretch", background:"#080D10", borderBottom:"1px solid #1f1f1f", flexShrink:0 }}>
          {visibleTabs.map(t => {
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
          <B
            onClick={() => setEditingTabs(v => !v)}
            title="タブの並び替え・表示/非表示"
            style={{
              flexShrink:0, width:34, background: editingTabs ? "#13161C" : "transparent",
              borderLeft:"1px solid #1f1f1f", color: editingTabs ? "#00E0A3" : "#6B7280", fontSize:13,
            }}
          >⋮⋮</B>
        </div>

        {/* タブ編集パネル — 並び替え(↑↓)・表示/非表示のみ。データ取得やAPIには
            触れず、端末内の見た目設定を変えるだけ(localStorageに保存)。 */}
        {editingTabs && (
          <div style={{ background:"#0C0F14", borderBottom:"1px solid #1f1f1f", padding:"8px 12px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:9, color:"#6B7280" }}>タブの並び替え・表示/非表示(この端末にのみ保存)</span>
              <button
                onClick={() => { setTabOrder(DEFAULT_TAB_ORDER); setHiddenTabIds([]); }}
                style={{ background:"none", border:"none", color:"#6B7280", fontSize:9, textDecoration:"underline", cursor:"pointer", fontFamily:"inherit" }}
              >既定順に戻す</button>
            </div>
            {tabOrder.map((id, idx) => {
              const t = TABS.find(x => x.id === id);
              if (!t) return null;
              const hidden = hiddenTabIds.includes(id);
              const isLastVisible = !hidden && visibleTabs.length <= 1;
              return (
                <div key={id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 2px", opacity: hidden ? 0.45 : 1 }}>
                  <span style={{ flex:1, fontSize:11, color:"#D0D0D0" }}>{t.label}</span>
                  <button onClick={() => moveTab(id, -1)} disabled={idx === 0} style={{
                    background:"#13161C", border:"1px solid #1B1F26", borderRadius:6, color: idx === 0 ? "#3A3F47" : "#A1A7B3",
                    width:26, height:26, fontSize:11, cursor: idx === 0 ? "default" : "pointer", fontFamily:"inherit",
                  }}>↑</button>
                  <button onClick={() => moveTab(id, 1)} disabled={idx === tabOrder.length - 1} style={{
                    background:"#13161C", border:"1px solid #1B1F26", borderRadius:6, color: idx === tabOrder.length - 1 ? "#3A3F47" : "#A1A7B3",
                    width:26, height:26, fontSize:11, cursor: idx === tabOrder.length - 1 ? "default" : "pointer", fontFamily:"inherit",
                  }}>↓</button>
                  <button
                    onClick={() => toggleTabHidden(id)}
                    disabled={isLastVisible}
                    title={isLastVisible ? "最低1つのタブは表示しておく必要があります" : (hidden ? "表示する" : "非表示にする")}
                    style={{
                      background: hidden ? "#13161C" : "#0a2a20", border:`1px solid ${hidden ? "#1B1F26" : "#00E0A344"}`, borderRadius:6,
                      color: isLastVisible ? "#3A3F47" : (hidden ? "#A1A7B3" : "#00E0A3"),
                      width:56, height:26, fontSize:9.5, cursor: isLastVisible ? "default" : "pointer", fontFamily:"inherit",
                    }}
                  >{hidden ? "非表示" : "表示中"}</button>
                </div>
              );
            })}
          </div>
        )}

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


