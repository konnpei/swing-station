export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages } = req.body;
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
        system: `あなたはスイングトレード（数日〜1週間）専門のAIアナリストです。
必ずweb_searchで最新の株価・相場情報を調べてから回答してください。
絶対に#や##などのMarkdown見出しを使わないこと。絵文字で見出しを表現すること。
スイング特化。株クラウィット口調。投資判断は自己責任。`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    res.status(200).json({ text: text || "応答なし" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
