import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type EvaluateStepArgs = {
  stepId: string;
  rubric: any;
  answers: Array<{ questionId: string; value?: any }>;
  context: { wizardId: string; version: number };
};

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

const StepEvaluationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    step_pass: { type: "boolean" },
    global_feedback: { type: "array", items: { type: "string" } },
    question_results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question_id: { type: "string" },
          pass: { type: "boolean" },
          failed_checks: { type: "array", items: { type: "string" } },
          feedback: { type: "array", items: { type: "string" } },
          suggested_revision: { type: "string" }
        },
        required: ["question_id", "pass", "failed_checks", "feedback"]
      }
    }
  },
  required: ["step_pass", "global_feedback", "question_results"]
} as const;

function buildPrompt(args: EvaluateStepArgs) {
  return [
    {
      role: "system" as const,
      content:
        "You are an instructional design reviewer. Evaluate user answers against the provided rubric. " +
        "Be strict when hard_gate is true. Return only structured JSON matching the schema."
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        {
          task: "evaluate_step",
          stepId: args.stepId,
          context: args.context,
          rubric: args.rubric,
          answers: args.answers.map((a) => ({
            questionId: a.questionId,
            value: a.value ?? null
          }))
        },
        null,
        2
      )
    }
  ];
}

export async function evaluateStep(args: EvaluateStepArgs): Promise<StepEvaluation> {
  const input = buildPrompt(args);

  // NOTE: Structured outputs for Responses API uses text.format, not response_format.
  const resp = await openai.responses.create({
    model: "gpt-4o-mini",
    input,
    text: {
      format: {
        type: "json_schema",
        name: "step_evaluation",
        strict: true,
        schema: StepEvaluationJsonSchema
      }
    }
  });

  // openai-node provides resp.output_text in many examples; fall back safely if missing
  const outputText =
    (resp as any).output_text ??
    (Array.isArray((resp as any).output)
      ? (resp as any).output
          .flatMap((o: any) => o?.content ?? [])
          .filter((c: any) => c?.type === "output_text")
          .map((c: any) => c?.text)
          .join("")
      : "");

  if (!outputText || typeof outputText !== "string") {
    throw new Error("Model returned empty output_text");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("Model output was not valid JSON");
  }

  return parsed as StepEvaluation;
}
