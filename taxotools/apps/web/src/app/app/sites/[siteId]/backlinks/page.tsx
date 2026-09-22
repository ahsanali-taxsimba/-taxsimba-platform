import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { prisma } from "@taxotools/database";

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

  const backlinks = await prisma.backlink.findMany({
    where: { siteId },
    include: { sourceDomain: true },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });

  // Seed a few stub backlinks for empty sites so UI is demonstrable
  if (!backlinks.length) {
    await prisma.backlink.createMany({
      data: [
        {
          siteId,
          sourceUrl: "https://news.example/seo-roundup",
          targetUrl: "https://example.com/",
          anchorText: "seo platform",
          toxicScore: 0.1,
        },
        {
          siteId,
          sourceUrl: "https://spammy.biz/links",
          targetUrl: "https://example.com/blog",
          anchorText: "click here",
          toxicScore: 0.82,
          relNofollow: true,
        },
      ],
    });
  }

  const rows = await prisma.backlink.findMany({
    where: { siteId },
    include: { sourceDomain: true },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Backlinks
        </p>
        <h1 className="font-display text-3xl font-semibold">Backlinks & outreach</h1>
        <p className="text-ink-500">
          Index, toxic scoring, and CRM hooks — wire a backlink API for live discovery
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Anchor</th>
              <th className="px-4 py-3">Toxic</th>
              <th className="px-4 py-3">Rel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-ink-50">
                <td className="px-4 py-3">{b.sourceUrl}</td>
                <td className="px-4 py-3">{b.anchorText}</td>
                <td className="px-4 py-3">
                  {b.toxicScore != null ? Math.round(b.toxicScore * 100) : "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {b.relNofollow ? "nofollow" : "follow"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
