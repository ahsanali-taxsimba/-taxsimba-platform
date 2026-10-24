/**
 * Public blog/article API consumed by tax_simba_frontend mergeArticlesWithApi / getBlogBySlug.
 * Serves automated live overlays so routine posts publish without a frontend rebuild.
 */
import { Router } from "express";

import { handler, httpError } from "../http/errors";
import { getLiveOverlay, listLiveOverlays } from "../content-automation/store";

export const blogsRouter = Router();

function present(overlay: Awaited<ReturnType<typeof getLiveOverlay>>) {
  if (!overlay) return null;
  const a = overlay.article;
  return {
    id: overlay.revisionId,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    content: a.content,
    metaTitle: a.metaTitle,
    metaDescription: a.metaDescription,
    category: a.category,
    audience: a.audience,
    tags: a.tags,
    publishedAt: overlay.firstPublishedAt,
    contentUpdatedAt: a.contentUpdatedAt,
    reviewedAt: a.contentUpdatedAt,
    authorName: a.authorName,
    reviewerName: a.reviewerName,
    featuredImage: a.featuredImage,
    featuredImageAlt: a.featuredImageAlt,
    ctaType: a.ctaType,
    relatedSlugs: a.relatedSlugs,
    relatedPages: a.relatedPages,
    sources: a.sources,
    status: "published",
    curated: false,
    revisionId: overlay.revisionId,
    readingMinutes: a.readingMinutes,
    iconKey: a.iconKey || "tax-guide",
    contentType: a.contentType || "Guide",
    isAutomatedOverlay: true,
    preservesCuratedSlug: Boolean(a.isUpdate),
  };
}

blogsRouter.get(
  "/resources/blogs",
  handler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || req.query.per_page || 9)));
    const all = (await listLiveOverlays()).map(present).filter(Boolean);
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const start = (page - 1) * limit;
    const articles = all.slice(start, start + limit);
    res.json({
      data: {
        articles,
        pagination: { page, limit, total, totalPages },
      },
    });
  }),
);

blogsRouter.get(
  "/resources/blogs/:slug",
  handler(async (req, res) => {
    const overlay = await getLiveOverlay(req.params.slug);
    if (!overlay) throw httpError(404, "Blog not found");
    res.json({
      data: {
        blog: present(overlay),
        recentBlogs: (await listLiveOverlays())
          .filter((o) => o.slug !== req.params.slug)
          .slice(0, 4)
          .map(present),
      },
    });
  }),
);
