'use client';
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { useState } from 'react';
import toast from 'react-hot-toast';

const PaymentForm = ({
  taxReturnData,
  amount,
  onPaymentSuccess,
  onPaymentError,
  onClose,
  loading,
  setLoading,
  savePaymentMethod,
  onSavePaymentMethodChange,
  initializingPayment,
  clientSecret
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { data: session } = useSession();
  const [paymentError, setPaymentError] = useState('');

  const confirmPaymentOnBackend = async (paymentIntentId) => {
    try {
      const confirmResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/confirm-payment`,
        {
          paymentIntentId,
          taxReturnId: taxReturnData.id,
        },
        {
          headers: {
            Authorization: session?.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (confirmResponse.data.success) {
        toast.success('Payment completed successfully!');
        onPaymentSuccess(confirmResponse.data.data);
      } else {
        setPaymentError('Payment confirmation failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      setPaymentError('Payment confirmation failed. Please try again.');
    }
  };

  const confirmWithStripe = async () => {
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setPaymentError('');

    const returnUrlParams = new URLSearchParams();
    if (taxReturnData?.id) {
      returnUrlParams.set('taxReturnId', taxReturnData.id);
    }

    const returnUrl = `${window.location.origin}/tax-return-form/payment-complete${returnUrlParams.toString() ? `?${returnUrlParams.toString()}` : ''}`;

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          receipt_email: session?.user?.email,
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setPaymentError(stripeError.message);
        onPaymentError?.(stripeError);
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        await confirmPaymentOnBackend(paymentIntent.id);
      } else if (paymentIntent?.status === 'processing') {
        toast.success('Payment processing. You will be notified when it completes.');
      } else if (paymentIntent?.status === 'requires_action') {
        const authError = new Error('Additional authentication required. Please follow the prompts.');
        setPaymentError(authError.message);
        onPaymentError?.(authError);
      } else {
        const genericError = new Error('Payment could not be completed. Please try again.');
        setPaymentError(genericError.message);
        onPaymentError?.(genericError);
      }
    } catch (error) {
      console.error('Payment error:', error);
      if (error.response?.data?.message) {
        setPaymentError(error.response.data.message);
      } else {
        setPaymentError('Payment failed. Please try again.');
      }
      onPaymentError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    await confirmWithStripe();
  };

  const handleExpressConfirm = async () => {
    await confirmWithStripe();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="form-label">Express Checkout</label>
        <div className="express-checkout-container mb-3">
          <ExpressCheckoutElement onConfirm={handleExpressConfirm} />
        </div>
        <label className="form-label">Or pay with card</label>
        <div
          className="payment-element-container"
          style={{
            padding: '12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            backgroundColor: 'white'
          }}
        >
          <PaymentElement />
        </div>
      </div>
      {paymentError && (
        <div className="alert alert-danger mb-3">
          {paymentError}
        </div>
      )}

      <div className="d-flex justify-content-between">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loading || initializingPayment}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!stripe || loading || initializingPayment || !clientSecret}
        >
          {loading ? 'Processing...' : `Pay £${amount}`}
        </button>
      </div>
    </form>
  );
};

export default PaymentForm;
