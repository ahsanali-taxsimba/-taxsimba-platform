"use client";
import { useState, useCallback } from "react";
import ExploreSection from "./_sections/ExploreSection";
import { Col, Container, Row } from "react-bootstrap";
import SmartTax from "./_sections/SmartTax";
import WhyReadBlogSection from "./_sections/WhyReadBlogSection";
import Link from "next/link";
import fetchJSON from "@/lib/fetchJSON";

import { getPublishedArticles, mergeArticlesWithApi } from "@/data/articles";

export default function BlogPageClient({
    articles = [],
    pagination,
    initialPage = 1,
    limit = 12,
    apiUrl,
    resourceData = {},
}) {
    // If no articles provided, use curated registry
    const initialItems = articles.length > 0 ? articles : getPublishedArticles();
    const [items, setItems] = useState(initialItems);
    const [pageInfo, setPageInfo] = useState(pagination);
    const [currentPage, setCurrentPage] = useState(pageInfo?.page || initialPage);
    const [loading, setLoading] = useState(false);

    const totalPages = pageInfo?.totalPages || (articles.length === 0 ? 1 : 1);

    const handlePageChange = useCallback(async (page) => {
        if (page < 1 || page > totalPages || page === currentPage || loading) return;
        setLoading(true);
        try {
            const url = `${apiUrl}?page=${page}&limit=${limit}&per_page=${limit}`;
            const data = await fetchJSON(url, { next: { revalidate: 0 } });
            const newArticles = data?.data?.articles || [];
            const newPagination = data?.data?.pagination || {
                totalPages: Math.ceil((data?.data?.total || 0) / limit) || 1,
                page: page,
                total: data?.data?.total || 0,
                limit: limit
            };

            // If API returns no articles, fall back to curated/static blogs on first page
            if (newArticles.length === 0 && page === 1) {
                setItems(getPublishedArticles());
            } else if (page === 1) {
                setItems(mergeArticlesWithApi(newArticles));
            } else {
                setItems(newArticles);
            }

            setPageInfo(newPagination);
            setCurrentPage(newPagination.page || page);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            console.error("Failed to load blogs", err);
            // Fallback to static blogs on error if we are on page 1
            if (page === 1) {
                setItems(getPublishedArticles());
            }
        } finally {
            setLoading(false);
        }
    }, [apiUrl, limit, totalPages, currentPage, loading]);

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h1 className="text-capitalize mb-3">UK Tax Guides &amp; Blog</h1>
                                <p className="mb-0">Practical guidance on Self Assessment, Making Tax Digital, landlords and sole traders — written to help you take the next step with TaxSimba.</p>
                            </div>
                        </Col>
                        <Col lg={6}>
                            <div className="breadcrum-img text-center">
                                <img src="/images/blog-bread.png" alt="TaxSimba UK tax guides and blog" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>


            <section className="blog-sec ptb-80">
                <Container>
                    <div className="common-title mb-lg-5 mb-4">
                        <h2>Latest guides</h2>
                    </div>
                    <Row>
                        {loading ? (
                            <Col xs={12}>
                                <div className="text-center py-5">
                                    <p className="mb-0">Loading articles...</p>
                                </div>
                            </Col>
                        ) : items?.length > 0 ? (
                            items.map((article) => {
                                const wordCount = (article?.excerpt || "").split(/\s+/).filter(Boolean).length;
                                const readTime = Math.max(1, Math.ceil(wordCount / 200));
                                return (
                                    <Col lg={4} className="mb-4" key={article?.id || article?.slug}>
                                        <div className="blog-card">
                                            <Link href={article?.slug ? `/blogs/${article.slug}` : "/blogs"}>
                                                <div className="blog-img">
                                                    <img
                                                        src={article?.featuredImage || "/images/tax_blog_default.png"}
                                                        alt={article?.featuredImageAlt || article?.title || "TaxSimba guide"}
                                                    />
                                                </div>
                                                <div className="blog-card-content mt-3">
                                                    <h3 className="h4">{article?.title || "Untitled"}</h3>
                                                    <p>{readTime} min read</p>
                                                </div>
                                            </Link>
                                        </div>
                                    </Col>
                                );
                            })
                        ) : (
                            <Col lg={4} className="mb-4">
                                <div className="blog-card">
                                    <Link href="/blogs">
                                        <div className="blog-img">
                                            <img src="/images/tax_blog_default.png" alt="TaxSimba tax guides" />
                                        </div>
                                        <div className="blog-card-content mt-3">
                                            <h3 className="h4">No articles available yet.</h3>
                                            <p>Check back soon</p>
                                        </div>
                                    </Link>
                                </div>
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
