import { redirect } from "next/navigation";

/**
 * Observed UAT misspelling /payments/success → canonical checkout-success.
 * Preserves session_id so webhook finalisation can still run.
 */
export default async function PaymentsPluralSuccess({ searchParams }) {
  const params = await searchParams;
  const sessionId = params?.session_id;
  const q = sessionId ? `?session_id=${encodeURIComponent(String(sessionId))}` : "";
  redirect(`/planlist/checkout-success${q}`);
}
