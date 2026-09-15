import {
  getArticleBySlug,
  getRelatedArticles,
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

export async function getMergedBlogList({ page = 1, limit = 9 } = {}) {
  const api = await fetchApiBlogList({ page, limit });
  const merged = mergeArticlesWithApi(api.articles);

  // Simple client-side pagination over merged set when API is empty/partial
  const total = merged.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
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
  const curated = getArticleBySlug(slug);
  if (curated) {
    const blog = withResolvedArticleContent(curated);
    return {
      blog,
      recentBlogs: getRelatedArticles(curated, 4),
    };
  }

  try {
    const url = `${apiBase()}resources/blogs/${slug}`;
    const data = await fetchJSON(url, { next: { revalidate: 0 }, cache: "no-store" });
    if (data?.data?.blog || data?.data) {
      const payload = data.data.blog ? data.data : { blog: data.data, recentBlogs: [] };
      const blog = normalizeApiArticle(payload.blog);
      const recent = Array.isArray(payload.recentBlogs)
        ? payload.recentBlogs.map(normalizeApiArticle)
        : getRelatedArticles(blog, 4);
      return { blog, recentBlogs: recent };
    }
  } catch (err) {
    console.error("Failed to fetch blog via API", err);
  }

  return null;
}
