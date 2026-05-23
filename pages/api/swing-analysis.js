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
        model: "claude-haiku-4-5-20251001
