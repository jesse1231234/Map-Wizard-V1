"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function StartPage() {
  const router = useRouter();

  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);

  async function createSessionAndGo() {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Keep these consistent with your seed/config
        body: JSON.stringify({ wizardId: "course_map_v1", version: 1 }),
      });

      const j: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(j?.error ?? `Failed to create session (${res.status})`);
        return;
      }

      const sessionId = j?.sessionId as string | undefined;
      if (!sessionId) {
        setError("Session created but no sessionId returned.");
        return;
      }

      router.replace(`/w/${encodeURIComponent(sessionId)}`);
    } catch {
      setError("Network error while creating session.");
    } finally {
      setCreating(false);
    }
  }

  // Auto-run once on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createSessionAndGo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Starting wizard…</h1>

      {creating && (
        <p className="text-sm text-neutral-600">
          Creating a new session and redirecting you into the wizard.
        </p>
      )}

      {error && (
        <div className="space-y-3 rounded-xl border border-neutral-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-sm text-neutral-600">
            If you’re seeing 401/Unauthorized, your server-side auth bypass isn’t enabled yet.
          </p>
          <button
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={createSessionAndGo}
            disabled={creating}
          >
            {creating ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}
    </main>
  );
}
