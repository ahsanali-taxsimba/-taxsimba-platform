"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Col, Container, Row } from "react-bootstrap";
import axios from "axios";
import { MdCheckCircle } from "react-icons/md";
import { FaChevronRight } from "react-icons/fa";
import { getCurrencySymbol } from "@/utils/commonHelper";
import { useCatalogueFromPrice, formatIntervalSuffix } from "@/hooks/useCatalogueFromPrice";
import { trackPrimaryCtaClick } from "@/lib/ppcAnalytics";
import {
  PpcHero,
  PpcTrustStrip,
  PpcHowItWorks,
  PpcIncluded,
  PpcFaqs,
  PpcFinalCta,
  PpcStickyCta,
  PpcPlansLoading,
  PpcPlansEmpty,
} from "@/components/ppc/PpcLandingBits";

const LANDING = "/lp/self-assessment";
const PRIMARY_HREF = "/register";
const PRIMARY_LABEL = "Start Self Assessment";

const faqs = [
  {
    q: "Is TaxSimba DIY tax software or an accountant service?",
    a: "TaxSimba is an accountant-led Self Assessment service. Software supports the client and accountant workflow; your accountant prepares and reviews the return. It is not DIY filing software you operate alone.",
  },
  {
    q: "What do I provide, and what does the accountant do?",
    a: "You provide your income, expense and supporting information through TaxSimba. Your accountant prepares and reviews the Self Assessment return. You remain responsible for the accuracy of what you supply.",
  },
  {
    q: "Do I approve before anything is filed with HMRC?",
    a: "Yes. Where the process applies, you review the prepared return and approve before filing.",
  },
  {
    q: "Who is this suitable for?",
    a: "Sole traders, landlords, freelancers and other individuals who need help with UK Self Assessment and prefer an accountant to prepare the return.",
  },
  {
    q: "How much does it cost?",
    a: "Self Assessment packages and live prices are shown on this page from our current catalogue when available. Choose the package that matches your situation when you register.",
  },
  {
    q: "What if I also need Making Tax Digital?",
    a: "If MTD for Income Tax also applies, TaxSimba offers a separate accountant-led MTD service. You can check eligibility on the MTD checker after you understand which journey you need.",
  },
];

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
        {plan.isPopular ? (
          <div className="popular-badge-simple">Most Popular</div>
        ) : null}
        <div className="plan-card-header">
          <h3 className="plan-name-main text-capitalize text-dark h4">{plan.name}</h3>
          <div className="price-row">
            <span className="price-new">
              {getCurrencySymbol(plan.currency)}
              {plan.price}
              {period ? <span className="plan-interval-txt">/{period}</span> : null}
            </span>
          </div>
          {plan.description ? (
            <p className="plan-desc-text text-muted">{plan.description}</p>
          ) : null}
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
          <button
            type="button"
            className="select-plan-button-modern"
            onClick={() => onSelect(plan)}
          >
            Select Plan <FaChevronRight className="chevron-icon" />
          </button>
        </div>
      </div>
    </Col>
  );
}

export default function PpcSelfAssessmentClient() {
  const router = useRouter();
  const { fromPrice, interval } = useCatalogueFromPrice("taxSimba");
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

  const handleSelect = () => {
    // Match existing logged-out pricing behaviour: /register (no invented query params).
    trackPrimaryCtaClick({
      service: "SA",
      landingPage: LANDING,
      ctaId: "package_select",
    });
    router.push(PRIMARY_HREF);
  };

  return (
    <div className="ppc-landing ppc-sa">
      <PpcHero
        service="SA"
        landingPage={LANDING}
        title="Accountant-led online Self Assessment"
        subtitle="For UK sole traders, landlords and freelancers. You provide your information and documents — a TaxSimba accountant prepares your return, you review and approve, then filing follows the TaxSimba workflow."
        processLine="Share your details → Accountant prepares → You approve → We file"
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
      />

      <PpcTrustStrip
        items={[
          "Accountant-led",
          "Not DIY software",
          "You review before filing",
          "UK-based support",
        ]}
      />

      <PpcHowItWorks
        steps={[
          {
            title: "Share your details",
            text: "Provide income, expenses and supporting documents through TaxSimba.",
          },
          {
            title: "Accountant prepares",
            text: "A TaxSimba accountant prepares and reviews your Self Assessment return.",
          },
          {
            title: "You review & approve",
            text: "Where the process applies, you review and approve before filing.",
          },
          {
            title: "Filing in workflow",
            text: "Filing is handled through the established TaxSimba accountant-led workflow.",
          },
        ]}
      />

      <section className="ppc-section py-5 bg-light" id="packages">
        <Container>
          <h2 className="ppc-section-title text-center mb-2">Self Assessment packages</h2>
          <p className="text-center text-muted mb-4">
            Live prices from our current catalogue. No hardcoded package prices on this page.
          </p>
          {loading ? (
            <PpcPlansLoading />
          ) : failed || plans.length === 0 ? (
            <PpcPlansEmpty />
          ) : (
            <Row className="justify-content-center">
              {plans.map((plan) => (
                <SaPlanCard key={plan.id} plan={plan} onSelect={handleSelect} />
              ))}
            </Row>
          )}
          <div className="text-center mt-4">
            <button
              type="button"
              className="common-btn"
              onClick={() => {
                trackPrimaryCtaClick({
                  service: "SA",
                  landingPage: LANDING,
                  ctaId: "packages_primary",
                });
                router.push(PRIMARY_HREF);
              }}
            >
              {PRIMARY_LABEL}
            </button>
          </div>
        </Container>
      </section>

      <PpcIncluded
        bullets={[
          "Accountant prepares your Self Assessment return from the information you provide",
          "You remain responsible for accurate records and answers",
          "Review and approve before filing where that step applies",
          "Secure online workflow for sharing documents with your accountant",
          "Clear package options from the live TaxSimba catalogue",
        ]}
      />

      <PpcFaqs items={faqs} />

      <PpcFinalCta
        service="SA"
        landingPage={LANDING}
        title="Ready to start?"
        text="Create your account and begin accountant-led Self Assessment with TaxSimba."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta
        service="SA"
        landingPage={LANDING}
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />
    </div>
  );
}

