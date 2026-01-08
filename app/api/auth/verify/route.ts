// app/api/auth/verify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VerifyMagicLinkSchema } from "@/lib/validators";
import { sha256 } from "@/lib/crypto";
import { buildSessionCookie, getSessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

function normalize(v: string | undefined) {
  return (v ?? "").trim().toLowerCase();
}
function bypassEnabled() {
  const v = process.env.AUTH_BYPASS;
  if (v === undefined) return true; // ON by default in your current testing stance
  const s = normalize(v);
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

// Some projects call this endpoint via GET from the verify page.
// If yours doesn't, keeping GET harmless avoids surprises.
export async function GET() {
  if (bypassEnabled()) {
    return NextResponse.json({ ok: true, bypass: true });
  }
  return NextResponse.json({ error: "Method not supported" }, { status: 405 });
}

export async function POST(req: Request) {
  // Global bypass: pretend verification succeeded; do not set cookies.
  if (bypassEnabled()) {
    return NextResponse.json({ ok: true, bypass: true });
  }

  const json = await req.json().catch(() => null);
  const parsed = VerifyMagicLinkSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { token } = parsed.data;

  const tokenHash = sha256(token);

  const row = await prisma.magicLinkToken.findFirst({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  // Consume token
  await prisma.magicLinkToken.delete({ where: { id: row.id } });

  // Set session cookie
  const cookie = buildSessionCookie({ userId: row.userId });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), cookie.value, cookie.options);
  return res;
}
