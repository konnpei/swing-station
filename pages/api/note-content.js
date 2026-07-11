/**
 * /api/note-content
 * 毎朝6:30（JST）に実行
 * 相場モードを自動判定 → 4パターンのキャラクター通知 + Note記事案
 */

const WEBHOOK = process.env.DISCORD_NOTE_CONTENT;
const MARKET_WEBHOOK = process.env.DISCORD_MARKET_WATCH;

export const config = { maxDuration: 60 };

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

const SYSTEM_PROMPT = `あなたはスイングトレード専門のNoteライターです。
必ずJSONのみ返してください。
説明文・マークダウン・コードブロック（\`\`\`）は絶対に使わないでください。
最初の文字は必ず{で始め、最後の文字は}で終わってください。`;

const ANALYSIS_PROMPT = `以下のJSON形式のみで返してください。キーや構造は変えないでください。

{
  "mode": "通常",
  "nikkei_change": "+0.5%",
  "market_summary": "今日の相場概況を50文字で",
  "mode_reason": "このモードと判定した理由を30文字で",
  "bull_bear": "ブル優勢",
  "note_title": "今日のNote記事タイトル",
  "note_body": "Note記事本文。注目銘柄3つ・今週の戦略・リスク注意点を含む2000文字程度。絵文字使用。マークダウン#不使用。",
  "x_post": "X投稿文140文字以内。#スイングトレード含む。"
}

相場モード判定基準：
- 爆騰モード：日経+1.5%以上 or 主要銘柄の出来高急増
- 暴落モード：日経-2%以上 or リスクオフ加速
- AIバブルモード：半導体・AI関連セクター+3%以上が主導
- 通常モード：上記以外

今日の日付・相場状況をもとに判断してください。`;

function getModeVisual(mode) {
  switch(mode) {
    case "爆騰":
      return {
        header: "🟢 **爆騰モード｜強い！！資金集中！！**",
        sub: "📈 上昇トレンド加速中",
        icons: "🚀 出来高急増　🔥 材料強い　💰 資金流入",
        bull: "🐂💨",
        tone: "強気全開！チャンスを逃すな！"
      };
    case "暴落":
      return {
        header: "🔴 **暴落モード｜危険信号 暴落警戒！！**",
        sub: "📉 リスクオフ加速中",
        icons: "⚠️ 下落トレンド　❗ 材料悪化　📊 出来高急増（売り）",
        bull: "🐻⚡",
        tone: "要注意！守りを固めろ！"
      };
    case "AIバブル":
      return {
        header: "🟣 **AIバブルモード｜AI相場 再加速！！**",
        sub: "🤖 半導体・AI関連が強い",
        icons: "💡 テーマ再燃　💰 資金流入　🔭 成長期待",
        bull: "🐂🤖",
        tone: "AI・半導体に資金集中！要チェック！"
      };
    default:
      return {
        header: "🔵 **通常モード｜今日の決算速報**",
        sub: "⚖️ ブル vs ベア 勝つのはどっち？",
        icons: "📊 増収増益銘柄　📋 決算・材料　📈 株価・出来高　🤖 AI自動分析",
        bull: "🐂⚔️🐻",
        tone: "今日も冷静に分析！"
      };
  }
}

function extractJSON(text) {
  // {から}までを抽出（ネストに対応）
  const start = text.indexOf("{");
  if (start === -1) throw new Error("JSONの開始が見つかりません");
  
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  
  if (end === -1) throw new Error("JSONの終端が見つかりません");
  
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

export default async function handler(req, res) {
  // 認証チェック（GET/POST問わず常にCRON_SECRETを要求）
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  try {
    const dateStr = getJST();

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: ANALYSIS_PROMPT }],
      }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));

    // テキストブロックのみ結合
    const raw = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // JSON抽出（堅牢なパース）
    const result = extractJSON(raw);

    const visual = getModeVisual(result.mode);

    // market-watch: モードアラート
    const modeMsg = [
      `${visual.header}`,
      `${visual.bull} ${dateStr} JST`,
      ``,
      `${visual.sub}`,
      `💬 ${result.market_summary}`,
      `📊 日経：${result.nikkei_change} | ${result.bull_bear}`,
      ``,
      `${visual.icons}`,
      ``,
      `⚡️ ${visual.tone}`,
      `📌 判定理由：${result.mode_reason}`,
    ].join("\n");
    await sendDiscord(MARKET_WEBHOOK, modeMsg);

    // note-content: Note記事案
    const noteMsg = [
      `📝 **${result.note_title}**`,
      ``,
      result.note_body.slice(0, 1500),
      result.note_body.length > 1500 ? "\n（続きはアプリで確認）" : "",
    ].join("\n");
    await sendDiscord(WEBHOOK, noteMsg);

    // X投稿文
    await sendDiscord(WEBHOOK, [
      `🐦 **X投稿文：**`,
      `\`\`\``,
      result.x_post,
      `\`\`\``,
    ].join("\n"));

    res.status(200).json({ ok: true, mode: result.mode, executedAt: dateStr });

  } catch (e) {
    await sendDiscord(WEBHOOK, `❌ エラー発生：${e.message.slice(0, 200)}`);
    res.status(500).json({ error: e.message });
  }
}
