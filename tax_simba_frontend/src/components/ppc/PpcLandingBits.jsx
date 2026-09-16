"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Accordion, Col, Container, Row, Spinner } from "react-bootstrap";
import { GoArrowUpRight } from "react-icons/go";
import { MdCheckCircle } from "react-icons/md";
import { trackPpcLandingView, trackPrimaryCtaClick } from "@/lib/ppcAnalytics";
import { formatGbpWhole } from "@/hooks/useCatalogueFromPrice";

/**
 * Shared PPC landing shell sections — isolated from organic SeoLandingBits.
 */
export function PpcHero({
  service,
  landingPage,
  title,
  subtitle,
  processLine,
  primaryHref,
  primaryLabel,
  fromPrice,
  fromPriceSuffix,
  secondaryHref,
  secondaryLabel,
  showGoogleRating = true,
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    trackPpcLandingView({ service, landingPage, searchParams });
  }, [service, landingPage, searchParams]);

  const priceLabel =
    fromPrice != null && formatGbpWhole(fromPrice)
      ? `Plans from ${formatGbpWhole(fromPrice)}${fromPriceSuffix || ""}`
      : null;

  const onPrimary = (ctaId) => {
    trackPrimaryCtaClick({ service, landingPage, ctaId });
  };

  return (
    <section className="ppc-hero py-5">
      <Container>
        <Row className="justify-content-center">
          <Col lg={8} className="text-center">
            <h1 className="ppc-hero-title mb-3">{title}</h1>
            {subtitle ? <p className="ppc-hero-sub mb-3">{subtitle}</p> : null}
            {processLine ? (
              <p className="ppc-process mb-3 small opacity-75">{processLine}</p>
            ) : null}
            {priceLabel ? <p className="ppc-from-price mb-4">{priceLabel}</p> : null}
            <div className="d-flex flex-column align-items-center gap-2">
              <Link
                href={primaryHref}
                className="common-btn ppc-primary-cta"
                onClick={() => onPrimary("hero_primary")}
              >
                {primaryLabel} <GoArrowUpRight className="ms-1" />
              </Link>
              {showGoogleRating ? (
                <p className="ppc-google-rating mb-0" aria-label="Rated 4.9 out of 5 on Google">
                  <span className="ppc-google-stars" aria-hidden="true">
                    ★★★★★
                  </span>
                  <span className="ppc-google-score">4.9 on Google</span>
                </p>
              ) : null}
              {secondaryHref && secondaryLabel ? (
                <Link href={secondaryHref} className="ppc-secondary-link small">
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export function PpcTrustStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <section className="ppc-trust py-4">
      <Container>
        <Row className="g-3 justify-content-center text-center">
          {items.map((item) => (
            <Col key={item} xs={6} md={3}>
              <div className="ppc-trust-item">
                <MdCheckCircle className="ppc-trust-icon" aria-hidden="true" />
                <span>{item}</span>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}

export function PpcHowItWorks({ title = "How it works", steps = [] }) {
  if (!steps.length) return null;
  return (
    <section className="ppc-section py-5">
      <Container>
        <h2 className="ppc-section-title text-center mb-4">{title}</h2>
        <Row className="g-4">
          {steps.map((step, idx) => (
            <Col md={6} lg={3} key={step.title}>
              <div className="ppc-step h-100">
                <div className="ppc-step-num">{idx + 1}</div>
                <h3 className="h5">{step.title}</h3>
                <p className="mb-0 small">{step.text}</p>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}

export function PpcIncluded({ title = "What’s included", bullets = [] }) {
  if (!bullets.length) return null;
  return (
    <section className="ppc-section py-5 bg-light">
      <Container>
        <Row className="justify-content-center">
          <Col lg={8}>
            <h2 className="ppc-section-title text-center mb-4">{title}</h2>
            <ul className="ppc-included-list mb-0">
              {bullets.map((b) => (
                <li key={b}>
                  <MdCheckCircle className="me-2 text-success" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export function PpcFaqs({ title = "FAQs", items = [] }) {
  if (!items.length) return null;
  return (
    <section className="ppc-section py-5">
      <Container>
        <h2 className="ppc-section-title text-center mb-4">{title}</h2>
        <Accordion className="ppc-faq mx-auto" style={{ maxWidth: 760 }}>
          {items.map((item, idx) => (
            <Accordion.Item eventKey={String(idx)} key={item.q}>
              <Accordion.Header>{item.q}</Accordion.Header>
              <Accordion.Body>{item.a}</Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}

export function PpcFinalCta({
  service,
  landingPage,
  title,
  text,
  href,
  label,
}) {
  return (
    <section className="ppc-final-cta py-5">
      <Container className="text-center">
        <h2 className="text-white mb-2">{title}</h2>
        {text ? <p className="text-white opacity-75 mb-4">{text}</p> : null}
        <Link
          href={href}
          className="common-btn"
          onClick={() =>
            trackPrimaryCtaClick({ service, landingPage, ctaId: "final_primary" })
          }
        >
          {label} <GoArrowUpRight className="ms-1" />
        </Link>
      </Container>
    </section>
  );
}

export function PpcStickyCta({ service, landingPage, href, label }) {
  return (
    <div className="ppc-sticky-cta d-md-none" role="region" aria-label="Continue">
      <Link
        href={href}
        className="common-btn w-100"
        onClick={() =>
          trackPrimaryCtaClick({ service, landingPage, ctaId: "sticky_primary" })
        }
      >
        {label}
      </Link>
    </div>
  );
}

export function PpcPlansLoading() {
  return (
    <div className="text-center py-4">
      <Spinner animation="border" variant="success" />
      <p className="mt-2 mb-0 small text-muted">Loading live packages…</p>
    </div>
  );
}

export function PpcPlansEmpty({ pricingHref = "/pricing" }) {
  return (
    <div className="text-center py-3">
      <p className="mb-3">Live package prices are temporarily unavailable.</p>
      <Link href={pricingHref} className="ppc-secondary-link">
        View packages on Pricing
      </Link>
    </div>
  );
}

/** Short concern cards — max ~4 buying questions. */
export function PpcConcerns({ title = "Common questions", items = [] }) {
  if (!items.length) return null;
  return (
    <section className="ppc-section py-5">
      <Container>
        <h2 className="ppc-section-title text-center mb-4">{title}</h2>
        <Row className="g-3 justify-content-center">
          {items.map((item) => (
            <Col md={6} key={item.q}>
              <div className="ppc-concern h-100">
                <h3 className="h6 mb-2">{item.q}</h3>
                <p className="mb-0 small opacity-90">{item.a}</p>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}

/** Compact useful list section (expenses, checklist, occupations). */
export function PpcUsefulSection({
  title,
  intro,
  items = [],
  note,
  variant = "dark",
}) {
  if (!title || !items.length) return null;
  const light = variant === "light";
  return (
    <section className={`ppc-section py-5 ${light ? "bg-light" : ""}`}>
      <Container>
        <Row className="justify-content-center">
          <Col lg={8}>
            <h2 className={`ppc-section-title text-center mb-3 ${light ? "" : ""}`}>{title}</h2>
            {intro ? (
              <p className={`text-center mb-4 ${light ? "text-muted" : "opacity-75"}`}>{intro}</p>
            ) : null}
            <ul className={`ppc-useful-list mb-0 ${light ? "ppc-useful-list-light" : ""}`}>
              {items.map((item) => (
                <li key={item}>
                  <MdCheckCircle className="me-2 text-success" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {note ? (
              <p className={`mt-4 mb-0 small text-center ${light ? "text-muted" : "opacity-75"}`}>
                {note}
              </p>
            ) : null}
          </Col>
        </Row>
      </Container>
    </section>
  );
}

/** Compact chip/list of audience labels (e.g. CIS trades). */
export function PpcAudienceTags({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <section className="ppc-section py-5 bg-light">
      <Container>
        <h2 className="ppc-section-title text-center mb-4">{title}</h2>
        <div className="ppc-audience-tags d-flex flex-wrap justify-content-center gap-2">
          {items.map((item) => (
            <span key={item} className="ppc-audience-tag">
              {item}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

