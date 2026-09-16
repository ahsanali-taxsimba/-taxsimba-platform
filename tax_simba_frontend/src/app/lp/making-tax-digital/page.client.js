"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "react-bootstrap";
import axios from "axios";
import MtdPricingSection from "@/components/MtdPricingSection";
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

const LANDING = "/lp/making-tax-digital";
const PRIMARY_HREF = "/register?role=MTD";
const PRIMARY_LABEL = "Get MTD Support";

const faqs = [
  {
    q: "Is TaxSimba DIY Making Tax Digital software?",
    a: "No. TaxSimba is an accountant-led MTD service. Our platform supports the customer and accountant workflow; you are not left to become an MTD software expert on your own.",
  },
  {
    q: "Can TaxSimba help manage MTD as my accountant or agent?",
    a: "Yes. Many people appoint an accountant or agent to help manage Making Tax Digital obligations. You still need to provide complete and accurate records; your TaxSimba accountant helps manage the MTD process with you.",
  },
  {
    q: "Does MTD replace Self Assessment completely?",
    a: "MTD for Income Tax changes how qualifying income is recorded and reported during the year. You should still expect year-end obligations. Check GOV.UK for the rules that apply to you.",
  },
  {
    q: "What do I still have to do?",
    a: "You provide complete, accurate income and expense information and respond to accountant questions. We do not claim guaranteed compliance or that you can ignore HMRC obligations.",
  },
  {
    q: "How do packages and pricing work?",
    a: "MTD packages and live prices are shown on this page from our catalogue when available. Choose the option that fits your situation when you register for MTD support.",
  },
  {
    q: "What if I am not sure I need MTD?",
    a: "Use our free MTD checker for a guidance-only indication, and confirm against current GOV.UK rules.",
  },
];

export default function PpcMakingTaxDigitalClient() {
  const router = useRouter();
  const { fromPrice, interval } = useCatalogueFromPrice("mtd");
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
        const response = await axios.get(`${apiUrl}subscription-plans?category=mtd`);
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
    trackPrimaryCtaClick({
      service: "MTD",
      landingPage: LANDING,
      ctaId,
    });
    router.push(PRIMARY_HREF);
  };

  return (
    <div className="ppc-landing ppc-mtd">
      <PpcHero
        service="MTD"
        landingPage={LANDING}
        title="Making Tax Digital, managed with an accountant"
        subtitle="TaxSimba helps you manage digital records and quarterly MTD requirements with accountant support — not DIY-only software."
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
        secondaryHref="/check-mtd"
        secondaryLabel="Not sure if MTD applies to you? Check if I need MTD"
      />

      <PpcTrustStrip
        items={[
          "Accountant-led MTD",
          "You provide records",
          "Built for HMRC MTD rules",
          "Secure document exchange",
        ]}
      />

      <PpcHowItWorks
        title="How MTD works with TaxSimba"
        steps={[
          {
            title: "Share your records",
            text: "Provide the income and expense information your accountant needs.",
          },
          {
            title: "Accountant support",
            text: "Your TaxSimba accountant helps manage the MTD process with you.",
          },
          {
            title: "Quarterly updates",
            text: "Stay on top of digital records and quarterly updates with accountant oversight.",
          },
          {
            title: "Your responsibilities",
            text: "You supply accurate information; TaxSimba does not replace your HMRC obligations.",
          },
        ]}
      />

      <section className="ppc-section py-5 mtd-luxury-section" id="packages">
        <Container>
          <h2 className="ppc-section-title text-center text-white mb-2">
            Making Tax Digital packages
          </h2>
          <p className="text-center text-white opacity-75 mb-4">
            Live catalogue packages and prices. Features and names render only as returned by the API.
          </p>
          {loading ? (
            <PpcPlansLoading />
          ) : failed || plans.length === 0 ? (
            <div className="text-white">
              <PpcPlansEmpty />
            </div>
          ) : (
            <MtdPricingSection
              subscriptionPlans={plans}
              currentPlanId={null}
              onSelectPlan={() => goRegister("package_select")}
            />
          )}
          <div className="text-center mt-4">
            <button
              type="button"
              className="common-btn"
              onClick={() => goRegister("packages_primary")}
            >
              {PRIMARY_LABEL}
            </button>
          </div>
        </Container>
      </section>

      <PpcIncluded
        title="What to expect"
        bullets={[
          "Accountant-led Making Tax Digital support — not DIY-only software",
          "You provide complete, accurate records and respond to accountant questions",
          "Secure document exchange for your tax information",
          "Package inclusions follow the live catalogue for the plan you choose",
          "If you are unsure whether MTD applies, use the MTD checker before registering",
        ]}
      />

      <PpcFaqs items={faqs} />

      <PpcFinalCta
        service="MTD"
        landingPage={LANDING}
        title="Get accountant-led MTD support"
        text="Register for the Making Tax Digital journey with TaxSimba."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta
        service="MTD"
        landingPage={LANDING}
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />
    </div>
  );
}

