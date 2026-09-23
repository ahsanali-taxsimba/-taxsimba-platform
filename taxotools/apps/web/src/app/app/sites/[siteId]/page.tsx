import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";
import { TOOLKIT_GROUPS } from "@taxotools/shared";
import { SiteOverviewMotion } from "@/components/SiteOverviewMotion";

export default async function SiteOverviewPage({
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
  let site;
  try {
    site = await getSiteForUser(user.id, siteId);
  } catch {
    notFound();
  }

  const [health, sov] = await Promise.all([
    siteHealthSummary(user.id, siteId),
    aeoShareOfVoice(user.id, siteId),
  ]);

  const sovAvg = sov.length
    ? `${Math.round((sov.reduce((a, s) => a + s.shareOfVoice, 0) / sov.length) * 100)}%`
    : "—";

  return (
    <SiteOverviewMotion
      siteId={siteId}
      siteName={site.name}
      domain={site.domain}
      url={site.url}
      healthScore={health.healthScore}
      keywordCount={site._count.keywords}
      pageCount={site._count.pages}
      sovAvg={sovAvg}
      groups={TOOLKIT_GROUPS.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        tools: g.tools.map((t) => ({ id: t.id, name: t.name, path: t.path })),
      }))}
    />
  );
}
