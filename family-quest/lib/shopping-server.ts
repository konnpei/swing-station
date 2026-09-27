import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const SHOP_COOKIE = "family-quest-shop";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function shoppingDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function password() {
  const value = process.env.SHOP_PASSWORD ?? "";
  return value.length >= 20 ? value : "";
}

export function shopAuthConfigured() { return Boolean(password()); }

export function validPassword(value: unknown) {
  if (!password() || typeof value !== "string" || value.length > 512) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(value), digest(password()));
}

function sign(payload: string) {
  return createHmac("sha256", password()).update(`family-quest-shop:${payload}`).digest("hex");
}

export function createShopSession() {
  if (!password()) throw new Error("Shopping authentication is not configured");
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${expiry}.${sign(expiry)}`;
}

export function authorizedShop(req: NextRequest) {
  if (!password()) return false;
  const value = req.cookies.get(SHOP_COOKIE)?.value ?? "";
  const [expiry, signature, extra] = value.split(".");
  if (extra || !/^\d{10}$/.test(expiry ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "")) return false;
  const remaining = Number(expiry) - Math.floor(Date.now() / 1000);
  return remaining > 0 && remaining <= SESSION_SECONDS && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(expiry), "hex"));
}

export function sameOrigin(req: NextRequest) {
  return req.headers.get("origin") === req.nextUrl.origin;
}

export function validItem(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
}
