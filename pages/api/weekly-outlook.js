/**
 * /api/weekly-outlook
 * 毎週日曜朝7時（JST）に実行
 * 翌週のスイングトレード戦略を生成 → Discord全チャンネルに通知
 */

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEBHOOKS = {
  market:  process.env.DISCORD_MARKET_WATCH,
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
  content: process.env.DISCORD_NOTE_CONTENT,
};

const WEEKLY_PROMPT = `スイングトレード専門アナリストとして、翌週（月〜金）の戦略をJSONのみで返してください。

web_searchで以下を検索してから回答：
- 「日経平均 来週 見通し 週足」
- 「米国株 来週 相場 予想」
- 「日本株 来週 注目銘柄 スイング」

{
  "week_label": "5/XX週",
  "jp_weekly_trend": "日本株週間トレンド予測",
  "us_weekly_trend": "米国株週間トレンド予測",
  "key_events": ["今週の重要イベント1", "イベント2", "イベント3"],
  "swing_strategy": "今週のスイング基本戦略（60文字）",
  "best_entry_days": "エントリーに最適な曜日と理由",
  "avoid_days": "避けるべき曜日と理由",
  "jp_watchlist": [
    {"code": "コード", "name": "銘柄名", "reason": "注目理由（30文字）", "timeframe": "60分 or 30分"}
  ],
  "us_watchlist": [
    {"ticker": "ティッカー", "name": "名前", "reason": "注目理由（30文字）", "timeframe": "60分 or 30分"}
  ],
  "x_post": "週間見通しX投稿文（140文字・#スイングトレード含む）",
  "note_intro": "Note週間レポート冒頭（300文字）"
}

日本株5銘柄、米国株3銘柄のウォッチリストを提示。`;

async function sendDiscord(url, content) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  });
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: WEEKLY_PROMPT }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const data = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // market-watch: 週間見通し
    await sendDiscord(WEBHOOKS.market, [
      `🗓️ **${data.week_label} スイング週間戦略**`,
      ``,
      `🇯🇵 日本株：${data.jp_weekly_trend}`,
      `🇺🇸 米国株：${data.us_weekly_trend}`,
      ``,
      `📅 重要イベント：`,
      ...data.key_events.map(e => `• ${e}`),
      ``,
      `⚡️ 今週の戦略：${data.swing_strategy}`,
      `✅ エントリー推奨：${data.best_entry_days}`,
      `❌ 避ける日：${data.avoid_days}`,
    ].join("\n"));

    // jp-stocks: 日本株ウォッチリスト
    await sendDiscord(WEBHOOKS.jp, [
      `🇯🇵 **今週の日本株スイングウォッチリスト**`,
      ``,
      ...data.jp_watchlist.map((s, i) =>
        `${i+1}. **${s.code} ${s.name}**（${s.timeframe}足）\n   ${s.reason}`
      ),
    ].join("\n"));

    // us-stocks: 米国株ウォッチリスト
    await sendDiscord(WEBHOOKS.us, [
      `🇺🇸 **今週の米国株スイングウォッチリスト**`,
      ``,
      ...data.us_watchlist.map((s, i) =>
        `${i+1}. **$${s.ticker} ${s.name}**（${s.timeframe}足）\n   ${s.reason}`
      ),
    ].join("\n"));

    // note-content: X投稿文＋Note冒頭
    await sendDiscord(WEBHOOKS.content, [
      `📝 **週間コンテンツ**`,
      ``,
      `**X投稿文：**`,
      `\`\`\``,
      data.x_post,
      `\`\`\``,
      ``,
      `**Note冒頭：**`,
      data.note_intro,
    ].join("\n"));

    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
