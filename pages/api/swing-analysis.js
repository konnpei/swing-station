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

const SYSTEM_PROMPT = `あなたはスイングトレード専門アナリストです。
必ずJSONのみを返してください。思考過程・説明文は一切不要です。
マークダウンのコードブロックも不要です。純粋なJSONのみ返してください。`;

const ANALYSIS_PROMPT = `今日の日本株・米国株から、以下10パターンそれぞれに最も当てはまる銘柄を各1〜2銘柄ピックアップしてください。

web_searchで「日本株 今日 注目銘柄」「米国株 今日 決算 モメンタム」を検索してから回答してください。

パターン一覧：
1. イベントドリブン：決算・IR・指標発表前後の初動
2. 暴落銘柄：急落からの反発狙い（RSI30以下）
3. モメンタム：上昇トレンド継続・新高値ブレイク
4. 押し目買い：トレンド中の一時調整・移動平均線タッチ
5. 出来高急増：異常出来高で需給変化・仕手・機関買い
6. ギャップアップ：寄り付き窓開け後の継続狙い
7. セクターローテーション：資金移動の先読み
8. 清原式割安：PBR低・ROE高の放置小型バリュー株
9. 井村式急回復：赤字→黒字転換・業績ターンアラウンド
10. バフェット式：高ROE・経済的堀・優良大型株

以下のJSON形式で返してください：
{
  "date": "YYYY/MM/DD",
  "market_comment": "今日の相場一言コメント（40文字）",
  "patterns": [
    {
      "pattern_id": 1,
      "pattern_name": "イベントドリブン",
      "emoji": "📅",
      "stocks": [
        {
          "code": "コードまたはティッカー",
          "name": "銘柄名",
          "market": "JP or US",
          "entry": "エントリーゾーン",
          "target": "目標（例：+3%）",
          "stop": "損切り（例：-2%）",
          "reason": "選定理由（40文字）",
          "score": 8
        }
      ]
    }
  ],
  "investor_picks": {
    "kiyohara": {
      "name": "清原達郎式",
      "stocks": [
        {"code": "コード", "name": "銘柄名", "market": "JP", "pbr": "0.5倍", "roe": "15%", "reason": "理由（30文字）"}
      ]
    },
    "imura": {
      "name": "井村直哉式",
      "stocks": [
        {"code": "コード", "name": "銘柄名", "market": "JP", "reason": "理由（30文字）"}
      ]
    },
    "sis": {
      "name": "SIS式",
      "stocks": [
        {"code": "コード", "name": "銘柄名", "market": "JP", "reason": "理由（30文字）"}
      ]
    },
    "buffett": {
      "name": "バフェット式",
      "stocks": [
        {"ticker": "ティッカー", "name": "銘柄名", "market": "US", "roe": "20%", "reason": "理由（30文字）"}
      ]
    }
  },
  "x_post": "今日のスイング注目パターンX投稿文（140文字・#スイングトレード含む）"
}`;

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const dateStr = getJST();

    // Claude分析
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: ANALYSIS_PROMPT }],
    });

    const raw = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // 思考過程除去（---以降の本文を抽出）
    let clean = raw;
    const sepIdx = raw.lastIndexOf("---");
    if (sepIdx !== -1) clean = raw.slice(sepIdx + 3).trim();
    clean = clean.replace(/```json|```/g, "").trim();

    const data = JSON.parse(clean);

    // ---- Discord送信 ----

    // 1. 相場環境 + 全パターン概要（market-watch）
    const marketLines = [
      `📊 **${dateStr} JST｜今日のスイングパターン分析**`,
      ``,
      `💬 ${data.market_comment}`,
      ``,
      `**📋 今日のパターン一覧：**`,
    ];
    for (const p of data.patterns) {
      const stocks = p.stocks.map(s => `${s.code} ${s.name}`).join("・");
      marketLines.push(`${p.emoji} **${p.pattern_name}**：${stocks}`);
    }
    await sendDiscord(WEBHOOKS.market, marketLines.join("\n"));

    // 2. 日本株パターン詳細（jp-stocks）
    const jpPatterns = data.patterns.filter(p =>
      p.stocks.some(s => s.market === "JP")
    );
    const jpLines = [
      `🇯🇵 **本日の日本株スイングパターン詳細**`,
      ``,
    ];
    for (const p of jpPatterns) {
      const jpStocks = p.stocks.filter(s => s.market === "JP");
      if (jpStocks.length === 0) continue;
      jpLines.push(`${p.emoji} **${p.pattern_name}**`);
      for (const s of jpStocks) {
        jpLines.push(
          `　**${s.code} ${s.name}** スコア:${s.score}/10`,
          `　エントリー：${s.entry}｜目標：${s.target}｜損切：${s.stop}`,
          `　📌 ${s.reason}`,
          ``
        );
      }
    }
    jpLines.push("※投資判断は自己責任で。");
    await sendDiscord(WEBHOOKS.jp, jpLines.join("\n"));

    // 3. 米国株パターン詳細（us-stocks）
    const usPatterns = data.patterns.filter(p =>
      p.stocks.some(s => s.market === "US")
    );
    const usLines = [
      `🇺🇸 **本日の米国株スイングパターン詳細**`,
      ``,
    ];
    for (const p of usPatterns) {
      const usStocks = p.stocks.filter(s => s.market === "US");
      if (usStocks.length === 0) continue;
      usLines.push(`${p.emoji} **${p.pattern_name}**`);
      for (const s of usStocks) {
        usLines.push(
          `　**$${s.code} ${s.name}** スコア:${s.score}/10`,
          `　エントリー：${s.entry}｜目標：${s.target}｜損切：${s.stop}`,
          `　📌 ${s.reason}`,
          ``
        );
      }
    }
    usLines.push("※投資判断は自己責任で。");
    await sendDiscord(WEBHOOKS.us, usLines.join("\n"));

    // 4. 投資家スタイル判定（content）
    const ip = data.investor_picks;
    const investorLines = [
      `👑 **投資家スタイル別ピック**`,
      ``,
      `🏆 **清原達郎式**（割安小型バリュー）`,
      ...ip.kiyohara.stocks.map(s =>
        `　**${s.code} ${s.name}** PBR:${s.pbr} ROE:${s.roe}\n　📌 ${s.reason}`
      ),
      ``,
      `🚀 **井村直哉式**（業績急回復・テンバガー）`,
      ...ip.imura.stocks.map(s =>
        `　**${s.code} ${s.name}**\n　📌 ${s.reason}`
      ),
      ``,
      `⚡️ **SIS式**（需給・モメンタム）`,
      ...ip.sis.stocks.map(s =>
        `　**${s.code} ${s.name}**\n　📌 ${s.reason}`
      ),
      ``,
      `🇺🇸 **バフェット式**（高ROE・優良大型）`,
      ...ip.buffett.stocks.map(s =>
        `　**$${s.ticker} ${s.name}** ROE:${s.roe}\n　📌 ${s.reason}`
      ),
      ``,
      `**X投稿文：**`,
      `\`\`\``,
      data.x_post,
      `\`\`\``,
    ];
    await sendDiscord(WEBHOOKS.content, investorLines.join("\n"));

    res.status(200).json({
      success: true,
      executedAt: dateStr,
      patterns: data.patterns.length,
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
