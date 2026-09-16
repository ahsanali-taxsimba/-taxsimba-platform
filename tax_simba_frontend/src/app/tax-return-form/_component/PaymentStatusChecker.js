// components/PaymentStatusChecker.js
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

const PaymentStatusChecker = ({ taxReturnId, onStatusUpdate }) => {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  const checkPaymentStatus = async () => {
    if (!taxReturnId || !session?.accessToken) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}client/status/${taxReturnId}`,
        {
          headers: {
            Authorization: session.accessToken,
          },
        }
      );

      if (response.data.success) {
        setPaymentStatus(response.data.data);
        if (onStatusUpdate) {
          onStatusUpdate(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPaymentStatus();
  }, [taxReturnId, session?.accessToken]);

  if (!paymentStatus) {
    return loading ? <div>Checking payment status...</div> : null;
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending_payment': { class: 'bg-warning text-dark', text: 'To be assigned' },
      'payment_completed': { class: 'bg-success', text: 'Payment Completed' },
      'payment_failed': { class: 'bg-danger', text: 'Payment Failed' },
      'processing': { class: 'bg-info', text: 'Processing' },
      'completed': { class: 'bg-success', text: 'Completed' }
    };

    const statusInfo = statusMap[status] || { class: 'bg-secondary', text: status };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  return (
    <div className="payment-status-card card">
      <div className="card-header border-0 d-flex justify-content-between align-items-center py-3">
        <h5 className="mb-0">Payment Status</h5>
        <button
          className="common-btn"
          onClick={checkPaymentStatus}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>
      <div className="card-body">
        <div className="row mb-2">
          <div className="col-sm-6"><strong>Tax Return ID:</strong></div>
          <div className="col-sm-6 text-end">{paymentStatus.taxReturn.taxReturnId}</div>
        </div>
        <div className="row mb-2">
          <div className="col-sm-6"><strong>Status:</strong></div>
          <div className="col-sm-6 text-end">{getStatusBadge(paymentStatus.taxReturn.status)}</div>
        </div>
        <div className="row mb-2">
          <div className="col-sm-6"><strong>Total Fee:</strong></div>
          <div className="col-sm-6 text-end">£{paymentStatus.taxReturn.totalFee}</div>
        </div>
        <div className="row mb-2">
          <div className="col-sm-6"><strong>Paid Amount:</strong></div>
          <div className="col-sm-6 text-end">£{paymentStatus.taxReturn.paidAmount || '0.00'}</div>
        </div>
        <div className="row mb-2">
          <div className="col-sm-6"><strong>Payment Status:</strong></div>
          <div className="col-sm-6 text-end">{getStatusBadge(paymentStatus.taxReturn.paymentStatus)}</div>
        </div>

        {paymentStatus.payment && (
          <>
            <hr />
            <h6>Payment Details</h6>
            <div className="row mb-2">
              <div className="col-sm-6"><strong>Payment Date:</strong></div>
              <div className="col-sm-6">
                {paymentStatus.payment.paymentDate ?
                  new Date(paymentStatus.payment.paymentDate).toLocaleDateString() :
                  'N/A'
                }
              </div>
            </div>
            <div className="row mb-2">
              <div className="col-sm-6"><strong>Payment Method:</strong></div>
              <div className="col-sm-6 text-capitalize">{paymentStatus.payment.paymentMethod}</div>
            </div>
          </>
        )}

        {paymentStatus.requiresPayment && (
          <div className="alert alert-warning mt-3">
            <i className="fa fa-exclamation-triangle me-2"></i>
            Payment is required to complete your tax return submission.
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatusChecker;