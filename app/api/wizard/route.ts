import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wizardId = url.searchParams.get("wizardId") ?? "course_map_v1";
  const version = Number(url.searchParams.get("version") ?? "1");

  if (!wizardId || !Number.isFinite(version) || version <= 0) {
    return NextResponse.json({ error: "Invalid wizardId/version" }, { status: 400 });
  }

  const cfg = await prisma.wizardConfig.findUnique({
    where: { id: `${wizardId}:${version}` }
  });

  if (!cfg) {
    return NextResponse.json({ error: "Wizard config not found" }, { status: 404 });
  }

  return NextResponse.json({ wizardId, version, config: cfg.json });
}
