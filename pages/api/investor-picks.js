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

const PROMPT = `スイングトレード専門アナリストとして、以下4人の投資家スタイルの厳格な判定条件を満たす銘柄のみをピックアップしてください。

web_searchで「日本株 割安 小型株 PBR ROE 黒字」「米国株 高ROE 優良株 堀 2026」を検索して回答。
条件を満たさない銘柄は絶対に選ばないこと。JSONのみ返してください。思考過程不要。

【判定条件】

💎 清原達郎式（割安小型バリュー）
必須条件：
- PBR 0.5倍以下
- EPS黒字（直近本決算）
- 自己資本比率40%以上
- 時価総額50億円以上
除外：赤字企業・無配3期以上・金融株・上場廃止リスク

🏛️ バフェット式（優良大型・経済的堀）
必須条件：
- ROE 3期連続15%以上
- 営業利益率10%以上
- 自己資本比率40%以上
- 直近3期で2期以上増収or増益
除外：赤字・有利子負債過多・事業構造変革中

🚀 井村直哉式（業績急回復）
必須条件：
- 直近四半期営業利益が前年同期比+30%以上
- 2期連続改善
- 株価が直近安値から+20%以内（初動であること）
除外：既に急騰済み・一過性特益による黒字

⚡️ SIS式（需給・モメンタム）
必須条件：
- 出来高が20日平均の2倍以上
- 株価が25日移動平均線より上
- 直近5日で陽線が多い
除外：低位仕手株・時価総額20億円未満

【共通除外条件】
- 直近に不祥事・訴訟リスクあり
- 上場廃止審査中
- 時価総額20億円未満

条件を満たす銘柄が見つからない場合は stocks を空配列にしてください。

JSONフォーマット：
{
  "kiyohara": {
    "label": "清原達郎式",
    "stocks": [
      {
        "code": "コード",
        "name": "銘柄名",
        "pbr": "0.4倍",
        "roe": "12%",
        "eps": "黒字",
        "equity_ratio": "45%",
        "market_cap": "80億円",
        "reason": "選定理由（条件を満たす根拠を明記・30文字）"
      }
    ]
  },
  "buffett": {
    "label": "バフェット式",
    "stocks": [
      {
        "ticker": "ティッカー",
        "name": "銘柄名",
        "roe": "18%",
        "op_margin": "12%",
        "equity_ratio": "50%",
        "reason": "選定理由（条件を満たす根拠を明記・30文字）"
      }
    ]
  },
  "imura": {
    "label": "井村直哉式",
    "stocks": [
      {
        "code": "コード",
        "name": "銘柄名",
        "op_profit_growth": "+45%",
        "consecutive_improvement": "2期連続",
        "price_from_low": "+15%",
        "reason": "選定理由（条件を満たす根拠を明記・30文字）"
      }
    ]
  },
  "sis": {
    "label": "SIS式",
    "stocks": [
      {
        "code": "コード",
        "name": "銘柄名",
        "volume_ratio": "2.5倍",
        "ma25": "上抜け",
        "reason": "選定理由（条件を満たす根拠を明記・30文字）"
      }
    ]
  },
  "x_post": "投資家スタイル別ピックX投稿文（140文字・#スイングトレード含む・条件を満たした銘柄のみ掲載）"
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
      system: `あなたは厳格なスクリーニングを行う投資アナリストです。
各投資家スタイルの判定条件を必ず満たす銘柄のみを選定してください。
条件を満たさない銘柄は絶対に選ばないこと。
JSONのみ返してください。`,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: PROMPT }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    // jp-stocks: 清原・井村・SIS
    const jpLines = [
      `👑 **${dateStr} JST｜投資家スタイル別厳選ピック**`, ``,
      `💎 **${data.kiyohara.label}**（PBR0.5↓・黒字・自己資本40%↑）`,
    ];
    if (data.kiyohara.stocks.length === 0) {
      jpLines.push(`　本日は条件を満たす銘柄なし`);
    } else {
      data.kiyohara.stocks.forEach(s => {
        jpLines.push(
          `　**${s.code} ${s.name}**`,
          `　PBR:${s.pbr} ROE:${s.roe} 自己資本:${s.equity_ratio} 時価総額:${s.market_cap}`,
          `　📌 ${s.reason}`, ``
        );
      });
    }

    jpLines.push(``, `🚀 **${data.imura.label}**（営業利益+30%・2期連続改善）`);
    if (data.imura.stocks.length === 0) {
      jpLines.push(`　本日は条件を満たす銘柄なし`);
    } else {
      data.imura.stocks.forEach(s => {
        jpLines.push(
          `　**${s.code} ${s.name}**`,
          `　利益成長:${s.op_profit_growth} ${s.consecutive_improvement} 安値比:${s.price_from_low}`,
          `　📌 ${s.reason}`, ``
        );
      });
    }

    jpLines.push(``, `⚡️ **${data.sis.label}**（出来高2倍↑・25MA上抜け）`);
    if (data.sis.stocks.length === 0) {
      jpLines.push(`　本日は条件を満たす銘柄なし`);
    } else {
      data.sis.stocks.forEach(s => {
        jpLines.push(
          `　**${s.code} ${s.name}**`,
          `　出来高比:${s.volume_ratio} 25MA:${s.ma25}`,
          `　📌 ${s.reason}`, ``
        );
      });
    }
    jpLines.push(`※投資判断は自己責任で。条件非充足銘柄は掲載しません。`);
    await sendDiscord(WEBHOOKS.jp, jpLines.join("\n"));

    // us-stocks: バフェット式
    const usLines = [
      `🏛️ **${data.buffett.label}**（ROE15%↑・営業利益率10%↑）`, ``
    ];
    if (data.buffett.stocks.length === 0) {
      usLines.push(`　本日は条件を満たす銘柄なし`);
    } else {
      data.buffett.stocks.forEach(s => {
        usLines.push(
          `　**$${s.ticker} ${s.name}**`,
          `　ROE:${s.roe} 営業利益率:${s.op_margin} 自己資本:${s.equity_ratio}`,
          `　📌 ${s.reason}`, ``
        );
      });
    }
    usLines.push(`※投資判断は自己責任で。`);
    await sendDiscord(WEBHOOKS.us, usLines.join("\n"));

    // note-content: X投稿文
    await sendDiscord(WEBHOOKS.content, [
      `📝 **投資家スタイル別厳選ピック X投稿文**`, ``,
      `\`\`\``, data.x_post, `\`\`\``,
    ].join("\n"));

    res.status(200).json({ success: true, executedAt: dateStr });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
