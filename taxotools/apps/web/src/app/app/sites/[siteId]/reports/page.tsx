import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { prisma } from "@taxotools/database";
import { ReportActions } from "@/components/ReportActions";

export default async function ReportsPage({
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
  const site = await getSiteForUser(user.id, siteId);
  const reports = await prisma.report.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Reports
        </p>
        <h1 className="font-display text-3xl font-semibold">Reports</h1>
        <p className="text-ink-500">Scheduled and on-demand SEO / AEO exports</p>
      </div>
      <ReportActions workspaceId={site.workspaceId} siteId={siteId} />
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span> · {r.status} ·{" "}
            {new Date(r.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
