"use client";
import { useMemo, useState, useCallback } from "react";
import { Col, Container, Row } from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {getSeasonalFocus} from "@/data/articleSeasonalFocus";
import ArticleCard from "@/components/articles/ArticleCard";


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
  limit = 10,
  apiUrl,
  initialCategory = "all",
}) {
  const router = useRouter();
  const focus = getSeasonalFocus();
  // Prefer server-provided published registry (honours release env). Never
  // re-derive publication on the client from process.env alone.
  const curated = useMemo(
    () => (publishedArticles.length ? publishedArticles : articles),
    [publishedArticles, articles],
  );
  const initialItems =
    articles.length > 0 ? articles : filterLocal(curated, initialCategory);
  const [query, setQuery] = useState("");
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
      const next = filterLocal(curated, filterId).filter((article) =>
        `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()),
      );
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
    [curated, limit, router, query],
  );

  const handlePageChange = useCallback(
    async (page) => {
      if (page < 1 || page > totalPages || page === currentPage || loading) return;
      setLoading(true);
      try {
        const filtered = filterLocal(curated, activeFilter).filter((article) =>
          `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()),
        );
        const start = (page - 1) * limit;
        setItems(filtered.slice(start, start + limit));
        setCurrentPage(page);
        setPageInfo({ page, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)), limit });
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
    [limit, totalPages, currentPage, loading, activeFilter, curated, query],
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
    <div className="editorial-guide-hub">
      <section className="guide-hub-masthead py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={12}>
              <div className="guide-hub-intro text-center">
                <p className="premium-kicker">Blog &amp; Guides</p>
                <h1 className="mb-3">Clear answers. Less tax stress.</h1>
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

      {focus ? <section className="guide-seasonal-focus" aria-label="Current filing focus"><Container><h2>{focus.title}</h2><p>{focus.body}</p><ul>{focus.links.map(([slug,label])=><li key={slug}><Link href={`/blogs/${slug}`}>{label}</Link></li>)}</ul></Container></section> : null}
      <section className="guide-seasonal-focus" aria-label="Landlord tax help"><Container><h2>Renting out a property?</h2><p>Find annual tax-return support, ongoing MTD help and guides organised around your rental situation.</p><Link href="/landlords">Explore the landlord hub →</Link></Container></section>
      <section className="blog-sec ptb-80">
        <Container>
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
            <div className="common-title mb-0">
              <h2>{activeFilter === "all" && !query && currentPage <= 2 ? "Featured guides" : "Explore our guides"}</h2>
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

          <div className="mb-4">
            <label htmlFor="guide-search" className="form-label">Search guides</label>
            <input id="guide-search" type="search" className="form-control" placeholder="Try MTD, receipts or rental income" value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                const filtered = filterLocal(curated, activeFilter).filter((article) =>
                  `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`.toLowerCase().includes(value.trim().toLowerCase()),
                );
                setItems(filtered.slice(0, limit));
                setCurrentPage(1);
                setPageInfo({ page: 1, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)), limit });
              }} />
            <p className="mt-2 mb-0" role="status">{pageInfo?.total ?? publishedCount} guides found</p>
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
                <Col lg={6} md={6} className="mb-4" key={article?.id || article?.slug}>
                  <ArticleCard article={article} />
                </Col>
              ))
            ) : (
              <Col xs={12}>
                <p className="mb-0">
                  No guides match your search and category.{" "}
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
                  aria-current={page === currentPage ? "page" : undefined}
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
    </div>
  );
}
