"use client";

import { useCallback, useMemo, useState } from "react";
import fetchJSON from "@/lib/fetchJSON";
import { TranslatedHeadingTwo } from "@/components/TranslatedContent";
import Link from "next/link";
import { FaPlus } from "react-icons/fa";

export default function ExploreSection({
    articles = [],
    pagination,
    initialPage = 1,
    limit = 20,
    apiUrl,
    resourceData = {},
}) {
    const [items, setItems] = useState(articles);
    const [pageInfo, setPageInfo] = useState(pagination);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [loading, setLoading] = useState(false);

    const hasMore = useMemo(() => {
        if (!pageInfo?.page || !pageInfo?.totalPages) return false;
        return pageInfo.page < pageInfo.totalPages;
    }, [pageInfo]);

    const nextPage = useMemo(() => (pageInfo?.page || currentPage) + 1, [pageInfo, currentPage]);

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || !apiUrl) return;
        setLoading(true);
        try {
            const url = `${apiUrl}?page=${nextPage}&limit=${limit}`;
            const data = await fetchJSON(url, { next: { revalidate: 0 } });
            const newArticles = data?.data?.articles || [];
            const nextPagination = data?.data?.pagination || null;
            setItems((prev) => [...prev, ...newArticles]);
            setPageInfo(nextPagination);
            setCurrentPage(nextPage);
        } catch (err) {
            console.error("Failed to load more blogs", err);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, hasMore, limit, nextPage]);

    return (
        <>
            <section className="explore">
                <div className="container">
                    <div className="global_heading">
                        <TranslatedHeadingTwo>Explore Our Most Popular Topics</TranslatedHeadingTwo>
                    </div>
                    <div className="row">

                        {items.map((article) => {
                            const featuredImage = article?.featuredImage || "/images/blog.png";
                            const supportText = article?.subCategory?.name || "Tax support";
                            const slugPath = article?.slug ? `/blogs/${article.slug}` : "#";

                            return (
                                <div className="col-sm-6 col-md-4" key={article?.id || article?.slug}>
                                    <div className="blogs" style={{ backgroundImage: `url(${featuredImage})` }}>
                                        <div className="blog_bx_top">
                                            <div className="support">{supportText}</div>
                                            <span className="plus_btn">
                                                <FaPlus />
                                            </span>
                                        </div>
                                        <h2>{article?.title || "Untitled"}</h2>
                                        <div className="lrn_more">
                                            <Link href={slugPath}>Learn More</Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    </div>

                    {hasMore && (
                        <div className="see_more">
                            <button className="basic_btn cean_btn" onClick={handleLoadMore} disabled={loading}>
                                {loading ? "Loading..." : "See More"}
                            </button>
                        </div>
                    )}

                </div>
            </section>

        </>
    );
}
