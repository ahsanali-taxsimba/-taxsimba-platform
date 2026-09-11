"use client";
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner, Container, Card, Button } from "react-bootstrap";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Checkout Success — P0 K.3
 * Polls compat checkout-success → native payments/status → fulfil only if Stripe paid.
 * Never sets isSubscriptionBuy; refreshes ownership from my-services / account details (D7 / N5).
 */
const CheckoutSuccess = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const hasFinalized = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (hasFinalized.current) return;

    const finalize = async () => {
      hasFinalized.current = true;
      if (!sessionId) {
        toast.error("Missing session_id in URL.");
        router.push("/planlist");
        return;
      }

      if (status === "unauthenticated" || !session?.accessToken) {
        toast.error("You must be logged in to complete this purchase.");
        router.push("/login");
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.post(
          `${apiUrl}client/subscription/checkout-success`,
          { sessionId },
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        setPurchaseInfo(response.data?.data || {});

        // Refresh ownership from server — never invent client-side entitlement.
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
            ownership: data.ownership || 'neither',
            isSubscriptionBuy: false,
          };
        } catch (e) {
          console.warn("Could not refresh account entitlements", e);
        }
        await update(ownershipPatch);

        toast.success("Your purchase was successful!");
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.message || "Failed to finalize purchase.");
        router.push("/planlist");
      } finally {
        setLoading(false);
      }
    };
    finalize();
  }, [sessionId, status, router, session?.accessToken, update]);

  useEffect(() => {
    if (!loading && purchaseInfo) {
      const timer = setTimeout(() => router.push("/dashboard/my-subscriptions"), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, purchaseInfo, router]);

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <Card className="shadow-sm" style={{ borderRadius: "12px", maxWidth: "500px", width: "100%" }}>
        <Card.Body className="p-4 text-center">
          {loading ? (
            <>
              <Spinner animation="border" className="mb-3" />
              <h5 className="mb-0">Finalising your purchase…</h5>
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
              <Button variant="primary" onClick={() => router.push("/dashboard/my-subscriptions")}>
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
