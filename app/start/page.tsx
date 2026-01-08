"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse =
  | { signedIn: true; user: { email: string } }
  | { signedIn: false; user?: { email: string } };

export default function StartPage() {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);

  // Sign-in form state (only used if not signed in)
  const [email, setEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  // Session creation state (only used if signed in)
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const j = (await res.json()) as MeResponse;
      setMe(j);
    } catch {
      setMe({ signedIn: false });
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  const signedIn = me?.signedIn === true;

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setAuthStatus("sending");
    setAuthError(null);
    setDevLink(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setAuthError("Network error while requesting link.");
      setAuthStatus("error");
      return;
    }

    const j: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      setAuthError(j?.error ?? "Failed to send link");
      setAuthStatus("error");
      return;
    }

    if (typeof j?.link === "string" && j.link.length > 0) {
      setDevLink(j.link);
    }

    setAuthStatus("sent");
  }

  async function createSessionAndGo() {
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId: "course_map_v1", version: 1 }),
      });

      const j: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If cookie expired or user isn't signed in, bounce back to sign-in state.
        if (res.status === 401) {
          await loadMe();
          setCreateError("You’re not signed in. Please sign in, then try again.");
          return;
        }
        setCreateError(j?.error ?? "Failed to create session");
        return;
      }

      const sessionId = j?.sessionId as string | undefined;
      if (!sessionId) {
        setCreateError("Session created but no sessionId returned.");
        return;
      }

      router.push(`/w/${encodeURIComponent(sessionId)}`);
    } finally {
      setCreating(false);
    }
  }

  // Optional: auto-create session as soon as user lands here signed in.
  // If you prefer manual click only, delete this useEffect.
  useEffect(() => {
    if (signedIn) {
      // don’t auto-run if already in progress or we already tried and got an error
      // (simple guard)
    }
  }, [signedIn]);

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
            "Sign in with a magic link, then start a session."
          )}
        </p>
      </header>

      {!signedIn ? (
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
              disabled={authStatus === "sending"}
              type="submit"
            >
              {authStatus === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          {authStatus === "sent" && !devLink && (
            <p className="text-sm text-neutral-700">Check your email for a sign-in link.</p>
          )}

          {authStatus === "sent" && devLink && (
            <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-3">
              <p className="text-sm text-neutral-800">
                <span className="font-medium">Dev bypass is enabled.</span> Click this magic link to sign in:
              </p>
              <a className="block break-all text-sm text-blue-700 underline" href={devLink}>
                {devLink}
              </a>
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                onClick={loadMe}
              >
                I clicked it — refresh sign-in status
              </button>
            </div>
          )}

          {authStatus === "error" && (
            <p className="text-sm text-red-600">{authError ?? "Something went wrong."}</p>
          )}
        </section>
      ) : (
        <section className="max-w-md space-y-4 rounded-xl border border-neutral-200 p-4">
          <h2 className="text-base font-medium">2) Start the wizard</h2>
          <p className="text-sm text-neutral-600">Create a new session and jump into the wizard.</p>

          <button
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={createSessionAndGo}
            disabled={creating}
          >
            {creating ? "Creating session…" : "Start course map session"}
          </button>

          {createError && <p className="text-sm text-red-600">{createError}</p>}
        </section>
      )}
    </main>
  );
}
