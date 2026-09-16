import BlogPageClient from "./page.client";
import { getMergedBlogList } from "@/lib/blogContent";
import { buildPageMetadata } from "@/lib/seo";

const DEFAULT_LIMIT = 9;
const blogsUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/"}resources/blogs`;

export function generateMetadata() {
  return buildPageMetadata({
    title: "UK Tax Guides & Blog | Self Assessment and MTD | TaxSimba",
    description:
      "Practical UK tax guides from TaxSimba: Self Assessment, Making Tax Digital, landlords, sole traders and what to do when HMRC contacts you.",
    path: "/blogs",
    ogImageAlt: "TaxSimba tax guides and blog",
  });
}

export default async function BlogPage() {
  const { articles, pagination, resourceData } = await getMergedBlogList({
    page: 1,
    limit: DEFAULT_LIMIT,
  });

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
