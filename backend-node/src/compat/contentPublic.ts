/**
 * Public marketing / CMS-compat read adapters for the client landing surfaces.
 *
 * Returns empty arrays safely when catalogue content is not seeded — never invents
 * marketing copy. Does not expose admin/CMS write surfaces (those remain S6 HIDE).
 */
import { Router } from "express";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import { FAQ_CATEGORIES } from "../domain/helpcentre";
import { handler, httpError } from "../http/errors";
import { keysToCamel } from "./caseMap";
import { sendCompatSuccess } from "./envelope";

export const compatContentPublicRouter = Router();

function activeFaqsQuery(): Doc {
  return { is_active: true };
}

/** Public FAQ list — active rows only (staff manage via /admin/faqs*). */
compatContentPublicRouter.get(
  "/faqs",
  handler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50) || 50));
    let rows = cleanMany(
      (await col("faqs").find(activeFaqsQuery()).sort({ order: 1 }).limit(500).toArray()) as Doc[],
    );
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.question ?? "")
            .toLowerCase()
            .includes(q) ||
          String(r.answer ?? "")
            .toLowerCase()
            .includes(q),
      );
    }
    const total = rows.length;
    const slice = rows.slice((page - 1) * limit, page * limit);
    const Faqs = slice.map((f) =>
      keysToCamel({
        ...f,
        status: f.is_active !== false,
      }),
    );
    sendCompatSuccess(
      res,
      {
        Faqs,
        faqs: Faqs,
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        categories: FAQ_CATEGORIES,
      },
      "OK",
    );
  }),
);

/** Approved marketing reviews / testimonials. Empty array is legitimate. */
async function approvedReviewsPayload(body: Record<string, unknown> = {}): Promise<Doc> {
  const page = Math.max(1, Number(body.page ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(body.limit ?? 10) || 10));
  // Prefer an explicit marketing collection if present; otherwise empty (do not invent).
  const marketing = cleanMany(
    (await col("marketing_reviews")
      .find({ status: { $in: ["approved", "APPROVED", 1, true] }, is_active: { $ne: false } })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray()) as Doc[],
  );
  const total = marketing.length;
  const reviews = marketing.slice((page - 1) * limit, page * limit).map((r) =>
    keysToCamel({
      id: r.id,
      name: r.name ?? r.author_name ?? "Customer",
      role: r.role ?? r.title ?? "",
      rating: r.rating ?? 5,
      text: r.text ?? r.body ?? r.comment ?? "",
      status: "approved",
    }),
  );
  return {
    reviews,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit || 1)) },
  };
}

compatContentPublicRouter.post(
  "/reviews/approved",
  handler(async (req, res) => {
    sendCompatSuccess(res, await approvedReviewsPayload((req.body ?? {}) as Record<string, unknown>), "OK");
  }),
);

compatContentPublicRouter.get(
  "/reviews/approved",
  handler(async (req, res) => {
    sendCompatSuccess(
      res,
      await approvedReviewsPayload({
        page: req.query.page,
        limit: req.query.limit,
      }),
      "OK",
    );
  }),
);

/** Alias observed in some Toxel network traces. */
compatContentPublicRouter.get(
  "/approved",
  handler(async (req, res) => {
    sendCompatSuccess(
      res,
      await approvedReviewsPayload({
        page: req.query.page,
        limit: req.query.limit,
      }),
      "OK",
    );
  }),
);

/** Resource / blog articles — empty when CMS content not seeded. */
async function blogsPayload(query: Record<string, unknown>): Promise<Doc> {
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10) || 10));
  const type = typeof query.type === "string" ? query.type : null;
  const filter: Doc = { is_active: { $ne: false }, status: { $nin: ["draft", "DRAFT", 0] } };
  if (type) {
    filter.$or = [
      { type },
      { category: type },
      { audience: type },
      { tags: type },
    ];
  }
  const articles = cleanMany(
    (await col("articles")
      .find(filter)
      .sort({ published_at: -1, created_at: -1 })
      .limit(limit)
      .toArray()) as Doc[],
  ).map((a) =>
    keysToCamel({
      id: a.id,
      title: a.title ?? "",
      slug: a.slug ?? a.id,
      excerpt: a.excerpt ?? a.summary ?? "",
      type: a.type ?? a.category ?? null,
      imageUrl: a.image_url ?? a.imageUrl ?? null,
      publishedAt: a.published_at ?? a.created_at ?? null,
    }),
  );
  return {
    articles,
    pagination: { total: articles.length, limit, page: 1 },
  };
}

compatContentPublicRouter.get(
  "/resources/blogs",
  handler(async (req, res) => {
    sendCompatSuccess(res, await blogsPayload(req.query as Record<string, unknown>), "OK");
  }),
);

