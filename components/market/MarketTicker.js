/* KabuBocchi次世代デザイン Phase 1 — Ticker Strip。
   朝刊(BriefingView)の最上部に置く、主要指標の横並び帯。
   色・フォントは既存サイトの実測トークンに合わせている
   (bg #080D10 / panel #13161C / border #1B1F26 / positive #00E0A3 / negative #ff5566)。
   実データのみを表示し、値が無ければ "—" にフォールバックする(捏造しない)。 */

function fmt(v, opts = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const { prefix = "", suffix = "", digits } = opts;
  const n = typeof digits === "number" ? v.toFixed(digits) : v.toLocaleString();
  return `${prefix}${n}${suffix}`;
}

function pctText(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export default function MarketTicker({ briefing }) {
  if (!briefing) return null;

  const items = [
    { sym: "NIKKEI", px: fmt(briefing.nikkei), chg: pctText(briefing.nikkei_pct) },
    { sym: "TOPIX", px: fmt(briefing.topix), chg: pctText(briefing.topix_pct) },
    { sym: "S&P500", px: fmt(briefing.sp500), chg: pctText(briefing.sp500_pct) },
    { sym: "NASDAQ", px: fmt(briefing.nasdaq), chg: pctText(briefing.nasdaq_pct) },
    { sym: "SOX", px: fmt(briefing.sox), chg: pctText(briefing.sox_pct) },
    { sym: "USD/JPY", px: fmt(briefing.usd_jpy), chg: pctText(briefing.usd_jpy_pct) },
    {
      sym: "US10Y", px: fmt(briefing.us10y, { suffix: "%" }),
      chg: typeof briefing.us10y_diff === "number"
        ? `${briefing.us10y_diff >= 0 ? "+" : ""}${briefing.us10y_diff.toFixed(2)}pt`
        : "—",
    },
    { sym: "GOLD", px: fmt(briefing.gold, { prefix: "$" }), chg: pctText(briefing.gold_pct) },
    { sym: "VIX", px: fmt(briefing.vix, { digits: 1 }), chg: pctText(briefing.vix_pct) },
  ];

  return (
    <div className="mkt-ticker">
      {items.map((it) => {
        const isDown = it.chg.startsWith("-");
        const isUp = it.chg.startsWith("+");
        const color = isDown ? "#ff5566" : isUp ? "#00E0A3" : "#A1A7B3";
        return (
          <div className="cell" key={it.sym}>
            <div className="sym">{it.sym}</div>
            <div className="px">{it.px}</div>
            <div className="chg" style={{ color }}>{it.chg}</div>
          </div>
        );
      })}
      <style jsx>{`
        .mkt-ticker {
          display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch;
          background: #080D10; border: 1px solid #1B1F26; border-radius: 12px;
          margin-bottom: 10px; scrollbar-width: none;
        }
        .mkt-ticker::-webkit-scrollbar { display: none; }
        .cell {
          flex: none; min-width: 92px; padding: 9px 13px;
          border-right: 1px solid #1B1F26;
        }
        .cell:last-child { border-right: none; }
        .sym {
          font-size: 9px; color: #6B7280; letter-spacing: .04em;
          font-family: 'JetBrains Mono','Courier New',monospace;
        }
        .px {
          font-size: 13px; color: #FFFFFF; margin-top: 3px;
          font-family: 'JetBrains Mono','Courier New',monospace;
        }
        .chg {
          font-size: 10.5px; margin-top: 2px;
          font-family: 'JetBrains Mono','Courier New',monospace;
        }
      `}</style>
    </div>
  );
}
