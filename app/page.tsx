"use client";

import { useEffect, useState } from "react";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<{ signedIn: boolean; user?: { email: string } } | null>(null);

  useEffect(() => {
    async function loadMe() {
      const res = await fetch("/api/me");
      const j = await res.json().catch(() => ({ signedIn: false }));
      setMe(j);
    }
    loadMe();
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? "Failed to send link");
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  const signedIn = me?.signedIn === true;

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Course Map Wizard (POC)</h1>
        <p className="text-sm text-neutral-600">
          {signedIn ? (
            <>
              Signed in as <span className="font-medium">{me?.user?.email}</span>
            </>
          ) : (
            "Not signed in."
          )}
        </p>
      </header>

      <section className="max-w-md space-y-4 rounded-xl border border-neutral-200 p-4">
        <h2 className="text-base font-medium">1) Email sign-in</h2>

        <form className="space-y-3" onSubmit={requestLink}>
          <label className="block space-y-1">
            <span className="text-sm text-neutral-700">Email</span>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              required
            />
          </label>

          <button
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={status === "sending"}
            type="submit"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
        </form>

        {status === "sent" && (
          <p className="text-sm text-neutral-700">Check your email for a sign-in link.</p>
        )}

        {status === "error" && <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>}
      </section>

      <section className="max-w-md space-y-3 rounded-xl border border-neutral-200 p-4">
        <h2 className="text-base font-medium">2) Start the wizard</h2>
        <p className="text-sm text-neutral-600">
          {signedIn ? "Create a new session and begin." : "Sign in first, then start a session."}
        </p>

        <a
          className={`inline-block rounded-md px-3 py-2 text-sm text-white ${
            signedIn ? "bg-neutral-900" : "bg-neutral-400 pointer-events-none"
          }`}
          href="/start"
          aria-disabled={!signedIn}
        >
          Start course map session
        </a>
      </section>
    </main>
  );
}
