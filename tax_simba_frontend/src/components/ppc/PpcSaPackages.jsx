"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Col, Container, Row } from "react-bootstrap";
import axios from "axios";
import { MdCheckCircle } from "react-icons/md";
import { FaChevronRight } from "react-icons/fa";
import { getCurrencySymbol } from "@/utils/commonHelper";
import { trackPrimaryCtaClick } from "@/lib/ppcAnalytics";
import { PpcPlansLoading, PpcPlansEmpty } from "@/components/ppc/PpcLandingBits";

function intervalLabel(interval) {
  if (!interval || typeof interval !== "string") return null;
  const key = interval.toLowerCase();
  if (key === "year" || key === "yearly" || key === "annual") return "year";
  if (key === "month" || key === "monthly") return "month";
  return key;
}

function SaPlanCard({ plan, onSelect }) {
  const period = intervalLabel(plan.interval);
  return (
    <Col lg={4} md={6} sm={12} className="mb-4">
      <div
        className={`ppc-sa-plan-card ${
          plan.isPopular ? "popular-card home-plan-card plan-card-white" : "home-plan-card plan-card-white"
        } position-relative h-100`}
      >
        {plan.isPopular ? <div className="popular-badge-simple">Most Popular</div> : null}
        <div className="plan-card-header">
          <h3 className="plan-name-main text-capitalize text-dark h4">{plan.name}</h3>
          <div className="price-row">
            <span className="price-new">
              {getCurrencySymbol(plan.currency)}
              {plan.price}
              {period ? <span className="plan-interval-txt">/{period}</span> : null}
            </span>
          </div>
          {plan.description ? <p className="plan-desc-text text-muted">{plan.description}</p> : null}
        </div>
        <ul className="plan-feature-list-modern">
          {Array.isArray(plan.features) &&
            plan.features.map((feature, idx) => (
              <li key={idx}>
                <MdCheckCircle className="check-icon-modern" />
                <span className="text-dark-50">{feature}</span>
              </li>
            ))}
        </ul>
        <div className="plan-card-action">
          <button type="button" className="select-plan-button-modern" onClick={() => onSelect(plan)}>
            Select Plan <FaChevronRight className="chevron-icon" />
          </button>
        </div>
      </div>
    </Col>
  );
}

/**
 * Live Self Assessment catalogue packages for PPC LPs.
 * Prices come from subscription-plans?category=taxSimba — never hardcoded.
 */
export default function PpcSaPackages({
  service = "SA",
  landingPage,
  primaryHref = "/register",
  primaryLabel = "Start Self Assessment",
  sectionTitle = "Self Assessment packages",
}) {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          setFailed(true);
          return;
        }
        const response = await axios.get(`${apiUrl}subscription-plans?category=taxSimba`);
        const rows = response.data?.data;
        if (!cancelled) {
          if (Array.isArray(rows) && rows.length > 0) {
            setPlans(rows);
            setFailed(false);
          } else {
            setPlans([]);
            setFailed(true);
          }
        }
      } catch {
        if (!cancelled) {
          setPlans([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goRegister = (ctaId) => {
    trackPrimaryCtaClick({ service, landingPage, ctaId });
    router.push(primaryHref);
  };

  return (
    <section className="ppc-section py-5 bg-light" id="packages">
      <Container>
        <h2 className="ppc-section-title text-center mb-2">{sectionTitle}</h2>
        <p className="text-center text-muted mb-4">
          Live prices from our current catalogue.
        </p>
        {loading ? (
          <PpcPlansLoading />
        ) : failed || plans.length === 0 ? (
          <PpcPlansEmpty />
        ) : (
          <Row className="justify-content-center">
            {plans.map((plan) => (
              <SaPlanCard key={plan.id} plan={plan} onSelect={() => goRegister("package_select")} />
            ))}
          </Row>
        )}
        <div className="text-center mt-4">
          <button type="button" className="common-btn" onClick={() => goRegister("packages_primary")}>
            {primaryLabel}
          </button>
        </div>
      </Container>
    </section>
  );
}
