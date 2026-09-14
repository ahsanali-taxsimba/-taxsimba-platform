"use client";
import {
  CISRebateCalc,
  EbayTaxCalc,
  RentalTaxCalc,
  UberTaxCalc,
} from "@/components/calculators/BusinessCalculators";
import {
  CorporationTaxCalc,
  CryptoTaxCalc,
  DividendTaxCalc,
} from "@/components/calculators/FinalCalculators";
import {
  ChildBenefitCalc,
  LatePenaltyCalc,
  PensionTaxReliefCalc,
} from "@/components/calculators/MiscCalculators";
import {
  CombinedTaxCalc,
  IncomeTaxCalc,
  NationalInsuranceCalc,
  SalaryAfterTaxCalc,
} from "@/components/calculators/NationalInsuranceCalc";
import {
  MileageTaxCalc,
  StampDutyCalc,
  TaxCodeChecker,
} from "@/components/calculators/SpecializedCalculators";
import { useTaxData } from "@/context/TaxDataContext";
import { calculatorContent } from "@/lib/calculators/content";
import { DEFAULT_YEAR } from "@/lib/calculators/data/tax-rates";
import { calculators } from "@/lib/calculators/metadata";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import * as Icons from "react-icons/tb";
import { VscTriangleDown } from "react-icons/vsc";
import "../calculators.css";
import { MdKeyboardDoubleArrowRight } from "react-icons/md";

const DynamicIcon = ({ name }) => {
  const IconComponent = Icons[name] || Icons.TbTax;
  return <IconComponent size={30} />;
};
const componentMap = {
  ni: NationalInsuranceCalc,
  "combined-tax": CombinedTaxCalc,
  "salary-after-tax": SalaryAfterTaxCalc,
  "income-tax": IncomeTaxCalc,
  "pension-tax-relief": PensionTaxReliefCalc,
  "child-benefit": ChildBenefitCalc,
  "late-penalty": LatePenaltyCalc,
  "rental-tax": RentalTaxCalc,
  "cis-rebate": CISRebateCalc,
  "ebay-tax": EbayTaxCalc,
  "stamp-duty": StampDutyCalc,
  "uber-tax": UberTaxCalc,
  "tax-code": TaxCodeChecker,
  "mileage-tax": MileageTaxCalc,
  "dividend-tax": DividendTaxCalc,
  "crypto-tax": CryptoTaxCalc,
  "corporation-tax": CorporationTaxCalc,
};

export default function CalculatorClientPage() {
  const { availableYears } = useTaxData();
  const { slug } = useParams();
  const calc = calculators.find((c) => c.slug === slug);
  const content = calculatorContent[slug];
  const CalculatorComponent = componentMap[slug];
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const paramYear = searchParams?.get('tax-year');
  const [selectedYear, setSelectedYear] = useState(paramYear || DEFAULT_YEAR);

  if (!calc || !CalculatorComponent) {
    return (
      <div className="calc-dashboard text-center">
        <h1 className="text-2xl font-bold mb-4">Calculator Not Found</h1>
        <Link href="/calculators" className="primary-button bg-brand-primary text-white p-3 rounded-xl px-6">Back to Dashboard</Link>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Calculators", href: "/calculators" },
    { label: calc.name }
  ];

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div id="calculator-root">
      <div className="calc-dashboard">
        <section className="calc-main-card py-5">
          <Container>
            <div className="calc-header mb-3">
              <Row>
                <Col lg={8}>
                  <h1>
                    {calc.name} calculator
                  </h1>
                  <p>
                    {calc.description?.replace("2025-2026", selectedYear)}
                  </p>
                </Col>
                <Col lg={4}>
                  <div className="calc-hdr-right d-flex gap-2 align-items-center justify-content-end">
                    <p>Tax Year</p>
                    <div className="drop-card">
                      <Form.Select
                        aria-label="Tax year selector"
                        value={selectedYear}
                        onChange={(e) => {
                          const newYear = e.target.value;
                          setSelectedYear(newYear);
                          const params = new URLSearchParams(searchParams);
                          params.set('tax-year', newYear);
                          router.replace(`${pathname}?${params.toString()}`);
                        }}
                      >
                        {availableYears.map(year => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            <div className="calc-inr-sec common-form ">
              <CalculatorComponent taxYear={selectedYear} />
            </div>

          </Container>

        </section>

        <section className="how-does-card py-80 pt-0">
          <Container>
            <div className="how-inr-box">
              <Row className=" align-items-center">
                <Col lg={7} className="pe-0">
                  <div className="how-does-icon">
                    <h2 className="">
                      How does the {calc.name} work?
                    </h2>
                    <div className="how-does-steps">
                      {content?.howItWorks.map((step, i) => (
                        <div key={i} className="how-does-step">
                          <div className="step-number">{i + 1}</div>
                          <p className="">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Col>
                <Col lg={5} className="ps-0">
                  <div className="smart-features-card text-center p-5">
                    <div className="feature-icon-box mb-3">
                      <Icons.TbCalculator className="text-theme" size={50} />
                    </div>
                    <h3>Smart Calculations</h3>
                    <p className="feature-desc">
                      Calculated instantly with up-to-date HMRC thresholds. Our engine ensures 100% accuracy for the current tax year.
                    </p>
                    <div className="pro-tip-box">
                      <Lightbulb size={20} />
                      <span>Pro Tip: Keep your receipts!</span>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Container>
        </section>

        {content && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-20 mb-20"
          >
            <section className="liable-card">
              <Container>
                <h2 className="text-2xl font-bold mb-10 text-gray-900 text-center">What makes you liable?</h2>
                <Row>
                  {content.keyDetails.map((detail, i) => (
                    <Col lg={4} key={i} className=" mb-lg-0 mb-4">
                      <div className="laible-card-inr p-6 ">
                        <div className="w-12 h-12 rounded-2xl bg-green-50 mb-6 flex items-center justify-center text-brand-primary">
                          <span className="liable-icon">
                            <DynamicIcon name={detail.icon} />
                          </span>
                        </div>
                        <p className="text-white leading-relaxed font-medium">{detail.text}</p>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Container>
            </section>
            
            {/* CTA Section Start */}
            <section className="calculator-banner cta-main bottom-cta ptb-80 pb-0">
              <Container>
                <div className="cta-inner">
                  <Row>
                    <Col lg={12}>
                      <div className="cta-cont text-center">
                        <div className="stop-stressing-content text-center">
                          <h2 className="text-lt-theme">
                            <span>  Share your details. </span> Choose your plan. <br className="d-lg-block d-none" /> Connect with your dedicated accountant.
                          </h2>
                          <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                            <Link href="/register" className="common-btn">
                              Get Started <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Container>
            </section>
            {/* CTA Section End */}
          </motion.div>
        )}
      </div>
    </div>
  );
}
