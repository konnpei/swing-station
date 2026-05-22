export const config = { maxDuration: 60 };

const WEBHOOKS = {
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
  market:  process.env.DISCORD_MARKET_WATCH,
  content: process.env.DISCORD_NOTE_CONTENT,
};

const SWING_PROMPT = `あなたはスイングトレード（数日〜1週間）専門のアナリストです。

以下の手順で分析してJSONのみ返してください。前置き不要。

【分析手順】
1. web_searchで「日本株 スイングトレード 注目銘柄 今週」を検索
2. web_searchで「米国株 スイング 買い場 今週」を検索
3. web_searchで「日経平均 週足 トレンド 今週」を検索

【出力形式】
{
  "date": "YYYY/MM/DD",
  "week": "第N週",
  "market": {
    "jp_trend": "週足トレンド",
    "us_trend": "週足トレンド",
    "swing_env": "スイング環境スコア（1-10）",
    "comment": "今週の相場コメント（40文字以内）"
  },
  "jp_stocks": [
    {
      "code": "証券コード",
      "name": "銘柄名",
      "type": "上昇継続 or 押し目買い or 底値反転",
      "weekly_trend": "週足トレンド説明（20文字）",
      "daily_support": "日足サポートライン",
      "entry_60min": "60分足エントリーゾーン",
      "entry_30min": "30分足エントリーポイント",
      "target": "利確目標（%）",
      "stop_loss": "損切りライン（%）",
      "hold_days": "想定保有日数",
      "best_entry_day": "最適エントリー曜日",
      "reason": "選定理由（50文字）",
      "risk": "リスク（30文字）",
      "score": 8
    }
  ],
  "us_stocks": [
    {
      "ticker": "ティッカー",
      "name": "銘柄名",
      "type": "上昇継続 or 押し目買い or 底値反転",
      "weekly_trend": "週足トレンド説明（20文字）",
      "entry_60min": "60分足エントリーゾーン",
      "entry_30min": "30分足エントリーポイント",
      "target": "利確目標（%）",
      "stop_loss": "損切りライン（%）",
      "hold_days": "想定保有日数",
      "best_entry_day": "最適エントリー曜日",
      "reason": "選定理由（50文字）",
      "risk": "リスク（30文字）",
      "score": 8
    }
  ],
  "x_post": "X投稿文（140文字以内）",
  "note_article": "Note記事本文（1200文字程度）"
}

日本株3銘柄、米国株3銘柄を選定。`;

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
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: SWING_PROMPT }],
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
      "```",
      data.x_post,
      "```",
      "",
      "**Note記事：**",
      "```",
      data.note_article.slice(0, 800),
      "```",
    ].join("\n");
    await sendDiscord(WEBHOOKS.content, contentMsg);

    res.status(200).json({ success: true, date: data.date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
