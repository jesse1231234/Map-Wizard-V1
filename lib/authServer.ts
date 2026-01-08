// lib/authServer.ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";

function normalize(v: string | undefined) {
  return (v ?? "").trim().toLowerCase();
}

function isExplicitlyFalse(v: string | undefined) {
  const s = normalize(v);
  return s === "0" || s === "false" || s === "no" || s === "off";
}

function isTruthy(v: string | undefined) {
  const s = normalize(v);
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Bypass policy:
 * - If AUTH_BYPASS is unset => BYPASS ON (for now, per your request)
 * - If AUTH_BYPASS is explicitly falsey (0/false/no/off) => BYPASS OFF
 * - Otherwise (1/true/yes/on) => BYPASS ON
 */
function bypassEnabled() {
  const raw = process.env.AUTH_BYPASS;
  if (raw === undefined) return true;
  if (isExplicitlyFalse(raw)) return false;
  return isTruthy(raw);
}

/**
 * Returns a userId if authenticated, otherwise null.
 * With bypass enabled, auto-upserts a demo user and returns its id.
 */
export async function getAuthedUserId(): Promise<string | null> {
  if (bypassEnabled()) {
    const email = (process.env.AUTH_BYPASS_EMAIL || "dev@local.test").toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true },
    });
    return user.id;
  }

  const jar = await cookies();
  const cookie = jar.get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  return auth?.userId ?? null;
}
