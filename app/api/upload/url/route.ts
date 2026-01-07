import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CreateUploadUrlSchema } from "@/lib/validators";
import { parseSessionCookieValue, getSessionCookieName } from "@/lib/auth";
import { createPresignedPutUrl } from "@/lib/s3";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const jar = await cookies();
  const cookie = jar.get(getSessionCookieName())?.value;

  const auth = parseSessionCookieValue(cookie);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (!s || s.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  const key = `uploads/${sessionId}/${stepId}/${questionId}/${Date.now()}_${safeName}`;

  const presigned = await createPresignedPutUrl({ key, contentType });

  return NextResponse.json({
    bucket: presigned.bucket,
    key: presigned.key,
    putUrl: presigned.url
  });
}
