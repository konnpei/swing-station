import { Html, Head, Main, NextScript } from "next/document";

function dashboardBootstrap() {
  const ID = "market-dashboard-overlay";
  const STYLE_ID = "market-dashboard-style";
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const num = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;

  function scoreMarket(d) {
    if (typeof d.market_score === "number") return clamp(Math.round(d.market_score), 0, 100);
    let score = 50;
    score += clamp(num(d.nikkei_pct) * 5, -16, 16);
    score += clamp(num(d.sox_pct) * 6, -18, 18);
    score += clamp(num(d.nasdaq_pct) * 3, -8, 8);
    score -= clamp((num(d.vix, 20) - 20) * 1.4, -10, 18);
    return clamp(Math.round(score), 0, 100);
  }

  function scoreMeta(score) {
    if (score >= 70) return { label: "攻めの日", sub: "強気", color: "#00ff9d" };
    if (score >= 55) return { label: "やや攻め", sub: "選別強気", color: "#a8e063" };
    if (score >= 40) return { label: "様子見", sub: "中立", color: "#ffd166" };
    if (score >= 25) return { label: "守る日", sub: "警戒", color: "#ff9955" };
    return { label: "強く守る日", sub: "強い警戒", color: "#ff5566" };
  }

  function cleanLine(value, max = 43) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  function strategies(d) {
    if (Array.isArray(d.strategy_lines) && d.strategy_lines.length) {
      return d.strategy_lines.slice(0, 3).map((x) => cleanLine(x));
    }
    const c = d.consideration || {};
    const candidates = [c.point, c.action, d.market_summary].map((x) => cleanLine(x)).filter(Boolean);
    const defaults = [
      num(d.sox_pct) > 1 ? "全体指数より半導体の相対的な強さを優先" : "寄り付き直後は方向を決めず、指数の反応を確認",
      num(d.nikkei_pct) < -1 ? "急落局面では一括買いを避け、分割で検討" : "急騰銘柄を追わず、押し目まで待つ",
      num(d.vix, 20) >= 25 ? "VIX高水準のためポジションを小さく管理" : "過熱銘柄は利確、売られすぎは分割検討",
    ];
    return [...candidates, ...defaults].slice(0, 3);
  }

  function parseDate(value) {
    if (!value) return null;
    const normalized = String(value).replace(/\//g, "-");
    const date = new Date(normalized.length === 10 ? normalized + "T00:00:00+09:00" : normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function nextEvent(d) {
    const direct = Array.isArray(d.today_events) ? d.today_events : [];
    const merged = direct.length ? direct : [
      ...(Array.isArray(d.events_jp) ? d.events_jp.map((e) => ({ ...e, region: e.region || "日本" })) : []),
      ...(Array.isArray(d.events_us) ? d.events_us.map((e) => ({ ...e, region: e.region || "米国" })) : []),
    ];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return merged
      .map((e) => ({ ...e, _date: parseDate(e.date) }))
      .filter((e) => !e._date || e._date >= start)
      .sort((a, b) => (a._date?.getTime() || 0) - (b._date?.getTime() || 0))[0] || null;
  }

  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = create("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ID}{margin:0 0 14px;display:grid;grid-template-columns:minmax(210px,.82fr) minmax(260px,1.18fr);gap:10px;color:#e8e8e8;font-family:'JetBrains Mono','Courier New',monospace}
      #${ID} .md-card{background:linear-gradient(145deg,#151515,#0d0d0d);border:1px solid #2d2d2d;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px #0006}
      #${ID} .md-score{grid-row:span 2;padding:14px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:278px}
      #${ID} .md-kicker{font-size:10px;letter-spacing:.12em;color:#8a8a8a;margin-bottom:8px;font-weight:700}
      #${ID} .md-ring{width:166px;height:166px;border-radius:50%;display:grid;place-items:center;position:relative}
      #${ID} .md-ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#0e0e0e;border:1px solid #303030}
      #${ID} .md-ring-inner{position:relative;z-index:1;text-align:center}
      #${ID} .md-number{font-family:'Orbitron',monospace;font-size:47px;line-height:1;font-weight:900}
      #${ID} .md-denom{font-size:10px;color:#777;margin-top:4px}
      #${ID} .md-action{font-size:22px;font-weight:900;margin-top:12px}
      #${ID} .md-sub{font-size:10px;color:#8a8a8a;margin-top:3px}
      #${ID} .md-reasons{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:13px}
      #${ID} .md-reason{background:#151515;border:1px solid #282828;border-radius:7px;padding:7px 4px;text-align:center;font-size:9px;color:#999}
      #${ID} .md-reason strong{display:block;font-size:12px;margin-top:3px;color:#eee}
      #${ID} .md-panel{padding:13px 14px}
      #${ID} .md-title{font-size:12px;font-weight:900;margin-bottom:9px;display:flex;align-items:center;gap:7px}
      #${ID} .md-title:before{content:'';width:4px;height:16px;border-radius:4px;background:#e8e8e8}
      #${ID} .md-lines{display:flex;flex-direction:column;gap:7px}
      #${ID} .md-line{display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center;background:#121212;border:1px solid #292929;border-radius:9px;padding:8px 9px;font-size:11px;line-height:1.55}
      #${ID} .md-index{width:22px;height:22px;border-radius:7px;background:#e8e8e8;color:#0a0a0a;display:grid;place-items:center;font-weight:900;font-size:10px}
      #${ID} .md-event{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:#14110b;border:1px solid #ffd16655;border-radius:10px;padding:10px 11px}
      #${ID} .md-date{font-family:'Orbitron',monospace;font-size:16px;color:#ffd166;font-weight:900;white-space:nowrap}
      #${ID} .md-event-title{font-size:12px;font-weight:900;color:#eee;line-height:1.45}
      #${ID} .md-event-meta{font-size:9px;color:#888;margin-top:3px}
      #${ID} .md-badge{font-size:9px;color:#ffd166;border:1px solid #ffd16677;border-radius:999px;padding:4px 7px;white-space:nowrap}
      @media(max-width:620px){#${ID}{grid-template-columns:1fr}#${ID} .md-score{grid-row:auto;min-height:0;padding:13px}#${ID} .md-ring{width:142px;height:142px}#${ID} .md-number{font-size:41px}#${ID} .md-action{font-size:19px}#${ID} .md-panel{padding:12px}#${ID} .md-line{font-size:10px;padding:7px 8px}#${ID} .md-event{grid-template-columns:auto 1fr}#${ID} .md-badge{grid-column:2;justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function findRoot() {
    const tab = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "朝刊");
    const content = tab?.parentElement?.nextElementSibling;
    return content?.firstElementChild?.firstElementChild || null;
  }

  function render(d) {
    const root = findRoot();
    if (!root || document.getElementById(ID)) return false;
    addStyles();
    const score = scoreMarket(d);
    const meta = scoreMeta(score);
    const lines = strategies(d);
    const event = nextEvent(d);

    const wrap = create("section");
    wrap.id = ID;
    wrap.setAttribute("aria-label", "今日の相場ダッシュボード");

    const scoreCard = create("div", "md-card md-score");
    scoreCard.appendChild(create("div", "md-kicker", "TODAY'S MARKET SCORE"));
    const ring = create("div", "md-ring");
    ring.style.background = `conic-gradient(${meta.color} ${score}%,#242424 0)`;
    ring.style.filter = `drop-shadow(0 0 13px ${meta.color}66)`;
    const inner = create("div", "md-ring-inner");
    const number = create("div", "md-number", String(score));
    number.style.color = meta.color;
    inner.appendChild(number);
    inner.appendChild(create("div", "md-denom", "/ 100"));
    ring.appendChild(inner);
    scoreCard.appendChild(ring);
    const action = create("div", "md-action", meta.label);
    action.style.color = meta.color;
    scoreCard.appendChild(action);
    scoreCard.appendChild(create("div", "md-sub", `${meta.sub}｜指数からの参考判定`));
    const reasons = create("div", "md-reasons");
    [["日経", num(d.nikkei_pct), "%"], ["SOX", num(d.sox_pct), "%"], ["VIX", num(d.vix), ""]].forEach(([name, value, unit]) => {
      const box = create("div", "md-reason", name);
      box.appendChild(create("strong", "", `${unit && value > 0 ? "+" : ""}${Number(value).toFixed(1)}${unit}`));
      reasons.appendChild(box);
    });
    scoreCard.appendChild(reasons);

    const strategyCard = create("div", "md-card md-panel");
    strategyCard.appendChild(create("div", "md-title", "今日の3行戦略"));
    const lineWrap = create("div", "md-lines");
    lines.forEach((line, index) => {
      const row = create("div", "md-line");
      row.appendChild(create("div", "md-index", String(index + 1)));
      row.appendChild(create("div", "", line));
      lineWrap.appendChild(row);
    });
    strategyCard.appendChild(lineWrap);

    const eventCard = create("div", "md-card md-panel");
    eventCard.appendChild(create("div", "md-title", "今日は何の日？"));
    const eventBox = create("div", "md-event");
    if (event) {
      const dateLabel = event.date ? String(event.date).replace(/^\d{4}[-/]/, "").replace("-", "/") : (event.time || "本日");
      eventBox.appendChild(create("div", "md-date", dateLabel));
      const info = create("div");
      info.appendChild(create("div", "md-event-title", event.title || event.text || "重要イベント"));
      info.appendChild(create("div", "md-event-meta", [event.region, event.time].filter(Boolean).join(" ・ ") || "市場予定"));
      eventBox.appendChild(info);
      eventBox.appendChild(create("div", "md-badge", event.importance === "high" ? "最重要" : event.importance === "low" ? "参考" : "重要"));
    } else {
      eventBox.appendChild(create("div", "md-date", "—"));
      const info = create("div");
      info.appendChild(create("div", "md-event-title", "直近の重要イベントは登録されていません"));
      info.appendChild(create("div", "md-event-meta", "予定タブで月間スケジュールを確認"));
      eventBox.appendChild(info);
    }
    eventCard.appendChild(eventBox);

    wrap.appendChild(scoreCard);
    wrap.appendChild(strategyCard);
    wrap.appendChild(eventCard);

    const modeCard = Array.from(root.children).find((node) => (node.textContent || "").includes("モード"));
    if (modeCard?.nextSibling) root.insertBefore(wrap, modeCard.nextSibling);
    else root.insertBefore(wrap, root.firstChild);
    return true;
  }

  async function mount() {
    try {
      const response = await fetch(`/api/latest?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (render(data) || attempts > 40) clearInterval(timer);
      }, 250);
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
}

export default function Document() {
  const script = `(${dashboardBootstrap.toString()})();`;
  return (
    <Html lang="ja">
      <Head />
      <body>
        <Main />
        <NextScript />
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </body>
    </Html>
  );
}
