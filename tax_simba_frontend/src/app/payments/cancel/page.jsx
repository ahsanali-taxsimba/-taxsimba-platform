import { redirect } from "next/navigation";

/** /payments/cancel → canonical checkout-cancel (never 404). */
export default function PaymentsPluralCancel() {
  redirect("/planlist/checkout-cancel");
}
