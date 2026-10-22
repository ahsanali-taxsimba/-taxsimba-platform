"use client";

import Link from "next/link";
import TranslatedRichText from "@/components/TranslatedRichText";
import {
  TranslatedHeading,
  TranslatedParagraph,
} from "@/components/TranslatedContent";
import GetStartedButton from "@/components/re-used/GetStartedButton";
import {getArticleAction} from "@/data/articleQualityActions";
import { getLandlordJourney } from "@/data/landlordJourney";
import ArticleTools from "@/components/articles/ArticleTools";
import ArticleIcon from "@/components/articles/ArticleIcon";
import ArticleArtwork from "@/components/articles/ArticleArtwork";
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
    const existing = String(match[0]).match(/\sid=["']([^"']+)["']/i)?.[1];
    const base = label.toLowerCase().replace(/&[^;]+;/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${index}`;
    const id = existing || `${base}-${index}`;
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

export default function BlogDetailsClientPage({ blogDetails }) {
  const blog = blogDetails?.blog;
  const cta = getCtaForArticle(blog);
  const serviceCta = getContextualServiceCta(blog);
  const action = getArticleAction(blog);
  const reviewed = formatDate(blog?.reviewedAt);
  const published = formatDate(blog?.publishedAt);
  const updated = formatDate(blog?.contentUpdatedAt);
  const minutes = readingMinutes(blog);
  let rawHtml = resolveDeadlineSensitiveHtml(blog?.content || "");
  // The quick-answer panel replaces the same opening paragraph in the body.
  if (blog?.premiumReady) rawHtml = rawHtml.replace(/^\s*<p>[\s\S]*?<\/p>\s*/i, "");
  const toolLink = ["mtd-accountant-cost","self-assessment-accountant-cost"].includes(blog?.slug) ? {id:"quote-tool",label:"Compare two quotes"} : ["mtd-cumulative-quarterly-updates","correct-mtd-quarterly-update"].includes(blog?.slug) ? {id:"cumulative-tool",label:"Try the cumulative totals calculator"} : blog?.slug === "sold-rental-property-60-day-tax" ? {id:"property-tool",label:"Count 60 days from completion"} : null;
  const toc = extractToc(rawHtml);
  const htmlWithIds = injectHeadingIds(rawHtml, toc);
  const categoryCrumb =
    blog?.category === "Making Tax Digital"
      ? "Making Tax Digital"
      : blog?.category || "Guides";

  return (
    <article className={`compact-article${blog?.premiumReady ? " premium-article" : ""}`}>
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
              {blog.dek || blog.excerpt}
            </TranslatedParagraph>
          ) : null}

          <div className="compact-article-meta">
            <span>By {blog?.authorName || "TaxSimba"}</span>
            {blog?.contentType ? <span>{blog.contentType}</span> : null}
            {reviewed ? <span>Reviewed {reviewed}</span> : null}
            {!reviewed && published ? <span>Published {published}</span> : null}
            {updated ? <span>Updated {updated}</span> : null}
            {blog?.reviewerName ? <span>Reviewed by {blog.reviewerName}</span> : null}
            <span>{minutes} min read</span>
            {blog?.audience ? <span>{blog.audience.replace(/-/g, " ")}</span> : null}
          </div>

          <ArticleArtwork article={blog} hero />

          {Array.isArray(blog?.sources) && blog.sources.length > 0 ? (
            <p className="compact-article-checked">
              <a href="#official-sources">Read the sources</a>
            </p>
          ) : null}
        </div>
      </header>

      <div className="compact-article-main">
        {toc.length > 0 ? (
          <aside className="compact-article-toc" aria-label="In this guide">
            <details className="article-contents-disclosure">
            <summary>In this guide</summary>
            <ol>
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ol>
            </details>
          </aside>
        ) : null}

        <div className="compact-article-body">
          {blog?.premiumReady && blog?.answer ? (
            <section className="premium-answer" aria-labelledby="quick-answer">
              <span className="premium-answer-icon" aria-hidden="true">✧</span>
              <div><h2 id="quick-answer">The quick answer</h2><p>{blog.answer}</p></div>
            </section>
          ) : null}
          {action?.timing ? <aside className="article-timing" aria-label="Deadline context"><h2>{action.timing.heading}</h2><p>{action.timing.body}</p><a href={action.timing.source}>Check the HMRC guidance</a></aside> : null}
          {toolLink ? <p><a href={`#${toolLink.id}`}>{toolLink.label} ↓</a></p> : null}
          <TranslatedRichText html={htmlWithIds} />
          <ArticleTools slug={blog?.slug} />
          {blog?.checklist?.length && !blog?.editorialRevisionVersion ? (
            <section className="premium-checklist" aria-labelledby="action-checklist">
              <p className="premium-kicker">Practical next steps</p>
              <h2 id="action-checklist">Your three-point checklist</h2>
              <ol>{blog.checklist.map((item, index) => <li key={item}>
                {blog?.details?.[index] ? <details><summary>{item}</summary><p>{blog.details[index]}</p></details> : item}
              </li>)}</ol>
            </section>
          ) : null}

          {!blog?.editorialRevisionVersion && (blog?.slug === "mtd-accountant-cost" || blog?.slug === "self-assessment-accountant-cost") ? (
            <section className="premium-comparison" aria-labelledby="compare-service">
              <p className="premium-kicker">Compare like for like</p>
              <h2 id="compare-service">Questions to ask before you buy</h2>
              <div className="premium-table-wrap"><table><thead><tr><th>Check</th><th>Why it matters</th></tr></thead><tbody>
                <tr><td>What work is included?</td><td>Low headline prices may exclude records, corrections or advice.</td></tr>
                <tr><td>Who checks the figures?</td><td>Understand whether you are buying software access or accountant-led delivery.</td></tr>
                <tr><td>What costs extra?</td><td>Ask about additional income sources, late records and HMRC queries.</td></tr>
              </tbody></table></div>
            </section>
          ) : null}


          {getLandlordJourney(blog?.slug) ? <nav className="landlord-guide-return" aria-label="Landlord help"><h2 className="h4">Put this answer into your landlord tax plan</h2><p><Link href="/landlords">Explore the landlord hub</Link> or <Link href={getLandlordJourney(blog.slug).href}>{getLandlordJourney(blog.slug).label.toLowerCase()}</Link>.</p></nav> : null}
          <aside className="compact-article-service" aria-label="TaxSimba service">
            <p className="compact-article-service-kicker">Accountant-led support</p>
            <h2 className="h4">{action?.heading || "Want help with the next step?"}</h2>
            <p>
              {action?.body || "Compare what is included in TaxSimba packages, the service scope and any additional work before you buy."}
            </p>
            {action?.freeRoute ? <a className="article-official-action" href={action.href}>{action.label}</a> : <GetStartedButton text={action?.label || serviceCta.label} href={action?.href || serviceCta.href} variant="pro-blue" />}
            {action?.freeRoute ? <p className="mt-3"><Link href={serviceCta.href}>Compare TaxSimba support if you need return preparation</Link></p> : null}
          </aside>


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
              <h2 className="h5">Sources and further reading</h2>
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
