/**
 * /blogs hub media notes.
 *
 * Layout/spacing is handled in CSS. Artwork that matches the reference’s
 * illustrated editorial style is NOT present in the repo or V6 package.
 * Do not treat CSS crops or prior photographic experiments as a substitute.
 */

export const GUIDE_HUB_HERO = {
  src: "/images/guide-hub/hero-still-life-1600.webp",
  srcSet:
    "/images/guide-hub/hero-still-life-640.webp 640w, /images/guide-hub/hero-still-life-960.webp 960w, /images/guide-hub/hero-still-life-1600.webp 1600w",
  width: 1600,
  height: 900,
  alt: "Stack of green tax guides, a plain mug and a plant on a wooden desk",
};

/**
 * Exact artwork gap vs the agreed /blogs mockup (illustrated editorial style):
 *
 * 1. Hero: reference uses illustrated/editorial books + plain mug + plant still-life
 *    that matches the mockup art direction. Current file is a temporary still-life
 *    stand-in with a plain mug (no lion mark). Replace with the approved mockup asset
 *    when available: e.g. `guide-hub-hero-books-mug-plant.{webp,jpg}` (wide, ivory-blend left).
 *
 * 2. Listing cards (all 120): reference uses topic-specific illustrated editorial
 *    frames at ~2.4:1 (wide). Repo currently only has the shared cartoon consultation
 *    series under `/images/articles/{slug}-*.webp`. Photographic listing overrides were
 *    tried and rejected as not matching the reference — do not extend that style.
 *
 * Needed card assets (illustrated editorial, ~2.4:1, topic-relevant), one set per slug:
 *   /images/guide-hub/cards/{slug}-{480,960,1440}.webp
 * for every slug in PRIORITY_ARTICLE_SLUGS (20) then REMAINING_ARTICLE_SLUGS (100).
 *
 * Until those ship, cards use existing articleArtwork cropped to 2.4:1 in CSS only.
 */
export const GUIDE_HUB_ARTWORK_GAP = {
  heroApprovedAsset: false,
  listingIllustratedAssetsPresent: 0,
  listingIllustratedAssetsNeeded: 120,
  note:
    "CSS can match width, spacing and 2.4:1 crops; it cannot reproduce the mockup’s illustrated editorial artwork.",
};

/** No listing artwork overrides — keep existing article illustrations until gap is filled. */
export function withGuideHubListingArtwork(article) {
  return article;
}
