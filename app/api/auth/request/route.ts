// app/api/auth/request/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RequestMagicLinkSchema } from "@/lib/validators";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMagicLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

function isTruthyEnv(v: string | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export async function POST(req: Request) {
  // Global bypass: pretend it worked, do nothing.
  if (isTruthyEnv(process.env.AUTH_BYPASS)) {
    return NextResponse.json({ ok: true, bypass: true });
  }

  const json = await req.json().catch(() => null);
  const parsed = RequestMagicLinkSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    // Fail fast before writing to DB.
    return NextResponse.json({ error: "APP_URL is not set" }, { status: 500 });
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Create magic link token
  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const link = `${appUrl}/auth/verify?token=${encodeURIComponent(rawToken)}`;

  // Temporary dev bypass: return the magic link directly instead of sending email.
  if (isTruthyEnv(process.env.MAGIC_LINK_DEV_BYPASS)) {
    console.log(`[MAGIC_LINK_DEV_BYPASS] ${email} -> ${link}`);
    return NextResponse.json({ ok: true, link, expiresAt });
  }

  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
