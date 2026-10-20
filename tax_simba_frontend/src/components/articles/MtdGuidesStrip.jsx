"use client";

import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import ArticleCard from "./ArticleCard";

/**
 * Three published MTD guide cards shown below MTD packages.
 * Guides must be resolved on the server and passed in so release env is honoured.
 */
export default function MtdGuidesStrip({ guides = [] }) {
  if (!Array.isArray(guides) || !guides.length) return null;

  return (
    <section className="mtd-guides-strip ptb-80 pt-0" aria-labelledby="mtd-guides-heading">
      <Container>
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <h2 id="mtd-guides-heading" className="h3 mb-2">
              Related MTD guides
            </h2>
            <p className="mb-0 text-muted">
              Practical answers from the Blog &amp; Guides library.
            </p>
          </div>
          <Link href="/blogs?category=mtd" className="common-btn-outline">
            View all MTD guides
          </Link>
        </div>
        <Row>
          {guides.map((article) => (
            <Col lg={4} md={6} className="mb-4" key={article.slug}>
              <ArticleCard article={article} />
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}
