import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return url && key ? createClient(url, key) : null;
}

export async function GET() {
  const supabase = db();
  if (!supabase) return NextResponse.json({ configured: false, items: [] });
  const { data, error } = await supabase.from("shopping_items").select("id,text,done,source,created_at").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "shared storage not configured" }, { status: 503 });
  const text = String((await req.json())?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const { data, error } = await supabase.from("shopping_items").insert({ text, done: false, source: "app" }).select("id,text,done").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "shared storage not configured" }, { status: 503 });
  const body = await req.json();
  const { error } = await supabase.from("shopping_items").update({ done: Boolean(body.done) }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "shared storage not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
