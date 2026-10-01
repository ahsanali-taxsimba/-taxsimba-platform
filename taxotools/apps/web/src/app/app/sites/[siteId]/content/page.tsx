import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAIJobs } from "@/server/services/ai-content.service";
import { ContentAIPanel } from "@/components/ContentAIPanel";

export default async function ContentPage({
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
  const jobs = await listAIJobs(user.id, siteId);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Content
        </p>
        <h1 className="font-display text-3xl font-semibold">Content intelligence & AI writer</h1>
        <p className="text-ink-500">
          Scoring, outlines, articles, FAQ/schema generation — credits billed per job
        </p>
      </div>
      <ContentAIPanel siteId={siteId} jobs={jobs} />
    </div>
  );
}
