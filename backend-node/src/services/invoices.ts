/**
 * Paid receipts for additional-work payments.
 *
 * One receipt per confirmed payment. The receipt is created only from a backend-confirmed
 * payment, is never edited afterwards, and reuses the amounts already recorded on the
 * transaction -- no separate tax logic is applied here.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";

const BUSINESS = {
  name: "TaxSimba",
  website: "taxsimba.co.uk",
  email: "support@taxsimba.co.uk",
  vat_note: "Amounts are shown as charged at checkout by our payment provider.",
};

async function nextNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const counter = await col("counters").findOneAndUpdate(
    { id: `invoice_${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const value = (counter as Doc | null)?.value ?? 1;
  return `INV-${year}-${String(value).padStart(4, "0")}`;
}

/** Idempotent: returns null when a receipt already exists for this payment request. */
export async function createReceipt(tx: Doc): Promise<Doc | null> {
  if (await col("invoices").findOne({ payment_request_id: tx.id })) return null;
  const receipt: Doc = {
    id: randomUUID(),
    number: await nextNumber(),
    payment_request_id: tx.id,
    client_id: tx.client_id ?? null,
    client_user_id: tx.user_id ?? null,
    case_id: tx.case_id ?? null,
    case_ref: tx.case_ref ?? null,
    description: tx.description ?? null,
    amount: tx.amount ?? null,
    currency: tx.currency ?? "gbp",
    payment_date: tx.paid_at ?? null,
    provider_reference: tx.stripe_payment_intent_id ?? tx.session_id ?? null,
    status: "PAID",
    created_at: new Date().toISOString(),
  };
  await col("invoices").insertOne({ ...receipt });
  return receipt;
}

export function renderHtml(receipt: Doc, clientName: string): string {
  const rows: [string, string][] = [
    ["Receipt number", receipt.number],
    ["Status", receipt.status],
    ["Client", clientName],
    ["Case reference", receipt.case_ref || "—"],
    ["Description", receipt.description || "—"],
    ["Amount paid", `£${Number(receipt.amount).toFixed(2)}`],
    ["Payment date", String(receipt.payment_date ?? "").slice(0, 19).replace("T", " ")],
    ["Payment reference", receipt.provider_reference || "—"],
  ];
  const body = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${receipt.number} — ${BUSINESS.name} receipt</title>
<style>body{font-family:system-ui,sans-serif;color:#161B18;margin:40px;max-width:640px}
h1{color:#006B3C;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}
th,td{text-align:left;padding:10px 0;border-bottom:1px solid #E3E7E4;font-size:14px}
th{width:200px;color:#626A65;font-weight:500}p{font-size:12px;color:#626A65}
@media print{body{margin:0}}</style></head><body>
<h1>${BUSINESS.name} — payment receipt</h1>
<p>${BUSINESS.website} · ${BUSINESS.email}</p>
<table>${body}</table>
<p>${BUSINESS.vat_note}</p>
<p>This receipt confirms a payment for additional work agreed outside your package.</p>
</body></html>`;
}
