"use client";

/**
 * P0 K.8 — Client additional-work payment panel + billing list adapter.
 */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Spinner, Button } from "react-bootstrap";
import { toast } from "react-toastify";

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL || "";

export default function AdditionalWorkClientPanel() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [requests, setRequests] = useState([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl()}client/payment-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data?.data?.paymentRequests || []);
    } catch (err) {
      console.error("Failed to load payment requests", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pay = async (id) => {
    setBusyId(id);
    try {
      const res = await axios.post(
        `${apiUrl()}client/payment-requests/${id}/checkout`,
        { originUrl: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const url = res.data?.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error("Checkout URL missing");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Unable to start checkout. Verify your email if prompted.";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-3">
        <Spinner animation="border" size="sm" variant="success" />
      </div>
    );
  }

  const pending = requests.filter(
    (p) => p.paymentStatus !== "paid" && p.paymentStatus !== "cancelled",
  );
  if (!pending.length && !requests.length) return null;

  return (
    <div className="edt_profile_box mb-4" data-testid="additional-work-panel">
      <div className="edt_prof_head">
        <h3>Additional work payments</h3>
      </div>
      <p className="text-muted small mb-3">
        Additional work identified outside your package. Pay securely via Stripe Checkout.
        This does not change your SA or MTD subscription.
      </p>
      <ul className="list-unstyled mb-0">
        {requests.map((p) => (
          <li
            key={p.id}
            data-testid={`addwork-${p.id}`}
            className="border rounded p-3 mb-3 bg-white"
          >
            <div className="fw-semibold">{p.description}</div>
            <div className="small text-muted mt-1">
              £{Number(p.amount || 0).toFixed(2)} · {p.paymentStatus || "pending"}
              {p.dueDate ? ` · due ${p.dueDate}` : ""}
              {p.caseRef ? ` · ${p.caseRef}` : ""}
            </div>
            <div className="mt-2 d-flex gap-2 flex-wrap align-items-center">
              {p.paymentStatus === "paid" ? (
                <span className="badge bg-success" data-testid={`addwork-paid-${p.id}`}>
                  Paid{p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                </span>
              ) : p.paymentStatus === "cancelled" ? (
                <span className="badge bg-secondary">Cancelled</span>
              ) : (
                <Button
                  data-testid={`addwork-pay-${p.id}`}
                  size="sm"
                  style={{ backgroundColor: "#14ab71", borderColor: "#14ab71" }}
                  disabled={busyId === p.id}
                  onClick={() => void pay(p.id)}
                >
                  {busyId === p.id ? "Starting…" : "Pay securely"}
                </Button>
              )}
              {p.paymentStatus === "paid" && (
                <button
                  type="button"
                  data-testid={`addwork-receipt-${p.id}`}
                  className="btn btn-sm btn-outline-secondary"
                  onClick={async () => {
                    try {
                      const res = await axios.get(
                        `${apiUrl()}client/payment-requests/${p.id}/receipt`,
                        {
                          headers: { Authorization: `Bearer ${token}` },
                          responseType: "blob",
                        },
                      );
                      const url = window.URL.createObjectURL(
                        new Blob([res.data], { type: "text/html" }),
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      toast.error("Unable to open receipt");
                    }
                  }}
                >
                  View receipt
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
