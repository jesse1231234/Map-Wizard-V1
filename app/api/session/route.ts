import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CreateSessionSchema } from "@/lib/validators";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookie = cookies().get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await prisma.session.create({
    data: {
      userId: auth.userId,
      wizardId: parsed.data.wizardId,
      version: parsed.data.version,
      status: "in_progress",
      stepId: "s0_context"
    }
  });

  return NextResponse.json({ sessionId: created.id });
}
