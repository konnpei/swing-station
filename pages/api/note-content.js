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
JSONのみ返してください。思考過程・説明文は不要です。`;

const ANALYSIS_PROMPT = `今日の相場をweb_searchで調べて、以下のJSONを返してください。

検索キーワード：「日経平均 今日 騰落率」「半導体 AI セクター 今日」

相場モード判定基準：
- 爆騰モード：日経+1.5%以上 or 主要銘柄の出来高急増
- 暴落モード：日経-2%以上 or リスクオフ加速
- AIバブルモード：半導体・AI関連セクター+3%以上が主導
- 通常モード：上記以外

{
  "mode": "通常 or 爆騰 or 暴落 or AIバブル",
  "nikkei_change": "+1.2%",
  "market_summary": "相場概況（50文字）",
  "mode_reason": "このモードと判定した理由（30文字）",
  "bull_bear": "ブル優勢 or ベア優勢 or 均衡",
  "note_title": "今日のNote記事タイトル",
  "note_body": "Note記事本文（相場概況・注目銘柄3つ・今週の戦略・リスク注意点を含む2000文字程度・絵文字使用・マークダウン#不使用）",
  "x_post": "X投稿文（140文字・#スイングトレード含む）"
}`;

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

export default async function handler(req, res) {
  if (req.method !== "POST" && req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).end();
    }
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
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: ANALYSIS_PROMPT }],
      }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));

    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

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

    // note-content: Note記事案 + X投稿文
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
    res.status(500).json({ error: e.message });
  }
}
