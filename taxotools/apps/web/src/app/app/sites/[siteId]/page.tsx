import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";
import { TOOLKIT_GROUPS } from "@taxotools/shared";

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

  return (
    <div className="animate-rise space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
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
        <Link
          href={`/app/sites/${siteId}/tools`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Open full toolkit
        </Link>
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

      {TOOLKIT_GROUPS.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{group.name}</h2>
            <p className="text-sm text-ink-500">{group.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <Link
                key={tool.id}
                href={`/app/sites/${siteId}/tools/${tool.path}`}
                className="rounded-xl border border-ink-100 bg-white p-4 transition hover:border-accent"
              >
                <p className="font-medium text-ink-900">{tool.name}</p>
                <p className="mt-1 text-xs text-ink-500">Open tool →</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
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
