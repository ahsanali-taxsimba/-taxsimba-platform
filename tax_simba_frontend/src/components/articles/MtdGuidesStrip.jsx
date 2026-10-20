"use client";

import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import { getPublishedArticlesByCategory } from "@/data/articles";
import ArticleCard from "./ArticleCard";

/**
 * Three published MTD guide cards shown below MTD packages.
 * Counts and links are derived from the shared published registry.
 */
export default function MtdGuidesStrip({ limit = 3 }) {
  const guides = getPublishedArticlesByCategory("Making Tax Digital", limit);
  if (!guides.length) return null;

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
          <Link
            href="/blogs?category=mtd"
            className="common-btn-outline"
          >
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
