/* KabuBocchi次世代デザイン Phase 2 — Sector Ranking。
   朝刊(BriefingView)に「今日どのセクターが強い/弱いか」を5秒で伝える要約。
   詳細な全業種ヒートマップは既存の日本株/米国株タブ(SectorHeatmap)に
   既にあるため、ここでは重複させず上位3・下位3だけの簡潔なランキングにする。
   実データ(sector_heatmap)のみ使用。 */

export default function SectorRanking({ heatmap }) {
  if (!heatmap || heatmap.length === 0) return null;

  const sorted = [...heatmap].sort((a, b) => (b.avg_pct ?? 0) - (a.avg_pct ?? 0));
  const top = sorted.slice(0, 3);
  const bottom = sorted.length > 6 ? sorted.slice(-3).reverse() : [];

  return (
    <div className="sr-wrap">
      <div className="sr-head">SECTOR RANKING</div>
      <div className="sr-list">
        {top.map((s) => (
          <div className="sr-row up" key={`top-${s.sector}`}>
            <span className="sr-name">▲ {s.sector}</span>
            <span className="sr-mover">{s.top_mover?.name}</span>
            <span className="sr-pct">{s.avg_pct >= 0 ? "+" : ""}{s.avg_pct.toFixed(2)}%</span>
          </div>
        ))}
        {bottom.map((s) => (
          <div className="sr-row down" key={`bottom-${s.sector}`}>
            <span className="sr-name">▼ {s.sector}</span>
            <span className="sr-mover">{s.top_mover?.name}</span>
            <span className="sr-pct">{s.avg_pct >= 0 ? "+" : ""}{s.avg_pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .sr-wrap {
          background: #13161C; border: 1px solid #1B1F26; border-radius: 12px;
          padding: 12px 14px; margin-bottom: 14px;
        }
        .sr-head {
          font-size: 10px; letter-spacing: .1em; color: #6B7280; font-weight: 700;
          margin-bottom: 8px;
        }
        .sr-list { display: flex; flex-direction: column; }
        .sr-row {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 0; border-bottom: 1px solid #1B1F26; font-size: 12px;
        }
        .sr-row:last-child { border-bottom: none; }
        .sr-name { flex: none; width: 92px; color: #FFFFFF; }
        .sr-row.up .sr-name { color: #00E0A3; }
        .sr-row.down .sr-name { color: #ff5566; }
        .sr-mover {
          flex: 1; min-width: 0; color: #6B7280; font-size: 10.5px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sr-pct {
          flex: none; font-family: 'JetBrains Mono','Courier New',monospace;
          font-variant-numeric: tabular-nums; color: #A1A7B3; font-size: 11.5px;
        }
      `}</style>
    </div>
  );
}
