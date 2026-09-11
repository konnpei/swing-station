// GitHub上の最新data/latest_stock_charts.pngをリクエストのたびに取得する。
// pages/api/chart.jsと同じパターン(Issue #28: note投稿セット用)。
// 生成に失敗した日は元々保存自体が行われない(scripts/morning_briefing.py側で
// stock_charts_bufがNoneの場合は保存をスキップする)ため、その場合は前回分が
// そのまま返る。呼び出し側(/note)は404/取得失敗をハンドルすること。

const RAW_URL = "https://raw.githubusercontent.com/konnpei/swing-station/main/data/latest_stock_charts.png";

export default async function handler(req, res) {
  try {
    const r = await fetch(`${RAW_URL}?t=${Date.now()}`);
    if (!r.ok) {
      return res.status(r.status).end();
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).end();
  }
}
