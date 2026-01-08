import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateUploadUrlSchema } from "@/lib/validators";
import { createPresignedPutUrl } from "@/lib/s3";
import { getAuthedUserId } from "@/lib/authServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Auth (bypass-aware)
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateUploadUrlSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sessionId, stepId, questionId, filename, contentType } = parsed.data;

  const s = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!s || s.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  const key = `uploads/${sessionId}/${stepId}/${questionId}/${Date.now()}_${safeName}`;

  const presigned = await createPresignedPutUrl({ key, contentType });

  return NextResponse.json({
    bucket: presigned.bucket,
    key: presigned.key,
    putUrl: presigned.url,
  });
}
