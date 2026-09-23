import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { BacklinksEnginePanel } from "@/components/BacklinksEnginePanel";

export default async function BacklinksPage({
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
  await getSiteForUser(user.id, siteId);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Backlinks
        </p>
        <h1 className="font-display text-3xl font-semibold">Backlink Engine</h1>
        <p className="text-ink-500">
          Multi-source external crawl (Ahrefs · Semrush · Majestic) with toxic scoring, disavow,
          and competitor monitoring.
        </p>
      </div>
      <BacklinksEnginePanel siteId={siteId} />
      <p className="text-sm text-ink-500">
        Also open{" "}
        <Link
          href={`/app/sites/${siteId}/tools/backlink-engine`}
          className="text-accent-dark"
        >
          Backlink Engine tool
        </Link>{" "}
        or{" "}
        <Link
          href={`/app/sites/${siteId}/tools/disavow-manager`}
          className="text-accent-dark"
        >
          Disavow Manager
        </Link>
        .
      </p>
    </div>
  );
}
