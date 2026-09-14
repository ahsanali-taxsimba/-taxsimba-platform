"use server";

import React from "react";
import { notFound } from "next/navigation";
import fetchJSON from "@/lib/fetchJSON";
import { Col, Container, Row } from "react-bootstrap";
import Link from 'next/link'

const Page = async ({ params }) => {
  const slug = params?.id;
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const urls = [
    `${process.env.NEXT_PUBLIC_API_URL}resources/${slug}`,
    `${process.env.NEXT_PUBLIC_API_URL}resources/subcategory/${slug}/articles`,
  ];
  // const url =  `${process.env.NEXT_PUBLIC_API_URL}resources/subcategory/${slug}/articles`;
  console.log("urls ", urls)
  let response = null;
  let lastError;

  for (const url of urls) {
    try {
      response = await fetchJSON(url, { next: { revalidate: 0 } });
      if (response?.data)
        break;
    } catch (err) {
      lastError = err;
      console.error(`Fetch failed for ${url}:`, err);
    }
  }

  if (!response?.data) {
    // Optionally surface lastError to logging/observability here
    return notFound();
  }

  return (
    <>



      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h2 className="text-capitalize mb-3">Taxsimba Blog</h2>
                <p className="mb-0">Stay informed with the latest tax updates, guides, and professional advice from Taxsimba.</p>
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

      <section className="blog-sec pd-100">
        <Container>
          <div className="common-title mb-5 text-center">
            <h2>Latest <span> News</span></h2>
          </div>

          <Row>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blogs/hmrc-signed-me-up-for-making-tax-digital">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="Making Tax Digital guide thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>HMRC signed me up for Making Tax Digital</h4>
                    <p>What that notice means and what to do next.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blogs/top-tax-saving-tips-uk">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="UK tax tips guide thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Tax tips for small businesses</h4>
                    <p>Practical steps to avoid common mistakes.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/rental-income-tax">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="Landlord MTD and rental income thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Help for landlords</h4>
                    <p>MTD and rental income support for property landlords.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blogs/understanding-self-assessment-uk">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="Self Assessment guide thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Understanding Self Assessment</h4>
                    <p>A plain-English guide to filing your UK tax return.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/making-tax-digital">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="Making Tax Digital accountant thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Making Tax Digital accountant</h4>
                    <p>Accountant-led MTD support without becoming a software expert.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blogs">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="TaxSimba guides and blog thumbnail" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>More UK tax guides</h4>
                    <p>Browse TaxSimba’s Guides & Blog for practical tax help.</p>
                  </div>
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </section>



    </>
  );
};

export default Page;
