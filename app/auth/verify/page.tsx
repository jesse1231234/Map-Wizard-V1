// app/auth/verify/page.tsx
import { redirect } from "next/navigation";

export default function VerifyPage() {
  // Ignore magic-link verification while testing full wizard flow
  redirect("/start");
}
