// app/api/auth/verify/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalize(v: string | undefined) {
  return (v ?? "").trim().toLowerCase();
}

function bypassEnabled() {
  const v = process.env.AUTH_BYPASS;
  if (v === undefined) return true; // default ON for your current testing setup
  const s = normalize(v);
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export async function POST() {
  // When bypass is enabled, verification is irrelevant.
  if (bypassEnabled()) {
    return NextResponse.json({ ok: true, bypass: true });
  }

  // If you ever re-enable auth, re-implement real verify here.
  return NextResponse.json(
    { error: "Magic-link verify disabled (AUTH_BYPASS=0 required + implementation needed)" },
    { status: 501 }
  );
}

// Some clients may call this endpoint via GET; keep it harmless.
export async function GET() {
  if (bypassEnabled()) {
    return NextResponse.json({ ok: true, bypass: true });
  }
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
