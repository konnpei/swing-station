const WEBHOOK = process.env.DISCORD_WEBHOOK_NOTE_CONTENT;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).end();
  }

  try {
    // AI記事生成
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `あなたはスイングトレード専門のNoteライターです。
今日の相場をweb_searchで調べて、Note記事として投稿できるクオリティの文章を書いてください。

記事フォーマット：
【タイトル】今日の相場タイトル
【本文】
・相場概況（日米）
・注目銘柄3つ（週足→日足→エントリーゾーン）
・今週の戦略まとめ
・リスク注意点

絵文字を使って読みやすく。マークダウンの#は使わない。3000文字程度。`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: "今日のスイングトレード向けNote記事を書いて。" }],
      }),
    });

    const data = await r.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");

    // Discord送信
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📝 **Note記事案（確認してからNoteに投稿してください）**\n\n${text.slice(0, 1900)}\n\n${text.length > 1900 ? "（続きはアプリで確認）" : ""}`,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
