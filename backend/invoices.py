"""Paid receipts for additional-work payments.

One receipt per confirmed payment. The receipt is created only from a backend-confirmed
payment, is never edited afterwards, and reuses the amounts already recorded on the
transaction -- no separate tax logic is applied here.
"""
import uuid
from datetime import datetime, timezone

from db import db

BUSINESS = {
    "name": "TaxSimba",
    "website": "taxsimba.co.uk",
    "email": "support@taxsimba.co.uk",
    "vat_note": "Amounts are shown as charged at checkout by our payment provider.",
}


async def _next_number() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"id": f"invoice_{year}"}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
    return f"INV-{year}-{(counter or {}).get('value', 1):04d}"


async def create_receipt(tx: dict) -> dict | None:
    """Idempotent: returns None when a receipt already exists for this payment request."""
    existing = await db.invoices.find_one({"payment_request_id": tx["id"]})
    if existing:
        return None
    receipt = {
        "id": str(uuid.uuid4()), "number": await _next_number(),
        "payment_request_id": tx["id"], "client_id": tx.get("client_id"),
        "client_user_id": tx.get("user_id"), "case_id": tx.get("case_id"),
        "case_ref": tx.get("case_ref"), "description": tx.get("description"),
        "amount": tx.get("amount"), "currency": tx.get("currency", "gbp"),
        "payment_date": tx.get("paid_at"),
        "provider_reference": tx.get("stripe_payment_intent_id") or tx.get("session_id"),
        "status": "PAID", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(dict(receipt))
    return receipt


def render_html(receipt: dict, client_name: str) -> str:
    rows = [
        ("Receipt number", receipt["number"]),
        ("Status", receipt["status"]),
        ("Client", client_name),
        ("Case reference", receipt.get("case_ref") or "—"),
        ("Description", receipt.get("description") or "—"),
        ("Amount paid", f"£{float(receipt['amount']):.2f}"),
        ("Payment date", (receipt.get("payment_date") or "")[:19].replace("T", " ")),
        ("Payment reference", receipt.get("provider_reference") or "—"),
    ]
    body = "".join(
        f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in rows)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>{receipt['number']} — {BUSINESS['name']} receipt</title>
<style>body{{font-family:system-ui,sans-serif;color:#161B18;margin:40px;max-width:640px}}
h1{{color:#006B3C;font-size:22px}}table{{width:100%;border-collapse:collapse;margin-top:24px}}
th,td{{text-align:left;padding:10px 0;border-bottom:1px solid #E3E7E4;font-size:14px}}
th{{width:200px;color:#626A65;font-weight:500}}p{{font-size:12px;color:#626A65}}
@media print{{body{{margin:0}}}}</style></head><body>
<h1>{BUSINESS['name']} — payment receipt</h1>
<p>{BUSINESS['website']} · {BUSINESS['email']}</p>
<table>{body}</table>
<p>{BUSINESS['vat_note']}</p>
<p>This receipt confirms a payment for additional work agreed outside your package.</p>
</body></html>"""
