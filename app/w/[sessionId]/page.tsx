// app/w/[sessionId]/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type SessionPayload = {
  ok?: boolean;
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

const WizardApp = dynamic(() => import("@/components/WizardApp"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto max-w-3xl py-10">
      <p className="text-sm text-neutral-600">Loading wizard UI…</p>
    </main>
  ),
});

export default function WizardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [data, setData] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/session/${sessionId}`, { cache: "no-store" });
      const j = await res.json();

      if (!res.ok) {
        setError(j?.error ?? "Failed to load session");
        setData(null);
        return;
      }

      setData(j);
    } catch {
      setError("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    refresh();
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
          onClick={refresh}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!data) return null;

  return (
    <WizardApp
      session={data.session}
      answers={data.answers}
      feedback={data.feedback}
      comments={data.comments}
      onRefresh={refresh}
    />
  );
}
