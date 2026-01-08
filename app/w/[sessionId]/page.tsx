// app/w/[sessionId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type SessionPayload = {
  session: {
    id: string;
    wizardId: string;
    version: number;
    stepId: string | null;
    status: string;
  };
  answers: any[];
  feedback: any[];
  comments: any[];
};

export default function WizardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [data, setData] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/session/${sessionId}`);
      const j = await res.json();

      if (!res.ok) {
        setError(j?.error ?? "Failed to load session");
        return;
      }

      setData(j);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-10">
        <p className="text-sm text-neutral-600">Loading wizard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl py-10 space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={load}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  /**
   * IMPORTANT:
   * Your existing wizard renderer already lives below this line
   * (StepRenderer / DynamicForm / etc).
   *
   * We are intentionally NOT changing that logic here.
   */
  return (
    <main className="mx-auto max-w-3xl py-10">
      {/* 
        Pass through exactly what the renderer expects.
        These props match the API response shape we fixed earlier.
      */}
      {/* Example: */}
      {/* <WizardRuntime {...data} onSubmitSuccess={load} /> */}

      {/* TEMP visibility while testing */}
      <pre className="text-xs rounded-lg bg-neutral-100 p-4 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
