/**
 * Listing-only editorial stills for /blogs cards.
 * Does not replace in-article / OG artwork. Slugs without an entry keep
 * their existing articleArtwork (cartoon series) until a matching asset exists.
 */
const CARD = (slug) => ({
  slug,
  src: `/images/guide-hub/cards/${slug}-960.webp`,
  srcSet: `/images/guide-hub/cards/${slug}-480.webp 480w, /images/guide-hub/cards/${slug}-960.webp 960w, /images/guide-hub/cards/${slug}-1440.webp 1440w`,
  width: 1440,
  height: 1080,
});

export const GUIDE_HUB_HERO = {
  src: "/images/guide-hub/hero-still-life-1600.webp",
  srcSet:
    "/images/guide-hub/hero-still-life-640.webp 640w, /images/guide-hub/hero-still-life-960.webp 960w, /images/guide-hub/hero-still-life-1600.webp 1600w",
  width: 1600,
  height: 900,
  alt: "Stack of green tax guides, a TaxSimba mug and a plant on a wooden desk",
};

/** First-page priority guides with topic-specific photographic stills. */
export const GUIDE_HUB_LISTING_ARTWORK = {
  "mtd-accountant-cost": CARD("mtd-accountant-cost"),
  "self-assessment-accountant-cost": CARD("self-assessment-accountant-cost"),
  "join-mtd-service-mid-year": CARD("join-mtd-service-mid-year"),
  "switch-mtd-accountant-mid-year": CARD("switch-mtd-accountant-mid-year"),
  "mtd-quarterly-updates-tax-payments": CARD("mtd-quarterly-updates-tax-payments"),
  "self-assessment-2025-26-mtd-2026-27": CARD("self-assessment-2025-26-mtd-2026-27"),
  "mtd-cumulative-quarterly-updates": CARD("mtd-cumulative-quarterly-updates"),
  "correct-mtd-quarterly-update": CARD("correct-mtd-quarterly-update"),
  "waiting-for-utr-tax-return": CARD("waiting-for-utr-tax-return"),
};

/**
 * Remaining first-20 slugs still need restrained editorial card stills
 * (object/desk photography, not the shared cartoon consultation series):
 * employed-and-self-employed-tax-return, uber-private-hire-driver-tax-return,
 * delivery-driver-courier-tax-return, mtd-software-vs-accountant-service,
 * authorise-mtd-accountant-safely, multiple-overdue-self-assessment-returns,
 * appeal-self-assessment-late-penalty, sold-rental-property-60-day-tax,
 * pay-self-assessment-through-tax-code-december, mtd-proof-quarterly-update-submitted,
 * hmrc-signed-me-up-for-making-tax-digital — plus the remaining 100 listing cards.
 */
export const GUIDE_HUB_LISTING_ARTWORK_NEEDED = [
  "employed-and-self-employed-tax-return",
  "uber-private-hire-driver-tax-return",
  "delivery-driver-courier-tax-return",
  "mtd-software-vs-accountant-service",
  "authorise-mtd-accountant-safely",
  "multiple-overdue-self-assessment-returns",
  "appeal-self-assessment-late-penalty",
  "sold-rental-property-60-day-tax",
  "pay-self-assessment-through-tax-code-december",
  "mtd-proof-quarterly-update-submitted",
  "hmrc-signed-me-up-for-making-tax-digital",
];

export function withGuideHubListingArtwork(article) {
  if (!article?.slug) return article;
  const art = GUIDE_HUB_LISTING_ARTWORK[article.slug];
  if (!art) return article;
  return { ...article, artwork: art };
}
