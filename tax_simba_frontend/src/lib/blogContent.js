import {
  getArticleBySlug,
  getRelatedArticles,
  isPubliclyVisibleArticle,
  mergeArticlesWithApi,
  normalizeApiArticle,
  withResolvedArticleContent,
} from "@/data/articles";
import fetchJSON from "@/lib/fetchJSON";

const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";

export async function fetchApiBlogList({ page = 1, limit = 9 } = {}) {
  const url = `${apiBase()}resources/blogs?page=${page}&limit=${limit}&per_page=${limit}`;
  try {
    const data = await fetchJSON(url, { next: { revalidate: 0 } });
    const articles = data?.data?.articles || [];
    return {
      articles,
      pagination: data?.data?.pagination || null,
      resourceData: data?.data || {},
    };
  } catch (err) {
    console.error("Failed to load blogs list", err);
    return { articles: [], pagination: null, resourceData: {} };
  }
}

export async function getMergedBlogList({ page = 1, limit = 9, category } = {}) {
  const api = await fetchApiBlogList({ page, limit });
  let merged = mergeArticlesWithApi(api.articles);

  if (category) {
    const needle = String(category).toLowerCase();
    const aliases = {
      mtd: "making tax digital",
      "making-tax-digital": "making tax digital",
      sa: "self assessment",
      "self-assessment": "self assessment",
    };
    const target = aliases[needle] || needle;
    merged = merged.filter(
      (a) => String(a.category || "").toLowerCase() === target,
    );
  }

  const total = merged.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const pageItems = merged.slice(start, start + limit);

  return {
    articles: pageItems,
    pagination: {
      totalPages,
      page: safePage,
      total,
      limit,
    },
    resourceData: api.resourceData,
  };
}

export async function getBlogBySlug(slug) {
  const curatedAny = getArticleBySlug(slug, { includeUnpublished: true });
  if (curatedAny) {
    // Draft / unpublished curated records must not resolve via API fallback.
    if (!isPubliclyVisibleArticle(curatedAny)) {
      return null;
    }
    const blog = withResolvedArticleContent(curatedAny);
    return {
      blog,
      recentBlogs: getRelatedArticles(curatedAny, 4),
    };
  }

  try {
    const url = `${apiBase()}resources/blogs/${slug}`;
    const data = await fetchJSON(url, { next: { revalidate: 0 }, cache: "no-store" });
    if (data?.data?.blog || data?.data) {
      const payload = data.data.blog ? data.data : { blog: data.data, recentBlogs: [] };
      const blog = normalizeApiArticle(payload.blog);
      if (!isPubliclyVisibleArticle(blog)) return null;
      const recent = Array.isArray(payload.recentBlogs)
        ? payload.recentBlogs.map(normalizeApiArticle).filter(isPubliclyVisibleArticle)
        : getRelatedArticles(blog, 4);
      return { blog, recentBlogs: recent };
    }
  } catch (err) {
    console.error("Failed to fetch blog via API", err);
  }

  return null;
}
