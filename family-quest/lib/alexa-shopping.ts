import { SkillRequestSignatureVerifier } from "ask-sdk-express-adapter";

export type AlexaEnvelope = {
  session?: { application?: { applicationId?: string }; user?: { userId?: string } };
  context?: { System?: { application?: { applicationId?: string }; user?: { userId?: string } } };
  request?: { type?: string; timestamp?: string; requestId?: string; locale?: string;
    intent?: { name?: string; slots?: { item?: { value?: string } } } };
};

export async function verifyAlexa(raw: string, headers: Headers): Promise<AlexaEnvelope> {
  const body: AlexaEnvelope = JSON.parse(raw);
  const time = Date.parse(body?.request?.timestamp ?? "");
  // SDK timestamp verification does not reject future/invalid dates; check both directions.
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 150_000) throw new Error("Invalid timestamp");
  const certificate = new URL(headers.get("signaturecertchainurl") ?? "");
  certificate.hash = "";
  certificate.pathname = certificate.pathname.replace(/\/{2,}/g, "/");
  if (certificate.protocol !== "https:" || certificate.hostname !== "s3.amazonaws.com" ||
      (certificate.port && certificate.port !== "443") || !certificate.pathname.startsWith("/echo.api/") ||
      certificate.username || certificate.password || certificate.search) throw new Error("Invalid certificate URL");
  const signature = headers.get("signature-256");
  if (!signature || signature.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) throw new Error("Missing signature");
  // A fresh verifier rechecks certificate validity and the complete trusted CA chain every time.
  await new SkillRequestSignatureVerifier().verify(raw, {
    signaturecertchainurl: certificate.href, "signature-256": signature,
  });
  const skillId = process.env.ALEXA_SKILL_ID;
  const contextId = body.context?.System?.application?.applicationId;
  const sessionId = body.session?.application?.applicationId;
  if (!skillId || (contextId ?? sessionId) !== skillId || (sessionId && sessionId !== skillId)) throw new Error("Wrong skill");
  const allowed = (process.env.ALEXA_ALLOWED_USER_IDS ?? "").split(",").map(x => x.trim()).filter(Boolean);
  const userId = body.context?.System?.user?.userId ?? body.session?.user?.userId;
  if (!userId || !allowed.includes(userId) || (body.session?.user?.userId && body.session.user.userId !== userId)) throw new Error("Unauthorized user");
  if (!body.request?.requestId || body.request.requestId.length > 512) throw new Error("Invalid request ID");
  return body;
}

export function splitShoppingItems(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 600 || /[\u0000-\u001f\u007f]/.test(value)) return [];
  // Japanese 「と」 can be part of a product name (e.g. さとう); split only explicit separators.
  const items = value.split(/[、,，\n]+/).map(x => x.trim()).filter(Boolean);
  return items.length > 0 && items.length <= 10 && items.every(x => x.length <= 120) ? [...new Set(items)] : [];
}
