import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getAccountContext } from "@/lib/auth";
import { listSitesForUser } from "@/server/services/tenant.service";
import { usageSummary } from "@/server/services/usage.service";

export default async function AppDashboardPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const [account, sites] = await Promise.all([
    getAccountContext(user.id),
    listSitesForUser(user.id),
  ]);

  if (!account) redirect("/onboarding");
  if (!sites.length) redirect("/onboarding");

  const usage = await usageSummary(account.id);
  const plan = account.subscription?.plan;

  return (
    <div className="animate-rise space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-950">Overview</h1>
        <p className="mt-1 text-ink-500">
          {plan?.name} plan · {sites.length} site{sites.length === 1 ? "" : "s"} · workspace health
          at a glance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {usage.items
          .filter((i) => ["SITES", "KEYWORDS", "CRAWLS", "AEO_SCANS"].includes(i.metric))
          .map((item) => (
            <div key={item.metric} className="rounded-xl border border-ink-100 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-ink-500">
                {item.metric.replace("_", " ")}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
                {item.used}
                <span className="text-base font-normal text-ink-300">
                  /{item.limit < 0 ? "∞" : item.limit}
                </span>
              </p>
            </div>
          ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Sites</h2>
          <Link href="/onboarding" className="text-sm font-medium text-accent-dark">
            Add site
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3">Crawls</th>
                <th className="px-4 py-3">Pages</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-ink-50 hover:bg-ink-50/80">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/sites/${site.id}`}
                      className="font-medium text-ink-900 hover:text-accent-dark"
                    >
                      {site.name}
                    </Link>
                    <p className="text-xs text-ink-500">{site.domain}</p>
                  </td>
                  <td className="px-4 py-3">{site._count.keywords}</td>
                  <td className="px-4 py-3">{site._count.crawls}</td>
                  <td className="px-4 py-3">{site._count.pages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { href: sites[0] ? `/app/sites/${sites[0].id}/keywords` : "#", label: "Keyword intel" },
          { href: sites[0] ? `/app/sites/${sites[0].id}/technical` : "#", label: "Site health" },
          { href: sites[0] ? `/app/sites/${sites[0].id}/aeo` : "#", label: "AEO / GEO" },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-ink-100 bg-white p-5 transition hover:border-accent"
          >
            <p className="font-display text-lg font-semibold">{c.label}</p>
            <p className="mt-1 text-sm text-ink-500">Open module →</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
