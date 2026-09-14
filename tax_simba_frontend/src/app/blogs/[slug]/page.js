import fetchJSON from '@/lib/fetchJSON';
import BlogDetailsClientPage from './page.client';
import { staticBlogs } from '@/data/staticBlogs';

export const revalidate = 0;

const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://taxsimba.co.uk';

async function getBlog(slug, { allowNull = false } = {}) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
        const url = `${apiUrl}resources/blogs/${slug}`;
        const data = await fetchJSON(url, { next: { revalidate: 0 }, cache: "no-store" });
        if (data?.data) return data.data;
    } catch (err) {
        console.error("Failed to fetch blog via API, checking static data", err);
    }

    // Fallback to static data
    const staticBlog = staticBlogs.find(b => b.slug === slug);
    if (staticBlog) {
        return {
            blog: staticBlog,
            recentBlogs: staticBlogs.filter(b => b.slug !== slug)
        };
    }

    return null;
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const blogDetails = await getBlog(slug, { allowNull: true });

    if (!blogDetails?.blog) {
        return {
            title: 'Blog not found | TaxSimba',
            description: 'The requested service could not be found.',
        };
    }

    const blog = blogDetails.blog;
    const url = `${baseUrl}/blogs/${slug}`;
    const title = `${blog?.metaTitle || blog?.title} | TaxSimba`;
    const description = blog?.metaDescription || blog?.excerpt || "";
    const ogImageUrl = blog?.featuredImage
        ? blog.featuredImage
        : new URL("/images/logo.png", baseUrl).toString();

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title,
            description,
            url,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 628,
                    alt: blog?.title || "TaxSimba blog",
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [
                {
                    url: ogImageUrl,
                    alt: blog?.title || "TaxSimba blog",
                },
            ],
        },
        keywords: [
            blog?.title,
            blog?.tagline,
            'TaxSimba blogs',
            'tax advisor',
            'uk tax',
        ],
    };
}

export default async function BlogPage({ params }) {
    const { slug } = await params;
    const blogDetails = await getBlog(slug);
    return (
        <BlogDetailsClientPage blogDetails={blogDetails}/>
    );
}
