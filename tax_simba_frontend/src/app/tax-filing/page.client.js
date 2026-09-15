"use client";
import AccountantLedPublicFaqs from "@/components/seo/AccountantLedPublicFaqs";
import Link from 'next/link';
import TaxFillingTracker from './_components/TaxFillingTracker'
import { useSession } from 'next-auth/react'
import GlobalBannerSection from '@/components/default/GlobalBannerSection';
import HowItWorksSection from '../(home)/_home-components/HowItWorksSection';
import AssessmentSectionGlobal from '@/components/default/AssesmentSectionGlobalSection';
import { Col, Container, Row } from 'react-bootstrap';
import { MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from 'react-icons/md';

const TaxFilling = () => {
  const { data: session } = useSession();
  return (
    <>


      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3 fs-2">Simple tax filing today...</h1>
                <p>Get your self-assessment tax return filed by a <span className="text-orange">qualified accountant.</span></p>
              </div>
            </Col>
            <Col lg={6} className="mt-lg-0 mt-5">
              <div className="breadcrum-img text-center">
                <img src="/images/breadcrum-img.png" alt="Breadcrumb Image" className="img-fluid" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="tax-problems-sec ptb-80">
        <Container>
          <div className="common-title text-center mb-5">
            <h2>Filing That <span>Makes Sense</span></h2>
            <p>Simple, clear filing support for the tax returns that matter to you.</p>
          </div>
          <Row>
            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">01</div>
                <span className="tax-problem-icon">
                  <img src="/images/sel-employment.svg" alt="img" />
                </span>
                <h3>Self-Employment</h3>
                <p>Manage allowable expenses, deductions, and filing requirements for your self-employed business.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">02</div>
                <span className="tax-problem-icon">
                  <img src="/images/tax-deduct.svg" alt="img" />
                </span>
                <h3>Tax Deductions</h3>
                <p>Understand which expenses are deductible and how to maximize deductions to reduce your tax bill.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">03</div>

                <span className="tax-problem-icon">
                  <img src="/images/vat.svg" alt="img" />
                </span>
                <h3>VAT & More</h3>
                <p>Get clarity on VAT, pension planning, property income, and general tax strategy questions.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">04</div>

                <span className="tax-problem-icon">
                  <img src="/images/property.svg" alt="img" />
                </span>
                <h3>Property Income</h3>
                <p>Understand tax obligations on rental income, allowable expenses, and property investment strategies.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">05</div>

                <span className="tax-problem-icon">
                  <img src="/images/retirement-plan.svg" alt="img" />
                </span>
                <h3>Pension Planning</h3>
                <p>Maximize your pension contributions and understand tax relief benefits for long-term savings.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">06</div>

                <span className="tax-problem-icon">
                  <img src="/images/gain.svg" alt="img" />
                </span>
                <h3>Capital Gains</h3>
                <p>Navigate investment gains, CGT allowances, and understand your tax liability on asset sales.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">07</div>

                <span className="tax-problem-icon">
                  <img src="/images/dividends.svg" alt="img" />
                </span>
                <h3>Dividend Income</h3>
                <p>Manage dividend tax, understand allowances, and optimize your investment income strategy.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">08</div>

                <span className="tax-problem-icon">
                  <img src="/images/insurance.svg" alt="img" />
                </span>
                <h3>National Insurance</h3>
                <p>Understand NI contributions, thresholds, and how to minimize your National Insurance bill.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box mb-0">
                <div className="fbox-number">09</div>

                <span className="tax-problem-icon">
                  <img src="/images/inheritance.svg" alt="img" />
                </span>
                <h3>Inheritance Tax</h3>
                <p>Learn about IHT planning, thresholds, and strategies to protect your family's assets.</p>
              </div>
            </Col>

          </Row>

        </Container>
      </section>

      <section className="ready-call-outer ptb-80 pt-0 ">
        <Container>
          <div className="ready-call">
            <Row>
              <Col xl={7} lg={6} >
                <div className="ready-call-text p-lg-5 p-3">
                  <h2>Book Your <span>Consultation</span></h2>
                  <p className="text-white">Get straight answers to your tax questions from real accountants who understand your situation.</p>
                  <ul className="easy-list">
                    <li><MdOutlineCheckCircle />No jargon, just simple answers</li>
                    <li><MdOutlineCheckCircle />Understand what you actually owe</li>
                    <li><MdOutlineCheckCircle />Find out how to pay less tax legally</li>
                    <li><MdOutlineCheckCircle />Leave knowing exactly what to do next</li>
                  </ul>
                  <Link href="/register" className="common-btn">
                    Book Your Session Now <MdKeyboardDoubleArrowRight className="ms-1" />
                  </Link>
                </div>
              </Col>
              <Col xl={5} lg={6}>
                <div className="ready-call-img text-center">
                  <img src="/images/consult.png" alt="ready-call" className="img-fluid" />
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>

      <section className="cta-full-main ptb-80">
        <Container>
          <div className="cta-inner">
            <Row>
              <Col lg={12}>
                <div className="cta-cont text-center">
                  <div className="stop-stressing-content text-center p-0">
                    <div className="cta-logo">
                      <img src="/images/cat-logo.png" alt="img" className="img-fluid" />
                    </div>
                    <h2 className="text-white mt-4">
                      How to complete your tax return <span>faster</span>
                    </h2>
                    <p className="text-white mb-0">Answer a few questions and finish your return step by step.</p>
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                      <Link href="/register" className="common-btn">
                        Start Your Return <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>

      {/* FAQ Section Start */}
            <AccountantLedPublicFaqs />
            {/* FAQ Section End */}
</>

  )
}

export default TaxFilling