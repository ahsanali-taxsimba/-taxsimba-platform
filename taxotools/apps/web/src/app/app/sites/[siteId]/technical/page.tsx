import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listCrawls, siteHealthSummary } from "@/server/services/crawl.service";
import { CrawlPanel } from "@/components/CrawlPanel";
import { CrawlerMasterPanel } from "@/components/CrawlerMasterPanel";

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
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Technical
        </p>
        <h1 className="font-display text-3xl font-semibold">Technical SEO</h1>
        <p className="text-ink-500">
          Health score: {health.healthScore ?? "—"} · Critical:{" "}
          {health.issueCounts.CRITICAL} · High: {health.issueCounts.HIGH}
          {" · "}
          <span className="font-medium text-ink-700">
            {health.dataSource === "live-http" ? "Live HTTP data" : "Awaiting first live crawl"}
          </span>
        </p>
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold">Live site audit</h2>
        <div className="mt-4">
          <CrawlPanel
            siteId={siteId}
            crawls={crawls}
            healthScore={health.healthScore}
            dataSource={health.dataSource}
          />
        </div>
      </div>
      <CrawlerMasterPanel siteId={siteId} />
    </div>
  );
}
