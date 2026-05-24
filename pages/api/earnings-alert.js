/**
 * /api/earnings-alert
 * TDnet RSS監視 → 決算サプライズ → スイング視点でDiscord通知
 */
import Anthropic from "@anthropic-ai/sdk";
export const config = { maxDuration: 60 };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DISCORD_EARNINGS = process.env.DISCORD_EARNINGS_ALERT;
const TDNET_RSS = "https://www.release.tdnet.info/inbs/I_list_001_20000101.rss";
const EARNINGS_KW = ["決算","業績","通期","四半期","上方修正","下方修正","営業利益","純利益"];
const processed = new Set();

async function fetchRSS() {
  try {
    const res = await fetch(TDNET_RSS, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const items = [];
    for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const get = (tag) => x.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s"))?.[1]?.trim() || "";
      items.push({ title: get("title"), link: get("link"), pubDate: get("pubDate"), description: get("description"), guid: get("guid") || get("link") });
    }
    return items;
  } catch { return []; }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const items = await fetchRSS();
  const earnings = items.filter(i => EARNINGS_KW.some(k => `${i.title}${i.description}`.includes(k)));
  const newItems = earnings.filter(i => !processed.has(i.guid)).slice(0, 3);
  let notified = 0;
  for (const item of newItems) {
    processed.add(item.guid);
    const code = (item.link.match(/(\d{4})/) || item.title.match(/[（(](\d{4})[）)]/))? .[1];
    const r = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `以下の決算をスイングトレード視点で分析してください。
タイトル：${item.title}
コード：${code || "不明"}
web_searchで「${code} 決算 予想 結果」を検索して市場予想と比較し、
スイング（数日〜1週間）の観点でBEAT_FLAG: YES/NO/UNKNOWNと
60分足エントリーゾーン・損切り・目標を含む分析を返してください。
株クラ向けウィット口調で。`
      }],
    });
    const text = r.content.filter(b => b.type === "text").map(b => b.text).join("");
    const beat = text.match(/BEAT_FLAG:\s*(YES|NO|UNKNOWN)/i)?.[1] || "UNKNOWN";
    if (beat === "YES" && DISCORD_EARNINGS) {
      await fetch(DISCORD_EARNINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🔥 **決算サプライズ！スイング狙い目！**\n\n**${item.title}**\n🕐 ${item.pubDate}\n\n${text.replace(/BEAT_FLAG:.*\n?/, "").trim().slice(0, 1400)}\n\n🔗 ${item.link}`.slice(0, 1900)
        }),
      });
      notified++;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  res.status(200).json({ success: true, checked: items.length, earnings: earnings.length, notified });
}
