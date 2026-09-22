import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";

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

  const modules = [
    { href: `/app/sites/${siteId}/keywords`, label: "Keywords & ranks", desc: "Explorer, clusters, SERP features" },
    { href: `/app/sites/${siteId}/technical`, label: "Technical SEO", desc: "Crawls, issues, CWV hooks" },
    { href: `/app/sites/${siteId}/content`, label: "Content & AI writer", desc: "Scores, articles, programmatic SEO" },
    { href: `/app/sites/${siteId}/aeo`, label: "AEO / GEO", desc: "AI citations & share of voice" },
    { href: `/app/sites/${siteId}/backlinks`, label: "Backlinks", desc: "Index, toxic score, outreach" },
    { href: `/app/sites/${siteId}/reports`, label: "Reports", desc: "White-label exports" },
  ];

  return (
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-sm text-ink-500">
          <Link href="/app/sites" className="hover:text-accent-dark">
            Sites
          </Link>{" "}
          / {site.domain}
        </p>
        <h1 className="font-display text-3xl font-semibold text-ink-950">{site.name}</h1>
        <p className="text-ink-500">{site.url}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Health score" value={health.healthScore ?? "—"} />
        <Metric label="Keywords" value={site._count.keywords} />
        <Metric label="Pages" value={site._count.pages} />
        <Metric
          label="AI SOV (avg)"
          value={
            sov.length
              ? `${Math.round((sov.reduce((a, s) => a + s.shareOfVoice, 0) / sov.length) * 100)}%`
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-ink-100 bg-white p-5 transition hover:border-accent"
          >
            <p className="font-display text-lg font-semibold">{m.label}</p>
            <p className="mt-1 text-sm text-ink-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
