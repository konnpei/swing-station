import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  for (const name of ['google_access_token', 'google_refresh_token', 'google_oauth_state']) response.cookies.delete(name);
  return response;
}
