import { NextRequest, NextResponse } from "next/server";
import { authorizedShop, sameOrigin, shopAuthConfigured, shoppingDb, validItem } from "../../../lib/shopping-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function denied(req: NextRequest) {
  if (!shopAuthConfigured()) return NextResponse.json({ error: "SHOPの保護設定がまだ完了していません。" }, { status: 503 });
  if (!authorizedShop(req)) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  if (req.method !== "GET" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}
const unavailable = () => NextResponse.json({ error: "共有リストに接続できません。時間をおいて再試行してください。" }, { status: 503 });
const invalid = () => NextResponse.json({ error: "入力を確認してください。" }, { status: 400 });
const validId = (id: unknown) => typeof id === "string" ? /^[1-9]\d{0,18}$/.test(id) : typeof id === "number" && Number.isSafeInteger(id) && id > 0;

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ configured: false, items: [] });
  const rejection = denied(req);
  if (rejection) return rejection;
  const db = shoppingDb();
  if (!db) return unavailable();
  const { data, error } = await db.from("shopping_items").select("id,text,done,source,created_at").order("created_at");
  if (error) return unavailable();
  return NextResponse.json({ configured: true, items: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: NextRequest) {
  const rejection = denied(req);
  if (rejection) return rejection;
  const db = shoppingDb();
  if (!db) return unavailable();
  try {
    const raw = await req.text();
    if (raw.length > 2048) return invalid();
    const text = JSON.parse(raw)?.text;
    if (!validItem(text)) return invalid();
    const { data, error } = await db.from("shopping_items").insert({ text: text.trim(), done: false, source: "app" }).select("id,text,done").single();
    return error ? unavailable() : NextResponse.json(data);
  } catch { return invalid(); }
}
export async function PATCH(req: NextRequest) {
  const rejection = denied(req);
  if (rejection) return rejection;
  const db = shoppingDb();
  if (!db) return unavailable();
  try {
    const raw = await req.text();
    if (raw.length > 2048) return invalid();
    const body = JSON.parse(raw);
    if (!validId(body?.id) || typeof body?.done !== "boolean") return invalid();
    const { error } = await db.from("shopping_items").update({ done: body.done }).eq("id", body.id);
    return error ? unavailable() : NextResponse.json({ ok: true });
  } catch { return invalid(); }
}
export async function DELETE(req: NextRequest) {
  const rejection = denied(req);
  if (rejection) return rejection;
  const db = shoppingDb();
  if (!db) return unavailable();
  const id = req.nextUrl.searchParams.get("id");
  if (!validId(id)) return invalid();
  const { error } = await db.from("shopping_items").delete().eq("id", id);
  return error ? unavailable() : NextResponse.json({ ok: true });
}
