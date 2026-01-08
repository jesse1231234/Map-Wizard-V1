import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";

export const runtime = "nodejs";

type Ctx = {
  params: { id: string };
};

export async function GET(_req: Request, ctx: Ctx) {
  // Auth (bypass-aware)
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = ctx.params.id;

  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      answers: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stepId: true,
          questionId: true,
          valueJson: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      feedback: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stepId: true,
          kind: true,
          severity: true,
          message: true,
          createdAt: true,
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stepId: true,
          questionId: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    session: {
      id: session.id,
      wizardId: session.wizardId,
      version: session.version,
      status: session.status,
      stepId: session.stepId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    answers: session.answers,
    feedback: session.feedback,
    comments: session.comments,
  });
}
