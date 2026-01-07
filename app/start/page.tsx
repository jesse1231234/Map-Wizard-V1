"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StartPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"starting" | "error">("starting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function start() {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId: "course_map_v1", version: 1 })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setStatus("error");
        setError(j?.error ?? "Failed to create session. Are you signed in?");
        return;
      }

      const j = (await res.json()) as { sessionId: string };
      router.replace(`/w/${encodeURIComponent(j.sessionId)}`);
    }

    start();
  }, [router]);

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Starting…</h1>
      {status === "starting" && (
        <p className="text-sm text-neutral-700">Creating your course map session.</p>
      )}
      {status === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
          <a className="text-sm underline" href="/">
            Back to home
          </a>
        </div>
      )}
    </main>
  );
}
