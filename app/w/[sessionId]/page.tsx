"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type WizardConfig = {
  wizard_id: string;
  version: number;
  title: string;
  steps: Array<{
    id: string;
    title: string;
    gate: { mode: "none" | "soft" | "hard"; rubric_id?: string };
    content: { intro_md?: string; why_md?: string; resources?: Array<any> };
    questions: Array<any>;
  }>;
};

type StepEvaluation = {
  step_pass: boolean;
  global_feedback: string[];
  question_results: Array<{
    question_id: string;
    pass: boolean;
    failed_checks: string[];
    feedback: string[];
    suggested_revision?: string;
  }>;
};

function mdToPlain(md?: string) {
  if (!md) return "";
  return md
    .replace(/[*_`]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function getByPath(obj: any, path: string) {
  // supports paths like "s1_outcomes.outcomes_list"
  const parts = path.split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export default function WizardSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [cfg, setCfg] = useState<WizardConfig | null>(null);
  const [stepId, setStepId] = useState<string>("s0_context");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [evaluation, setEvaluation] = useState<StepEvaluation | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setStatus("loading");
      setError(null);

      const res = await fetch("/api/wizard?wizardId=course_map_v1&version=1");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setStatus("error");
        setError(j?.error ?? "Failed to load wizard config");
        return;
      }
      const j = (await res.json()) as { config: WizardConfig };
      setCfg(j.config);

      setStatus("ready");
    }

    load();
  }, []);

  const steps = cfg?.steps ?? [];
  const currentStep = useMemo(() => steps.find((s) => s.id === stepId) ?? steps[0], [steps, stepId]);

  const currentStepIndex = useMemo(() => {
    if (!currentStep) return 0;
    const idx = steps.findIndex((s) => s.id === currentStep.id);
    return idx >= 0 ? idx : 0;
  }, [steps, currentStep]);

  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < steps.length - 1;

  const isHardGated = currentStep?.gate?.mode === "hard";

  async function uploadFile(args: {
    stepId: string;
    questionId: string; // parent question id (repeat_group)
    fieldId: string; // file field id within repeat_group
    file: File;
  }) {
    const res = await fetch("/api/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        stepId: args.stepId,
        questionId: `${args.questionId}.${args.fieldId}`,
        filename: args.file.name,
        contentType: args.file.type || "application/octet-stream"
      })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error ?? "Failed to create upload URL");
    }

    const j = (await res.json()) as { bucket: string; key: string; putUrl: string };

    const put = await fetch(j.putUrl, {
      method: "PUT",
      headers: { "Content-Type": args.file.type || "application/octet-stream" },
      body: args.file
    });

    if (!put.ok) {
      throw new Error("Upload failed");
    }

    return {
      bucket: j.bucket,
      key: j.key,
      filename: args.file.name,
      contentType: args.file.type || "application/octet-stream",
      size: args.file.size
    };
  }

  async function submitStep() {
    if (!currentStep) return;
    setStatus("submitting");
    setError(null);

    const payload = {
      sessionId,
      stepId: currentStep.id,
      answers: Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value
      }))
    };

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setStatus("error");
      setError(j?.error ?? "Submit failed");
      return;
    }

    const j = (await res.json()) as { evaluation: StepEvaluation };
    setEvaluation(j.evaluation);
    setStatus("ready");
  }

  function goPrev() {
    if (!canGoPrev) return;
    setEvaluation(null);
    setAnswers({});
    setStepId(steps[currentStepIndex - 1].id);
  }

  function goNext() {
    if (!canGoNext) return;
    if (isHardGated && !evaluation?.step_pass) return;
    setEvaluation(null);
    setAnswers({});
    setStepId(steps[currentStepIndex + 1].id);
  }

  function renderQuestion(q: any) {
    const val = answers[q.id];

    if (q.type === "short_text") {
      return (
        <input
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={(val ?? "") as string}
          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
          placeholder={q.ui?.placeholder ?? ""}
        />
      );
    }

    if (q.type === "long_text") {
      return (
        <textarea
          className="w-full min-h-[120px] rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={(val ?? "") as string}
          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
          placeholder={q.ui?.placeholder ?? ""}
        />
      );
    }

    if (q.type === "single_select") {
      return (
        <select
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={(val ?? "") as string}
          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
        >
          <option value="" disabled>
            Select…
          </option>
          {(q.options ?? []).map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (q.type === "repeat_group") {
      const items: any[] = Array.isArray(val) ? val : [];
      const minItems = q.ui?.min_items ?? 0;
      const maxItems = q.ui?.max_items ?? 50;

      function setItem(index: number, fieldId: string, fieldValue: any) {
        const next = items.map((it, i) => (i === index ? { ...(it ?? {}), [fieldId]: fieldValue } : it));
        setAnswers((a) => ({ ...a, [q.id]: next }));
      }

    if (q.type === "matrix") {
      const matrixVal: any[] = Array.isArray(val) ? val : [];

      // derive rows from prior answers per config
      const rowsFrom = q.ui?.rows_from_answer as string | undefined;
      const rowLabelField = q.ui?.row_label_field as string | undefined;

      const sourceItems: any[] = Array.isArray(getByPath(answers, rowsFrom ?? ""))
        ? (getByPath(answers, rowsFrom ?? "") as any[])
        : [];

      // build a stable row list
      const rows = sourceItems.map((it, idx) => {
        const label = rowLabelField ? it?.[rowLabelField] : undefined;
        return {
          row_key: String(idx),
          row_label: (label ?? `Row ${idx + 1}`) as string
        };
      });

      // Ensure matrix has an entry per row
      const normalized = rows.map((r) => {
        const existing = matrixVal.find((m) => m?.row_key === r.row_key);
        return existing ?? { row_key: r.row_key, row_label: r.row_label };
      });

      function setCell(rowKey: string, colId: string, value: any) {
        const next = normalized.map((r) => (r.row_key === rowKey ? { ...r, [colId]: value } : r));
        setAnswers((a) => ({ ...a, [q.id]: next }));
      }

      // write back normalized if different length (keeps it in sync after outcome edits)
      if (matrixVal.length !== normalized.length) {
        // avoid infinite loop; only set once when mismatch
        queueMicrotask(() => setAnswers((a) => ({ ...a, [q.id]: normalized })));
      }

      return (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="w-[220px] border-b border-neutral-200 p-2 text-left text-xs font-medium text-neutral-600">
                  Outcome
                </th>
                {(q.columns ?? []).map((c: any) => (
                  <th
                    key={c.id}
                    className="border-b border-neutral-200 p-2 text-left text-xs font-medium text-neutral-600"
                  >
                    {c.label}
                    {c.required ? <span className="text-red-600"> *</span> : null}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {normalized.map((r) => (
                <tr key={r.row_key} className="align-top">
                  <td className="border-b border-neutral-200 p-2 text-xs text-neutral-700">
                    {r.row_label}
                  </td>

                  {(q.columns ?? []).map((c: any) => {
                    const cellVal = r?.[c.id] ?? "";

                    if (c.type === "short_text") {
                      return (
                        <td key={c.id} className="border-b border-neutral-200 p-2">
                          <input
                            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            value={cellVal}
                            onChange={(e) => setCell(r.row_key, c.id, e.target.value)}
                            placeholder={c.ui?.placeholder ?? ""}
                          />
                        </td>
                      );
                    }

                    if (c.type === "long_text") {
                      return (
                        <td key={c.id} className="border-b border-neutral-200 p-2">
                          <textarea
                            className="w-full min-h-[90px] rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            value={cellVal}
                            onChange={(e) => setCell(r.row_key, c.id, e.target.value)}
                            placeholder={c.ui?.placeholder ?? ""}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={c.id} className="border-b border-neutral-200 p-2">
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
                          Unsupported column type: <span className="font-mono">{c.type}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="p-3 text-xs text-neutral-600">
              Add outcomes in the previous step to populate this table.
            </div>
          )}
        </div>
      );
    }


      function addItem() {
        if (items.length >= maxItems) return;
        const empty: Record<string, any> = {};
        for (const f of q.fields ?? []) empty[f.id] = "";
        setAnswers((a) => ({ ...a, [q.id]: [...items, empty] }));
      }

      function removeItem(index: number) {
        const next = items.filter((_, i) => i !== index);
        setAnswers((a) => ({ ...a, [q.id]: next }));
      }

      return (
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-xs text-neutral-600">
              Add {minItems > 0 ? `at least ${minItems}` : "an item"}.
            </p>
          )}

          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-600">Item {idx + 1}</p>
                <button
                  className="text-xs underline disabled:opacity-50"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= minItems}
                  type="button"
                >
                  Remove
                </button>
              </div>

              {(q.fields ?? []).map((f: any) => {
                const fVal = item?.[f.id] ?? "";

                if (f.type === "short_text") {
                  return (
                    <label key={f.id} className="block space-y-1">
                      <span className="text-xs text-neutral-700">
                        {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                      </span>
                      <input
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        value={fVal}
                        onChange={(e) => setItem(idx, f.id, e.target.value)}
                        placeholder={f.ui?.placeholder ?? ""}
                      />
                    </label>
                  );
                }

                if (f.type === "long_text") {
                  return (
                    <label key={f.id} className="block space-y-1">
                      <span className="text-xs text-neutral-700">
                        {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                      </span>
                      <textarea
                        className="w-full min-h-[100px] rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        value={fVal}
                        onChange={(e) => setItem(idx, f.id, e.target.value)}
                        placeholder={f.ui?.placeholder ?? ""}
                      />
                    </label>
                  );
                }

                if (f.type === "single_select") {
                  return (
                    <label key={f.id} className="block space-y-1">
                      <span className="text-xs text-neutral-700">
                        {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                      </span>
                      <select
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        value={fVal}
                        onChange={(e) => setItem(idx, f.id, e.target.value)}
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {(f.options ?? []).map((opt: any) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (f.type === "url") {
                  return (
                    <label key={f.id} className="block space-y-1">
                      <span className="text-xs text-neutral-700">
                        {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                      </span>
                      <input
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        value={fVal}
                        onChange={(e) => setItem(idx, f.id, e.target.value)}
                        placeholder={f.ui?.placeholder ?? "https://"}
                      />
                    </label>
                  );
                }

                // file support comes next
                if (f.type === "file") {
                  const uploaded = fVal && typeof fVal === "object" ? fVal : null;

                  return (
                    <div key={f.id} className="space-y-1">
                      <div className="text-xs text-neutral-700">
                        {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                      </div>

                      {uploaded ? (
                        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm">{uploaded.filename ?? "Uploaded file"}</div>
                            <div className="text-xs text-neutral-500">
                              {uploaded.contentType ?? "file"} • {uploaded.size ?? "?"} bytes
                            </div>
                          </div>

                          <button
                            className="text-xs underline"
                            type="button"
                            onClick={() => setItem(idx, f.id, null)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <input
                          className="block w-full text-sm"
                          type="file"
                          accept={Array.isArray(f.ui?.accept) ? f.ui.accept.join(",") : undefined}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              // optimistic placeholder
                              setItem(idx, f.id, { uploading: true, filename: file.name, size: file.size });

                              const meta = await uploadFile({
                                stepId: currentStep.id,
                                questionId: q.id,
                                fieldId: f.id,
                                file
                              });

                              setItem(idx, f.id, meta);
                            } catch (err: any) {
                              setItem(idx, f.id, null);
                              setError(err?.message ?? "Upload failed");
                              setStatus("error");
                            } finally {
                              // allow selecting same file again if needed
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      )}

                      <div className="text-[11px] text-neutral-500">
                        Uploads go directly to S3 using a presigned URL.
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={f.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
                    Unsupported field type in repeat_group: <span className="font-mono">{f.type}</span>
                  </div>
                );

              })}
            </div>
          ))}

          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            onClick={addItem}
            disabled={items.length >= maxItems}
            type="button"
          >
            {q.ui?.add_label ?? "Add item"}
          </button>
        </div>
      );
    }

    // POC: we’ll implement matrix + file next.
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        Unsupported question type in UI POC: <span className="font-mono">{q.type}</span>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="text-sm text-neutral-700">Loading wizard…</p>;
  }

  if (status === "error") {
    return (
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">Wizard</h1>
        <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => router.replace("/")}
          type="button"
        >
          Back home
        </button>
      </main>
    );
  }

  if (!cfg || !currentStep) {
    return <p className="text-sm text-neutral-700">Missing wizard config.</p>;
  }

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{cfg.title}</h1>
        <p className="text-sm text-neutral-600">
          Session: <span className="font-mono">{sessionId}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        {/* Main panel */}
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{currentStep.title}</h2>
              <p className="text-xs text-neutral-500">
                Step {currentStepIndex + 1} of {steps.length} • Gate: {currentStep.gate.mode}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={goPrev}
                disabled={!canGoPrev || status === "submitting"}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={submitStep}
                disabled={status === "submitting"}
                type="button"
              >
                {status === "submitting" ? "Submitting…" : "Submit for feedback"}
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={goNext}
                disabled={!canGoNext || (isHardGated && !evaluation?.step_pass)}
                title={isHardGated && !evaluation?.step_pass ? "Submit and pass to continue" : ""}
                type="button"
              >
                Next
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {currentStep.questions.length === 0 && (
              <p className="text-sm text-neutral-700">No questions in this step.</p>
            )}

            {currentStep.questions.map((q) => {
              const qEval = evaluation?.question_results?.find((r) => r.question_id === q.id);
              return (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium">
                      {q.label} {q.required ? <span className="text-red-600">*</span> : null}
                    </label>
                    {qEval && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          qEval.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {qEval.pass ? "Pass" : "Needs work"}
                      </span>
                    )}
                  </div>

                  {renderQuestion(q)}

                  {qEval && qEval.feedback?.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                      {qEval.feedback.slice(0, 4).map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {evaluation && (
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Step result</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    evaluation.step_pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {evaluation.step_pass ? "Pass" : "Fail"}
                </span>
              </div>

              {evaluation.global_feedback?.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {evaluation.global_feedback.slice(0, 4).map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              )}

              {isHardGated && !evaluation.step_pass && (
                <p className="text-xs text-neutral-600">
                  This step is hard-gated. Revise and resubmit to continue.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="space-y-4 rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold">Guidance</h3>

          {currentStep.content?.intro_md && (
            <p className="text-sm text-neutral-700">{mdToPlain(currentStep.content.intro_md)}</p>
          )}

          {currentStep.content?.why_md && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-600">Why this matters</p>
              <p className="text-sm text-neutral-700">{mdToPlain(currentStep.content.why_md)}</p>
            </div>
          )}

          {(currentStep.content?.resources?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-600">Resources</p>
              <ul className="space-y-2">
                {currentStep.content.resources!.map((r: any, idx: number) => (
                  <li key={idx} className="text-sm">
                    <a className="underline" href={r.url} target="_blank" rel="noreferrer">
                      {r.caption ?? r.url}
                    </a>
                    <div className="text-xs text-neutral-500">{r.type}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
