import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RequestMagicLinkSchema } from "@/lib/validators";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMagicLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestMagicLinkSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email }
  });

  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL is not set" }, { status: 500 });
  }

  const link = `${appUrl.replace(/\/$/, "")}/auth/verify?token=${encodeURIComponent(rawToken)}`;
  // Temporary dev bypass: return the magic link directly instead of sending email.
  // Enable by setting MAGIC_LINK_DEV_BYPASS=true (or "1") in env.
  const bypass = (process.env.MAGIC_LINK_DEV_BYPASS || "").toLowerCase();
  if (bypass === "1" || bypass === "true" || bypass === "yes") {
    console.log(`[MAGIC_LINK_DEV_BYPASS] ${email} -> ${link}`);
    return NextResponse.json({ ok: true, link });
  }
  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
