"use client";
import { useState, useCallback } from "react";
import ExploreSection from "./_sections/ExploreSection";
import { Col, Container, Row } from "react-bootstrap";
import SmartTax from "./_sections/SmartTax";
import WhyReadBlogSection from "./_sections/WhyReadBlogSection";
import Link from "next/link";
import fetchJSON from "@/lib/fetchJSON";

import { staticBlogs } from "@/data/staticBlogs";

export default function BlogPageClient({
    articles = [],
    pagination,
    initialPage = 1,
    limit = 12,
    apiUrl,
    resourceData = {},
}) {
    // If no articles provided, use static blogs
    const initialItems = articles.length > 0 ? articles : staticBlogs;
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

            // If API returns no articles, fall back to static blogs on first page
            if (newArticles.length === 0 && page === 1) {
                setItems(staticBlogs);
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
                setItems(staticBlogs);
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
                                <h2 className="text-capitalize mb-3">Expert Tax Insights</h2>
                                <p className="mb-0">Stay updated with the latest tax news, tips, and guidance from Taxsimba's team of experts.</p>
                            </div>
                        </Col>
                        <Col lg={6}>
                            <div className="breadcrum-img text-center">
                                <img src="/images/blog-bread.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>


            <section className="blog-sec ptb-80">
                <Container>
                    <div className="common-title mb-lg-5 mb-4">
                        <h2>Our Latest Articles</h2>
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
                                            <Link href={article?.slug ? `/blogs/${article.slug}` : "/blog-details"}>
                                                <div className="blog-img">
                                                    <img src={article?.featuredImage || "/images/tax_blog_default.png"} alt={article?.title || "img"} />
                                                </div>
                                                <div className="blog-card-content mt-3">
                                                    <h4>{article?.title || "Untitled"}</h4>
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
                                    <Link href="/blog-details">
                                        <div className="blog-img">
                                            <img src="/images/tax_blog_default.png" alt="img" />
                                        </div>
                                        <div className="blog-card-content mt-3">
                                            <h4>No articles available yet.</h4>
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
