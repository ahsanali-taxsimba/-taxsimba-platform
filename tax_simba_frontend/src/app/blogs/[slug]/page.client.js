"use client";

import Link from "next/link";
import TranslatedRichText from "@/components/TranslatedRichText";
import {
  TranslatedHeading,
  TranslatedParagraph,
} from "@/components/TranslatedContent";
import GetStartedButton from "@/components/re-used/GetStartedButton";
import ArticleIcon from "@/components/articles/ArticleIcon";
import {
  getCtaForArticle,
  getContextualServiceCta,
  resolveDeadlineSensitiveHtml,
} from "@/data/articles";

const GENERAL_NOTICE =
  "This guide provides general information based on published HMRC guidance. Tax rules and individual circumstances can change. If you use TaxSimba, the services included will be those confirmed in your selected package and engagement terms.";

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

function readingMinutes(article) {
  if (article?.readingMinutes) return article.readingMinutes;
  const wordCount = String(article?.content || article?.excerpt || "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function extractToc(html = "") {
  const items = [];
  const re = /<h2[^>]*>(.*?)<\/h2>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(html)) !== null) {
    const label = match[1].replace(/<[^>]+>/g, "").trim();
    if (!label) continue;
    index += 1;
    const id = `section-${index}`;
    items.push({ id, label });
  }
  return items;
}

function injectHeadingIds(html = "", toc = []) {
  let i = 0;
  return html.replace(/<h2([^>]*)>/gi, (full, attrs) => {
    const item = toc[i];
    i += 1;
    if (!item) return full;
    if (/\sid=/.test(attrs)) return full;
    return `<h2${attrs} id="${item.id}">`;
  });
}

function splitAfterSecondSection(html = "") {
  const matches = [...html.matchAll(/<\/h2>/gi)];
  if (matches.length < 2) {
    return { before: html, after: "" };
  }
  // Insert service card after the second H2 section body: find end of second following block roughly at third h2 or end
  const third = html.search(/<h2[^>]*>/gi);
  // Find position after content following 2nd h2 — use index of 3rd h2 if present
  let count = 0;
  let insertAt = -1;
  const re = /<h2[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    count += 1;
    if (count === 3) {
      insertAt = m.index;
      break;
    }
  }
  if (insertAt === -1) {
    return { before: html, after: "" };
  }
  return { before: html.slice(0, insertAt), after: html.slice(insertAt) };
}

export default function BlogDetailsClientPage({ blogDetails }) {
  const blog = blogDetails?.blog;
  const cta = getCtaForArticle(blog);
  const serviceCta = getContextualServiceCta(blog);
  const reviewed = formatDate(blog?.reviewedAt);
  const published = formatDate(blog?.publishedAt);
  const minutes = readingMinutes(blog);
  const rawHtml = resolveDeadlineSensitiveHtml(blog?.content || "");
  const toc = extractToc(rawHtml);
  const htmlWithIds = injectHeadingIds(rawHtml, toc);
  const { before, after } = splitAfterSecondSection(htmlWithIds);
  const categoryCrumb =
    blog?.category === "Making Tax Digital"
      ? "Making Tax Digital"
      : blog?.category || "Guides";

  return (
    <article className="compact-article">
      <header className="compact-article-hero">
        <div className="compact-article-hero-inner">
          <nav className="compact-article-crumb" aria-label="Breadcrumb">
            <Link href="/blogs">Blog &amp; Guides</Link>
            <span aria-hidden="true"> / </span>
            <span>{categoryCrumb}</span>
          </nav>

          <div className="compact-article-title-row">
            <ArticleIcon iconKey={blog?.iconKey || "tax-guide"} size={30} />
            <TranslatedHeading className="compact-article-title">
              {blog?.title}
            </TranslatedHeading>
          </div>

          {blog?.excerpt ? (
            <TranslatedParagraph className="compact-article-dek">
              {blog.excerpt}
            </TranslatedParagraph>
          ) : null}

          <div className="compact-article-meta">
            {blog?.contentType ? <span>{blog.contentType}</span> : null}
            {reviewed ? <span>Reviewed {reviewed}</span> : null}
            {!reviewed && published ? <span>Published {published}</span> : null}
            {blog?.reviewerName ? <span>Reviewed by {blog.reviewerName}</span> : null}
            <span>{minutes} min read</span>
            {blog?.audience ? <span>{blog.audience.replace(/-/g, " ")}</span> : null}
          </div>

          {Array.isArray(blog?.sources) && blog.sources.length > 0 ? (
            <p className="compact-article-checked">
              <a href="#official-sources">Checked against GOV.UK guidance</a>
            </p>
          ) : null}
        </div>
      </header>

      <div className="compact-article-main">
        {toc.length > 0 ? (
          <aside className="compact-article-toc" aria-label="In this guide">
            <h2 className="h6">In this guide</h2>
            <ol>
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}

        <div className="compact-article-body">
          <TranslatedRichText className="blog-content" html={before} />

          <aside className="compact-article-service" aria-label="TaxSimba service">
            <p className="compact-article-service-kicker">Accountant-led support</p>
            <h2 className="h4">Want help with the next step?</h2>
            <p>
              Compare what is included in TaxSimba packages before you buy. Email-only
              support and accountant-led delivery — not DIY software alone.
            </p>
            <GetStartedButton text={serviceCta.label} href={serviceCta.href} variant="pro-blue" />
          </aside>

          {after ? <TranslatedRichText className="blog-content" html={after} /> : null}

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
            <div className="compact-article-sources" id="official-sources">
              <h2 className="h5">Official sources</h2>
              <ul>
                {blog.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="compact-article-notice">{GENERAL_NOTICE}</p>
            </div>
          ) : (
            <p className="compact-article-notice mt-4">{GENERAL_NOTICE}</p>
          )}

          {blogDetails?.recentBlogs?.length ? (
            <div className="compact-article-related mt-5 mb-4">
              <h2 className="h4">Related guides</h2>
              <ul className="compact-related-list">
                {blogDetails.recentBlogs.slice(0, 4).map((item) => (
                  <li key={item.slug || item.id}>
                    <Link href={`/blogs/${item.slug}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mb-5">
            <GetStartedButton text={cta.label} href={cta.href} variant="pro-blue" />
          </div>
        </div>
      </div>
    </article>
  );
}
