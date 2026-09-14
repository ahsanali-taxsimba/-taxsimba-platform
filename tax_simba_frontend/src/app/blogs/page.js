import fetchJSON from "@/lib/fetchJSON";
import BlogPageClient from "./page.client";

import { staticBlogs } from "@/data/staticBlogs";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";
const blogsUrl = `${apiBase}resources/blogs`;
const DEFAULT_LIMIT = 9;

async function getBlogs(page = 1, limit = DEFAULT_LIMIT) {
    try {
        // Many APIs use limit, per_page or pageSize. We'll use limit as seen in the response.
        const url = `${blogsUrl}?page=${page}&limit=${limit}&per_page=${limit}`;
        const data = await fetchJSON(url, { next: { revalidate: 0 } });
        const articles = data?.data?.articles || [];

        if (articles.length === 0 && page === 1) {
            return {
                articles: staticBlogs,
                pagination: { totalPages: 1, page: 1, total: staticBlogs.length, limit: DEFAULT_LIMIT },
                resourceData: {},
            };
        }

        return {
            articles: articles,
            pagination: data?.data?.pagination || {
                totalPages: Math.ceil((data?.data?.total || 0) / limit) || 1,
                page: page,
                total: data?.data?.total || 0,
                limit: limit
            },
            resourceData: data?.data || {},
        };
    } catch (err) {
        console.error("Failed to load blogs list", err);
        return {
            articles: page === 1 ? staticBlogs : [],
            pagination: page === 1 ? { totalPages: 1, page: 1, total: staticBlogs.length, limit: DEFAULT_LIMIT } : null,
            resourceData: {},
        };
    }
}

export function generateMetadata() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
    const canonicalUrl = `${baseUrl}/blogs`;
    const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

    return {
        title: "TaxSimba Blog | UK Tax Tips, Guides & Updates",
        description: "Read the latest UK tax tips, news, and how-to guides from TaxSimba. Stay informed on self-assessment, capital gains, compliance, and more.",
        robots: "index, follow",
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            locale: "en_GB",
            type: "website",
            siteName: "TaxSimba",
            title: "TaxSimba Blog | UK Tax Tips, Guides & Updates",
            description: "Read the latest UK tax tips, news, and how-to guides from TaxSimba. Stay informed on self-assessment, capital gains, compliance, and more.",
            url: canonicalUrl,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 628,
                    alt: "TaxSimba — Self Assessment Tax UK, online tax consultants",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            site: "@TaxSimba",
            title: "TaxSimba Blog | UK Tax Tips, Guides & Updates",
            description: "Read the latest UK tax tips, news, and how-to guides from TaxSimba. Stay informed on self-assessment, capital gains, compliance, and more.",
            images: [
                {
                    url: ogImageUrl,
                    alt: "TaxSimba logo",
                },
            ],
        },
    };
}

export default async function BlogPage() {
    const { articles, pagination, resourceData } = await getBlogs(1, DEFAULT_LIMIT);
    return (
        <BlogPageClient
            articles={articles}
            pagination={pagination}
            initialPage={1}
            limit={DEFAULT_LIMIT}
            apiUrl={blogsUrl}
            resourceData={resourceData}
        />
    );
}
