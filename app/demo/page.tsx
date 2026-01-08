"use client";

import React, { useMemo, useState } from "react";
import { wizardConfigV1 } from "@/lib/wizard/config";

type Answers = Record<string, any>;

function mdToPlain(md?: string) {
  if (!md) return "";
  return md
    .replace(/[*_`]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

export default function DemoWizardPage() {
  const cfg = wizardConfigV1;
  const steps = cfg.steps ?? [];

  const [stepIndex, setStepIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<Record<string, Answers>>({});

  // Clamp index to valid range
  const safeIndex =
    steps.length === 0 ? 0 : Math.min(Math.max(stepIndex, 0), steps.length - 1);

  const step = steps[safeIndex];

  // If no steps exist, show a clear message instead of crashing/TS error.
  if (!step) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{cfg.title} — Demo Mode</h1>
        <p className="text-sm text-neutral-700">
          Wizard config has no steps. Check <code className="rounded bg-neutral-100 px-1">lib/wizard/config.ts</code>.
        </p>
      </main>
    );
  }
  const stepId = step.id;


  const stepAnswers: Answers = answersByStep[stepId] ?? {};

  function setAnswer(questionId: string, value: any) {
    setAnswersByStep((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? {}),
        [questionId]: value,
      },
    }));
  }

  const canPrev = stepIndex > 0;
  const canNext = stepIndex < steps.length - 1;

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const q of step.questions) {
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
  }, [step.questions, stepAnswers]);

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{cfg.title} — Demo Mode</h1>
        <p className="text-sm text-neutral-600">
          This page bypasses login and database. Answers are stored in-memory only.
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
                  onClick={() => setStepIndex(i)}
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
            <div className="text-xs text-neutral-500">
              Step {stepIndex + 1} of {steps.length} • {stepId}
            </div>
            <h2 className="text-lg font-semibold">{step.title}</h2>
            {step.content?.intro_md && (
              <p className="text-sm text-neutral-700">{mdToPlain(step.content.intro_md)}</p>
            )}
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {step.questions.map((q: any) => {
              const value = stepAnswers[q.id];

              // short_text
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

              // long_text
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

              // single_select
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
                      {q.options.map((o: any) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              // url
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

              // file (demo: store filename only)
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

              // repeat_group + matrix: keep simple for now
              return (
                <div key={q.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                  <div className="font-medium">{q.label}</div>
                  <p className="text-neutral-600">
                    Demo mode doesn’t render question type <code>{q.type}</code> yet.
                  </p>
                </div>
              );
            })}
          </div>

          {/* Required warnings */}
          {missingRequired.length > 0 && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-neutral-800">
              <div className="font-medium">Missing required fields:</div>
              <ul className="list-disc pl-5">
                {missingRequired.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
              disabled={!canPrev}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              Prev
            </button>

            <button
              type="button"
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={!canNext}
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            >
              Next
            </button>

            <div className="ml-auto">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                onClick={() => {
                  // quick export for your own inspection
                  console.log("DEMO ANSWERS:", answersByStep);
                  alert("Answers dumped to console as DEMO ANSWERS");
                }}
              >
                Dump answers
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
