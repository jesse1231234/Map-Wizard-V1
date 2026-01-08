// components/WizardApp.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type WizardStep = {
  id: string;
  title: string;
  content?: { intro_md?: string };
  gate?: { mode?: "none" | "soft" | "hard" };
  questions: any[];
};

type WizardConfig = {
  title: string;
  steps: WizardStep[];
};

type SessionShape = {
  id: string;
  wizardId: string;
  version: number;
  stepId: string | null;
  status: string;
};

type Props = {
  session: SessionShape;
  answers: any[];
  feedback: any[];
  comments: any[];
  onRefresh: () => Promise<void> | void;
};

type AnswersByQuestion = Record<string, any>;

function mdToPlain(md?: string) {
  if (!md) return "";
  return md
    .replace(/[*_`]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function latestAnswersForStep(allAnswers: any[], stepId: string): AnswersByQuestion {
  // DB stores append-only. Pick latest per question.
  const out: AnswersByQuestion = {};
  const filtered = allAnswers
    .filter((a) => a?.stepId === stepId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const a of filtered) {
    const qid = a?.questionId;
    if (!qid) continue;
    if (out[qid] === undefined) out[qid] = a.value;
  }
  return out;
}

function latestFeedbackPayloadForStep(allFeedback: any[], stepId: string) {
  const filtered = allFeedback
    .filter((f) => f?.stepId === stepId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return filtered[0]?.payload ?? null;
}

export default function WizardApp({ session, answers, feedback, onRefresh }: Props) {
  const [cfg, setCfg] = useState<WizardConfig | null>(null);
  const [cfgError, setCfgError] = useState<string | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);

  const [draftByStep, setDraftByStep] = useState<Record<string, AnswersByQuestion>>({});
  const [activeStepId, setActiveStepId] = useState<string | null>(session.stepId);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load config from DB via API
  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      setCfgLoading(true);
      setCfgError(null);

      try {
        const res = await fetch(
          `/api/wizard?wizardId=${encodeURIComponent(session.wizardId)}&version=${encodeURIComponent(
            String(session.version)
          )}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) {
          if (!mounted) return;
          setCfgError(j?.error ?? "Failed to load wizard config");
          setCfg(null);
          return;
        }
        if (!mounted) return;
        setCfg(j?.config ?? null);
      } catch {
        if (!mounted) return;
        setCfgError("Network error while loading wizard config");
        setCfg(null);
      } finally {
        if (!mounted) return;
        setCfgLoading(false);
      }
    }

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [session.wizardId, session.version]);

  // Keep activeStepId aligned with session.stepId (server is source of truth)
  useEffect(() => {
    setActiveStepId(session.stepId);
  }, [session.stepId]);

  const steps = cfg?.steps ?? [];
  const stepIndex = useMemo(() => {
    if (!activeStepId) return 0;
    const idx = steps.findIndex((s) => s.id === activeStepId);
    return idx >= 0 ? idx : 0;
  }, [steps, activeStepId]);

  const step = steps[stepIndex];
  const stepId = step?.id;

  // Initialize draft for current step from latest saved answers
  useEffect(() => {
    if (!stepId) return;
    setDraftByStep((prev) => {
      if (prev[stepId]) return prev;
      return { ...prev, [stepId]: latestAnswersForStep(answers, stepId) };
    });
  }, [answers, stepId]);

  function setAnswer(questionId: string, value: any) {
    if (!stepId) return;
    setDraftByStep((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? {}),
        [questionId]: value,
      },
    }));
  }

  const stepAnswers: AnswersByQuestion = stepId ? draftByStep[stepId] ?? {} : {};

  const missingRequired = useMemo(() => {
    if (!step) return [];
    const missing: string[] = [];
    for (const q of step.questions ?? []) {
      if (!q.required) continue;

      const v = stepAnswers[q.id];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);

      if (empty) missing.push(q.label);
    }
    return missing;
  }, [step, stepAnswers]);

  const evaluation = useMemo(() => {
    if (!stepId) return null;
    return latestFeedbackPayloadForStep(feedback, stepId);
  }, [feedback, stepId]);

  const canPrev = stepIndex > 0;
  const canNext = stepIndex < steps.length - 1;

  async function submitStep() {
    if (!stepId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payloadAnswers = Object.entries(stepAnswers).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          stepId,
          answers: payloadAnswers,
        }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitError(j?.error ?? `Submit failed (${res.status})`);
        return;
      }

      // Refresh pulls updated session.stepId + feedback from DB
      await onRefresh();
    } catch {
      setSubmitError("Network error during submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (cfgLoading) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">Loading wizard…</h1>
      </main>
    );
  }

  if (cfgError || !cfg) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">Wizard</h1>
        <p className="text-sm text-red-600">{cfgError ?? "Wizard config not available."}</p>
      </main>
    );
  }

  if (!step) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">{cfg.title}</h1>
        <p className="text-sm text-neutral-700">No steps found in wizard config.</p>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{cfg.title}</h1>
        <p className="text-xs text-neutral-500">
          Session {session.id} • {session.status} • step {stepIndex + 1} / {steps.length} • {stepId}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Step nav */}
        <aside className="rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 text-sm font-medium text-neutral-800">Steps</div>
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    i === stepIndex ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
                  }`}
                  onClick={() => setActiveStepId(s.id)}
                  type="button"
                >
                  {i + 1}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* Step content */}
        <section className="space-y-4 rounded-xl border border-neutral-200 p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            {step.content?.intro_md ? (
              <p className="text-sm text-neutral-700">{mdToPlain(step.content.intro_md)}</p>
            ) : null}
          </div>

          {/* Feedback */}
          {evaluation ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div className="font-medium">Latest evaluation</div>
              {Array.isArray(evaluation.global_feedback) && evaluation.global_feedback.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-neutral-700">
                  {evaluation.global_feedback.map((t: string, idx: number) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-neutral-600">No global feedback.</p>
              )}
            </div>
          ) : null}

          {/* Questions (same renderer as demo) */}
          <div className="space-y-4">
            {(step.questions ?? []).map((q: any) => {
              const value = stepAnswers[q.id];

              if (q.type === "short_text") {
                return (
                  <label key={q.id} className="block space-y-1">
                    <span className="text-sm font-medium text-neutral-800">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </span>
                    {q.help_text ? <p className="text-xs text-neutral-500">{q.help_text}</p> : null}
                    <input
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      value={value ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.ui?.placeholder ?? ""}
                      type="text"
                    />
                  </label>
                );
              }

              if (q.type === "long_text") {
                return (
                  <label key={q.id} className="block space-y-1">
                    <span className="text-sm font-medium text-neutral-800">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </span>
                    {q.help_text ? <p className="text-xs text-neutral-500">{q.help_text}</p> : null}
                    <textarea
                      className="min-h-[120px] w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      value={value ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.ui?.placeholder ?? ""}
                    />
                  </label>
                );
              }

              if (q.type === "single_select") {
                return (
                  <label key={q.id} className="block space-y-1">
                    <span className="text-sm font-medium text-neutral-800">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </span>
                    <select
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      value={value ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {(q.options ?? []).map((o: any) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (q.type === "url") {
                return (
                  <label key={q.id} className="block space-y-1">
                    <span className="text-sm font-medium text-neutral-800">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </span>
                    <input
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      value={value ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.ui?.placeholder ?? "https://"}
                      type="url"
                    />
                  </label>
                );
              }

              if (q.type === "file") {
                return (
                  <div key={q.id} className="space-y-1">
                    <div className="text-sm font-medium text-neutral-800">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </div>
                    <input
                      type="file"
                      className="block text-sm"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setAnswer(q.id, f ? { filename: f.name, size: f.size, type: f.type } : null);
                      }}
                    />
                    {value?.filename ? (
                      <p className="text-xs text-neutral-600">Selected: {value.filename}</p>
                    ) : null}
                  </div>
                );
              }

              return (
                <div key={q.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                  <div className="font-medium">{q.label}</div>
                  <p className="text-neutral-600">
                    Renderer doesn’t support question type <code>{q.type}</code> yet.
                  </p>
                </div>
              );
            })}
          </div>

          {/* Required warnings */}
          {missingRequired.length > 0 ? (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-neutral-800">
              <div className="font-medium">Missing required fields:</div>
              <ul className="list-disc pl-5">
                {missingRequired.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          {/* Nav + Submit */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
              disabled={!canPrev}
              onClick={() => setActiveStepId(steps[Math.max(0, stepIndex - 1)]?.id ?? stepId)}
            >
              Prev
            </button>

            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
              disabled={!canNext}
              onClick={() =>
                setActiveStepId(steps[Math.min(steps.length - 1, stepIndex + 1)]?.id ?? stepId)
              }
            >
              Next
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting}
                onClick={submitStep}
              >
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
