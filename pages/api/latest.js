// GitHub上の最新data/latest.jsonをリクエストのたびに取得する。
// Vercelビルド時点の静的ファイルを読む方式（旧実装）だと、GitHub Actionsが
// データを更新してもVercelが再ビルドするまでサイトに反映されないため、
// 常にGitHubから直接取得する方式に変更している。

const RAW_URL = "https://raw.githubusercontent.com/konnpei/swing-station/main/data/latest.json";

function sanitizeJsonText(text) {
  // Python側で NaN/Infinity が混ざった場合でも、APIを500にしない。
  // JSON標準では無効なので、欠損値として null に寄せる。
  return text.replace(/:\s*(?:NaN|Infinity|-Infinity)(?=\s*[,}])/g, ": null");
}

export default async function handler(req, res) {
  try {
    const r = await fetch(`${RAW_URL}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: `GitHub取得失敗: ${r.status}` });
    }

    const text = await r.text();
    const data = JSON.parse(sanitizeJsonText(text));

    // フロントの5分ごとポーリングに配慮したキャッシュ設定
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
