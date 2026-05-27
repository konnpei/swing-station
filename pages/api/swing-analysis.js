/**
 * /api/swing-analysis
 * 毎朝6:30（JST）に実行
 * 10パターンのスイングトレード銘柄を分析 → Discord通知
 */

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEBHOOKS = {
  market:  process.env.DISCORD_MARKET_WATCH,
  jp:      process.env.DISCORD_JP_STOCKS,
  us:      process.env.DISCORD_US_STOCKS,
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

const PROMPT = `スイングトレード専門アナリストとして今日の注目銘柄を分析してください。

web_searchで「日本株 今日 注目銘柄 スイング」「米国株 今日 モメンタム 決算」を検索して回答してください。
JSONのみ返してください。思考過程・説明文は不要です。

以下10パターン、各1銘柄をピックアップ：
1. イベントドリブン（決算・IR前後）
2. 暴落銘柄（RSI30以下・反発狙い）
3. モメンタム（新高値ブレイク）
4. 押し目買い（移動平均線タッチ）
5. 出来高急増（異常出来高）
6. ギャップアップ（窓開け継続）
7. セクターローテーション（資金移動）
8. 清原式割安（PBR低・ROE高）
9. 井村式急回復（赤字→黒字転換）
10. バフェット式（高ROE・優良大型）

JSONフォーマット：
{
  "date": "YYYY/MM/DD",
  "market_comment": "今日の相場一言（40文字）",
  "patterns": [
    {
      "id": 1,
      "name": "イベントドリブン",
      "emoji": "📅",
      "code": "コードまたはティッカー",
      "stock_name": "銘柄名",
      "market": "JP or US",
      "entry": "エントリーゾーン",
      "target": "+3%",
      "stop": "-2%",
      "reason": "選定理由（40文字）",
      "score": 8
    }
  ]
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

    // market-watch: 概要一覧
    const marketLines = [
      `📊 **${dateStr} JST｜スイングパターン分析**`,
      `💬 ${data.market_comment}`,
      ``,
      ...data.patterns.map(p =>
        `${p.emoji} **${p.name}**：${p.code} ${p.stock_name}（スコア:${p.score}/10）`
      ),
    ];
    await sendDiscord(WEBHOOKS.market, marketLines.join("\n"));

    // jp-stocks: 日本株詳細
    const jpStocks = data.patterns.filter(p => p.market === "JP");
    if (jpStocks.length > 0) {
      const jpLines = [`🇯🇵 **本日の日本株スイングパターン**`, ``];
      for (const p of jpStocks) {
        jpLines.push(
          `${p.emoji} **${p.name}**`,
          `　**${p.code} ${p.stock_name}** スコア:${p.score}/10`,
          `　エントリー：${p.entry}｜目標：${p.target}｜損切：${p.stop}`,
          `　📌 ${p.reason}`,
          ``
        );
      }
      jpLines.push("※投資判断は自己責任で。");
      await sendDiscord(WEBHOOKS.jp, jpLines.join("\n"));
    }

    // us-stocks: 米国株詳細
    const usStocks = data.patterns.filter(p => p.market === "US");
    if (usStocks.length > 0) {
      const usLines = [`🇺🇸 **本日の米国株スイングパターン**`, ``];
      for (const p of usStocks) {
        usLines.push(
          `${p.emoji} **${p.name}**`,
          `　**$${p.code} ${p.stock_name}** スコア:${p.score}/10`,
          `　エントリー：${p.entry}｜目標：${p.target}｜損切：${p.stop}`,
          `　📌 ${p.reason}`,
          ``
        );
      }
      usLines.push("※投資判断は自己責任で。");
      await sendDiscord(WEBHOOKS.us, usLines.join("\n"));
    }

    res.status(200).json({ success: true, executedAt: dateStr, patterns: data.patterns.length });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
