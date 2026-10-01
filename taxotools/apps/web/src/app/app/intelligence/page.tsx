import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { IntelligencePanel } from "@/components/IntelligencePanel";

export default async function IntelligencePage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  return <IntelligencePanel />;
}
