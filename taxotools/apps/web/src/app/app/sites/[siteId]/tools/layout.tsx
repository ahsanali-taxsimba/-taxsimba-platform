import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { SiteToolkitNav } from "@/components/SiteToolkitNav";

export default async function SiteToolsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return (
    <div className="animate-rise">
      <div className="mb-6">
        <p className="text-sm text-ink-500">
          <Link href="/app/sites" className="hover:text-accent-dark">
            Sites
          </Link>{" "}
          /{" "}
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            {site.domain}
          </Link>{" "}
          / Tools
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-ink-100 bg-white p-4">
          <Link
            href={`/app/sites/${siteId}`}
            className="mb-4 block font-display text-lg font-semibold text-ink-950"
          >
            {site.name}
          </Link>
          <SiteToolkitNav siteId={siteId} />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
