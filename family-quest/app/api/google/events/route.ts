import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const auth = await accessToken(request);
  if (!auth) return NextResponse.json({ error: 'Google login required' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const start = body.start || new Date().toISOString();
  if (!Number.isFinite(Date.parse(start))) return NextResponse.json({ error: '開始時刻を確認してください' }, { status: 400 });
  const end = body.end || new Date(Date.parse(start) + 60 * 60 * 1000).toISOString();
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 300 || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) return NextResponse.json({ error: '予定名と開始・終了時刻を確認してください' }, { status: 400 });
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

export async function GET(request: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: 'setup_required' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const auth = await accessToken(request);
    if (!auth) return NextResponse.json({ error: 'login_required' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 86400000).toISOString();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: 'Asia/Tokyo' });
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events?' + params, { headers: { authorization: 'Bearer ' + auth.token }, cache: 'no-store' });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: r.status === 401 ? 'login_required' : 'calendar_error' }, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
    const events = (data.items || []).filter((e: { status?: string }) => e.status !== 'cancelled').map((e: { id: string; summary?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; htmlLink?: string }) => ({ id: e.id, title: e.summary || '（タイトルなし）', start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, allDay: Boolean(e.start?.date), htmlLink: e.htmlLink }));
    const response = NextResponse.json({ events, hasMore: Boolean(data.nextPageToken) }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (auth.expires) response.cookies.set('google_access_token', auth.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: auth.expires });
    return response;
  } catch { return NextResponse.json({ error: 'calendar_error' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
}
