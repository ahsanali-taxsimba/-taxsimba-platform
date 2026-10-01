import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listSitesForUser } from "@/server/services/tenant.service";

export default async function SitesPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const sites = await listSitesForUser(user.id);

  return (
    <div className="space-y-6" data-testid="sites-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent-dark">Projects</p>
          <h1 className="font-display text-3xl font-semibold text-ink-950">Your sites</h1>
          <p className="mt-1 text-ink-500">
            Each project gets health scores, rank charts, AEO bars, and Auto SEO toolkits.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Add site
        </Link>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => {
          const activity = site._count.keywords + site._count.pages + site._count.crawls;
          return (
            <li key={site.id}>
              <Link
                href={`/app/sites/${site.id}`}
                className="block rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition-colors hover:border-accent hover:bg-accent-soft/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold text-ink-950">{site.name}</p>
                    <p className="text-sm text-ink-500">{site.domain}</p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-dark">
                    {activity > 0 ? "Active" : "New"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ink-50 px-2 py-3">
                    <p className="font-display text-lg font-semibold text-ink-900">
                      {site._count.keywords}
                    </p>
                    <p className="text-[11px] text-ink-500">Keywords</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-2 py-3">
                    <p className="font-display text-lg font-semibold text-ink-900">
                      {site._count.crawls}
                    </p>
                    <p className="text-[11px] text-ink-500">Crawls</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-2 py-3">
                    <p className="font-display text-lg font-semibold text-ink-900">
                      {site._count.pages}
                    </p>
                    <p className="text-[11px] text-ink-500">Pages</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-accent-dark">Open dashboard →</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
