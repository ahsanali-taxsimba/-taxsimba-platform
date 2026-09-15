import { TranslatedHeading, TranslatedParagraph } from '@/components/TranslatedContent'
import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'

const BannerSection = () => {
  return (
    <>
      {/*Banner Start*/}
      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={7}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3 fs-2">We Handle Your Taxes</h1>
                <p className="mb-0">Quick and easy help for everyone. You can relax while we help you do your taxes the easy way. Spend more time on what you love and let us handle the hard work.</p>
              </div>
            </Col>
            <Col lg={5} className="mt-lg-0 mt-5">
              <div className="breadcrum-img text-center">
                <img src="/images/breadcrum-img.png" alt="Breadcrumb Image" className="img-fluid" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>
    </>
  )
}

export default BannerSection
