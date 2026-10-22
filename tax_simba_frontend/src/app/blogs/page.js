import BlogPageClient from "./page.client";
import { getMergedBlogList } from "@/lib/blogContent";

import { buildPageMetadata } from "@/lib/seo";

const DEFAULT_LIMIT = 10;
const blogsUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/"}resources/blogs`;

export function generateMetadata() {
  return buildPageMetadata({
    title: "Blog & Guides | Self Assessment and MTD | TaxSimba",
    description:
      "Practical UK tax guides from TaxSimba: Self Assessment, Making Tax Digital, landlords, sole traders and what to do when HMRC contacts you.",
    path: "/blogs",
    ogImageAlt: "TaxSimba Blog & Guides",
  });
}

export default async function BlogPage({ searchParams }) {
  const params = await searchParams;
  const category = typeof params?.category === "string" ? params.category : "";
  const { articles, pagination, resourceData, publishedArticles } = await getMergedBlogList({
    page: 1,
    limit: DEFAULT_LIMIT,
    category: category || undefined,
  });
  // Server-resolved published registry so client filters/counts match release env.


  return (
    <BlogPageClient
      articles={articles}
      publishedArticles={publishedArticles}
      pagination={pagination}
      initialPage={1}
      limit={DEFAULT_LIMIT}
      apiUrl={blogsUrl}
      resourceData={resourceData}
      initialCategory={category || "all"}
    />
  );
}
