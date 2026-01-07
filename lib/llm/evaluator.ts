import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type StepEvalResult = {
  step_pass: boolean;
  global_feedback: string[];
  question_results: Array<{
    question_id: string;
    pass: boolean;
    failed_checks: string[];
    feedback: string[];
    suggested_revision?: string;
    scores?: Record<string, number>;
    flags?: Record<string, string | boolean>;
  }>;
  flags?: Record<string, string | boolean>;
};

export async function evaluateStep(args: {
  stepId: string;
  rubric: unknown;
  answers: unknown;
  context: unknown;
}): Promise<StepEvalResult> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["step_pass", "global_feedback", "question_results"],
    properties: {
      step_pass: { type: "boolean" },
      global_feedback: { type: "array", items: { type: "string" } },
      question_results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question_id", "pass", "failed_checks", "feedback"],
          properties: {
            question_id: { type: "string" },
            pass: { type: "boolean" },
            failed_checks: { type: "array", items: { type: "string" } },
            feedback: { type: "array", items: { type: "string" } },
            suggested_revision: { type: "string" },
            scores: { type: "object", additionalProperties: { type: "number" } },
            flags: { type: "object", additionalProperties: { type: ["string", "boolean"] } }
          }
        }
      },
      flags: { type: "object", additionalProperties: { type: ["string", "boolean"] } }
    }
  } as const;

  const prompt = [
    "You are an instructional-design quality evaluator for a course-map wizard.",
    "Evaluate the user's step answers against the provided rubric.",
    "Be strict about required rubric checks but provide helpful, actionable feedback.",
    "Return JSON ONLY matching the provided schema. No extra keys.",
    "",
    "STEP_ID:",
    args.stepId,
    "",
    "RUBRIC_JSON:",
    JSON.stringify(args.rubric),
    "",
    "SESSION_CONTEXT_JSON:",
    JSON.stringify(args.context),
    "",
    "STEP_ANSWERS_JSON:",
    JSON.stringify(args.answers)
  ].join("\n");

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "step_evaluation",
        schema
      }
    }
  });

  // With json_schema, output_text should be a valid JSON string.
  const text = resp.output_text;
  return JSON.parse(text) as StepEvalResult;
}
