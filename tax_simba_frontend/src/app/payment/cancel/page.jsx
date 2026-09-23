import { redirect } from "next/navigation";

/** Legacy Stripe cancel path → canonical checkout-cancel. */
export default function LegacyPaymentCancel() {
  redirect("/planlist/checkout-cancel");
}
