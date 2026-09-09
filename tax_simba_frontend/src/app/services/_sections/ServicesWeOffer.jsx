import { TranslatedHeadingFour, TranslatedHeadingTwo, TranslatedParagraph, TranslatedSpan } from "@/components/TranslatedContent";
import Link from "next/link";
import { Col, Row } from "react-bootstrap";
export default function ServicesWeOffer({ services }) {
  console.log("services check", services)
  return (
    <section className="choose_us_section mx-3 ptb-80 tax-problems-sec">
      <div className="container_services_we_offer">

        <div className="container">
          <div className="common-title text-center mb-5">
            <h2> Our <span> Friendly </span> Services </h2>
            <p>Everything you need to finish your taxes with a smile.</p>
          </div>

          <Row>
            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/cis-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">01</div>
                <span className="tax-problem-icon">
                  <img src="/images/sel-employment.svg" alt="img" />
                </span>
                <h3>CIS Tax Returns</h3>
                <p>Expert handling of CIS deductions, monthly statements, and year-end tax returns for contractors and subcontractors in the construction industry.</p>
              </Link>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/self-employed-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">02</div>
                <span className="tax-problem-icon">
                  <img src="/images/tax-deduct.svg" alt="img" />
                </span>
                <h3>Self-employed Tax Return Services UK</h3>
                <p>Complete self-assessment for sole traders and freelancers, including income reporting, allowable expenses, and trading allowance claims.</p>
              </Link>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/rental-income-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">03</div>

                <span className="tax-problem-icon">
                  <img src="/images/vat.svg" alt="img" />
                </span>
                <h3>Rental Income Tax Returns</h3>
                <p>Accurate reporting of rental income, allowable property expenses, wear-and-tear allowances, and landlord tax relief for buy-to-let owners.</p>
              </Link>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/private-client-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">04</div>

                <span className="tax-problem-icon">
                  <img src="/images/property.svg" alt="img" />
                </span>
                <h3>Private Client Tax Returns</h3>
                <p>Personalised tax return service for individuals with employment income, dividends, trusts, share schemes, and multiple income sources.</p>
              </Link>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/capital-gains-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">05</div>

                <span className="tax-problem-icon">
                  <img src="/images/retirement-plan.svg" alt="img" />
                </span>
                <h3>Capital Gains Tax Returns & Advice</h3>
                <p>Expert CGT calculation and filing for property disposals, share sales, and other chargeable assets, including annual exempt amount planning.</p>
              </Link>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <Link href="/high-net-worth-service" className="tax-problems-box d-inline-block text-dark">
                <div className="fbox-number">06</div>

                <span className="tax-problem-icon">
                  <img src="/images/gain.svg" alt="img" />
                </span>
                <h3>High Net Worth Individuals Tax Returns</h3>
                <p>Specialist tax returns for high earners with complex portfolios, multiple income streams, offshore assets, and personal allowance tapering issues.</p>
              </Link>
            </Col>
          </Row>
        </div>
      </div>
    </section>
  )
}
