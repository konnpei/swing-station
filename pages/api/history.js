// GitHub上のdata/history/を毎回取得する（Vercelビルド時点の静的ファイルではなく常に最新）。
// 一覧取得はGitHub Contents APIを1回、各ファイルの中身はraw.githubusercontent.com経由で取得する。

const REPO = "konnpei/swing-station";
const CONTENTS_URL = `https://api.github.com/repos/${REPO}/contents/data/history`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/data/history`;

async function fetchJson(url) {
  const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  try {
    const { date } = req.query;

    // 特定日の朝刊フル詳細を返す(日付ピッカー用)
    if (date) {
      const r = await fetch(`${RAW_BASE}/${date}.json?t=${Date.now()}`);
      if (!r.ok) {
        return res.status(404).json({ error: `${date} のデータが見つかりません` });
      }
      const data = await r.json();
      return res.status(200).json({ date, data });
    }

    // 既存: 履歴タブの統計表示用（最大400日分＝平日ベースでおよそ1年半）
    let files;
    try {
      const listing = await fetchJson(CONTENTS_URL);
      files = listing
        .map(f => f.name)
        .filter(n => n.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 400);
    } catch (e) {
      return res.status(200).json({ history: [] });
    }

    const results = await Promise.all(files.map(async file => {
      try {
        const d = await fetchJson(`${RAW_BASE}/${file}`);
        return {
          date: d.date,
          fileDate: file.replace(".json", ""),
          mode: d.mode,
          nikkei: d.nikkei,
          nikkei_pct: d.nikkei_pct,
          usd_jpy: d.usd_jpy,
          sox_pct: d.sox_pct,
          sox: d.sox,
          vix: d.vix,
          topix: d.topix,
          topix_pct: d.topix_pct,
          nasdaq: d.nasdaq,
          nasdaq_pct: d.nasdaq_pct,
          sp500: d.sp500,
          sp500_pct: d.sp500_pct,
          sector_heatmap: d.sector_heatmap || [],
          us_sector_heatmap: d.us_sector_heatmap || [],
          stocks_jp: (d.stocks_jp || []).map(s => ({ name: s.name, code: s.code, score: s.score })),
        };
      } catch (e) {
        return null;
      }
    }));

    const history = results.filter(Boolean);
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message, history: [] });
  }
}
