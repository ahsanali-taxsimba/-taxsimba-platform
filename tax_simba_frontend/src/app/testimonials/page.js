// import dynamic from 'next/dynamic'
// import React, { use } from 'react'
import { Col, Container, Row } from 'react-bootstrap';
import TestimonialsClient from './page.client';

// const TestimonialsClient = dynamic(() => import('./page.client.jsx'), {
  // ssr: false})


  export function generateMetadata() {
  // const pathname = new URL(request.url).pathname;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const metadataBase = new URL(baseUrl);
  const canonicalUrl = new URL('/testimonials', metadataBase).toString();
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Our Client Testimonials | TaxSimba",
    description: "Read real client testimonials about TaxSimba’s UK tax and accounting services. See how we help individuals and businesses file taxes accurately and stress-free.",
    metadataBase,
    // keywords: "Online Tax Return Filing, File Tax Online",
    robots: "index, follow",
    alternates: {
       canonical: canonicalUrl
    },

    // Open Graph
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "Our Client Testimonials | TaxSimba",
      description: "Read real client testimonials about TaxSimba’s UK tax and accounting services. See how we help individuals and businesses file taxes accurately and stress-free.",
      url: canonicalUrl,
      images: [
        {
        url: ogImageUrl,
        width: 1200,
        height: 628,
        alt: "TaxSimba — Self Assessment Tax UK, online tax consultants",
        },
      ],
    },

    // Twitter
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba", // Replace with your Twitter handle
      title: "Our Client Testimonials | TaxSimba",
      description: "Read real client testimonials about TaxSimba’s UK tax and accounting services. See how we help individuals and businesses file taxes accurately and stress-free.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}
const Testimonials = () => {
  return (
    <>
     <section className="breadcrum-sec-top py-80">
          <Container>
              <Row className="align-items-center">
                  <Col lg={6}>
                      <div className="bread-crum-inr-box text-lg-start text-center">
                          <h1 className="text-capitalize mb-3 fs-2">Testimonials</h1>
                          <p className="mb-0">At Taxsimba, we are committed to protecting your personal and financial data. Learn how we handle your
                             information securely and transparently.</p>
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

    <TestimonialsClient />      
    </>
  )
}

export default Testimonials;
