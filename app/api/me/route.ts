import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ signedIn: false });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ signedIn: false });

  return NextResponse.json({
    signedIn: true,
    user: { id: user.id, email: user.email }
  });
}
