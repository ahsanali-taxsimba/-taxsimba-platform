"use client";
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner, Container, Card, Button } from "react-bootstrap";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import { postPurchaseDashboardPath } from "@/lib/catalogueJourney";

/**
 * Checkout Success — P0 K.3
 * Polls compat checkout-success → native payments/status → fulfil only if Stripe paid.
 * Never sets isSubscriptionBuy; refreshes ownership from my-services / account details (D7 / N5).
 * Refresh/retry is idempotent. Missing/invalid/unpaid sessions show controlled errors (never silent 404).
 * Landing path is ownership / fulfilled-service aware — never hardcode SA /dashboard.
 */
const CheckoutSuccess = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const attemptRef = useRef(0);
  const hasSucceeded = useRef(false);

  const nextDashboardPath = useMemo(
    () =>
      postPurchaseDashboardPath({
        serviceType: purchaseInfo?.serviceType || purchaseInfo?.service_type,
        hasActiveMtd: ownership?.hasActiveMtd ?? session?.hasActiveMtd ?? session?.user?.hasActiveMtd,
        hasActiveSa: ownership?.hasActiveSa ?? session?.hasActiveSa ?? session?.user?.hasActiveSa,
        ownership: ownership?.ownership ?? session?.ownership ?? session?.user?.ownership,
      }),
    [purchaseInfo, ownership, session],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (hasSucceeded.current) return;

    if (!sessionId) {
      setError("Missing checkout session. Return to plans and try again.");
      setLoading(false);
      return;
    }

    if (status === "unauthenticated" || !session?.accessToken) {
      setError("You must be logged in to complete this purchase.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    const finalize = async () => {
      attemptRef.current += 1;
      try {
        const response = await axios.post(
          `${apiUrl}client/subscription/checkout-success`,
          { sessionId },
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (cancelled) return;
        setPurchaseInfo(response.data?.data || {});
        setWaitingPayment(false);
        setError(null);

        let ownershipPatch = {
          hasActiveService: true,
          isSubscriptionBuy: false,
        };
        try {
          const account = await axios.post(
            `${apiUrl}auth/get-account-details`,
            {},
            { headers: { Authorization: `Bearer ${session.accessToken}` } }
          );
          const data = account.data?.data || {};
          ownershipPatch = {
            hasActiveSa: Boolean(data.hasActiveSa),
            hasActiveMtd: Boolean(data.hasActiveMtd),
            hasActiveService: Boolean(data.hasActiveService),
            ownership: data.ownership || "neither",
            isSubscriptionBuy: false,
          };
          setOwnership(ownershipPatch);
        } catch (e) {
          console.warn("Could not refresh account entitlements", e);
        }
        await update(ownershipPatch);
        hasSucceeded.current = true;
        toast.success("Your purchase was successful!");
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const statusCode = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || "Failed to finalize purchase.";
        // Unpaid / webhook lag — poll briefly without claiming success.
        if (
          statusCode === 402 ||
          statusCode === 409 ||
          /unpaid|pending|not paid|not complete|waiting/i.test(String(msg))
        ) {
          setWaitingPayment(true);
          if (attemptRef.current < 8) {
            setTimeout(finalize, 2000);
            return;
          }
          setError(
            "Payment is still processing. Refresh this page in a moment — activation is idempotent and will not double-charge.",
          );
          setLoading(false);
          return;
        }
        setError(msg);
        setLoading(false);
      }
    };

    setLoading(true);
    finalize();
    return () => {
      cancelled = true;
    };
  }, [sessionId, status, session?.accessToken, update]);

  useEffect(() => {
    if (!loading && purchaseInfo && !error) {
      const timer = setTimeout(() => router.push(nextDashboardPath), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, purchaseInfo, error, router, nextDashboardPath]);

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <Card className="shadow-sm" style={{ borderRadius: "12px", maxWidth: "500px", width: "100%" }}>
        <Card.Body className="p-4 text-center">
          {loading ? (
            <>
              <Spinner animation="border" className="mb-3" />
              <h5 className="mb-0">
                {waitingPayment ? "Waiting for payment confirmation…" : "Finalising your purchase…"}
              </h5>
            </>
          ) : error ? (
            <>
              <h4 className="mb-3 text-danger">Unable to confirm purchase</h4>
              <p className="text-muted mb-4">{error}</p>
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Button as={Link} href="/planlist" variant="outline-secondary">
                  Return to plans
                </Button>
              </div>
            </>
          ) : (
            <>
              <h4 className="mb-3 text-success">Purchase Completed</h4>
              {purchaseInfo?.plan && (
                <p>
                  You have successfully subscribed to <strong>{purchaseInfo.plan.name}</strong>.
                </p>
              )}
              <p className="text-muted mb-4">You will be redirected to the next steps shortly.</p>
              <Button variant="primary" onClick={() => router.push(nextDashboardPath)}>
                Proceed to Next Steps
              </Button>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CheckoutSuccess;
