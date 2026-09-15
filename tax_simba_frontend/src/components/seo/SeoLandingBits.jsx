import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import { GoArrowUpRight } from "react-icons/go";

/**
 * Lightweight shared shell for SEO commercial/landing pages.
 * Keeps existing TaxSimba visual language (common-btn, common-title, breadcrumb).
 */
export function SeoBreadcrumbHero({
  title,
  subtitle,
  imageSrc = "/images/breadcrum-img.png",
  imageAlt = "TaxSimba",
  primaryCta,
  secondaryCta,
  processLine,
}) {
  return (
    <section className="breadcrum-sec-top py-80">
      <Container>
        <Row className="align-items-center">
          <Col lg={6}>
            <div className="bread-crum-inr-box text-lg-start text-center">
              <h1 className="text-capitalize mb-3">{title}</h1>
              {subtitle ? <p className="mb-0">{subtitle}</p> : null}
              {processLine ? (
                <p className="mt-3 mb-0 small opacity-75">{processLine}</p>
              ) : null}
              {(primaryCta || secondaryCta) ? (
                <div className="d-flex align-items-center justify-content-lg-start justify-content-center gap-2 flex-wrap mt-4">
                  {primaryCta ? (
                    <Link href={primaryCta.href} className="common-btn">
                      {primaryCta.label} <GoArrowUpRight className="ms-1" />
                    </Link>
                  ) : null}
                  {secondaryCta ? (
                    <Link href={secondaryCta.href} className="common-btn-outline">
                      {secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Col>
          <Col lg={6} className="mt-lg-0 mt-5">
            <div className="breadcrum-img text-center">
              <img src={imageSrc} alt={imageAlt} className="img-fluid" />
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export function SeoCtaBand({
  title,
  text,
  href,
  label,
}) {
  return (
    <section className="cta-main bottom-cta mobile-cta ptb-80">
      <Container>
        <Row className="align-items-center">
          <Col lg={8} className="mb-lg-0 mb-4">
            <div className="common-title mb-0">
              <h2 className="text-lt-theme">{title}</h2>
              {text ? <p className="mb-0 text-white">{text}</p> : null}
            </div>
          </Col>
          <Col lg={4} className="text-lg-end text-center">
            <Link href={href} className="common-btn">
              {label} <GoArrowUpRight className="ms-1" />
            </Link>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export function SeoLinkList({ heading, links = [] }) {
  if (!links.length) return null;
  return (
    <section className="ptb-80 pt-0">
      <Container>
        <div className="common-title mb-4">
          <h2>{heading}</h2>
        </div>
        <ul className="mb-0">
          {links.map((link) => (
            <li key={link.href} className="mb-2">
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function SeoSources({ sources = [] }) {
  if (!sources.length) return null;
  return (
    <section className="pb-5">
      <Container>
        <h2 className="h5">Sources</h2>
        <ul>
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="small opacity-75 mb-0">
          General information for UK taxpayers — not personal tax advice. Always check current GOV.UK guidance for your situation.
        </p>
      </Container>
    </section>
  );
}
