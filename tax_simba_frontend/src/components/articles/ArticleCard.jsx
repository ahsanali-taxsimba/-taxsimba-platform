import Link from "next/link";
import ArticleIcon from "./ArticleIcon";

function readingLabel(article) {
  if (article?.readingMinutes) return `${article.readingMinutes} min read`;
  const words = String(article?.excerpt || "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

export default function ArticleCard({ article }) {
  if (!article?.slug) return null;
  return (
    <Link href={`/blogs/${article.slug}`} className="article-card-link">
      <article className="article-card">
        <div className="article-card-top">
          <ArticleIcon iconKey={article.iconKey || "tax-guide"} size={26} />
          <span className="article-card-type">{article.contentType || "Guide"}</span>
        </div>
        <h3 className="article-card-title">{article.title}</h3>
        <p className="article-card-excerpt">{article.excerpt}</p>
        <div className="article-card-meta">
          <span>{article.category}</span>
          <span aria-hidden="true">·</span>
          <span>{readingLabel(article)}</span>
        </div>
        <span className="article-card-cta">Read guide</span>
      </article>
    </Link>
  );
}
