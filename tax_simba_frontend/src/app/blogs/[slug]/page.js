import { notFound } from "next/navigation";
import BlogDetailsClientPage from "./page.client";
import { getBlogBySlug } from "@/lib/blogContent";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  buildPageMetadata,
  absoluteUrl,
} from "@/lib/seo";

export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const blogDetails = await getBlogBySlug(slug);

  if (!blogDetails?.blog) {
    return {
      title: "Guide not found | TaxSimba",
      description: "The requested TaxSimba guide could not be found.",
    };
  }

  const blog = blogDetails.blog;
  const metaTitle = blog.metaTitle || blog.title;
  return buildPageMetadata({
    title: metaTitle.includes("TaxSimba") ? metaTitle : `${metaTitle} | TaxSimba`,
    description: blog.metaDescription || blog.excerpt || "",
    path: `/blogs/${slug}`,
    ogImage: blog.featuredImage || "/images/logo.png",
    ogImageAlt: blog.featuredImageAlt || blog.title,
    type: "article",
    keywords: [blog.title, blog.category, "TaxSimba", "UK tax"].filter(Boolean),
  });
}

export default async function BlogPage({ params }) {
  const { slug } = await params;
  const blogDetails = await getBlogBySlug(slug);
  if (!blogDetails?.blog) notFound();

  const blog = blogDetails.blog;
  const jsonLd = [
    articleJsonLd(blog),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides & Blog", path: "/blogs" },
      { name: blog.title, path: `/blogs/${blog.slug}` },
    ]),
  ];

  return (
    <>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <BlogDetailsClientPage blogDetails={blogDetails} canonicalUrl={absoluteUrl(`/blogs/${blog.slug}`)} />
    </>
  );
}
