'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useSession } from 'next-auth/react';

const statusCopy = {
  loading: 'Checking payment status...',
  success: 'Payment completed successfully!',
  processing: 'Payment is still processing. You will be notified once it completes.',
  error: 'We were unable to confirm your payment.',
};

export default function PaymentCompletePage() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const taxReturnId = searchParams.get('taxReturnId');
  const { data: session, status: authStatus } = useSession();

  const [status, setStatus] = useState(paymentIntentId ? 'loading' : 'error');
  const [message, setMessage] = useState(
    paymentIntentId ? statusCopy.loading : 'Missing payment reference.'
  );
  const [paymentDetails, setPaymentDetails] = useState(null);

  const confirmPayment = useCallback(async () => {
    if (!paymentIntentId) {
      setStatus('error');
      setMessage('Missing payment reference.');
      return;
    }

    if (!session?.accessToken) {
      setStatus('error');
      setMessage('You must be signed in to verify this payment.');
      return;
    }

    const unwrapData = (payload) => {
      let current = payload;
      while (current?.data && typeof current.data === 'object') {
        current = current.data;
      }
      return current;
    };

    try {
      setStatus('loading');
      setMessage(statusCopy.loading);
      setPaymentDetails(null);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/confirm-payment`,
        {
          paymentIntentId,
          taxReturnId,
        },
        {
          headers: {
            Authorization: session.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setStatus('success');
        setMessage(statusCopy.success);
        setPaymentDetails(unwrapData(response.data));
      } else {
        setStatus('processing');
        setMessage(
          response.data.message ||
          'Payment is still processing. Please check back shortly.'
        );
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      setStatus('error');
      setMessage(
        error.response?.data?.message ||
        error.message ||
        statusCopy.error
      );
    }
  }, [paymentIntentId, session?.accessToken, taxReturnId]);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }
    confirmPayment();
  }, [authStatus, confirmPayment]);

  const statusClass =
    status === 'success'
      ? 'text-success'
      : status === 'processing'
        ? 'text-warning'
        : status === 'loading'
          ? 'text-primary'
          : 'text-danger';

  const derivedData = useMemo(() => {
    if (!paymentDetails || typeof paymentDetails !== 'object') {
      return {
        payment: null,
        taxReturn: null,
      };
    }

    const payment =
      paymentDetails.payment ||
      paymentDetails.paymentInfo ||
      paymentDetails.stripePayment ||
      null;

    const taxReturn =
      paymentDetails.taxReturn ||
      paymentDetails.taxReturnData ||
      paymentDetails.taxReturnInfo ||
      null;

    return { payment, taxReturn };
  }, [paymentDetails]);

  const formatAmount = (value) => {
    if (value === undefined || value === null) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    return `£${numeric.toFixed(2)}`;
  };

  const paymentAmount =
    paymentDetails?.amountFormatted ||
    derivedData.payment?.amountFormatted ||
    derivedData.payment?.displayAmount ||
    formatAmount(
      derivedData.payment?.amountReceived ?? derivedData.payment?.amount
    ) ||
    formatAmount(paymentDetails?.amount);

  const resolvedTaxReturnId =
    derivedData.taxReturn?.taxReturnId ||
    paymentDetails?.taxReturnId ||
    taxReturnId;

  const paymentStatus =
    derivedData.taxReturn?.paymentStatus ||
    derivedData.payment?.status ||
    paymentDetails?.status;

  return (
    <div className="container">
      <section className="tax_retur_ban" style={{ backgroundImage: "url(/images/banner-bg-img.png)" }}>
        <div className="container">
          <h1>Tax Return</h1>
        </div>
      </section>
      <div className='tax_return_main'>
        <div className='container'>
          <div className='row mb-4'>
            <div className='col-md-6'>
              <div className="payment-status-card card justify-content-center">
                
                  <div className="card shadow-sm">
                    <div className="card-body p-4">
                      <h1 className="h4 mb-3">Payment Status</h1>
                      <p className={`fw-semibold ${statusClass}`}>{message}</p>

                      {paymentIntentId && (
                        <div className="mb-3">
                          <small className="text-muted">
                            Payment reference:&nbsp;
                            <span className="text-dark">{paymentIntentId}</span>
                          </small>
                        </div>
                      )}

                      {(resolvedTaxReturnId || paymentAmount || paymentStatus) && (
                        <div className="alert alert-success d-flex flex-column gap-1">
                          {resolvedTaxReturnId && (
                            <p className="mb-0">
                              <strong>Tax Return ID:</strong> {resolvedTaxReturnId}
                            </p>
                          )}
                          {derivedData.taxReturn?.totalFee && (
                            <p className="mb-0">
                              <strong>Total Fee:</strong>{' '}
                              {formatAmount(derivedData.taxReturn.totalFee)}
                            </p>
                          )}
                          {paymentAmount && (
                            <p className="mb-0">
                              <strong>Paid Amount:</strong> {paymentAmount}
                            </p>
                          )}
                          {paymentStatus && (
                            <p className="mb-0">
                              <strong>Payment Status:</strong> {paymentStatus}
                            </p>
                          )}
                          {derivedData.payment?.paymentMethod && (
                            <p className="mb-0 text-capitalize">
                              <strong>Payment Method:</strong>{' '}
                              {derivedData.payment.paymentMethod}
                            </p>
                          )}
                          {derivedData.payment?.paymentDate && (
                            <p className="mb-0">
                              <strong>Payment Date:</strong>{' '}
                              {new Date(
                                derivedData.payment.paymentDate
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="d-flex gap-2 mt-4">
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={confirmPayment}
                          disabled={status === 'loading'}
                        >
                          Refresh status
                        </button>
                        <Link href="/tax-return-form" className="btn btn-primary">
                          Back to tax return form
                        </Link>
                      </div>

                      {status === 'error' && (
                        <p className="mt-3 text-muted">
                          If this problem persists, please contact support with your
                          payment reference.
                        </p>
                      )}
                    </div>
                  </div>
                
              </div>
            </div>
            <div className='col-md-6'>
              <div className="alert alert-success">
                <h5>🎉 Submission Complete!</h5>
                <p>Your tax return has been successfully submitted and payment processed.</p>
                <Link href="/tax-return-form" className="btn btn-primary btn-sm mt-2" >
                  Submit Another Tax Return
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
