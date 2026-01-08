import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";
import { z } from "zod";

export const runtime = "nodejs";

const CreateSessionSchema = z.object({
  wizardId: z.string().min(1),
  version: z.number().int().positive(),
});

export async function POST(req: Request) {
  // Auth (bypass-aware)
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
  const json = await req.json().catch(() => null);
  const parsed = CreateSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId,
      wizardId: parsed.data.wizardId,
      version: parsed.data.version,
      status: "in_progress",
      stepId: "s0_context",
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, sessionId: session.id });
}
