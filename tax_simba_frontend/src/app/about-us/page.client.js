import Accountant from '@/components/re-used/Accountant'
import Partners from '@/components/re-used/Partners'
import { TranslatedHeadingFour, TranslatedHeadingTwo, TranslatedParagraph, TranslatedSpan } from '@/components/TranslatedContent'
import Link from 'next/link'
import { Col, Container, Row } from 'react-bootstrap'
import { MdKeyboardDoubleArrowRight } from 'react-icons/md'

const AboutUsClient = () => {
  return (
    <>

      {/*Banner Start*/}

      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={7}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3 fs-2">Redefining Tax Management. One Click at a Time.</h1>
                <p className="mb-0">Our team is here to make tax filing smart, accessible,
                  hassle-free and effortless. Get solutions backed by certified
                  experts and data-driven technology.</p>
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
      <section className='feature-bussiness-sec ptb-80'>
        <Container>
          <div className="feature-bussiness">
            <div className="feature-bussiness-inner">
              <Row className="align-items-center">
                <Col lg={7} className=" mb-4">
                  <div className='feature-bussiness-left common-title pe-lg-5 pe-0'>
                    <div className="feature-text-box connect-box-card">
                      <h2 className='mb-3'>Your <span>Reliable Partner</span> for Hassle-free Finances</h2>
                      <p className='mb-0'>At TaxSimba, our goal is to make tax filing in the UK
                        simple and hassle-free. We have designed a digital
                        platform to help remove the jargon and guesswork with tax management. Remove
                        the stress and save your
                        time as you collaborate with our tax experts. Take control of your finances
                        and file taxes smartly. Our mission is to empower UK taxpayers with the tools
                        and support they need for complete peace of mind. Experience a smarter, faster
                        way to handle your Self Assessment today.</p>
                    </div>
                  </div>
                </Col>
                <Col lg={5} className="mb-4">
                  <div className="feature-bussiness-right">
                    <img src="/images/auth.jpg" alt="" className='img-fluid' />
                  </div>
                </Col>
              </Row>

              <Row>
                <Col lg={3} className="mb-lg-0 mb-4">
                  <div className='feature-bussiness-bottom-box h-100'>
                    <div className="feature-bottom-text">
                      <h4>Smart Tax Estimator</h4>
                      <p>See your estimated tax bill update in real-time as you enter your income and expenses. No more surprise tax bills in January.</p>
                    </div>
                  </div>
                </Col>
                <Col lg={3} className="mb-lg-0 mb-4">
                  <div className='feature-bussiness-bottom-box h-100'>
                    <div className="feature-bottom-text">
                      <h4>Maximized Deductions</h4>
                      <p>Ensure you claim every allowable expense you're entitled to with built-in guidance on what can and cannot be deducted.</p>
                    </div>
                  </div>
                </Col>
                <Col lg={3} className="mb-lg-0 mb-4">
                  <div className='feature-bussiness-bottom-box h-100'>
                    <div className="feature-bottom-text">
                      <h4>Direct Submission</h4>
                      <p>File your Self Assessment tax return straight to HMRC electronically from within Taxsimba without needing to visit the HMRC portal.</p>
                    </div>
                  </div>
                </Col>
                <Col lg={3} className="mb-lg-0 mb-4">
                  <div className='feature-bussiness-bottom-box h-100'>
                    <div className="feature-bottom-text">
                      <h4>Expert Review Checks</h4>
                      <p>Our system runs automated diagnostic checks on your return before submission to help prevent common mistakes and HMRC inquiries.</p>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        </Container>
      </section>
      {/* whats the cost end */}


      <section className="our_journey_sec ptb-80">
        <div className="container">
          <div className="common-title text-center mb-5">
            <h2 className='mb-2'>Our Journey <span>From an Idea to Impact</span></h2>
          </div>

          <div className="total_timeline_wrapper">
            <div className="road">
              <svg
                viewBox="0 0 1440 158"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M58.2852 104.939C34.0448 117.207 9.26249 113.622 -0.0986328 110.297L1.00992 151.129C13.204 154.454 25.0286 154.454 44.0588 152.052C77.7588 147.322 105.891 118.672 115.745 104.939C126.769 90.2812 151.995 58.8968 164.706 50.6196C180.596 40.2731 201.473 37.6865 223.46 43.7835C241.049 48.6611 262.937 74.3919 271.682 86.6476C281.905 100.874 307.784 131.951 329.512 142.445C356.671 155.563 379.766 155.378 404.893 150.205C430.02 145.031 452.007 124.338 458.843 117.133C464.312 111.368 478.612 93.9148 485.079 85.9086C509.282 53.9453 526.095 42.8597 548.82 40.4578C591.315 38.056 605.172 63.368 628.267 91.8209C651.362 120.274 681.477 153.715 728.591 153.9C775.705 154.085 803.049 131.359 830.578 95.8856C858.107 60.4118 875.105 41.1969 909.285 40.2731C936.63 39.5341 961.819 63.7375 970.995 76.1163C974.382 81.0433 984.372 94.5923 997.231 109.373C1013.3 127.849 1039.36 153.346 1087.58 153.346C1135.8 153.346 1162.59 119.35 1169.06 113.807C1175.52 108.264 1205.82 66.6936 1222.08 53.7605C1235.09 43.414 1252.88 40.2115 1260.14 40.0883C1290.89 39.4971 1310.95 59.1185 1321.48 72.7907C1329.18 83.2604 1349.23 107.784 1361.95 120.643C1391.21 150.648 1425.99 155.07 1440.1 153.53V113.992C1413.05 116.357 1389.54 94.4075 1381.16 83.1372C1373.77 73.6529 1356.85 52.3933 1348.27 43.2292C1337.56 31.7742 1314.65 0.36513 1260.14 0.36513C1205.64 0.36513 1175.15 43.414 1153.72 70.9431C1132.29 98.4722 1116.95 112.144 1084.25 113.622C1058.09 114.805 1034.31 92.6831 1025.68 81.2896C1019.22 73.0986 1005.06 55.3125 1000.19 49.6958C994.09 42.675 962.311 -0.743424 909.285 0.36513C856.26 1.47368 835.197 30.8504 824.666 40.6426C814.135 50.4348 805.636 65.5851 781.432 91.8209C757.229 118.057 727.482 116.948 705.127 108.634C682.771 100.32 658.567 64.107 646.189 48.772C633.81 33.437 611.639 13.6678 594.641 7.57073C577.643 1.47368 547.897 -4.43861 515.564 7.57073C483.231 19.5801 451.083 63.7375 442.769 74.823C434.455 85.9086 421.706 98.657 411.36 105.124C401.013 111.59 388.265 115.285 364.246 112.329C345.031 109.964 324.215 88.8031 316.209 78.3335L300.504 58.749C289.234 47.6635 263.922 0.919329 201.473 0.180293C139.025 -0.558743 105.029 54.869 89.5095 74.823C77.0937 90.7861 63.5201 101.551 58.2852 104.939Z"
                  fill="#2E93A9"
                />
                <path
                  className="svg-line"
                  d="M0.0869141 129.881C5.5681 132.899 16.9 135.978 38.8863 132.283C61.6909 128.45 78.979 118.611 110.388 79.8114C141.797 41.012 158.795 14.4066 206.648 17.178C254.5 19.9494 284.062 67.063 295.147 80.5504C306.233 94.0378 339.12 137.633 379.397 135.424C419.675 133.215 430.945 120.458 463.278 80.9199C495.611 41.3815 511.131 17.5476 556.766 17.5476C602.402 17.5476 629.007 58.1943 671.317 107.156C713.626 156.117 783.465 131.175 813.027 87.2017C827.746 62.2592 868.492 14.0741 913.721 20.8732C970.257 29.3721 975.8 48.2176 1014.6 98.8416C1045.64 139.341 1093.55 136.532 1113.63 130.066C1124.53 126.617 1153.32 109.299 1181.25 67.6173C1216.17 15.5153 1260.88 19.9495 1276.03 21.6123C1291.18 23.2751 1314.09 27.3398 1351.41 78.7029C1388.74 130.066 1414.6 133.392 1439.73 133.392"
                  stroke="#DBDBDB"
                  strokeWidth={3}
                />
              </svg>
            </div>
            <ul>
              <li>
                <div className="timeline_year">2011</div>
                <TranslatedSpan className="txt_timeline">
                  Founded successful trust-based accountancy practice
                </TranslatedSpan>
              </li>
              <li>
                <div className="timeline_year">2012</div>
                <TranslatedSpan className="txt_timeline">
                  Expanded services across UK nationwide
                </TranslatedSpan>
              </li>
              <li>
                <div className="timeline_year">2015</div>
                <TranslatedSpan className="txt_timeline">Adopted digital cloud-based solutions</TranslatedSpan>
                {/* Acquired ABC Insurance limited */}
              </li>
              <li>
                <div className="timeline_year">2017</div>
                <TranslatedSpan className="txt_timeline">Served 300+ UK taxpayers successfully</TranslatedSpan>
              </li>
              <li>
                <div className="timeline_year">2025</div>
                <TranslatedSpan className="txt_timeline">
                  Launched TaxSimba digital tax platform
                </TranslatedSpan>
              </li>
              <li>
                <div className="timeline_year">2026</div>
                <TranslatedSpan className="txt_timeline">Introducing MTD software platform soon</TranslatedSpan>
              </li>
              <li>
                <div className="timeline_year">2027</div>
                <TranslatedSpan className="txt_timeline">
                  Expanding tax services across Europe
                </TranslatedSpan>
              </li>
            </ul>
          </div>
        </div>
      </section>

  
      <section className="tax-problems-sec tax-problems-sec-about ptb-80">
        <Container>
          <div className="common-title text-center mb-5">
            <h2>  What <span>Sets Us</span> Apart </h2>
            <p>Why People Choose Us</p>
          </div>
          <Row>
            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">01</div>
                <span className="tax-problem-icon">
                  <img src="/images/sel-employment.svg" alt="img" />
                </span>
                <h3>Quick Turnaround</h3>
                <p>Our team prioritises your time and works to offer fast results. We ensure your tax submissions are processed efficiently without compromising on accuracy.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">02</div>
                <span className="tax-problem-icon">
                  <img src="/images/tax-deduct.svg" alt="img" />
                </span>
                <h3>Transparent Costs</h3>
                <p>No unpleasant surprises. No extra costs. We believe in clear, upfront pricing with no hidden fees, so you know exactly what you're paying for.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">03</div>

                <span className="tax-problem-icon">
                  <img src="/images/vat.svg" alt="img" />
                </span>
                <h3>100% Online Procedure</h3>
                <p>Easy Accessibility. File taxes anytime anywhere. Our fully digital platform allows you to manage your taxes from the comfort of your home or on the go.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">04</div>

                <span className="tax-problem-icon">
                  <img src="/images/property.svg" alt="img" />
                </span>
                <h3>GDPR-Compliance</h3>
                <p>Your personal data is totally safe. We adhere to the highest security standards and data protection regulations to keep your information confidential and secure.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">05</div>

                <span className="tax-problem-icon">
                  <img src="/images/retirement-plan.svg" alt="img" />
                </span>
                <h3>Dedicated Support</h3>
                <p>Real experts, genuine solutions—whenever you need it. Our support team is always ready to assist you with any questions or concerns you may have during the filing process.</p>
              </div>
            </Col>

            <Col lg={4} md={6} sm={12} xs={12}>
              <div className="tax-problems-box">
                <div className="fbox-number">06</div>

                <span className="tax-problem-icon">
                  <img src="/images/gain.svg" alt="img" />
                </span>
                <h3>Complete Clarity</h3>
                <p>No jargon at all. Simple and straightforward process. We break down complex tax terms into easy-to-understand language, making tax management accessible to everyone.</p>
              </div>
            </Col>


          </Row>
        </Container>
      </section>

      <Partners className="our_partner press_sec" heading="Our Partners & Press" discription="Certifications & Trust Badges" />

      <section className="cta-main bottom-cta pd-80">
        <Container>
          <div className="cta-inner">
            <Row>
              <Col lg={12}>
                <div className="cta-cont text-center">
                  <div className="stop-stressing-content text-center">
                    <h2 className="text-white">
                      Start your tax return today
                    </h2>
                    <p className="text-white">Complete your Self Assessment the simple way.</p>
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
      {/* CTA Section End */}

    </>

  )
}

export default AboutUsClient