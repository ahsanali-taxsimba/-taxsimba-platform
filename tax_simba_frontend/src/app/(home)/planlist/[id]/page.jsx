"use client";
import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Spinner, Button } from 'react-bootstrap';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/utils/commonHelper';

/**
 * P0 K.3 — Stripe Checkout Session only.
 * Elements / CardElement / Apple Pay / Google Pay / subscription/create are disabled (D6 / E6).
 */
export default function PlanCheckoutPage() {
  const { id: planId } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
        const headers = session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {};
        const res = await axios.get(`${apiUrl}subscription-plans/${planId}`, { headers });
        setPlan(res.data?.data || res.data);
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.message || 'Failed to load plan');
        setPlan(null);
      } finally {
        setLoadingPlan(false);
      }
    };
    if (status !== 'loading') load();
  }, [planId, session?.accessToken, status]);

  const startCheckout = async () => {
    if (!session?.accessToken) {
      toast.error('Please log in to continue.');
      router.push(`/login?plan=${planId}`);
      return;
    }
    setPaying(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
      const response = await axios.post(
        `${apiUrl}client/subscription/checkout-session`,
        {
          planId,
          originUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      const checkoutUrl = response.data?.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error('Failed to create checkout session. Please try again.');
    } catch (err) {
      console.error('Checkout failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to start checkout.');
    } finally {
      setPaying(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-5">
        <h2>Plan not found</h2>
        <Button variant="link" onClick={() => router.push('/planlist')}>Back to plans</Button>
      </div>
    );
  }

  const basePrice = plan?.price ? parseFloat(plan.price) : 0;
  const currency = plan.currency || 'GBP';

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <div className="p-4 border rounded bg-white shadow-sm">
            <h2 className="mb-2">{plan.name}</h2>
            {plan.description && <p className="text-muted">{plan.description}</p>}
            <p className="fs-4 fw-semibold mb-4">
              {getCurrencySymbol(currency)}{basePrice.toFixed(2)}
            </p>
            {Array.isArray(plan.features) && plan.features.length > 0 && (
              <ul className="mb-4">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            <Button
              className="w-100 text-white"
              style={{ backgroundColor: '#14ab71', border: 'none' }}
              disabled={paying || status === 'loading'}
              onClick={startCheckout}
            >
              {paying ? <Spinner animation="border" size="sm" /> : 'Continue to secure checkout'}
            </Button>
            <p className="text-muted small mt-3 mb-0">
              You will be redirected to Stripe Checkout. Card entry on this page is not used for P0.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
