import { redirect } from "next/navigation";

/**
 * Legacy Stripe success path → canonical checkout-success.
 * Preserves session_id query param.
 */
export default async function LegacyPaymentSuccess({ searchParams }) {
  const params = await searchParams;
  const sessionId = params?.session_id;
  const q = sessionId ? `?session_id=${encodeURIComponent(String(sessionId))}` : "";
  redirect(`/planlist/checkout-success${q}`);
}