compatContentPublicRouter.get(
  "/resources/blogs/:slug",
  handler(async (req, res) => {
    const slug = req.params.slug;
    const article = (await col("articles").findOne({
      $or: [{ slug }, { id: slug }],
      is_active: { $ne: false },
    })) as Doc | null;
    if (!article) throw httpError(404, "Article not found");
    sendCompatSuccess(res, keysToCamel(clean(article)), "OK");
  }),
);

compatContentPublicRouter.get(
  "/blogs",
  handler(async (req, res) => {
    sendCompatSuccess(res, await blogsPayload(req.query as Record<string, unknown>), "OK");
  }),
);

/** Resource categories for navbar / footer. Empty array is safe. */
compatContentPublicRouter.get(
  "/resources/categories",
  handler(async (_req, res) => {
    const rows = cleanMany(
      (await col("resource_categories")
        .find({ is_active: { $ne: false } })
        .sort({ display_order: 1 })
        .limit(100)
        .toArray()) as Doc[],
    );
    sendCompatSuccess(
      res,
      rows.map((c) =>
        keysToCamel({
          id: c.id,
          name: c.name ?? "",
          slug: c.slug ?? "",
          displayOrder: c.display_order ?? 0,
          subCategories: Array.isArray(c.sub_categories) ? c.sub_categories : [],
        }),
      ),
      "OK",
    );
  }),
);

compatContentPublicRouter.get(
  "/categories",
  handler(async (_req, res) => {
    const rows = cleanMany(
      (await col("resource_categories")
        .find({ is_active: { $ne: false } })
        .sort({ display_order: 1 })
        .limit(100)
        .toArray()) as Doc[],
    );
    sendCompatSuccess(
      res,
      rows.map((c) =>
        keysToCamel({
          id: c.id,
          name: c.name ?? "",
          slug: c.slug ?? "",
          displayOrder: c.display_order ?? 0,
          subCategories: Array.isArray(c.sub_categories) ? c.sub_categories : [],
        }),
      ),
      "OK",
    );
  }),
);

/** Marketing services list (legacy CMS). Prefer cms_services, fall back to services. */
compatContentPublicRouter.get(
  "/services",
  handler(async (_req, res) => {
    let rows = cleanMany(
      (await col("cms_services")
        .find({ is_active: { $ne: false } })
        .sort({ display_order: 1 })
        .limit(100)
        .toArray()) as Doc[],
    );
    if (!rows.length) {
      rows = cleanMany(
        (await col("services")
          .find({ is_active: { $ne: false } })
          .limit(50)
          .toArray()) as Doc[],
      );
    }
    sendCompatSuccess(
      res,
      rows.map((s) =>
        keysToCamel({
          id: s.id,
          name: s.name ?? s.title ?? "",
          slug: s.slug ?? s.code ?? s.id,
          description: s.description ?? "",
          isActive: s.is_active !== false,
        }),
      ),
      "OK",
    );
  }),
);

compatContentPublicRouter.get(
  "/services/:slug",
  handler(async (req, res) => {
    const slug = req.params.slug;
    let row = (await col("cms_services").findOne({
      $or: [{ slug }, { id: slug }],
      is_active: { $ne: false },
    })) as Doc | null;
    if (!row) {
      row = (await col("services").findOne({
        $or: [{ slug }, { code: slug }, { id: slug }],
        is_active: { $ne: false },
      })) as Doc | null;
    }
    if (!row) throw httpError(404, "Service not found");
    sendCompatSuccess(res, keysToCamel(clean(row)), "OK");
  }),
);

/** Active tax-rate rows for calculator loader — empty array if none configured. */
compatContentPublicRouter.get(
  "/tax-rates/active",
  handler(async (_req, res) => {
    const rows = cleanMany(
      (await col("tax_rates")
        .find({ is_active: { $ne: false }, status: { $nin: ["inactive", "INACTIVE", 0] } })
        .limit(100)
        .toArray()) as Doc[],
    );
    sendCompatSuccess(
      res,
      rows.map((r) =>
        keysToCamel({
          id: r.id,
          country: r.country ?? "UK",
          taxYear: r.tax_year ?? r.taxYear ?? "",
          settings: r.settings ?? {},
          isActive: true,
        }),
      ),
      "OK",
    );
  }),
);

/** Alias seen in Toxel traces for tax-rates/active. */
compatContentPublicRouter.get(
  "/active",
  handler(async (_req, res) => {
    const rows = cleanMany(
      (await col("tax_rates")
        .find({ is_active: { $ne: false } })
        .limit(100)
        .toArray()) as Doc[],
    );
    sendCompatSuccess(
      res,
      rows.map((r) =>
        keysToCamel({
          id: r.id,
          country: r.country ?? "UK",
          taxYear: r.tax_year ?? r.taxYear ?? "",
          settings: r.settings ?? {},
          isActive: true,
        }),
      ),
      "OK",
    );
  }),
);
