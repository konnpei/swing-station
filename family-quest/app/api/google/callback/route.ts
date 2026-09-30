import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('cookie') || '';
  const savedState = cookie.match(/(?:^|;\s*)google_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/calendar-sample?google=error', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 500 });

  const redirectUri = new URL('/api/google/callback', request.url).toString();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) return NextResponse.redirect(new URL('/calendar-sample?google=error', request.url));

  const response = NextResponse.redirect(new URL('/calendar-sample?google=connected', request.url));
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  response.cookies.set('google_access_token', tokens.access_token, { ...opts, maxAge: Number(tokens.expires_in || 3600) });
  if (tokens.refresh_token) response.cookies.set('google_refresh_token', tokens.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 180 });
  response.cookies.delete('google_oauth_state');
  return response;
}
