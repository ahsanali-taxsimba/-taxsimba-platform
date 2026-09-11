'use client';
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
} from '@stripe/react-stripe-js';
import axios from 'axios';

import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import PaymentForm from './PaymentForm';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);


const PaymentModal = ({ 
  isOpen, 
  onClose, 
  taxReturnData, 
  amount, 
  onPaymentSuccess 
}) => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);

  useEffect(() => {
    if (!isOpen || !taxReturnData?.id || !session?.accessToken) {
      return;
    }

    let isMounted = true;

    const createPaymentIntent = async () => {
      try {
        setInitializingPayment(true);
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}client/create-payment-intent`,
          {
            taxReturnId: taxReturnData.id,
            amount,
            savePaymentMethod
          },
          {
            headers: {
              Authorization: session.accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (isMounted) {
          setClientSecret(response?.data?.data?.clientSecret || null);
        }
      } catch (error) {
        console.error('Failed to initialize payment intent', error);
        toast.error('Unable to start payment. Please try again.');
        if (isMounted) {
          setClientSecret(null);
        }
      } finally {
        if (isMounted) {
          setInitializingPayment(false);
        }
      }
    };

    createPaymentIntent();

    return () => {
      isMounted = false;
      setClientSecret(null);
    };
  }, [amount, isOpen, savePaymentMethod, session?.accessToken, taxReturnData?.id]);

  if (!isOpen) return null;

  const handlePaymentSuccess = (paymentData) => {
    onPaymentSuccess(paymentData);
    onClose();
  };

  const handlePaymentError = (error) => {
    console.error('Payment failed:', error);
    toast.error('Payment failed. Please try again.');
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Complete Payment</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>
          
          <div className="modal-body">
            <div className="payment-summary mb-4">
              <h6>Payment Summary</h6>
              <div className="d-flex justify-content-between mb-2">
                <span>Tax Return Type:</span>
                <span>{taxReturnData.typeName}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Tax Return ID:</span>
                <span>{taxReturnData.taxReturnId}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between fw-bold">
                <span>Total Amount:</span>
                <span>£{amount}</span>
              </div>
            </div>

            {clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret }}
                key={clientSecret}
              >
                <PaymentForm
                  taxReturnData={taxReturnData}
                  amount={amount}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                  onClose={onClose}
                  loading={loading}
                  setLoading={setLoading}
                  savePaymentMethod={savePaymentMethod}
                  onSavePaymentMethodChange={setSavePaymentMethod}
                  initializingPayment={initializingPayment}
                  clientSecret={clientSecret}
                />
              </Elements>
            ) : (
              <div className="text-center py-4">
                {initializingPayment ? 'Preparing payment options...' : 'Unable to load payment form.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
