export const config = { maxDuration: 60 };

const WEBHOOKS = {
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
  market:  process.env.DISCORD_MARKET_WATCH,
  content: process.env.DISCORD_NOTE_CONTENT,
};

async function sendDiscord(webhookUrl, content) {
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    return res.ok;
  } catch { return false; }
}

function formatJPStock(s, rank) {
  return [
    `**${rank}位 ${s.name}（${s.code}）** 📊スコア:${s.score}/10`,
    `タイプ：${s.type}`,
    `週足：${s.weekly_trend}`,
    `60分エントリー：${s.entry_60min}`,
    `30分エントリー：${s.entry_30min}`,
    `利確目標：+${s.target} / 損切：${s.stop_loss}`,
    `保有想定：${s.hold_days} / 狙い曜日：${s.best_entry_day}`,
    `📌 ${s.reason}`,
    `⚠️ ${s.risk}`,
  ].join("\n");
}

function formatUSStock(s, rank) {
  return [
    `**${rank}位 $${s.ticker} ${s.name}** 📊スコア:${s.score}/10`,
    `タイプ：${s.type}`,
    `週足：${s.weekly_trend}`,
    `60分エントリー：${s.entry_60min}`,
    `30分エントリー：${s.entry_30min}`,
    `利確目標：+${s.target} / 損切：${s.stop_loss}`,
    `保有想定：${s.hold_days} / 狙い曜日：${s.best_entry_day}`,
    `📌 ${s.reason}`,
    `⚠️ ${s.risk}`,
  ].join("\n");
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: "You are a JSON generator. You must ALWAYS respond with valid JSON only. Never include any text outside the JSON object.",
        messages: [{ role: "user", content: `Return ONLY this JSON with today's real market data filled in. No other text:
{"date":"2025/05/24","market":{"jp_trend":"上昇","us_trend":"上昇","swing_env":"7","comment":"コメント"},"jp_stocks":[{"code":"7203","name":"トヨタ","type":"押し目買い","weekly_trend":"上昇","daily_support":"3500円","entry_60min":"3520-3540円","entry_30min":"3525円","target":"3%","stop_loss":"-2%","hold_days":"3-5日","best_entry_day":"月曜","reason":"理由","risk":"リスク","score":8},{"code":"9984","name":"SBG","type":"上昇継続","weekly_trend":"上昇","daily_support":"9000円","entry_60min":"9100-9200円","entry_30min":"9150円","target":"4%","stop_loss":"-2%","hold_days":"3-5日","best_entry_day":"火曜","reason":"理由","risk":"リスク","score":9},{"code":"6857","name":"アドバンテスト","type":"押し目買い","weekly_trend":"上昇","daily_support":"8000円","entry_60min":"8100-8200円","entry_30min":"8150円","target":"5%","stop_loss":"-3%","hold_days":"3-5日","best_entry_day":"水曜","reason":"理由","risk":"リスク","score":8}],"us_stocks":[{"ticker":"NVDA","name":"エヌビディア","type":"押し目買い","weekly_trend":"調整","entry_60min":"218-223ドル","entry_30min":"220ドル","target":"4%","stop_loss":"-3%","hold_days":"5-7日","best_entry_day":"月曜","reason":"理由","risk":"リスク","score":7},{"ticker":"MSFT","name":"マイクロソフト","type":"上昇継続","weekly_trend":"上昇","entry_60min":"418-425ドル","entry_30min":"421ドル","target":"3%","stop_loss":"-2%","hold_days":"3-5日","best_entry_day":"月曜","reason":"理由","risk":"リスク","score":8},{"ticker":"AAPL","name":"アップル","type":"底値反転","weekly_trend":"反転","entry_60min":"195-200ドル","entry_30min":"197ドル","target":"3%","stop_loss":"-2%","hold_days":"3-5日","best_entry_day":"火曜","reason":"理由","risk":"リスク","score":7}],"x_post":"投稿文","note_article":"記事本文"}` }],
      }),
    });

    const response = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(response));

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    const marketMsg = [
      `📊 **${data.date} スイング相場環境**`,
      `🇯🇵 日本株週足：${data.market.jp_trend}`,
      `🇺🇸 米国株週足：${data.market.us_trend}`,
      `スイング環境スコア：${data.market.swing_env}/10`,
      `💬 ${data.market.comment}`,
    ].join("\n");
    await sendDiscord(WEBHOOKS.market, marketMsg);

    const jpMsg = [
      `🇯🇵 **本日の日本株スイング候補**`,
      "",
      ...data.jp_stocks.map((s, i) => formatJPStock(s, i + 1) + "\n"),
      "※投資判断は自己責任で。",
    ].join("\n");
    await sendDiscord(WEBHOOKS.jp, jpMsg);

    const usMsg = [
      `🇺🇸 **本日の米国株スイング候補**`,
      "",
      ...data.us_stocks.map((s, i) => formatUSStock(s, i + 1) + "\n"),
      "※投資判断は自己責任で。",
    ].join("\n");
    await sendDiscord(WEBHOOKS.us, usMsg);

    const contentMsg = [
      `📝 **本日のコンテンツ**`,
      "",
      "**X投稿文：**",
      data.x_post,
      "",
      "**Note記事：**",
      data.note_article.slice(0, 800),
    ].join("\n");
    await sendDiscord(WEBHOOKS.content, contentMsg);

    res.status(200).json({ success: true, date: data.date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
