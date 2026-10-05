import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const secret = process.env.ALEXA_SKILL_SECRET ?? "";

function speech(text: string) {
  return NextResponse.json({
    version: "1.0",
    response: { outputSpeech: { type: "PlainText", text }, shouldEndSession: true },
  });
}

export async function POST(req: NextRequest) {
  if (secret && req.headers.get("x-family-quest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!url || !key) return speech("ファミリークエストの共有保存設定がまだ完了していません。");

  const body = await req.json();
  const intent = body?.request?.intent;
  if (body?.request?.type === "LaunchRequest") return speech("ファミリークエストです。買うものを追加できます。");
  if (body?.request?.type !== "IntentRequest" || intent?.name !== "AddShoppingItemIntent") {
    return speech("買うものを追加して、と話してください。");
  }

  const item = String(intent?.slots?.item?.value ?? "").trim();
  if (!item) return speech("追加するものをもう一度教えてください。");

  const supabase = createClient(url, key);
  const { error } = await supabase.from("shopping_items").insert({ text: item, done: false, source: "alexa" });
  if (error) {
    console.error("Alexa shopping insert failed", error);
    return speech("追加できませんでした。設定を確認してください。");
  }
  return speech(`${item}をファミリークエストの買い物リストに追加しました。`);
}
