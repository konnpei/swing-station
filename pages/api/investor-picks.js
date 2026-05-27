import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEBHOOKS = {
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
  content: process.env.DISCORD_NOTE_CONTENT,
};

function getJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

async function sendDiscord(url, content) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  });
}

const PROMPT = `スイングトレード専門アナリストとして、以下4人の投資家スタイルに合う銘柄を各3銘柄ピックアップしてください。

web_searchで「日本株 割安 小型株 PBR低」「米国株 高ROE 優良株 2026」を検索して回答。
JSONのみ返してください。思考過程不要。

{
  "kiyohara": {
    "label": "清原達郎式",
    "description": "割安小型バリュー・PBR低・ROE高",
    "stocks": [
      {"code": "コード", "name": "銘柄名", "pbr": "0.5倍", "roe": "15%", "reason": "理由（30文字）"}
    ]
  },
  "imura": {
    "label": "井村直哉式",
    "description": "業績急回復・テンバガー候補",
    "stocks": [
      {"code": "コード", "name": "銘柄名", "reason": "理由（30文字）"}
    ]
  },
  "sis": {
    "label": "SIS式",
    "description": "需給・板読み・短期モメンタム",
    "stocks": [
      {"code": "コード", "name": "銘柄名", "reason": "理由（30文字）"}
    ]
  },
  "buffett": {
    "label": "バフェット式",
    "description": "高ROE・経済的堀・優良大型",
    "stocks": [
      {"ticker": "ティッカー", "name": "銘柄名", "roe": "20%", "reason": "理由（30文字）"}
    ]
  },
  "x_post": "投資家スタイル別ピックX投稿文（140文字・#スイングトレード含む）"
}`;

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const dateStr = getJST();

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: "You are a JSON generator. Respond with valid JSON only. No text outside JSON.",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: PROMPT }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    const jpLines = [
      `👑 **${dateStr} JST｜投資家スタイル別ピック（JP）**`, ``,
      `🏆 **${data.kiyohara.label}**（${data.kiyohara.description}）`,
      ...data.kiyohara.stocks.map(s =>
        `　**${s.code} ${s.name}** PBR:${s.pbr} ROE:${s.roe}\n　📌 ${s.reason}`
      ),
      ``,
      `🚀 **${data.imura.label}**（${data.imura.description}）`,
      ...data.imura.stocks.map(s =>
        `　**${s.code} ${s.name}**\n　📌 ${s.reason}`
      ),
      ``,
      `⚡️ **${data.sis.label}**（${data.sis.description}）`,
      ...data.sis.stocks.map(s =>
        `　**${s.code} ${s.name}**\n　📌 ${s.reason}`
      ),
      ``,
      `※投資判断は自己責任で。`,
    ];
    await sendDiscord(WEBHOOKS.jp, jpLines.join("\n"));

    const usLines = [
      `🇺🇸 **${data.buffett.label}**（${data.buffett.description}）`, ``,
      ...data.buffett.stocks.map(s =>
        `　**$${s.ticker} ${s.name}** ROE:${s.roe}\n　📌 ${s.reason}`
      ),
      ``,
      `※投資判断は自己責任で。`,
    ];
    await sendDiscord(WEBHOOKS.us, usLines.join("\n"));

    await sendDiscord(WEBHOOKS.content, [
      `📝 **投資家スタイル別ピック X投稿文**`, ``,
      `\`\`\``, data.x_post, `\`\`\``,
    ].join("\n"));

    res.status(200).json({ success: true, executedAt: dateStr });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
