"use client";
import { useMemo, useState, useCallback } from "react";
import { Col, Container, Row } from "react-bootstrap";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getSeasonalFocus } from "@/data/articleSeasonalFocus";
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

function HouseIcon() {
  return (
    <svg
      className="guide-hub-landlord-icon"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="25" height="25" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 14.5L14 9l6 5.5V20a1 1 0 0 1-1 1h-3.2v-4.2h-3.6V21H9a1 1 0 0 1-1-1v-5.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BlogPageClient({
  articles = [],
  publishedArticles = [],
  pagination,
  initialPage = 1,
  limit = 9,
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
  const showingFeatured =
    activeFilter === "all" && !query.trim() && currentPage === 1;

  const applyFilter = useCallback(
    (filterId) => {
      setActiveFilter(filterId);
      const next = filterLocal(curated, filterId).filter((article) =>
        `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
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

  const handleSearch = useCallback(
    (value) => {
      setQuery(value);
      const filtered = filterLocal(curated, activeFilter).filter((article) =>
        `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`
          .toLowerCase()
          .includes(value.trim().toLowerCase()),
      );
      setItems(filtered.slice(0, limit));
      setCurrentPage(1);
      setPageInfo({
        page: 1,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        limit,
      });
    },
    [curated, activeFilter, limit],
  );

  const handlePageChange = useCallback(
    async (page) => {
      if (page < 1 || page > totalPages || page === currentPage || loading) return;
      setLoading(true);
      try {
        const filtered = filterLocal(curated, activeFilter).filter((article) =>
          `${article.title} ${article.excerpt} ${article.query || ""} ${(article.tags || []).join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        );
        const start = (page - 1) * limit;
        setItems(filtered.slice(start, start + limit));
        setCurrentPage(page);
        setPageInfo({
          page,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          limit,
        });
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
      <section className="guide-hub-masthead" aria-labelledby="guide-hub-heading">
        <Container>
          <Row className="guide-hub-hero align-items-center g-4 g-lg-5">
            <Col lg={6}>
              <div className="guide-hub-intro">
                <h1 id="guide-hub-heading">Practical answers. Clear next steps.</h1>
                <p className="guide-hub-lead">
                  Self Assessment, Making Tax Digital and landlord tax guides.
                </p>
                {publishedCount > 0 ? (
                  <p className="guide-hub-count sr-only">
                    {publishedCount} published guide{publishedCount === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </div>
            </Col>
            <Col lg={6}>
              <figure className="guide-hub-hero-media">
                <Image
                  src="/images/articles/self-assessment-for-landlords-2025-26-1440.webp"
                  alt=""
                  width={1440}
                  height={480}
                  className="guide-hub-hero-img"
                  priority
                  sizes="(max-width: 991px) 100vw, 540px"
                />
              </figure>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="guide-hub-landlord-strip" aria-label="Landlord tax help">
        <Container>
          <div className="guide-hub-landlord-inner">
            <div className="guide-hub-landlord-copy">
              <HouseIcon />
              <p>
                <strong>Renting out a property?</strong> Find annual tax-return
                support, ongoing MTD help and practical property guides.
              </p>
            </div>
            <Link href="/landlords" className="guide-hub-landlord-link">
              Explore the landlord hub →
            </Link>
          </div>
        </Container>
      </section>

      <section className="blog-sec guide-hub-listing ptb-80">
        <Container>
          <div className="guide-hub-toolbar">
            <div className="common-title mb-0">
              <h2>{showingFeatured ? "Featured guides" : "Explore our guides"}</h2>
            </div>
            <div className="guide-hub-search">
              <label htmlFor="guide-search" className="visually-hidden">
                Search guides
              </label>
              <span className="guide-hub-search-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id="guide-search"
                type="search"
                className="form-control"
                placeholder="Search guides"
                value={query}
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>
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

          <p className="guide-hub-status" role="status">
            {pageInfo?.total ?? publishedCount} guides found
          </p>

          <Row className="guide-hub-grid">
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

      {focus ? (
        <section className="guide-seasonal-focus" aria-label="Current filing focus">
          <Container>
            <h2>{focus.title}</h2>
            <p>{focus.body}</p>
            <ul>
              {focus.links.map(([slug, label]) => (
                <li key={slug}>
                  <Link href={`/blogs/${slug}`}>{label}</Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
