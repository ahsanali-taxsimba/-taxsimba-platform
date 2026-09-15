"use client";

import Link from "next/link";
import TranslatedRichText from "@/components/TranslatedRichText";
import {
  TranslatedHeading,
  TranslatedHeadingThree,
  TranslatedParagraph,
} from "@/components/TranslatedContent";
import GetStartedButton from "@/components/re-used/GetStartedButton";
import { getCtaForArticle, resolveDeadlineSensitiveHtml } from "@/data/articles";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function readingMinutes(text = "") {
  const wordCount = String(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export default function BlogDetailsClientPage({ blogDetails }) {
  const blog = blogDetails?.blog;
  const cta = getCtaForArticle(blog);
  const published = formatDate(blog?.publishedAt);
  const reviewed = formatDate(blog?.reviewedAt);

  return (
    <div className="container">
      <nav className="pt-4 mb-3" aria-label="Breadcrumb">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link href="/">Home</Link>
          </li>
          <li className="breadcrumb-item">
            <Link href="/blogs">Guides &amp; Blog</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {blog?.title}
          </li>
        </ol>
      </nav>

      <div className="blog-header">
        <img
          src={blog?.featuredImage || "/images/tax_blog_default.png"}
          alt={blog?.featuredImageAlt || blog?.title || "TaxSimba guide"}
        />
        <div className="blog-header-content">
          {blog?.category ? (
            <p className="mb-2 text-uppercase small fw-semibold opacity-75">{blog.category}</p>
          ) : null}
          <TranslatedHeading className="blog-title">{blog?.title}</TranslatedHeading>
          <TranslatedParagraph className="blog-meta">
            By {blog?.authorName || "TaxSimba Tax Team"}
            {published ? ` · Published ${published}` : ""}
            {reviewed && reviewed !== published ? ` · Reviewed ${reviewed}` : ""}
            {` · ${readingMinutes(blog?.content || blog?.excerpt)} min read`}
          </TranslatedParagraph>
          <div className="get_started_centered">
            <GetStartedButton text={cta.label} href={cta.href} variant="pro-blue" />
          </div>
        </div>
      </div>

      <div className="blog-layout">
        <div>
          <TranslatedRichText
            className="blog-content"
            html={resolveDeadlineSensitiveHtml(blog?.content || "")}
          />

          {Array.isArray(blog?.relatedPages) && blog.relatedPages.length > 0 ? (
            <div className="mt-5 mb-4">
              <h2 className="h4">Related TaxSimba pages</h2>
              <ul>
                {blog.relatedPages.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(blog?.sources) && blog.sources.length > 0 ? (
            <div className="mt-4 mb-5">
              <h2 className="h5">Sources &amp; further reading</h2>
              <ul>
                {blog.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="small opacity-75 mb-0">
                This article is general information for UK taxpayers, not personal tax advice.
                {blog?.reviewerName ? ` Reviewed by ${blog.reviewerName}.` : ""}
              </p>
            </div>
          ) : null}

          <div className="mb-5">
            <GetStartedButton text={cta.label} href={cta.href} variant="pro-blue" />
          </div>
        </div>

        <aside className="sidebar">
          <div className="sidebar-box">
            <TranslatedHeadingThree>Related guides</TranslatedHeadingThree>
            {blogDetails?.recentBlogs?.slice(0, 4).map((item) => (
              <div className="recent-post" key={item.slug || item.id}>
                <img
                  src={item?.featuredImage || "/images/tax_blog_default.png"}
                  alt={item?.featuredImageAlt || item?.title || "Related guide"}
                />
                <Link href={`/blogs/${item?.slug}`}>
                  <span>{item?.title}</span>
                </Link>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
