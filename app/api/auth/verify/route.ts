import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VerifyMagicLinkSchema } from "@/lib/validators";
import { sha256 } from "@/lib/crypto";
import { createSessionCookieValue, sessionCookieHeader } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = VerifyMagicLinkSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tokenHash = sha256(parsed.data.token);

  const record = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  await prisma.magicLinkToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() }
  });

  const cookieVal = createSessionCookieValue({
    userId: record.userId,
    exp: Date.now() + 7 * 24 * 3600 * 1000
  });

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookieHeader(cookieVal));
  return res;
}
