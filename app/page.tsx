"use client";

import React, { useEffect, useState } from "react";

type MeResponse =
  | { signedIn: true; user: { email: string } }
  | { signedIn: false; user?: { email: string } };

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<MeResponse | null>(null);

  // Dev bypass: if /api/auth/request returns { link }, show it here.
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const j = (await res.json()) as MeResponse;
        setMe(j);
      } catch {
        setMe({ signedIn: false });
      }
    }
    loadMe();
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();

    setStatus("sending");
    setError(null);
    setDevLink(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setError("Network error while requesting link.");
      setStatus("error");
      return;
    }

    // Always try to parse JSON; dev-bypass returns { ok: true, link }
    // and error cases typically return { error }.
    const j: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(j?.error ?? "Failed to send link");
      setStatus("error");
      return;
    }

    if (typeof j?.link === "string" && j.link.length > 0) {
      setDevLink(j.link);
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
              autoComplete="email"
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

        {status === "sent" && !devLink && (
          <p className="text-sm text-neutral-700">Check your email for a sign-in link.</p>
        )}

        {status === "sent" && devLink && (
          <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-3">
            <p className="text-sm text-neutral-800">
              <span className="font-medium">Dev bypass is enabled.</span> Click this magic link to sign in:
            </p>
            <a className="block break-all text-sm text-blue-700 underline" href={devLink}>
              {devLink}
            </a>
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
        )}
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
