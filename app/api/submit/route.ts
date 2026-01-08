import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";
import { z } from "zod";

// Adjust this import to whatever your repo uses for rubric evaluation
import { evaluateStep } from "@/lib/llm/evaluator";

export const runtime = "nodejs";

const SubmitSchema = z.object({
  sessionId: z.string().min(1),
  stepId: z.string().min(1),

  // answers: array so you can submit multiple questions at once
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        valueJson: z.any(),
      })
    )
    .default([]),

  // navigation intent
  nextStepId: z.string().min(1).optional(),
  markComplete: z.boolean().optional(),
});

export async function POST(req: Request) {
  // Auth (bypass-aware)
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = SubmitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sessionId, stepId, answers, nextStepId, markComplete } = parsed.data;

  // Ensure session belongs to user
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, wizardId: true, version: true, status: true, stepId: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Upsert answers for this step
  // (Your schema uses unique(sessionId, stepId, questionId) or similar; if not, adjust.)
  await prisma.$transaction(
    answers.map((a) =>
      prisma.answer.upsert({
        where: {
          sessionId_stepId_questionId: {
            sessionId,
            stepId,
            questionId: a.questionId,
          },
        },
        update: { valueJson: a.valueJson },
        create: {
          sessionId,
          stepId,
          questionId: a.questionId,
          valueJson: a.valueJson,
        },
      })
    )
  );

  // Load rubric for gating (if any)
  const rubric = await prisma.rubric.findFirst({
    where: {
      wizardId: session.wizardId,
      version: session.version,
      stepId,
    },
    select: { id: true, rubricJson: true },
  });

  // Clear prior feedback for this step (optional but usually desired)
  await prisma.feedback.deleteMany({ where: { sessionId, stepId } });

  let evalResult: any = null;

  if (rubric) {
    // Gather current answers for this step
    const stepAnswers = await prisma.answer.findMany({
      where: { sessionId, stepId },
      select: { questionId: true, valueJson: true },
    });

    // Evaluate against rubric (may call LLM)
    evalResult = await evaluateStep({
      wizardId: session.wizardId,
      version: session.version,
      stepId,
      rubric: rubric.rubricJson,
      answers: stepAnswers,
    });

    // Persist feedback items if returned
    const items = Array.isArray(evalResult?.items) ? evalResult.items : [];
    if (items.length > 0) {
      await prisma.feedback.createMany({
        data: items.map((it: any) => ({
          sessionId,
          stepId,
          kind: it.kind ?? "rubric",
          severity: it.severity ?? "info",
          message: it.message ?? "",
        })),
      });
    }

    // Gate advancement if rubric says not pass
    const passed = evalResult?.passed === true;

    if (!passed) {
      // Stay on same step; return feedback
      const feedback = await prisma.feedback.findMany({
        where: { sessionId, stepId },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({
        ok: true,
        gated: true,
        passed: false,
        nextStepId: stepId,
        evaluation: evalResult,
        feedback,
      });
    }
  }

  // Passed (or no rubric) => advance/update session
  const newStatus = markComplete ? "complete" : session.status;
  const newStepId = markComplete ? session.stepId : (nextStepId ?? session.stepId);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: newStatus,
      stepId: newStepId,
    },
  });

  const feedback = await prisma.feedback.findMany({
    where: { sessionId, stepId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    gated: false,
    passed: true,
    nextStepId: newStepId,
    evaluation: evalResult,
    feedback,
  });
}
