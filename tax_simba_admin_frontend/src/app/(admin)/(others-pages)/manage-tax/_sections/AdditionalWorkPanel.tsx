"use client";

/**
 * P0 K.8 — Admin/staff additional-work payment requests for a case (taxReturnId).
 * Calls compat aliases that map onto Node domain/additionalWork (no parallel payment system).
 */
import React, { useCallback, useEffect, useState } from "react";
import clientAxios from "@/lib/axios-client";
import { isAdminRole } from "@/lib/roles";
import { toast } from "react-toastify";

type AwRequest = {
  id: string;
  description?: string;
  amount?: number;
  paymentStatus?: string;
  requestStatus?: string;
  dueDate?: string | null;
  internalNote?: string | null;
  createdAt?: string;
  receiptNumber?: string | null;
};

type Props = {
  taxReturnId: string;
  userRole?: string | null;
};

export default function AdditionalWorkPanel({ taxReturnId, userRole }: Props) {
  const canManage = isAdminRole(userRole);
  const [rows, setRows] = useState<AwRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const load = useCallback(async () => {
    if (!taxReturnId) return;
    setLoading(true);
    try {
      const res = await clientAxios.get("/admin/payment-requests", {
        params: { case_id: taxReturnId, taxReturnId },
      });
      setRows(res.data?.data?.paymentRequests ?? []);
    } catch (err) {
      console.error("Failed to load payment requests", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [taxReturnId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendRequest = async () => {
    if (!description.trim() || !amount) {
      toast.error("Description and amount are required");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (
      !window.confirm(
        `Send a payment request of £${n.toFixed(2)} for: ${description.trim()}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await clientAxios.post("/admin/payment-requests", {
        taxReturnId,
        caseId: taxReturnId,
        description: description.trim(),
        amount: n,
        dueDate: dueDate || null,
        internalNote: internalNote || null,
      });
      toast.success("Payment request sent");
      setShowForm(false);
      setDescription("");
      setAmount("");
      setDueDate("");
      setInternalNote("");
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create payment request";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const resend = async (id: string) => {
    setBusy(true);
    try {
      await clientAxios.post(`/admin/payment-requests/${id}/resend`);
      toast.success("Reminder sent");
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to resend";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm("Cancel this unpaid payment request?")) return;
    setBusy(true);
    try {
      await clientAxios.post(`/admin/payment-requests/${id}/cancel`);
      toast.success("Cancelled");
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to cancel";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-5" data-testid="additional-work-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">Additional work payment requests</h3>
        {canManage && (
          <button
            type="button"
            data-testid="request-additional-payment-btn"
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#37a267] text-white hover:bg-[#2d8554] disabled:opacity-50"
            disabled={busy}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Close" : "Request additional payment"}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Charges outside the client package. Payment uses Stripe Checkout and never activates
        SA/MTD entitlement.
      </p>

      {showForm && canManage && (
        <div className="space-y-3 mb-5 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <textarea
            data-testid="addpay-description"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Description of additional work (shown to the client)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            data-testid="addpay-amount"
            type="number"
            min="0"
            step="0.01"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Amount (£)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            data-testid="addpay-due-date"
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <textarea
            data-testid="addpay-note"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Internal note (optional, not shown to the client)"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
          <button
            type="button"
            data-testid="addpay-send-btn"
            disabled={busy || !description.trim() || !amount}
            className="w-full px-4 py-2 rounded-lg bg-[#37a267] text-white text-sm font-semibold disabled:opacity-50"
            onClick={() => void sendRequest()}
          >
            Send payment request
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No additional-work payment requests for this case.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li
              key={p.id}
              data-testid={`addwork-${p.id}`}
              className="border border-gray-100 rounded-lg p-4 bg-white"
            >
              <div className="text-sm font-semibold text-gray-900">{p.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                £{Number(p.amount ?? 0).toFixed(2)} · {p.paymentStatus || p.requestStatus || "pending"}
                {p.dueDate ? ` · due ${p.dueDate}` : ""}
                {p.receiptNumber ? ` · receipt ${p.receiptNumber}` : ""}
              </div>
              {canManage && p.internalNote ? (
                <div className="text-xs text-amber-700 mt-1">Internal: {p.internalNote}</div>
              ) : null}
              {canManage && p.paymentStatus !== "paid" && p.paymentStatus !== "cancelled" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50"
                    disabled={busy}
                    onClick={() => void resend(p.id)}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
                    disabled={busy}
                    onClick={() => void cancel(p.id)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
