import crypto from "node:crypto";
import { configured, isOwner, redis, tokenKey } from "../../../lib/privateAuth";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!configured()) return res.status(503).json({ error: "認証設定が未完了です" });
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const generic = { message: "登録されたアドレスの場合、ログイン用メールを送信します。" };
  if (!isOwner(email)) return res.status(200).json(generic);
  try {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const limitKey = "kabubocchi:auth-rate:" + crypto.createHash("sha256").update(ip).digest("hex");
    const allowed = await redis(["SET", limitKey, "1", "EX", 60, "NX"]);
    if (allowed !== "OK") return res.status(200).json(generic);
    const token = crypto.randomBytes(32).toString("base64url");
    await redis(["SET", tokenKey(token), "1", "EX", 600]);
    const origin = "https://" + req.headers.host;
    if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) throw new Error("Invalid origin");
    const url = origin + "/api/private/verify?token=" + encodeURIComponent(token);
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.PRIVATE_EMAIL_FROM, to: [email], subject: "KabuBocchi 個人画面ログイン", text: "10分間有効なログインリンクです。\n" + url }),
    });
    if (!sent.ok) throw new Error("Mail delivery failed");
    return res.status(200).json(generic);
  } catch (error) {
    console.error("Private login request failed", error.message);
    return res.status(503).json({ error: "メール送信に失敗しました。時間をおいてお試しください。" });
  }
}
