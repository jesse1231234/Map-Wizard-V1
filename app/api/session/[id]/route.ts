import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, context: any) {
  const cookie = cookies().get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = context?.params?.id;
  if (typeof sessionId !== "string" || sessionId.length < 5) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      answers: { orderBy: { createdAt: "desc" }, take: 200 },
      feedback: { orderBy: { createdAt: "desc" }, take: 50 }
    }
  });

  if (!session || session.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      wizardId: session.wizardId,
      version: session.version,
      stepId: session.stepId,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    },
    answers: session.answers.map((a) => ({
      id: a.id,
      stepId: a.stepId,
      questionId: a.questionId,
      value: a.value,
      createdAt: a.createdAt
    })),
    feedback: session.feedback.map((f) => ({
      id: f.id,
      stepId: f.stepId,
      questionId: f.questionId,
      verdict: f.verdict,
      payload: f.payload,
      createdAt: f.createdAt
    }))
  });
}
