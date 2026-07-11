/**
 * /api/earnings-alert
 * JP: TDnet RSS監視 → 決算サプライズ → スイング視点でDiscord通知
 * US: Yahoo Finance RSS監視 → 決算ビート → Discord通知
 * 重複対策: KVストア(Vercel KV) or フォールバックでURLベース管理
 */
import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DISCORD_EARNINGS = process.env.DISCORD_EARNINGS_ALERT;
const CRON_SECRET = process.env.CRON_SECRET;

// VercelKVが使えない場合のフォールバック用（実行間で共有できないが最低限の重複防止）
const sessionProcessed = new Set();

// JST日付取得ユーティリティ
function getJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    date: jst.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }),
    datetime: jst.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    raw: jst,
  };
}

// 重複チェック（Vercel KVがあればKV、なければセッション内Set）
async function isProcessed(guid) {
  // Vercel KV対応（環境変数KV_REST_API_URLがあれば使用）
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/processed:${encodeURIComponent(guid)}`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      });
      const data = await res.json();
      return data.result !== null;
    } catch {
      return sessionProcessed.has(guid);
    }
  }
  return sessionProcessed.has(guid);
}

async function markProcessed(guid) {
  sessionProcessed.add(guid);
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      // 24時間TTLで保存
      await fetch(`${process.env.KV_REST_API_URL}/set/processed:${encodeURIComponent(guid)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "1", ex: 86400 }),
      });
    } catch {}
  }
}

// ---- JP: TDnet RSS ----
const TDNET_RSS = "https://www.release.tdnet.info/inbs/I_list_001_20000101.rss";
const EARNINGS_KW = ["決算", "業績", "通期", "四半期", "上方修正", "下方修正", "営業利益", "純利益"];

async function fetchJPEarnings() {
  try {
    const res = await fetch(TDNET_RSS, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const items = [];
    for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const get = (tag) =>
        x.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s"))?.[1]?.trim() || "";
      items.push({
        title: get("title"),
        link: get("link"),
        pubDate: get("pubDate"),
        description: get("description"),
        guid: get("guid") || get("link"),
        market: "JP",
      });
    }
    return items.filter((i) => EARNINGS_KW.some((k) => `${i.title}${i.description}`.includes(k)));
  } catch {
    return [];
  }
}

// ---- US: Yahoo Finance RSS（決算カレンダー） ----
const US_RSS = "https://finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA&region=US&lang=en-US";
const US_EARNINGS_KW = ["earnings", "beat", "miss", "EPS", "revenue", "quarterly", "results", "guidance"];

async function fetchUSEarnings() {
  try {
    const res = await fetch(US_RSS, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const text = await res.text();
    const items = [];
    for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const get = (tag) =>
        x.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s"))?.[1]?.trim() || "";
      items.push({
        title: get("title"),
        link: get("link"),
        pubDate: get("pubDate"),
        description: get("description"),
        guid: get("guid") || get("link"),
        market: "US",
      });
    }
    return items.filter((i) =>
      US_EARNINGS_KW.some((k) => `${i.title}${i.description}`.toLowerCase().includes(k.toLowerCase()))
    );
  } catch {
    return [];
  }
}

// ---- Claude分析 ----
async function analyzeEarnings(item) {
  const isJP = item.market === "JP";
  const US_TICKERS = ["AAPL","MSFT","GOOGL","GOOG","AMZN","NVDA","META","TSLA","NFLX","AMD","INTC","DBX","CRM","SNOW","UBER","LYFT","COIN","SHOP"];
  const code = isJP
    ? (item.link.match(/(\d{4})/) || item.title.match(/[（(](\d{4})[）)]/))? .[1]
    : US_TICKERS.find(t => new RegExp(`\\b${t}\\b`).test(item.title) || new RegExp(`\\b${t}\\b`).test(item.description || ""))
      || item.link.match(/[?&]s=([A-Z]{1,5})/)?.[1]
      || null;

  const prompt = isJP
    ? `以下の日本株決算をスイングトレード視点で分析してください。
タイトル：${item.title}
コード：${code || "不明"}
web_searchで「${code} 決算 予想 結果」を検索して市場予想と比較し、
スイング（数日〜1週間）の観点でBEAT_FLAG: YES/NO/UNKNOWNと
60分足エントリーゾーン・損切り・目標を含む分析を返してください。
株クラ向けウィット口調で。
思考過程は不要。分析結果のみ出力してください。`
    : `以下の米国株ニュースをスイングトレード視点で分析してください。
タイトル：${item.title}
ティッカー：${code || "不明"}
${code ? `web_searchで「${code} earnings EPS beat miss estimate 2026」を検索して直近決算と市場予想を比較し、` : "ティッカーが特定できないためBEAT_FLAG: UNKNOWNを返してください。"}
スイング（数日〜1週間）の観点でBEAT_FLAG: YES/NO/UNKNOWNと
エントリーゾーン・損切り・目標を含む分析を日本語で返してください。
株クラ向けウィット口調で、数字・ティッカーは英語のままでOK。
思考過程・検索過程は不要。分析結果のみ出力してください。`;

  const r = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 600,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = r.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // 思考過程・検索過程を除去（"---"区切り以降の分析本文のみ抽出）
  let text = rawText;
  const separatorIdx = rawText.lastIndexOf("---");
  if (separatorIdx !== -1) {
    text = rawText.slice(separatorIdx).trim();
  } else {
    // "---"がない場合は"Let me"/"I need"/"Wait"等の思考行を除去
    text = rawText
      .split("\n")
      .filter(line => !/^(Let me|I need|Wait|Now I|Perfect|I see|Actually|Hmm|OK|Sure|Great)/i.test(line.trim()))
      .join("\n")
      .trim();
  }

  const beat = rawText.match(/BEAT_FLAG:\s*(YES|NO|UNKNOWN)/i)?.[1] || "UNKNOWN";
  return { text, beat, code };
}

// ---- Discord送信 ----
async function sendDiscord(item, analysis) {
  if (!DISCORD_EARNINGS) return;
  const { datetime } = getJST();
  const flag = item.market === "JP" ? "🇯🇵" : "🇺🇸";
  const body = `${flag} **決算サプライズ！スイング狙い目！**\n\n**${item.title}**\n🕐 ${datetime} JST\n\n${analysis.text
    .replace(/BEAT_FLAG:.*\n?/, "")
    .trim()
    .slice(0, 1400)}\n\n🔗 ${item.link}`.slice(0, 1900);

  await fetch(DISCORD_EARNINGS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: body }),
  });
}

// ---- メインハンドラ ----
export default async function handler(req, res) {
  // 認証
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { datetime } = getJST();
  let notified = 0;
  const results = { jp: { checked: 0, earnings: 0 }, us: { checked: 0, earnings: 0 } };

  // JP取得
  const jpItems = await fetchJPEarnings();
  results.jp.checked = jpItems.length;

  // US取得
  const usItems = await fetchUSEarnings();
  results.us.checked = usItems.length;

  // 全アイテムをまとめて処理（最大JP:3件、US:3件）
  const targets = [
    ...jpItems.slice(0, 3),
    ...usItems.slice(0, 3),
  ];

  for (const item of targets) {
    // 重複チェック
    if (await isProcessed(item.guid)) continue;
    await markProcessed(item.guid);

    const analysis = await analyzeEarnings(item);

    if (analysis.beat === "YES") {
      await sendDiscord(item, analysis);
      notified++;
      if (item.market === "JP") results.jp.earnings++;
      else results.us.earnings++;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  res.status(200).json({
    success: true,
    executedAt: datetime,
    jp: results.jp,
    us: results.us,
    notified,
  });
}
