import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";

function isTruthy(v: string | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Returns a userId if authenticated, otherwise null.
 * If AUTH_BYPASS=true, auto-upserts a dev user and returns its id.
 */
export async function getAuthedUserId(): Promise<string | null> {
  if (isTruthy(process.env.AUTH_BYPASS)) {
    const email = (process.env.AUTH_BYPASS_EMAIL || "dev@local.test").toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email }
    });
    return user.id;
  }

  const jar = await cookies();
  const cookie = jar.get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  return auth?.userId ?? null;
}
