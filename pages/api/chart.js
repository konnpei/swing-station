// GitHub上の最新data/latest_chart.pngをリクエストのたびに取得する。
// latest.js同様、Vercelビルド時点の静的ファイルではなく常に最新を返す。

const RAW_URL = "https://raw.githubusercontent.com/konnpei/swing-station/main/data/latest_chart.png";

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
