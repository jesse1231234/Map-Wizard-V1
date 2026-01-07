"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerifyClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing token.");
      return;
    }

    async function verify() {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setStatus("error");
        setError(j?.error ?? "Verification failed.");
        return;
      }

      setStatus("success");
      setTimeout(() => router.replace("/"), 500);
    }

    verify();
  }, [token, router]);

  return (
    <main className="space-y-6">
      <h1 className="text-xl font-semibold">Signing you in…</h1>

      {status === "verifying" && (
        <p className="text-sm text-neutral-700">Verifying your link…</p>
      )}

      {status === "success" && (
        <p className="text-sm text-green-700">Signed in successfully. Redirecting…</p>
      )}

      {status === "error" && (
        <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
      )}
    </main>
  );
}
