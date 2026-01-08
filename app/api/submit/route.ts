// app/api/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";
import { evaluateStep } from "@/lib/llm/evaluator";
import { z } from "zod";

export const runtime = "nodejs";

const SubmitSchema = z.object({
  sessionId: z.string().min(1),
  stepId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        value: z.any(),
      })
    )
    .default([]),
});

type StepEvaluation = {
  step_pass: boolean;
  global_feedback: string[];
  question_results: Array<{
    question_id: string;
    pass: boolean;
    failed_checks: string[];
    feedback: string[];
    suggested_revision?: string;
  }>;
};

function verdictFromEval(ev: StepEvaluation) {
  return ev.step_pass ? "pass" : "fail";
}

export async function POST(req: Request) {
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

  const { sessionId, stepId, answers } = parsed.data;

  // Ensure session belongs to user
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, wizardId: true, version: true, stepId: true, status: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Persist answers (append-only; UI reads latest by createdAt)
  if (answers.length > 0) {
    await prisma.answer.createMany({
      data: answers.map((a) => ({
        sessionId,
        stepId,
        questionId: a.questionId,
        value: a.value,
      })),
    });
  }

  // Load wizard config to find gate mode and next step
  const cfg = await prisma.wizardConfig.findUnique({
    where: { id: `${session.wizardId}:${session.version}` },
    select: { json: true },
  });

  if (!cfg) {
    return NextResponse.json({ error: "Wizard config not found" }, { status: 500 });
  }

  const steps: any[] = Array.isArray((cfg.json as any)?.steps) ? (cfg.json as any).steps : [];
  const currentIndex = steps.findIndex((s) => s?.id === stepId);
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const gateMode: "none" | "soft" | "hard" =
    (currentStep?.gate?.mode as any) === "soft" || (currentStep?.gate?.mode as any) === "hard"
      ? (currentStep.gate.mode as any)
      : "none";

  // Load rubric (if any) for this step
  const rubricRow = await prisma.rubric.findFirst({
    where: { wizardId: session.wizardId, version: session.version, stepId },
    select: { json: true },
  });

  // Clear prior feedback for this step (keeps UI simple: latest payload matters)
  await prisma.feedback.deleteMany({ where: { sessionId, stepId } });

  // Default evaluation: if no gating/rubric, treat as pass
  let evaluation: StepEvaluation = {
    step_pass: true,
    global_feedback: [],
    question_results: [],
  };

  if (gateMode !== "none" && rubricRow) {
    // Pull latest answers for this step (one per question)
    const stepAnswers = await prisma.answer.findMany({
      where: { sessionId, stepId },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, value: true, createdAt: true },
    });

    const latestByQuestion = new Map<string, any>();
    for (const a of stepAnswers) {
      if (!latestByQuestion.has(a.questionId)) {
        latestByQuestion.set(a.questionId, a.value);
      }
    }

    try {
      evaluation = await evaluateStep({
        stepId,
        rubric: rubricRow.json,
        answers: Array.from(latestByQuestion.entries()).map(([questionId, value]) => ({
          questionId,
          value,
        })),
        context: { wizardId: session.wizardId, version: session.version },
      });
    } catch (e: any) {
      // Still persist a failure payload so the UI has something to show
      evaluation = {
        step_pass: false,
        global_feedback: [
          "Evaluation failed due to a server error. Check your OPENAI_API_KEY and server logs.",
        ],
        question_results: [],
      };
    }
  }

  // Persist evaluation as a single Feedback row
  await prisma.feedback.create({
    data: {
      sessionId,
      stepId,
      questionId: null,
      verdict: verdictFromEval(evaluation),
      payload: evaluation as any,
    },
    select: { id: true },
  });

  // Advance session step if passed OR if gate mode is none
  let nextStepId: string | null = null;
  let nextStatus: string | null = null;

  const canAdvance = evaluation.step_pass || gateMode === "none" || !rubricRow;

  if (canAdvance) {
    const isLast = currentIndex >= 0 ? currentIndex >= steps.length - 1 : false;

    if (isLast) {
      nextStatus = "complete";
      nextStepId = stepId; // keep last stepId
    } else if (currentIndex >= 0) {
      nextStepId = steps[currentIndex + 1]?.id ?? null;
    }
  } else {
    nextStepId = stepId; // stay put
  }

  if (nextStepId || nextStatus) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        stepId: nextStepId ?? session.stepId,
        status: nextStatus ?? session.status,
      },
    });
  }

  // Return shape expected by the wizard page
  const updated = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { stepId: true, status: true },
  });

  return NextResponse.json({
    ok: true,
    evaluation,
    session: updated ?? { stepId: session.stepId, status: session.status },
  });
}
