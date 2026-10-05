"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Spinner, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/utils/commonHelper';
import { formatPlanPrice, isPlanPurchasable } from '@/hooks/useCatalogueFromPrice';

/**
 * P0 K.3 — Stripe Checkout Session only.
 * Elements / CardElement / Apple Pay / Google Pay / subscription/create are disabled (D6 / E6).
 *
 * SA upgrade path: show target catalogue price, agreed-price credit, and amount payable
 * (upgrade difference). Server recalculates at checkout; client amounts are never accepted.
 */
export default function PlanCheckoutPage() {
  const { id: planId } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [paying, setPaying] = useState(false);
  const [upgradeQuote, setUpgradeQuote] = useState(null);
  const [upgradeLocked, setUpgradeLocked] = useState(null);
  const [isUpgradePath, setIsUpgradePath] = useState(false);
  const [confirmQuote, setConfirmQuote] = useState(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';

  const formatMoney = (amount, currency = 'GBP') => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const sym = getCurrencySymbol(currency);
    return `${sym}${Number.isInteger(n) ? n : n.toFixed(2)}`;
  };

  const loadUpgradeQuote = useCallback(async (token, planCode) => {
    try {
      const res = await axios.get(`${apiUrl}client/subscription/upgrade-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.data || res.data || {};
      if (data.locked) {
        setUpgradeLocked(data.lockReason || data.lock_reason || 'Package changes are locked');
      } else {
        setUpgradeLocked(null);
      }
      const options = data.options || [];
      const match = options.find(
        (o) =>
          String(o.code || '').toUpperCase() === String(planCode || '').toUpperCase() ||
          String(o.planId || o.plan_id || '') === String(planId),
      );
      if (match) {
        setIsUpgradePath(true);
        setUpgradeQuote({
          upgradePrice: match.upgradePrice ?? match.upgrade_price,
          credit: match.currentPackageCredit ?? match.current_package_credit,
          due: match.additionalAmountPayable ?? match.additional_amount_payable ?? match.totalDueNow ?? match.total_due_now,
          currency: match.currency || 'gbp',
          currentCode: data.currentPackage?.code || data.current_package?.code,
          currentAgreed: data.currentPackage?.agreedPrice ?? data.current_package?.agreed_price,
        });
        return true;
      }
      // Active SA but plan not in upgrade options (same/lower) → not an upgrade checkout.
      if (data.currentPackage || data.current_package) {
        setIsUpgradePath(true);
        setUpgradeQuote(null);
        return true;
      }
    } catch {
      /* fall through — treat as new purchase if options unavailable */
    }
    setIsUpgradePath(false);
    setUpgradeQuote(null);
    return false;
  }, [apiUrl, planId]);

  useEffect(() => {
    const load = async () => {
      try {
        const headers = session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {};
        const res = await axios.get(`${apiUrl}subscription-plans/${planId}`, { headers });
        const loaded = res.data?.data || res.data;
        setPlan(loaded);
        if (session?.accessToken && loaded) {
          const code = loaded.code || loaded.packageCode;
          await loadUpgradeQuote(session.accessToken, code);
        }
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.message || 'Failed to load plan');
        setPlan(null);
      } finally {
        setLoadingPlan(false);
      }
    };
    if (status !== 'loading') load();
  }, [planId, session?.accessToken, status, apiUrl, loadUpgradeQuote]);

  const redirectToCheckout = (checkoutUrl) => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      return true;
    }
    return false;
  };

  const startCheckout = async ({ acceptFinalAmount = false } = {}) => {
    if (!session?.accessToken) {
      toast.error('Please log in to continue.');
      router.push(`/login?plan=${planId}`);
      return;
    }
    if (!isPlanPurchasable(plan)) {
      toast.error('This package is currently unavailable.');
      return;
    }
    if (upgradeLocked) {
      toast.error(upgradeLocked);
      return;
    }
    setPaying(true);
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` };
      const originUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const packageCode = plan?.code || plan?.packageCode || planId;

      let response;
      if (isUpgradePath) {
        // Never send amount — server calculates from agreed SA price + live target catalogue.
        response = await axios.post(
          `${apiUrl}client/subscription/upgrade-checkout`,
          {
            planId,
            plan_id: planId,
            packageCode,
            package_code: packageCode,
            originUrl,
            origin_url: originUrl,
          },
          { headers },
        );
      } else {
        try {
          response = await axios.post(
            `${apiUrl}client/subscription/checkout-session`,
            {
              planId,
              packageCode,
              originUrl,
            },
            { headers },
          );
        } catch (err) {
          const msg = err?.response?.data?.message || '';
          if (String(msg).toLowerCase().includes('already active')) {
            response = await axios.post(
              `${apiUrl}client/subscription/upgrade-checkout`,
              {
                planId,
                plan_id: planId,
                packageCode,
                package_code: packageCode,
                originUrl,
                origin_url: originUrl,
              },
              { headers },
            );
            setIsUpgradePath(true);
          } else {
            throw err;
          }
        }
      }

      const payload = response.data?.data || response.data || {};
      const checkoutUrl = payload.checkoutUrl || payload.checkout_url;
      const finalDue =
        payload.totalDueNow ??
        payload.total_due_now ??
        payload.additionalAmountPayable ??
        payload.additional_amount_payable ??
        payload.amount;
      const displayedDue = upgradeQuote?.due;

      // Catalogue may have moved since the page opened — require explicit acceptance of final amount.
      if (
        isUpgradePath &&
        !acceptFinalAmount &&
        Number.isFinite(Number(finalDue)) &&
        Number.isFinite(Number(displayedDue)) &&
        Math.round(Number(finalDue) * 100) !== Math.round(Number(displayedDue) * 100)
      ) {
        setConfirmQuote({
          checkoutUrl,
          upgradePrice: payload.upgradePrice ?? payload.upgrade_price ?? upgradeQuote?.upgradePrice,
          credit: payload.currentPackageCredit ?? payload.current_package_credit ?? upgradeQuote?.credit,
          due: finalDue,
          currency: payload.currency || upgradeQuote?.currency || 'gbp',
          previousPackage: payload.previousPackage || payload.previous_package,
          newPackage: payload.newPackage || payload.new_package,
        });
        setPaying(false);
        return;
      }

      if (isUpgradePath && !acceptFinalAmount && Number.isFinite(Number(finalDue))) {
        // Always surface the server-final amount once before redirect (customer acceptance).
        setConfirmQuote({
          checkoutUrl,
          upgradePrice: payload.upgradePrice ?? payload.upgrade_price ?? upgradeQuote?.upgradePrice ?? plan?.price,
          credit: payload.currentPackageCredit ?? payload.current_package_credit ?? upgradeQuote?.credit,
          due: finalDue,
          currency: payload.currency || upgradeQuote?.currency || plan?.currency || 'gbp',
          previousPackage: payload.previousPackage || payload.previous_package,
          newPackage: payload.newPackage || payload.new_package || packageCode,
        });
        setPaying(false);
        return;
      }

      if (!redirectToCheckout(checkoutUrl)) {
        toast.error('Failed to create checkout session. Please try again.');
      }
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

  const basePrice = Number(plan?.price);
  const currency = plan.currency || 'GBP';
  const purchasable = isPlanPurchasable(plan);
  const showUpgradeBreakdown = isUpgradePath && upgradeQuote && Number(upgradeQuote.due) > 0;

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <div className="p-4 border rounded bg-white shadow-sm" data-testid="plan-checkout-card">
            <h2 className="mb-2">{plan.name}</h2>
            {plan.description && <p className="text-muted">{plan.description}</p>}

            {showUpgradeBreakdown ? (
              <div className="mb-4" data-testid="upgrade-price-breakdown">
                <div className="d-flex justify-content-between py-1">
                  <span>Target package price</span>
                  <strong>{formatMoney(upgradeQuote.upgradePrice, currency)}</strong>
                </div>
                <div className="d-flex justify-content-between py-1 text-muted">
                  <span>
                    Upgrade credit
                    {upgradeQuote.currentCode ? ` (${upgradeQuote.currentCode} agreed price)` : ' (existing SA purchase)'}
                  </span>
                  <span>− {formatMoney(upgradeQuote.credit, currency)}</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between py-1 fs-5">
                  <span>Amount payable now</span>
                  <strong data-testid="upgrade-amount-payable">
                    {formatMoney(upgradeQuote.due, currency)}
                  </strong>
                </div>
                <p className="text-muted small mb-0 mt-2">
                  You only pay the upgrade difference. Checkout amount is calculated server-side in GBP pence.
                </p>
              </div>
            ) : (
              <p className="fs-4 fw-semibold mb-4" data-testid="full-package-price">
                {purchasable
                  ? formatMoney(basePrice, currency)
                  : formatPlanPrice(plan)}
              </p>
            )}

            {upgradeLocked && (
              <Alert variant="warning" data-testid="upgrade-locked">
                {upgradeLocked}
              </Alert>
            )}

            {confirmQuote && (
              <Alert variant="info" data-testid="upgrade-final-amount-confirm">
                <div className="mb-2">
                  <strong>Confirm amount before payment</strong>
                </div>
                <div className="small mb-1">
                  Target package: {formatMoney(confirmQuote.upgradePrice, confirmQuote.currency)}
                </div>
                <div className="small mb-1">
                  Upgrade difference payable:{' '}
                  <strong>{formatMoney(confirmQuote.due, confirmQuote.currency)}</strong>
                </div>
                <div className="d-flex gap-2 mt-3">
                  <Button
                    size="sm"
                    style={{ backgroundColor: '#14ab71', border: 'none' }}
                    disabled={paying}
                    onClick={() => {
                      setConfirmQuote(null);
                      if (confirmQuote.checkoutUrl) {
                        redirectToCheckout(confirmQuote.checkoutUrl);
                      } else {
                        void startCheckout({ acceptFinalAmount: true });
                      }
                    }}
                    data-testid="confirm-upgrade-amount"
                  >
                    Pay {formatMoney(confirmQuote.due, confirmQuote.currency)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={paying}
                    onClick={() => setConfirmQuote(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </Alert>
            )}

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
              disabled={paying || status === 'loading' || !purchasable || Boolean(upgradeLocked) || Boolean(confirmQuote)}
              onClick={() => startCheckout()}
              data-testid="continue-to-checkout"
            >
              {paying ? (
                <Spinner animation="border" size="sm" />
              ) : !purchasable ? (
                'Unavailable'
              ) : showUpgradeBreakdown ? (
                `Continue — pay ${formatMoney(upgradeQuote.due, currency)} upgrade difference`
              ) : (
                'Continue to secure checkout'
              )}
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
