import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SubmitStepSchema } from "@/lib/validators";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";
import { evaluateStep } from "@/lib/llm/evaluator";

export const runtime = "nodejs";

// POC: rubrics stored in DB table Rubric (one row per step).
async function loadRubric(wizardId: string, version: number, stepId: string) {
  const r = await prisma.rubric.findFirst({ where: { wizardId, version, stepId } });
  return r?.json ?? null;
}

export async function POST(req: Request) {
  const cookie = cookies().get(getSessionCookieName())?.value;
  const auth = parseSessionCookieValue(cookie);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = SubmitStepSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sessionId, stepId, answers } = parsed.data;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Save answers (simple POC: always append; you can add versioning later).
  await prisma.answer.createMany({
    data: answers.map((a) => ({
      sessionId,
      stepId,
      questionId: a.questionId,
      value: a.value
    }))
  });

  const rubric = await loadRubric(session.wizardId, session.version, stepId);

  // If no rubric found, treat as pass (for non-gated steps)
  let evaluation: any = {
    step_pass: true,
    global_feedback: [],
    question_results: []
  };

  if (rubric) {
    const context = {
      wizardId: session.wizardId,
      version: session.version
    };

    evaluation = await evaluateStep({
      stepId,
      rubric,
      answers,
      context
    });
  }

  await prisma.feedback.create({
    data: {
      sessionId,
      stepId,
      verdict: evaluation.step_pass ? "pass" : "fail",
      payload: evaluation
    }
  });

  // Keep stepId updated (UI controls actual step navigation)
  await prisma.session.update({
    where: { id: sessionId },
    data: { stepId }
  });

  return NextResponse.json({ ok: true, evaluation });
}
