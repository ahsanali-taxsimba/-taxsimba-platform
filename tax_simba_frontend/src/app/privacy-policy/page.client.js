import { TranslatedHeading, TranslatedHeadingTwo, TranslatedParagraph } from '@/components/TranslatedContent'
import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import TranslatedText from "@/components/TranslatedText";

const PrivacyCLient = () => {
  return (
    <>

      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h2 className="text-capitalize mb-3">Taxsimba Privacy Policy</h2>
                <p className="mb-0">At Taxsimba, we are committed to protecting your personal and financial data. Learn how we handle your
                  information securely and transparently.</p>
              </div>
            </Col>
            <Col lg={6} className="mt-lg-0 mt-5">
              <div className="breadcrum-img text-center">
                <img src="/images/privacy-bread.png" alt="Breadcrumb Image" className="img-fluid" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>


      <section className="terms-coditions-sec ptb-80">
        <div className="container">
          <div className="row">
            <div className="col">
              <div className="terms-content">
                <h3><TranslatedText>Information We Collect</TranslatedText></h3>
                <p>
                  <TranslatedText>We collect personal and financial information necessary to provide our tax preparation and filing services. This includes your name, contact details, UTR (Unique Taxpayer Reference), National Insurance number, income statements, and other tax-related documents. We may also collect technical data such as IP addresses and browser information when you use our platform to ensure security and proper functionality.</TranslatedText>
                </p>
              </div>
              <div className="terms-content">
                <h3><TranslatedText>How We Use Your Information</TranslatedText></h3>
                <p>
                  <TranslatedText>The primary purpose of collecting your information is to accurately prepare and file your tax returns with HMRC. We also use your data to communicate with you about your account, provide customer support, and improve our services. Your information is processed strictly for the purpose of fulfilling your tax obligations and enhancing your user experience on Taxsimba.</TranslatedText>
                </p>
              </div>
              <div className="terms-content">
                <h3><TranslatedText>Data Security</TranslatedText></h3>
                <p>
                  <TranslatedText>We take the security of your data seriously. Taxsimba employs industry-standard encryption protocols and security measures to protect your personal and financial information from unauthorized access, disclosure, alteration, or destruction. Our systems are regularly monitored and updated to ensure your data remains safe and confidential throughout the tax filing process.</TranslatedText>
                </p>
              </div>
              <div className="terms-content">
                <h3><TranslatedText>Information Sharing</TranslatedText></h3>
                <p>
                  <TranslatedText>We do not sell, trade, or rent your personal information to third parties. We strictly only share your information with HMRC as required to file your return or with other relevant authorities as required by law.</TranslatedText>
                </p>
                <p>
                  <TranslatedText>We may also share data with trusted service providers who assist us in operating our platform, provided they agree to keep your information confidential. We may also disclose information when required by law or to protect our rights and safety.</TranslatedText>
                </p>
                <p>
                  <TranslatedText>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction, but we will notify you of any such change.</TranslatedText>
                </p>
              </div>
              <div className="terms-content">
                <h3><TranslatedText>Your Rights</TranslatedText></h3>
                <p>
                  <TranslatedText>You have specific rights regarding your personal information, including:</TranslatedText>
                </p>
                <ul className="terms-list ms-2">
                  <li>
                    <TranslatedText>1. The right to access the personal information we hold about you.</TranslatedText>
                  </li>
                  <li>
                    <TranslatedText>2. The right to request correction of any inaccurate or incomplete data.</TranslatedText>
                  </li>
                  <li>
                    <TranslatedText>3. The right to request deletion of your data, subject to legal retention requirements.</TranslatedText>
                  </li>
                  <li>
                    <TranslatedText>4. The right to restrict or object to the processing of your data.</TranslatedText>
                  </li>
                  <li><TranslatedText>5. The right to data portability.</TranslatedText></li>
                  <li>
                    <TranslatedText>6. The right to withdraw consent at any time where we rely on consent to process your data.</TranslatedText>
                  </li>
                </ul>
              </div>
              <div className="terms-content">
                <h3><TranslatedText>Updates to This Policy</TranslatedText></h3>
                <p>
                  <TranslatedText>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the new policy on this page with an updated effective date. We encourage you to review this policy periodically to stay informed about how we protect your information.</TranslatedText>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>




    </>
  )
}

export default PrivacyCLient
