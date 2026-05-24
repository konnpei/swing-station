export default async function handler(req, res) {
  const results = {};
  
  const webhooks = {
    market: process.env.DISCORD_MARKET_WATCH,
    jp: process.env.DISCORD_JP_STOCKS,
    us: process.env.DISCORD_US_STOCKS,
    content: process.env.DISCORD_NOTE_CONTENT,
    earnings: process.env.DISCORD_EARNINGS_ALERT,
  };

  for (const [name, url] of Object.entries(webhooks)) {
    if (!url) {
      results[name] = "❌ URL未設定";
      continue;
    }
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `🧪 テスト送信：${name}チャンネル` }),
      });
      results[name] = r.ok ? "✅ 成功" : `❌ 失敗 ${r.status}`;
    } catch (e) {
      results[name] = `❌ エラー: ${e.message}`;
    }
  }

  res.status(200).json(results);
}
