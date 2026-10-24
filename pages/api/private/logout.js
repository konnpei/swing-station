import { sessionCookie } from "../../../lib/privateAuth";
export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", sessionCookie + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  return res.redirect(303, "/private");
}
