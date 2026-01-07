import { hmacSign, timingSafeEqualHex } from "@/lib/crypto";

const COOKIE_NAME = "cmw_session";

type SessionPayload = {
  userId: string;
  exp: number; // unix ms
};

export function createSessionCookieValue(payload: SessionPayload) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = hmacSign(body, secret);
  return `${body}.${sig}`;
}

export function parseSessionCookieValue(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;

  const secret = process.env.APP_SECRET;
  if (!secret) return null;

  const expected = hmacSign(body, secret);
  if (!timingSafeEqualHex(expected, sig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;

    if (Date.now() > parsed.exp) return null;
    if (typeof parsed.userId !== "string") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(value: string) {
  const isProd = process.env.NODE_ENV === "production";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    7 * 24 * 3600
  }; ${isProd ? "Secure;" : ""}`;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
