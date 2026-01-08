// app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  // Always jump into the real flow (start -> creates session -> /w/[sessionId])
  redirect("/start");
}
