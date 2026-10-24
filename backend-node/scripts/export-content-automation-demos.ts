import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { bootTestApp, dropTestDb } from "../tests/helpers/app";
import {
  runDemoNewArticle,
  runDemoUpdateExisting,
} from "../src/content-automation/pipeline/dailyRun";

async function main() {
  process.env.CONTENT_AUTOMATION_FIXTURE_MODE = "true";
  process.env.CONTENT_AUTOMATION_ENABLED = "true";
  process.env.CONTENT_AUTOMATION_PAUSED = "false";
  console.log("booting...");
  await bootTestApp();
  console.log("new article...");
  const created = await runDemoNewArticle();
  console.log("update guide...");
  const updated = await runDemoUpdateExisting();
  const outDir = join(__dirname, "../../docs/content-automation/demos");
  mkdirSync(outDir, { recursive: true });
  const pack = (job: any, label: string) => ({
    label,
    stage: job.stage,
    slug: job.draft?.slug,
    isUpdate: job.draft?.isUpdate,
    title: job.draft?.title,
    metaTitle: job.draft?.metaTitle,
    metaDescription: job.draft?.metaDescription,
    publishedAt: job.draft?.publishedAt,
    contentUpdatedAt: job.draft?.contentUpdatedAt,
    category: job.draft?.category,
    ctaType: job.draft?.ctaType,
    featuredImage: job.draft?.featuredImage,
    featuredImageAlt: job.draft?.featuredImageAlt,
    sources: job.draft?.sources,
    relatedPages: job.draft?.relatedPages,
    changeSummary: job.draft?.changeSummary,
    revisionId: job.publishedRevisionId,
    contentHtml: job.draft?.content,
    validationIssues: job.validationIssues || [],
    fixtureMode: true,
    note: "Fixture-mode pipeline demo (CONTENT_AUTOMATION_FIXTURE_MODE=true). Not live generation-API or production publish proof.",
  });
  const neu = pack(created, "NEW_ARTICLE");
  const upd = pack(updated, "UPDATED_GUIDE");
  writeFileSync(join(outDir, "new-article.json"), JSON.stringify(neu, null, 2));
  writeFileSync(join(outDir, "updated-guide.json"), JSON.stringify(upd, null, 2));
  const page = (d: any) =>
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"/><title>${d.metaTitle}</title><meta name="description" content="${String(
      d.metaDescription,
    ).replace(
      /"/g,
      "&quot;",
    )}"/><style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#111}.meta{color:#555;font-size:.92rem;margin:.4rem 0}h1{font-size:1.8rem}</style></head><body><p class="meta"><strong>${d.label}</strong> · stage=${d.stage} · slug=<code>${d.slug}</code> · isUpdate=${d.isUpdate}</p><p class="meta">publishedAt (first publication; preserved on updates): ${d.publishedAt}<br/>contentUpdatedAt: ${d.contentUpdatedAt}<br/>category: ${d.category} · CTA: ${d.ctaType}<br/>image: ${d.featuredImage}</p><h1>${d.title}</h1>${d.contentHtml}<hr/><p class="meta">Sources:<br/>${(
      d.sources || []
    )
      .map((s: any) => `• ${s.label}: ${s.url}`)
      .join("<br/>")}</p><p class="meta">${d.note}</p></body></html>`;
  writeFileSync(join(outDir, "new-article.preview.html"), page(neu));
  writeFileSync(join(outDir, "updated-guide.preview.html"), page(upd));
  console.log(
    JSON.stringify(
      {
        newStage: created.stage,
        newSlug: created.draft?.slug,
        updateStage: updated.stage,
        updateSlug: updated.draft?.slug,
        preservedPublishedAt: updated.draft?.publishedAt,
      },
      null,
      2,
    ),
  );
  await dropTestDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
