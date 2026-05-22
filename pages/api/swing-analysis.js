export const config = { maxDuration: 60 };

const WEBHOOKS = {
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
  market:  process.env.DISCORD_MARKET_WATCH,
  content: process.env.DISCORD_NOTE_CONTENT,
};

const SWING_PROMPT = `以下のJSON形式のみで回答してください。説明文・前置き・コードブロック不要。JSONのみ。

{
  "date": "2025/05/23",
  "week": "第1週",
  "market": {
    "jp_trend": "上昇",
    "us_trend": "上昇",
    "swing_env": "7",
    "comment": "相場コメント"
  },
  "jp_stocks": [
    {
      "code": "7203",
      "name": "トヨタ自動車",
      "type": "押し目買い",
      "weekly_trend": "上昇トレンド継続",
      "daily_support": "3500円",
      "entry_60min": "3520-3540円",
      "entry_30min": "3525円",
      "target": "3%",
      "stop_loss": "-2%",
      "hold_days": "3-5日",
      "best_entry_day": "月曜",
      "reason": "週足上昇トレンドで日足押し目形成中",
      "risk": "為替リスクあり",
      "score": 8
    }
  ],
  "us_stocks": [
    {
      "ticker": "NVDA",
      "name": "エヌビディア",
      "type": "上昇継続",
      "weekly_trend": "強い上昇トレンド",
      "entry_60min": "900-910ドル",
      "entry_30min": "905ドル",
      "target": "5%",
      "stop_loss": "-3%",
      "hold_days": "3-5日",
      "best_entry_day": "火曜",
      "reason": "AI需要継続で強い上昇トレンド",
      "risk": "決算リスク",
      "score": 9
    }
  ],
  "x_post": "X投稿文",
  "note_article": "Note記事本文"
}

今日の日付と実際の相場状況で日本株3銘柄・米国株3銘柄を埋めてください。JSONのみ返してください。`;

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
