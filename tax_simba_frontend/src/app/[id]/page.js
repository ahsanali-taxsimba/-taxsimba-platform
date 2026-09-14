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
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>What is Making Tax Digital?</h4>
                    <p>A simple explanation of what it means for you.</p>

                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Tax tips for small businesses.</h4>
                    <p>Easy tips to avoid mistakes.</p>

                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Help for landlords.</h4>
                    <p>Simple guide for managing rental income.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Benefits of Automated Bookkeeping</h4>
                    <p>Discover how Tax Simba saves you hours by automating your records.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>Quarterly HMRC Update Checklist</h4>
                    <p>A step-by-step guide to staying compliant with quarterly filings.</p>
                  </div>
                </Link>
              </div>
            </Col>
            <Col lg={4} className="mb-4">
              <div className="blog-card">
                <Link href="/blog-details">
                  <div className="blog-img">
                    <img src="/images/blog.png" alt="img" />
                  </div>
                  <div className="blog-card-content mt-3">
                    <h4>The Future of Digital Tax in the UK</h4>
                    <p>Staying ahead of government regulations and digital deadlines.</p>
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
