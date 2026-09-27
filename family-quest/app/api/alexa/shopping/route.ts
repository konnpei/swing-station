import { NextRequest, NextResponse } from "next/server";
import { shoppingDb } from "../../../../lib/shopping-server";
import { splitShoppingItems, verifyAlexa } from "../../../../lib/alexa-shopping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function speech(text: string, end = false) {
  return NextResponse.json({ version: "1.0", response: {
    outputSpeech: { type: "PlainText", text }, shouldEndSession: end,
    ...(!end ? { reprompt: { outputSpeech: { type: "PlainText", text: "牛乳追加、のように話してください。終わる場合は、ストップと言ってください。" } } } : {}),
  } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 128 * 1024) throw new Error("Request too large");
    body = await verifyAlexa(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "Invalid Alexa request" }, { status: 400 });
  }
  const request = body.request!;
  if (request.type === "SessionEndedRequest") return NextResponse.json({ version: "1.0", response: {} });
  if (request.type === "LaunchRequest") return speech("ファミリークエストです。牛乳追加、のように買うものを教えてください。");
  const intent = request.intent;
  if (intent?.name === "AMAZON.StopIntent" || intent?.name === "AMAZON.CancelIntent") return speech("ファミリークエストを終了します。", true);
  if (request.type !== "IntentRequest" || intent?.name !== "AddShoppingItemIntent") return speech("牛乳追加、のように話してください。続けて卵追加、と話すこともできます。");
  const items = splitShoppingItems(intent.slots?.item?.value);
  if (!items.length) return speech("追加するものを短い商品名でもう一度教えてください。");
  const db = shoppingDb();
  if (!db) return speech("共有リストの保存設定がまだ完了していません。", true);
  // One database transaction records the request ID and inserts all items, preventing retry duplicates.
  const { error } = await db.rpc("add_alexa_shopping_items", { p_request_id: request.requestId, p_items: items });
  if (error) return speech("保存を確認できませんでした。少し待ってからもう一度お試しください。", true);
  return speech(`${items.join("、")}をファミリークエストの買い物リストに追加しました。ほかに追加するものはありますか。`);
}
