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
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
    res.status(200).json({ text: data.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
