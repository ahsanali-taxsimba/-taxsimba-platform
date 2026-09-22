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
    <div className="animate-rise space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sites</h1>
          <p className="text-ink-500">Projects under your workspaces</p>
        </div>
        <Link
          href="/onboarding"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Add site
        </Link>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => (
          <li key={site.id}>
            <Link
              href={`/app/sites/${site.id}`}
              className="block rounded-xl border border-ink-100 bg-white p-5 hover:border-accent"
            >
              <p className="font-display text-xl font-semibold">{site.name}</p>
              <p className="text-sm text-ink-500">{site.domain}</p>
              <p className="mt-3 text-xs text-ink-500">
                {site._count.keywords} keywords · {site._count.crawls} crawls · {site._count.pages}{" "}
                pages
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
