/**
 * /blogs hub media extracted from the agreed Blog & Guides mockup.
 * Listing overrides apply only to the first six featured guides.
 * Remaining cards keep existing articleArtwork (unchanged this task).
 */

const CARD = (slug) => ({
  slug,
  src: `/images/guide-hub/cards/${slug}-960.webp`,
  srcSet: `/images/guide-hub/cards/${slug}-480.webp 480w, /images/guide-hub/cards/${slug}-960.webp 960w, /images/guide-hub/cards/${slug}-1440.webp 1440w`,
  width: 1440,
  height: 600, // 2.4:1
});

export const GUIDE_HUB_HERO = {
  src: "/images/guide-hub/hero-still-life-1600.webp",
  srcSet:
    "/images/guide-hub/hero-still-life-640.webp 640w, /images/guide-hub/hero-still-life-960.webp 960w, /images/guide-hub/hero-still-life-1600.webp 1600w",
  width: 1600,
  height: 1000,
  alt: "Stack of green tax guides, a mug and a plant on a wooden desk",
};

/** First six priority guides → mockup card illustrations (by slug). */
export const GUIDE_HUB_LISTING_ARTWORK = {
  "mtd-accountant-cost": CARD("mtd-accountant-cost"),
  "self-assessment-accountant-cost": CARD("self-assessment-accountant-cost"),
  "join-mtd-service-mid-year": CARD("join-mtd-service-mid-year"),
  "switch-mtd-accountant-mid-year": CARD("switch-mtd-accountant-mid-year"),
  "mtd-quarterly-updates-tax-payments": CARD("mtd-quarterly-updates-tax-payments"),
  "self-assessment-2025-26-mtd-2026-27": CARD("self-assessment-2025-26-mtd-2026-27"),
};

export const GUIDE_HUB_ARTWORK_GAP = {
  mockupSource: "attached Blog & Guides mockup (1169×769)",
  heroExtracted: true,
  firstSixCardsExtracted: true,
  remainingListingCardsUnchanged: 114,
  note: "Later-page artwork left on existing article illustrations for this focused task.",
};

export function withGuideHubListingArtwork(article) {
  if (!article?.slug) return article;
  const art = GUIDE_HUB_LISTING_ARTWORK[article.slug];
  if (!art) return article;
  return { ...article, artwork: art };
}
