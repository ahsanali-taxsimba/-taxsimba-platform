import { prisma } from "@taxotools/database";
import { uploadReportHtml } from "@taxotools/integrations";

export async function processReport(payload: Record<string, unknown>) {
  const reportId = String(payload.reportId);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      site: {
        include: {
          _count: { select: { keywords: true, pages: true, backlinks: true } },
        },
      },
      workspace: true,
    },
  });
  if (!report) throw new Error("Report not found");

  const health = report.siteId
    ? await prisma.crawl.findFirst({
        where: { siteId: report.siteId, status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
      })
    : null;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${report.title}</title></head>
<body style="font-family:Georgia,serif;padding:40px;color:#121A2B">
  <h1>${report.whiteLabel && report.workspace.brandName ? report.workspace.brandName : "Taxotools"}</h1>
  <h2>${report.title}</h2>
  <p>Workspace: ${report.workspace.name}</p>
  ${
    report.site
      ? `<p>Site: ${report.site.domain}</p>
  <ul>
    <li>Keywords: ${report.site._count.keywords}</li>
    <li>Pages crawled: ${report.site._count.pages}</li>
    <li>Backlinks indexed: ${report.site._count.backlinks}</li>
    <li>Latest crawl issues: ${health?.issuesFound ?? "n/a"}</li>
  </ul>`
      : ""
  }
  <p>Generated ${new Date().toISOString()}</p>
</body></html>`;

  const uploaded = await uploadReportHtml(report.id, html);

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: uploaded.mode === "live" || uploaded.mode === "skipped" ? "COMPLETED" : "COMPLETED",
      finishedAt: new Date(),
      storageKey: uploaded.storageKey,
    },
  });

  return {
    reportId: updated.id,
    storageKey: uploaded.storageKey,
    bytes: uploaded.bytes,
    storageMode: uploaded.mode,
    storageError: uploaded.error || null,
  };
}
