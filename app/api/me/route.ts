import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const cookie = cookies().get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  if (!auth) return NextResponse.json({ signedIn: false });

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ signedIn: false });

  return NextResponse.json({
    signedIn: true,
    user: { id: user.id, email: user.email }
  });
}
