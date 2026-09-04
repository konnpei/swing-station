/* KabuBocchi次世代デザイン Phase 1 — World Market Table。
   以前は同じ情報が2箇所に分散していた:
   - MarketPulse(日経平均/SOX/NASDAQ/VIX/USD-JPYの横スクロールカード)
   - 6枚グリッド(TOPIX/S&P500/米10年債/BTC/DXY/Gold)
   これを1本のカテゴリ別テーブルに統合し、証券会社の板のような一覧性を持たせる。
   実データのみを表示し、値が無ければ "—"(捏造しない)。 */

function pctText(v, digits = 2) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function ptText(v, digits = 2) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}pt`;
}

function colorOf(text) {
  if (text.startsWith("-")) return "#ff5566";
  if (text.startsWith("+")) return "#00E0A3";
  return "#A1A7B3";
}

export default function MarketWorldTable({ briefing }) {
  if (!briefing) return null;

  const groups = [
    {
      cat: "JAPAN",
      rows: [
        { name: "日経平均", sub: "Nikkei 225", px: briefing.nikkei?.toLocaleString(), chg: pctText(briefing.nikkei_pct) },
        { name: "TOPIX", sub: "東証株価指数", px: briefing.topix?.toLocaleString(), chg: pctText(briefing.topix_pct) },
      ],
    },
    {
      cat: "US EQUITY",
      rows: [
        { name: "S&P 500", sub: "SPX", px: briefing.sp500?.toLocaleString(), chg: pctText(briefing.sp500_pct) },
        { name: "NASDAQ", sub: "IXIC", px: briefing.nasdaq?.toLocaleString(), chg: pctText(briefing.nasdaq_pct) },
        { name: "SOX", sub: "半導体指数", px: briefing.sox?.toLocaleString(), chg: pctText(briefing.sox_pct) },
      ],
    },
    {
      cat: "FX",
      rows: [
        { name: "USD/JPY", sub: "ドル円", px: briefing.usd_jpy, chg: pctText(briefing.usd_jpy_pct) },
        { name: "DXY", sub: "ドル指数", px: briefing.dxy, chg: pctText(briefing.dxy_pct) },
      ],
    },
    {
      cat: "BONDS",
      rows: [
        { name: "米10年債", sub: "US10Y", px: typeof briefing.us10y === "number" ? `${briefing.us10y}%` : "—", chg: ptText(briefing.us10y_diff) },
      ],
    },
    {
      cat: "COMMODITY / RISK",
      rows: [
        { name: "Gold", sub: "金", px: briefing.gold ? `$${briefing.gold.toLocaleString()}` : "—", chg: pctText(briefing.gold_pct) },
        { name: "VIX", sub: "恐怖指数", px: briefing.vix, chg: pctText(briefing.vix_pct) },
        { name: "BTC", sub: "ビットコイン", px: briefing.btc ? `$${briefing.btc.toLocaleString()}` : "—", chg: pctText(briefing.btc_pct) },
      ],
    },
  ];

  return (
    <div className="wmt-wrap">
      <div className="wmt-head">
        <span>WORLD MARKET</span>
        {briefing.market_data_refreshed_at && (
          <span className="wmt-updated">
            {new Date(briefing.market_data_refreshed_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新
          </span>
        )}
      </div>
      <div className="wmt-table">
        {groups.map((g) => (
          <div key={g.cat}>
            <div className="wmt-cat">{g.cat}</div>
            {g.rows.map((r) => (
              <div className="wmt-row" key={r.name}>
                <div className="wmt-name">
                  {r.name}
                  <small>{r.sub}</small>
                </div>
                <div className="wmt-px">{r.px ?? "—"}</div>
                <div className="wmt-chg" style={{ color: colorOf(r.chg) }}>{r.chg}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <style jsx>{`
        .wmt-wrap {
          background: #13161C; border: 1px solid #1B1F26; border-radius: 12px;
          padding: 12px 14px 6px; margin-bottom: 14px;
        }
        .wmt-head {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 10px; letter-spacing: .1em; color: #6B7280; font-weight: 700;
          margin-bottom: 10px; padding: 0 2px;
        }
        .wmt-updated {
          font-family: 'JetBrains Mono','Courier New',monospace; font-weight: 400;
          letter-spacing: 0; color: #4A5560;
        }
        .wmt-cat {
          font-size: 9.5px; letter-spacing: .08em; color: #4A5560; font-weight: 700;
          padding: 10px 2px 4px; border-bottom: 1px solid #1B1F26;
        }
        .wmt-row {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 2px; border-bottom: 1px solid #1B1F26;
        }
        .wmt-row:last-child { border-bottom: none; }
        .wmt-name {
          flex: 1; min-width: 0; font-size: 12.5px; color: #FFFFFF; font-weight: 500;
        }
        .wmt-name small {
          display: block; font-size: 10px; color: #6B7280; font-weight: 400; margin-top: 1px;
        }
        .wmt-px {
          flex: none; font-size: 13px; color: #FFFFFF; text-align: right; min-width: 84px;
          font-family: 'JetBrains Mono','Courier New',monospace; font-variant-numeric: tabular-nums;
        }
        .wmt-chg {
          flex: none; font-size: 11.5px; text-align: right; min-width: 68px;
          font-family: 'JetBrains Mono','Courier New',monospace; font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}
