import crypto from "node:crypto";

const secret = () => process.env.PRIVATE_SESSION_SECRET || "";
const owner = () => (process.env.PRIVATE_OWNER_EMAIL || "").trim().toLowerCase();
export const configured = () => Boolean(secret().length >= 32 && owner() && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.RESEND_API_KEY && process.env.PRIVATE_EMAIL_FROM);
export const isOwner = (email) => Boolean(owner() && typeof email === "string" && email.trim().toLowerCase() === owner());
const sign = (value) => crypto.createHmac("sha256", secret()).update(value).digest("base64url");
export function issueSession() {
  if (!configured()) throw new Error("Private authentication not configured");
  const payload = Buffer.from(JSON.stringify({ sub: "owner", exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + sign(payload);
}
export function validSession(cookie) {
  if (!configured() || typeof cookie !== "string") return false;
  const parts = cookie.split(".");
  if (parts.length !== 2) return false;
  const expected = sign(parts[0]);
  const actual = parts[1];
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return data.sub === "owner" && Number.isFinite(data.exp) && data.exp > Date.now();
  } catch { return false; }
}
export async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Authentication store unavailable");
  const body = await response.json();
  if (body.error) throw new Error("Authentication store unavailable");
  return body.result;
}
export const tokenKey = (token) => "kabubocchi:login:" + crypto.createHash("sha256").update(token).digest("hex");
export const sessionCookie = "kb_private_session";
