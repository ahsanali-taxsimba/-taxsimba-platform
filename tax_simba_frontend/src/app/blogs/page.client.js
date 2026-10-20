"use client";
import { useMemo, useState, useCallback } from "react";
import { Col, Container, Row } from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mergeArticlesWithApi } from "@/data/articles";
import ArticleCard from "@/components/articles/ArticleCard";
import fetchJSON from "@/lib/fetchJSON";

const FILTERS = [
  { id: "all", label: "All guides", category: "" },
  { id: "mtd", label: "Making Tax Digital", category: "mtd" },
  { id: "sa", label: "Self Assessment", category: "sa" },
];

function filterLocal(articles, categoryId) {
  if (!categoryId || categoryId === "all") return articles;
  const target =
    categoryId === "mtd"
      ? "making tax digital"
      : categoryId === "sa"
        ? "self assessment"
        : String(categoryId).toLowerCase();
  return articles.filter(
    (a) => String(a.category || "").toLowerCase() === target,
  );
}

export default function BlogPageClient({
  articles = [],
  publishedArticles = [],
  pagination,
  initialPage = 1,
  limit = 12,
  apiUrl,
  initialCategory = "all",
}) {
  const router = useRouter();
  // Prefer server-provided published registry (honours release env). Never
  // re-derive publication on the client from process.env alone.
  const curated = useMemo(
    () => (publishedArticles.length ? publishedArticles : articles),
    [publishedArticles, articles],
  );
  const initialItems =
    articles.length > 0 ? articles : filterLocal(curated, initialCategory);
  const [items, setItems] = useState(initialItems);
  const [pageInfo, setPageInfo] = useState(pagination);
  const [currentPage, setCurrentPage] = useState(pageInfo?.page || initialPage);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState(initialCategory || "all");

  const publishedCount = curated.length;
  const totalPages = pageInfo?.totalPages || 1;

  const applyFilter = useCallback(
    (filterId) => {
      setActiveFilter(filterId);
      const next = filterLocal(curated, filterId);
      setItems(next.slice(0, limit));
      setPageInfo({
        totalPages: Math.max(1, Math.ceil(next.length / limit)),
        page: 1,
        total: next.length,
        limit,
      });
      setCurrentPage(1);
      const href =
        filterId === "all" || !filterId
          ? "/blogs"
          : `/blogs?category=${encodeURIComponent(filterId)}`;
      router.replace(href, { scroll: false });
    },
    [curated, limit, router],
  );

  const handlePageChange = useCallback(
    async (page) => {
      if (page < 1 || page > totalPages || page === currentPage || loading) return;
      setLoading(true);
      try {
        if (activeFilter !== "all") {
          const filtered = filterLocal(curated, activeFilter);
          const start = (page - 1) * limit;
          setItems(filtered.slice(start, start + limit));
          setCurrentPage(page);
          setPageInfo((prev) => ({ ...prev, page, total: filtered.length }));
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        const url = `${apiUrl}?page=${page}&limit=${limit}&per_page=${limit}`;
        const data = await fetchJSON(url, { next: { revalidate: 0 } });
        const newArticles = data?.data?.articles || [];
        const newPagination = data?.data?.pagination || {
          totalPages: Math.ceil((data?.data?.total || 0) / limit) || 1,
          page,
          total: data?.data?.total || 0,
          limit,
        };

        if (newArticles.length === 0 && page === 1) {
          setItems(filterLocal(curated, "all").slice(0, limit));
        } else if (page === 1) {
          setItems(mergeArticlesWithApi(newArticles).slice(0, limit));
        } else {
          const merged = mergeArticlesWithApi(newArticles);
          const start = (page - 1) * limit;
          setItems(merged.slice(start, start + limit));
        }

        setPageInfo(newPagination);
        setCurrentPage(newPagination.page || page);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        console.error("Failed to load blogs", err);
        if (page === 1) {
          setItems(filterLocal(curated, activeFilter).slice(0, limit));
        }
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, limit, totalPages, currentPage, loading, activeFilter, curated],
  );

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={8}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3">Blog &amp; Guides</h1>
                <p className="mb-0">
                  Practical guidance on Self Assessment, Making Tax Digital, landlords
                  and sole traders — written to help you take the next step with TaxSimba.
                  {publishedCount > 0 ? (
                    <>
                      {" "}
                      <span className="d-inline-block">
                        {publishedCount} published guide{publishedCount === 1 ? "" : "s"}
                        .
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="blog-sec ptb-80">
        <Container>
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
            <div className="common-title mb-0">
              <h2>Latest guides</h2>
            </div>
            <div className="article-filter-row" role="tablist" aria-label="Guide categories">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                  className={`article-filter-btn${activeFilter === filter.id ? " active" : ""}`}
                  onClick={() => applyFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <Row>
            {loading ? (
              <Col xs={12}>
                <div className="text-center py-5">
                  <p className="mb-0">Loading articles...</p>
                </div>
              </Col>
            ) : items?.length > 0 ? (
              items.map((article) => (
                <Col lg={4} md={6} className="mb-4" key={article?.id || article?.slug}>
                  <ArticleCard article={article} />
                </Col>
              ))
            ) : (
              <Col xs={12}>
                <p className="mb-0">
                  No published guides in this category yet.{" "}
                  <Link href="/blogs">View all guides</Link>
                </p>
              </Col>
            )}
          </Row>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="prev"
                disabled={currentPage <= 1 || loading}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                ← Prev
              </button>
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  className={`page-btn ${page === currentPage ? "active" : ""}`}
                  disabled={loading}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="next"
                disabled={currentPage >= totalPages || loading}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
