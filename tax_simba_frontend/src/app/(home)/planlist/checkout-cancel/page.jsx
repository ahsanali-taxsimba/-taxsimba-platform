"use client";

import Link from "next/link";
import { Container, Card, Button } from "react-bootstrap";

/**
 * Stripe cancel_url landing page.
 * Cancellation creates no entitlement and must never 404.
 */
export default function CheckoutCancelPage() {
  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "80vh" }}
    >
      <Card className="shadow-sm" style={{ borderRadius: "12px", maxWidth: "500px", width: "100%" }}>
        <Card.Body className="p-4 text-center">
          <h4 className="mb-3">Checkout cancelled</h4>
          <p className="text-muted mb-4">
            Your payment was not completed. No package was activated and no tax case was created.
          </p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Button as={Link} href="/planlist" variant="primary">
              Return to plans
            </Button>
            <Button as={Link} href="/dashboard" variant="outline-secondary">
              Go to dashboard
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
