import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `あなたはスイングトレード（数日〜1週間）専門のAIアナリストです。

銘柄コードや名前が来たら必ずweb_searchで「{コード} 株価 週足 トレンド 今日」「{コード} ニュース 材料」を調べてから回答してください。

回答フォーマット：
🎯 銘柄名（コード）
📊 現在値・週間騰落率
📈 週足トレンド：[上昇/下降/横ばい]
📉 日足状況：[押し目/上昇中/調整中]
⏱️ 60分足エントリーゾーン：
⏱️ 30分足エントリーポイント：
🗓️ 最適エントリー曜日：[月/火/水/木/金]
🎯 利確目標：+XX%（想定X〜X日）
🛑 損切りライン：-XX%
💡 スイング戦略（3点）
⚠️ リスク・注意点

スイング（数日〜1週間・月〜金）特化。株クラウィット口調。投資判断は自己責任。`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages } = req.body;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    let fullText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        fullText += block.text;
      }
    }

    res.status(200).json({ text: fullText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
