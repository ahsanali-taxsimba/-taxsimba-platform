import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'

function page() {
    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">TaxSimba Terms and Conditions</h2>
                                <p className="mb-0">Please read our terms and conditions carefully to understand the professional guidelines and agreements for using TaxSimba’s UK tax compliance services.</p>
                            </div>
                        </Col>
                        <Col lg={6} className="mt-lg-0 mt-5">
                            <div className="breadcrum-img text-center">
                                <img src="/images/Terms-bread.png" alt="Breadcrumb Image" className="img-fluid" />
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
                                <h3>Acceptance of Terms</h3>
                                <p>
                                    By accessing and using TaxSimba, you agree to comply with and be bound by these Terms and Conditions. Our platform is designed to provide digital tax management and filing solutions for UK taxpayers. If you do not agree with any part of these terms, you must refrain from using our services.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Scope of Services</h3>
                                <p>
                                    TaxSimba provides a suite of digital tools including Self Assessment tax return preparation, Making Tax Digital (MTD) compliance software, and various tax calculators. These services are intended to assist users in calculating and submitting their tax data directly to HMRC through secure digital channels.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>User Responsibilities</h3>
                                <p>
                                    You are responsible for ensuring that all information you provide—including income records, expense details, UTR, and National Insurance numbers—is accurate and complete. TaxSimba is a facilitator for digital submission and is not responsible for any penalties, interest, or legal consequences resulting from inaccurate data entry or missed HMRC deadlines.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Professional Disclaimer</h3>
                                <p>
                                    TaxSimba is a software-based tax compliance platform and does not provide professional tax, legal, or accounting advice. While our tools are designed to maximize accuracy and minimize errors, users with complex financial situations are encouraged to seek advice from qualified tax professionals or HMRC directly.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Accounts and Security</h3>
                                <p>
                                    To access our filing features, you must create a secure account. You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Intellectual Property</h3>
                                <p>
                                    All content, software, branding, and logic on the TaxSimba platform are the exclusive property of TaxSimba or its licensors. You are granted a limited, non-transferable license to use the platform for the purpose of managing your personal or business tax compliance.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Limitation of Liability</h3>
                                <p>
                                    TaxSimba shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the platform. We provide our services on an "as-is" and "as-available" basis without any warranties of any kind regarding accuracy or continuous availability.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Governing Law</h3>
                                <p>
                                    These Terms and Conditions are governed by and construed in accordance with the laws of England and Wales. Any disputes arising in connection with these terms shall be subject to the exclusive jurisdiction of the courts of the United Kingdom.
                                </p>
                            </div>
                            <div className="terms-content">
                                <h3>Updates to These Terms</h3>
                                <p>
                                    We may update these Terms and Conditions from time to time to reflect changes in our services or legal requirements. We will notify you of any material changes by posting the updated terms on this page. Your continued use of the platform after such changes constitutes your acceptance of the new terms.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

export default page