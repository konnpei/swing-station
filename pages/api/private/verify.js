import { configured, redis, tokenKey, issueSession, sessionCookie } from "../../../lib/privateAuth";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();
  const token = req.query.token;
  if (!configured() || typeof token !== "string" || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) return res.redirect(302, "/private?error=invalid");
  try {
    const result = await redis(["GETDEL", tokenKey(token)]);
    if (result !== "1") return res.redirect(302, "/private?error=expired");
    res.setHeader("Set-Cookie", sessionCookie + "=" + issueSession() + "; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax");
    return res.redirect(302, "/private");
  } catch { return res.redirect(302, "/private?error=unavailable"); }
}
