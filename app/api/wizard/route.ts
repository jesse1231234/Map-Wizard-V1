// app/api/wizard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/authServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Keep auth consistent with the rest of the app (bypass makes this always succeed).
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const wizardId = url.searchParams.get("wizardId") || "course_map_v1";
  const versionRaw = url.searchParams.get("version") || "1";
  const version = Number(versionRaw);

  if (!wizardId || !Number.isFinite(version)) {
    return NextResponse.json({ error: "Invalid wizardId/version" }, { status: 400 });
  }

  const row = await prisma.wizardConfig.findUnique({
    where: { id: `${wizardId}:${version}` },
    select: { json: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Wizard config not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, config: row.json });
}
