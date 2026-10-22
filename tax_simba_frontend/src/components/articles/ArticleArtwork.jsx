export default function ArticleArtwork({ article, hero = false, className = "" }) {
  const art = article?.artwork;
  if (!art) return null;
  return (
    <figure className={`article-artwork ${hero ? "article-artwork-hero" : "article-artwork-card"} ${className}`.trim()}>
      <img
        src={art.src}
        srcSet={art.srcSet}
        sizes={hero ? "(max-width: 900px) 100vw, 1100px" : "(max-width: 760px) 100vw, 380px"}
        width={art.width}
        height={art.height}
        alt={hero ? article.featuredImageAlt || "" : ""}
        loading={hero ? "eager" : "lazy"}
        fetchPriority={hero ? "high" : "auto"}
      />
    </figure>
  );
}
