import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listCrawls, siteHealthSummary } from "@/server/services/crawl.service";
import { CrawlPanel } from "@/components/CrawlPanel";

export default async function TechnicalPage({
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
  const [crawls, health] = await Promise.all([
    listCrawls(user.id, siteId),
    siteHealthSummary(user.id, siteId),
  ]);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Technical
        </p>
        <h1 className="font-display text-3xl font-semibold">Site health</h1>
        <p className="text-ink-500">
          Health score: {health.healthScore ?? "—"} · Critical:{" "}
          {health.issueCounts.CRITICAL} · High: {health.issueCounts.HIGH}
        </p>
      </div>
      <CrawlPanel siteId={siteId} crawls={crawls} healthScore={health.healthScore} />
    </div>
  );
}
