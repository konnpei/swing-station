import { NextRequest, NextResponse } from "next/server";
import { createShopSession, sameOrigin, SESSION_SECONDS, SHOP_COOKIE, shopAuthConfigured, validPassword } from "../../../../lib/shopping-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!shopAuthConfigured()) return NextResponse.json({ error: "SHOPのパスワード設定がまだ完了していません。" }, { status: 503 });
  try {
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({ error: "invalid input" }, { status: 400 });
    if (!validPassword(JSON.parse(raw)?.password)) return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SHOP_COOKIE, createShopSession(), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
      path: "/api/shopping", maxAge: SESSION_SECONDS,
    });
    return response;
  } catch { return NextResponse.json({ error: "invalid input" }, { status: 400 }); }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SHOP_COOKIE, "", { path: "/api/shopping", maxAge: 0 });
  return response;
}
