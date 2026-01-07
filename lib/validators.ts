import { z } from "zod";

export const RequestMagicLinkSchema = z.object({
  email: z.string().email().max(320)
});

export const VerifyMagicLinkSchema = z.object({
  token: z.string().min(20).max(200)
});

export const CreateSessionSchema = z.object({
  wizardId: z.string().min(1),
  version: z.number().int().positive()
});

export const SubmitStepSchema = z.object({
  sessionId: z.string().min(10),
  stepId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.any()
    })
  )
});

export const CreateUploadUrlSchema = z.object({
  sessionId: z.string().min(10),
  stepId: z.string().min(1),
  questionId: z.string().min(1),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200)
});
