/**
 * /api/investor-picks
 * 毎朝6:35（JST）に実行（swing-analysisの5分後）
 * 清原・井村・SIS・バフェット式銘柄判定 → Discord通知
 */

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
  const authHeader = req.headers.auth
