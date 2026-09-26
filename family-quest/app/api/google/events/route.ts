import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))?.[1];
}

async function accessToken(request: Request) {
  const current = cookieValue(request, 'google_access_token');
  if (current) return { token: current };
  const refresh = cookieValue(request, 'google_refresh_token');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  return r.ok && j.access_token ? { token: j.access_token, expires: Number(j.expires_in || 3600) } : null;
}

export async function POST(request: Request) {
  const auth = await accessToken(request);
  if (!auth) return NextResponse.json({ error: 'Google login required' }, { status: 401 });
  const body = await request.json();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const start = body.start || new Date().toISOString();
  const end = body.end || new Date(Date.parse(start) + 60 * 60 * 1000).toISOString();
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + auth.token, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: body.title, description: body.who ? '対象: ' + body.who : undefined, start: { dateTime: start, timeZone: 'Asia/Tokyo' }, end: { dateTime: end, timeZone: 'Asia/Tokyo' } }),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data.error?.message || 'Calendar API error' }, { status: r.status });
  const response = NextResponse.json({ ok: true, id: data.id, htmlLink: data.htmlLink });
  if (auth.expires) response.cookies.set('google_access_token', auth.token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:auth.expires });
  return response;
}
