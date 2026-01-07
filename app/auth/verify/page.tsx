import { Suspense } from "react";
import VerifyClient from "./verify-client";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6">
          <h1 className="text-xl font-semibold">Signing you in…</h1>
          <p className="text-sm text-neutral-700">Loading…</p>
        </main>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
