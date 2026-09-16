/**
 * PPC conversion analytics — GA4/GTM dataLayer only.
 * NEVER push PII or tax-sensitive fields (name, email, phone, UTR, NINO,
 * tax figures, documents, address, bank details).
 */

const CONTEXT_KEY = "taxsimba_ppc_context";
const PURCHASE_FIRED_PREFIX = "taxsimba_ppc_purchase_fired_";

const ALLOWED_EVENT_KEYS = new Set([
  "event",
  "service",
  "landing_page",
  "cta_id",
  "plan_id",
  "plan_name",
  "value",
  "currency",
  "transaction_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
]);

const BLOCKED_KEY_PATTERN =
  /(email|name|phone|mobile|address|utr|nino|ni_number|document|password|bank|iban|sort.?code|account.?number|tax.?figure|income|profit)/i;

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function sanitizePayload(raw = {}) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || value === "") continue;
    if (BLOCKED_KEY_PATTERN.test(key)) continue;
    if (!ALLOWED_EVENT_KEYS.has(key) && key !== "event") continue;
    if (typeof value === "object") continue;
    if (typeof value === "string" && value.includes("@")) continue;
    out[key] = value;
  }
  return out;
}

export function pushPpcEvent(eventName, params = {}) {
  const w = safeWindow();
  if (!w || !eventName) return;
  w.dataLayer = w.dataLayer || [];
  const payload = sanitizePayload({ event: eventName, ...params });
  if (!payload.event) return;
  w.dataLayer.push(payload);
}

export function readUtmParams(searchParams) {
  if (!searchParams) return {};
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
  ];
  const out = {};
  for (const key of keys) {
    const val = searchParams.get?.(key) || searchParams[key];
    if (val && typeof val === "string" && val.length < 200) out[key] = val;
  }
  return out;
}

/** Persist anonymous PPC journey context for downstream register/checkout. */
export function setPpcContext({ service, landingPage, searchParams } = {}) {
  const w = safeWindow();
  if (!w) return;
  const ctx = {
    service: service === "MTD" ? "MTD" : "SA",
    landing_page: landingPage || "",
    ...readUtmParams(searchParams || new URLSearchParams(w.location.search)),
    ts: Date.now(),
  };
  try {
    w.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore quota */
  }
  return ctx;
}

export function getPpcContext() {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return sanitizePayload({
      service: parsed.service === "MTD" ? "MTD" : "SA",
      landing_page: parsed.landing_page || "",
      utm_source: parsed.utm_source,
      utm_medium: parsed.utm_medium,
      utm_campaign: parsed.utm_campaign,
      utm_content: parsed.utm_content,
      utm_term: parsed.utm_term,
      gclid: parsed.gclid,
    });
  } catch {
    return null;
  }
}

export function trackPpcLandingView({ service, landingPage, searchParams }) {
  const ctx = setPpcContext({ service, landingPage, searchParams });
  pushPpcEvent("ppc_landing_view", {
    service: ctx.service,
    landing_page: ctx.landing_page,
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
    utm_content: ctx.utm_content,
    utm_term: ctx.utm_term,
    gclid: ctx.gclid,
  });
}

export function trackPrimaryCtaClick({ service, landingPage, ctaId }) {
  const ctx = getPpcContext() || {};
  pushPpcEvent("primary_cta_click", {
    service: service || ctx.service,
    landing_page: landingPage || ctx.landing_page,
    cta_id: ctaId || "primary",
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
  });
}

export function trackRegistrationStarted({ service, planId } = {}) {
  const ctx = getPpcContext() || {};
  pushPpcEvent("registration_started", {
    service: service || ctx.service || "SA",
    landing_page: ctx.landing_page,
    plan_id: planId || undefined,
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
  });
}

export function trackRegistrationCompleted({ service, planId } = {}) {
  const ctx = getPpcContext() || {};
  pushPpcEvent("registration_completed", {
    service: service || ctx.service || "SA",
    landing_page: ctx.landing_page,
    plan_id: planId || undefined,
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
  });
}

export function trackCheckoutStarted({ service, planId, planName, value, currency } = {}) {
  const ctx = getPpcContext() || {};
  pushPpcEvent("checkout_started", {
    service: service || ctx.service || "SA",
    landing_page: ctx.landing_page,
    plan_id: planId || undefined,
    plan_name: planName || undefined,
    value: typeof value === "number" && Number.isFinite(value) ? value : undefined,
    currency: currency || "GBP",
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
  });
}

/**
 * Fire purchase ONLY after confirmed successful payment finalisation.
 * Dedupes by Stripe session id so page refresh does not re-fire.
 */
export function trackPurchaseConfirmed({
  sessionId,
  service,
  planId,
  planName,
  value,
  currency,
  transactionId,
} = {}) {
  const w = safeWindow();
  if (!w || !sessionId) return false;
  const firedKey = `${PURCHASE_FIRED_PREFIX}${sessionId}`;
  try {
    if (w.sessionStorage.getItem(firedKey)) return false;
  } catch {
    /* continue */
  }

  const ctx = getPpcContext() || {};
  pushPpcEvent("purchase", {
    service: service || ctx.service || "SA",
    landing_page: ctx.landing_page,
    plan_id: planId || undefined,
    plan_name: planName || undefined,
    value: typeof value === "number" && Number.isFinite(value) ? value : undefined,
    currency: currency || "GBP",
    transaction_id: transactionId || sessionId,
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
  });

  try {
    w.sessionStorage.setItem(firedKey, "1");
  } catch {
    /* ignore */
  }
  return true;
}

export function isPpcPath(pathname) {
  if (!pathname) return false;
  return pathname === "/lp" || pathname.startsWith("/lp/");
}
