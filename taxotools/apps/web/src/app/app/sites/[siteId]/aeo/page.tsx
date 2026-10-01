import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listVisibility, aeoShareOfVoice } from "@/server/services/aeo.service";
import { AeoPanel } from "@/components/AeoPanel";

export default async function AeoPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const { siteId } = await params;
  const [records, shareOfVoice] = await Promise.all([
    listVisibility(user.id, siteId),
    aeoShareOfVoice(user.id, siteId),
  ]);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / AEO · GEO
        </p>
        <h1 className="font-display text-3xl font-semibold">AI visibility</h1>
        <p className="text-ink-500">
          Brand mentions, citations, and share of voice across AI engines + Google AI Overviews
        </p>
      </div>
      <AeoPanel siteId={siteId} records={records} shareOfVoice={shareOfVoice} />
    </div>
  );
}
