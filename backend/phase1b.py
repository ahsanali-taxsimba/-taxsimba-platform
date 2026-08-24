"""Phase 1B — multi-service client accounts, package upgrades, MTD recommendations, payments.

Extends the existing Phase 1 architecture; nothing here replaces Self Assessment workflow.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user, require_roles
from db import clean, clean_many, db, scrub, scrub_many
from workflow import STATUS_META, log_activity, notify, now_iso

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

router = APIRouter(prefix="/api")

TAX_CODE = "txcd_20060000"  # professional services
SELF_ASSESSMENT = "SELF_ASSESSMENT"
MTD = "MTD_INCOME_TAX"
SERVICE_LABELS = {SELF_ASSESSMENT: "Self Assessment", MTD: "MTD for Income Tax"}

DEFAULT_PACKAGES = [
    {"service_type": SELF_ASSESSMENT, "code": "SIMPLE", "name": "Simple", "price": 119.0,
     "rank": 1, "billing_frequency": "Per tax year"},
    {"service_type": SELF_ASSESSMENT, "code": "SMART", "name": "Smart", "price": 149.0,
     "rank": 2, "billing_frequency": "Per tax year"},
    {"service_type": SELF_ASSESSMENT, "code": "ELITE", "name": "Elite", "price": 249.0,
     "rank": 3, "billing_frequency": "Per tax year"},
    {"service_type": MTD, "code": "MTD_ESSENTIAL", "name": "MTD Essential", "price": 240.0,
     "rank": 1, "billing_frequency": "Quarterly billing"},
    {"service_type": MTD, "code": "MTD_PLUS", "name": "MTD Plus", "price": 360.0,
     "rank": 2, "billing_frequency": "Quarterly billing"},
]

# Configurable late-stage lock: client-initiated package changes are disabled from these statuses.
DEFAULT_LOCK_STATUSES = ["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW", "ADMIN_APPROVED",
                         "AWAITING_CLIENT_APPROVAL", "CLIENT_APPROVED",
                         "READY_FOR_SUBMISSION", "SUBMISSION_IN_PROGRESS",
                         "SUBMITTED", "SUBMISSION_ISSUE", "COMPLETED"]


async def bootstrap_client_services(client: dict, tax_year: str = "2024/25"):
    """Every client gets a Self Assessment service plus a dormant MTD placeholder."""
    if not await db.client_services.find_one({"client_id": client["id"],
                                              "service_type": SELF_ASSESSMENT}):
        await db.client_services.insert_one({
            "id": str(uuid.uuid4()), "client_id": client["id"], "client_user_id": client["user_id"],
            "service_type": SELF_ASSESSMENT, "status": "ACTIVE", "package_code": "SMART",
            "tax_year": tax_year, "activated_at": now_iso(), "package_history": [],
            "created_at": now_iso(),
        })
    if not await db.client_services.find_one({"client_id": client["id"], "service_type": MTD}):
        await db.client_services.insert_one({
            "id": str(uuid.uuid4()), "client_id": client["id"], "client_user_id": client["user_id"],
            "service_type": MTD, "status": "NOT_ACTIVE", "package_code": None, "tax_year": None,
            "activated_at": None, "package_history": [], "created_at": now_iso(),
        })


# ------------------------------------------------------------------ bootstrap
async def ensure_phase1b_data():
    for p in DEFAULT_PACKAGES:
        await db.packages.update_one(
            {"service_type": p["service_type"], "code": p["code"]},
            {"$setOnInsert": {**p, "id": str(uuid.uuid4()), "is_active": True,
                              "created_at": now_iso()}},
            upsert=True,
        )
    await db.settings.update_one(
        {"key": "package_change_lock"},
        {"$setOnInsert": {"key": "package_change_lock", "locked_statuses": DEFAULT_LOCK_STATUSES}},
        upsert=True,
    )
    # Give every existing client a Self Assessment service record (one client, many services).
    async for c in db.clients.find({}):
        case = await db.cases.find_one({"client_id": c["id"], "service_type": SELF_ASSESSMENT})
        await bootstrap_client_services(c, case["tax_year"] if case else "2024/25")
    if not await db.clients.find_one({"client_ref": {"$exists": True}}):
        n = 42
        async for c in db.clients.find({}).sort("created_at", 1):
            if not c.get("client_ref"):
                await db.clients.update_one({"id": c["id"]}, {"$set": {"client_ref": f"CL-{n:04d}"}})
                n += 1
    try:
        s = stripe.tax.Settings.retrieve()
        if not (s.head_office and getattr(s.head_office, "address", None)):
            stripe.tax.Settings.modify(
                head_office={"address": {"country": "GB", "line1": "1 Tax Street",
                                         "city": "London", "postal_code": "EC1A 1BB"}},
                defaults={"tax_behavior": "exclusive", "tax_code": TAX_CODE},
            )
    except Exception as e:
        print(f"stripe tax settings skipped: {e}")


# ------------------------------------------------------------------ helpers
async def _client_of(user: dict) -> dict:
    c = await db.clients.find_one({"user_id": user["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Client record not found")
    return clean(c)


async def _package(service_type: str, code: str) -> dict:
    p = await db.packages.find_one({"service_type": service_type, "code": code, "is_active": True})
    if not p:
        raise HTTPException(status_code=404, detail="Package not found")
    return clean(p)


async def _lock_statuses():
    s = await db.settings.find_one({"key": "package_change_lock"})
    return (s or {}).get("locked_statuses", DEFAULT_LOCK_STATUSES)


async def _sa_case(client_id: str):
    return await db.cases.find_one({"client_id": client_id, "service_type": SELF_ASSESSMENT},
                                   sort=[("created_at", -1)])


async def _lock_state(client_id: str):
    case = await _sa_case(client_id)
    if not case:
        return False, None, None
    locked = case["status"] in await _lock_statuses()
    return locked, case["status"], case["id"]


# ------------------------------------------------------------------ packages
class PackageIn(BaseModel):
    service_type: str
    code: str
    name: str
    price: float
    rank: int
    billing_frequency: str = "Per tax year"


class PriceIn(BaseModel):
    price: float


@router.get("/packages")
async def list_packages(service_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"is_active": True}
    if service_type:
        q["service_type"] = service_type
    return clean_many(await db.packages.find(q).sort("rank", 1).to_list(100))


@router.post("/packages")
async def create_package(body: PackageIn, user: dict = Depends(require_roles("SUPER_ADMIN"))):
    if await db.packages.find_one({"service_type": body.service_type, "code": body.code}):
        raise HTTPException(status_code=400, detail="Package code already exists for this service")
    doc = {**body.dict(), "id": str(uuid.uuid4()), "is_active": True, "created_at": now_iso()}
    await db.packages.insert_one(dict(doc))
    return clean(doc)


@router.patch("/packages/{package_id}/price")
async def update_price(package_id: str, body: PriceIn,
                       user: dict = Depends(require_roles("SUPER_ADMIN"))):
    p = await db.packages.find_one({"id": package_id})
    if not p:
        raise HTTPException(status_code=404, detail="Package not found")
    await db.packages.update_one({"id": package_id}, {"$set": {"price": body.price}})
    await db.pricing_audit.insert_one({
        "id": str(uuid.uuid4()), "package_id": package_id, "code": p["code"],
        "previous_price": p["price"], "new_price": body.price,
        "changed_by": user["name"], "role": user["role"], "created_at": now_iso(),
    })
    return {"ok": True}


@router.get("/settings/package-lock")
async def get_lock(user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    s = await db.settings.find_one({"key": "package_change_lock"})
    return {"locked_statuses": (s or {}).get("locked_statuses", DEFAULT_LOCK_STATUSES)}


class LockIn(BaseModel):
    locked_statuses: list


@router.patch("/settings/package-lock")
async def set_lock(body: LockIn, user: dict = Depends(require_roles("SUPER_ADMIN"))):
    await db.settings.update_one({"key": "package_change_lock"},
                                {"$set": {"locked_statuses": body.locked_statuses}}, upsert=True)
    return {"ok": True}


# ------------------------------------------------------------------ my services
def _service_view(s: dict, pkg: Optional[dict]):
    return {
        "id": s["id"], "service_type": s["service_type"],
        "service_name": SERVICE_LABELS.get(s["service_type"], s["service_type"]),
        "status": s["status"], "package_code": s.get("package_code"),
        "package_name": pkg["name"] if pkg else None,
        "package_price": pkg["price"] if pkg else None,
        "tax_year": s.get("tax_year"), "activated_at": s.get("activated_at"),
        "package_history": s.get("package_history", []),
    }


async def _services_for(client: dict):
    out = []
    async for s in db.client_services.find({"client_id": client["id"]}):
        pkg = None
        if s.get("package_code"):
            pkg = await db.packages.find_one({"service_type": s["service_type"], "code": s["package_code"]})
        cases = await db.cases.find({"client_id": client["id"], "service_type": s["service_type"]}).to_list(100)
        view = _service_view(s, clean(pkg) if pkg else None)
        view["cases"] = [{"id": c["id"], "case_ref": c["case_ref"], "tax_year": c["tax_year"],
                          "status": c["status"], "current_stage": c["current_stage"]} for c in cases]
        out.append(view)
    order = {SELF_ASSESSMENT: 0, MTD: 1}
    return sorted(out, key=lambda x: order.get(x["service_type"], 9))


@router.get("/my-services")
async def my_services(user: dict = Depends(require_roles("CLIENT"))):
    client = await _client_of(user)
    return {"client_ref": client.get("client_ref"), "services": await _services_for(client)}


@router.get("/clients/{client_user_id}/services")
async def client_services(client_user_id: str,
                          user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    client = await db.clients.find_one({"user_id": client_user_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client = clean(client)
    return {"client_ref": client.get("client_ref"), "client_name": client["name"],
            "services": await _services_for(client)}


@router.get("/my-upgrade-options")
async def my_upgrade_options(user: dict = Depends(require_roles("CLIENT"))):
    client = await _client_of(user)
    svc = await db.client_services.find_one({"client_id": client["id"], "service_type": SELF_ASSESSMENT})
    if not svc:
        raise HTTPException(status_code=404, detail="No Self Assessment service")
    current = await db.packages.find_one({"service_type": SELF_ASSESSMENT, "code": svc.get("package_code")})
    locked, case_status, _ = await _lock_state(client["id"])
    options = []
    if current:
        async for p in db.packages.find({"service_type": SELF_ASSESSMENT, "is_active": True,
                                         "rank": {"$gt": current["rank"]}}).sort("rank", 1):
            options.append({
                "code": p["code"], "name": p["name"], "upgrade_price": p["price"],
                "current_package_credit": current["price"],
                "additional_amount_payable": round(max(p["price"] - current["price"], 0.0), 2),
                "total_due_now": round(max(p["price"] - current["price"], 0.0), 2),
            })
    return {
        "current_package": {"code": current["code"], "name": current["name"], "price": current["price"]} if current else None,
        "is_highest": bool(current) and not options,
        "locked": locked, "lock_reason": f"Your return has reached {case_status}" if locked else None,
        "options": options,
    }


# ------------------------------------------------------------------ payments
class UpgradeCheckoutIn(BaseModel):
    package_code: str
    origin_url: str


class OfferCheckoutIn(BaseModel):
    offer_id: str
    origin_url: str


def _checkout(amount: float, label: str, origin_url: str, metadata: dict):
    session = stripe.checkout.Session.create(
        line_items=[{
            "price_data": {
                "currency": "gbp",
                "unit_amount": int(round(amount * 100)),
                "tax_behavior": "exclusive",
                "product_data": {"name": label, "tax_code": TAX_CODE},
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin_url}/payment/cancel",
        automatic_tax={"enabled": True},
        billing_address_collection="required",
        metadata=metadata,
    )
    return session


async def _inflight(query: dict):
    """One payable checkout at a time per business key — reuse the open session instead of
    creating a second payable one."""
    rec = await db.payment_transactions.find_one({**query, "payment_status": "pending",
                                                  "status": "initiated"})
    if not rec:
        return None
    try:
        s = stripe.checkout.Session.retrieve(rec["session_id"])
    except Exception:
        return None
    if s.status == "open" and s.url:
        return {"checkout_url": s.url, "session_id": rec["session_id"],
                "amount": rec["amount"], "reused": True}
    await db.payment_transactions.update_one(
        {"session_id": rec["session_id"]},
        {"$set": {"status": s.status or "expired",
                  "payment_status": s.payment_status or "expired",
                  "updated_at": now_iso()}})
    return None


@router.post("/payments/upgrade-checkout")
async def upgrade_checkout(body: UpgradeCheckoutIn, user: dict = Depends(require_roles("CLIENT"))):
    client = await _client_of(user)
    svc = await db.client_services.find_one({"client_id": client["id"], "service_type": SELF_ASSESSMENT})
    if not svc or svc["status"] != "ACTIVE":
        raise HTTPException(status_code=400, detail="No active Self Assessment service")
    current = await _package(SELF_ASSESSMENT, svc["package_code"])
    target = await _package(SELF_ASSESSMENT, body.package_code)
    if target["rank"] <= current["rank"]:
        raise HTTPException(status_code=400,
                            detail="Downgrades are not permitted once a package is active")
    locked, case_status, _ = await _lock_state(client["id"])
    if locked:
        raise HTTPException(status_code=400,
                            detail=f"Package changes are locked at this stage ({case_status})")
    amount = round(max(target["price"] - current["price"], 0.0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="No additional amount payable")
    reuse = await _inflight({"client_id": client["id"], "kind": "SA_UPGRADE",
                             "new_package": target["code"]})
    if reuse:
        return reuse
    session = _checkout(amount, f"Self Assessment upgrade — {current['name']} to {target['name']}",
                        body.origin_url,
                        {"kind": "SA_UPGRADE", "client_id": client["id"], "user_id": user["id"],
                         "from_package": current["code"], "to_package": target["code"]})
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "user_id": user["id"],
        "client_id": client["id"], "kind": "SA_UPGRADE", "service_type": SELF_ASSESSMENT,
        "previous_package": current["code"], "new_package": target["code"],
        "amount": float(amount), "currency": "gbp", "status": "initiated",
        "payment_status": "pending", "fulfilled": False,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id, "amount": amount}


@router.post("/payments/offer-checkout")
async def offer_checkout(body: OfferCheckoutIn, user: dict = Depends(require_roles("CLIENT"))):
    offer = await db.offers.find_one({"id": body.offer_id, "client_user_id": user["id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Offer is no longer available")
    reuse = await _inflight({"offer_id": offer["id"], "kind": "SERVICE_ACTIVATION"})
    if reuse:
        return reuse
    label = f"{SERVICE_LABELS.get(offer['service_type'], offer['service_type'])} — {offer['package_name']}"
    session = _checkout(offer["amount_due"], label, body.origin_url,
                        {"kind": "SERVICE_ACTIVATION", "offer_id": offer["id"],
                         "client_id": offer["client_id"], "user_id": user["id"],
                         "service_type": offer["service_type"], "to_package": offer["package_code"]})
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "user_id": user["id"],
        "client_id": offer["client_id"], "kind": "SERVICE_ACTIVATION",
        "service_type": offer["service_type"], "offer_id": offer["id"],
        "previous_package": None, "new_package": offer["package_code"],
        "amount": float(offer["amount_due"]), "currency": "gbp", "status": "initiated",
        "payment_status": "pending", "fulfilled": False,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id, "amount": offer["amount_due"]}


async def _notify_admins(title: str, bodytext: str, case_id: Optional[str] = None,
                         link: str = "/admin/recommendations", ntype: str = "INFO"):
    async for admin in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}}):
        await notify(admin["id"], title, bodytext, case_id, link, ntype)


async def _fulfil(tx: dict):
    """Idempotent post-payment business logic."""
    if tx.get("fulfilled"):
        return
    client = await db.clients.find_one({"id": tx["client_id"]})
    user = await db.users.find_one({"id": tx["user_id"]})
    actor = {"id": user["id"], "name": user["name"], "role": "CLIENT"} if user else None

    if tx["kind"] == "ADDITIONAL_WORK":
        claimed = await db.payment_transactions.update_one(
            {"id": tx["id"], "fulfilled": {"$ne": True}},
            {"$set": {"fulfilled": True, "paid_at": now_iso(), "updated_at": now_iso()}})
        if not claimed.modified_count:
            return  # already confirmed -- never notify or audit the same payment twice
        case = await db.cases.find_one({"id": tx.get("case_id")})
        await log_activity(tx.get("case_id"),
                           f"Additional work payment received — £{tx['amount']:.2f} "
                           f"(ref {tx.get('stripe_payment_intent_id') or tx['session_id']})",
                           actor, {"payment_request_id": tx["id"], "amount": tx["amount"]})
        for uid in {(case or {}).get("assigned_accountant_id")} | {
                u["id"] async for u in db.users.find({"role": {"$in": ["ADMIN", "SUPER_ADMIN"]}},
                                                     {"id": 1})}:
            if uid:
                await notify(uid, "Additional work payment received",
                             f"{(case or {}).get('client_name', 'Client')} paid "
                             f"£{tx['amount']:.2f} for {tx.get('description', 'additional work')}",
                             tx.get("case_id"),
                             f"/work/cases/{tx.get('case_id')}", "PAYMENT")
        return

    if tx["kind"] == "SA_UPGRADE":
        svc = await db.client_services.find_one({"client_id": tx["client_id"],
                                                 "service_type": SELF_ASSESSMENT})
        if svc and svc.get("package_code") == tx["new_package"]:
            # Business-key idempotency: this upgrade has already been applied.
            await db.payment_transactions.update_one({"session_id": tx["session_id"]},
                                                     {"$set": {"fulfilled": True,
                                                               "duplicate": True,
                                                               "updated_at": now_iso()}})
            return
        case = await _sa_case(tx["client_id"])
        await db.client_services.update_one(
            {"id": svc["id"]},
            {"$set": {"package_code": tx["new_package"], "updated_at": now_iso()},
             "$push": {"package_history": {
                 "previous_package": tx["previous_package"], "new_package": tx["new_package"],
                 "changed_at": now_iso(), "changed_by": user["name"] if user else "Client",
                 "reason": "Client upgrade", "payment_session": tx["session_id"],
                 "amount_paid": tx["amount"]}}},
        )
        if case:
            await log_activity(case["id"],
                              f"Package upgraded {tx['previous_package']} → {tx['new_package']} (£{tx['amount']:.2f} paid)",
                              actor, {"amount": tx["amount"]},
                              comments=f"Payment session {tx['session_id']}")
        await _notify_admins("Self Assessment package upgraded",
                             f"{client['name']} upgraded {tx['previous_package']} → {tx['new_package']}",
                             case["id"] if case else None, "/admin/recommendations", "UPGRADE")

    elif tx["kind"] == "SERVICE_ACTIVATION":
        if tx.get("offer_id"):
            offer_now = await db.offers.find_one({"id": tx["offer_id"]})
            if offer_now and offer_now.get("status") == "PAID":
                await db.payment_transactions.update_one({"session_id": tx["session_id"]},
                                                         {"$set": {"fulfilled": True,
                                                                   "duplicate": True,
                                                                   "updated_at": now_iso()}})
                return
        already = await db.client_services.find_one({"client_id": tx["client_id"],
                                                     "service_type": tx["service_type"],
                                                     "status": "ACTIVE"})
        if already and already.get("package_code") == tx["new_package"]:
            await db.payment_transactions.update_one({"session_id": tx["session_id"]},
                                                     {"$set": {"fulfilled": True,
                                                               "duplicate": True,
                                                               "updated_at": now_iso()}})
            return
        pkg = await db.packages.find_one({"service_type": tx["service_type"], "code": tx["new_package"]})
        tax_year = "2026/27"
        existing = await db.client_services.find_one({"client_id": tx["client_id"],
                                                      "service_type": tx["service_type"]})
        history_entry = {"previous_package": existing.get("package_code") if existing else None,
                         "new_package": tx["new_package"], "changed_at": now_iso(),
                         "changed_by": user["name"] if user else "Client",
                         "reason": "Service activation", "payment_session": tx["session_id"],
                         "amount_paid": tx["amount"]}
        if existing:
            await db.client_services.update_one(
                {"id": existing["id"]},
                {"$set": {"status": "ACTIVE", "package_code": tx["new_package"],
                          "tax_year": tax_year, "activated_at": now_iso()},
                 "$push": {"package_history": history_entry}})
        else:
            await db.client_services.insert_one({
                "id": str(uuid.uuid4()), "client_id": tx["client_id"],
                "client_user_id": tx["user_id"], "service_type": tx["service_type"],
                "status": "ACTIVE", "package_code": tx["new_package"], "tax_year": tax_year,
                "activated_at": now_iso(), "package_history": [history_entry],
                "created_at": now_iso()})
        stage, next_action, owner = STATUS_META["AWAITING_ASSIGNMENT"]
        seq = await db.cases.count_documents({"service_type": tx["service_type"]}) + 1
        while await db.cases.find_one({"case_ref": f"MTD-{2000 + seq}"}):
            seq += 1
        case = {
            "id": str(uuid.uuid4()), "case_ref": f"MTD-{2000 + seq}",
            "is_test": bool(client.get("is_test")),
            "client_id": tx["client_id"], "client_user_id": tx["user_id"],
            "client_name": client["name"], "service_type": tx["service_type"],
            "tax_year": tax_year, "assigned_accountant_id": None,
            "assigned_accountant_name": None, "admin_reviewer_id": None,
            "admin_reviewer_name": None, "status": "AWAITING_ASSIGNMENT",
            "current_stage": stage, "next_action": next_action, "next_action_owner": owner,
            "priority": "MEDIUM", "internal_deadline": None, "external_deadline": None,
            "internal_instructions": None, "waiting_reason": None, "approved_version_id": None,
            "package_code": tx["new_package"],
            "created_at": now_iso(), "last_updated": now_iso(),
        }
        await db.cases.insert_one(dict(case))
        await log_activity(case["id"],
                           f"{SERVICE_LABELS.get(tx['service_type'], tx['service_type'])} activated "
                           f"({pkg['name'] if pkg else tx['new_package']}, £{tx['amount']:.2f} paid)",
                           actor, new_status="AWAITING_ASSIGNMENT")
        if tx.get("offer_id"):
            await db.offers.update_one({"id": tx["offer_id"]},
                                       {"$set": {"status": "PAID", "paid_at": now_iso()}})
            offer = await db.offers.find_one({"id": tx["offer_id"]})
            if offer and offer.get("recommendation_id"):
                await db.recommendations.update_one({"id": offer["recommendation_id"]},
                                                    {"$set": {"status": "ACTIVATED"}})
        await _notify_admins("New MTD service activated — assign an accountant",
                             f"{client['name']} — {case['case_ref']}", case["id"],
                             f"/admin/cases/{case['id']}", "ASSIGNMENT")

    await db.payment_transactions.update_one({"session_id": tx["session_id"]},
                                            {"$set": {"fulfilled": True, "updated_at": now_iso()}})


@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_payment_intent_id": s.payment_intent,
                              "updated_at": now_iso()}})
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except Exception:
            pass
    if record.get("payment_status") == "paid" and not record.get("fulfilled"):
        await _fulfil(record)
        record = await db.payment_transactions.find_one({"session_id": session_id})
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"]}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "stripe_payment_intent_id": obj.get("payment_intent"),
                      "updated_at": now_iso()}})
        tx = await db.payment_transactions.find_one({"session_id": obj["id"]})
        if tx and tx.get("payment_status") == "paid":
            await _fulfil(tx)
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": now_iso()}})
    return {"status": "ok"}


@router.get("/my-payments")
async def my_payments(user: dict = Depends(require_roles("CLIENT"))):
    rows = await db.payment_transactions.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    # A checkout that was never completed must not sit as "Pending" forever. Anything still
    # unresolved after 24 hours is reported as cancelled; confirmed payments are untouched.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    out = []
    for r in rows:
        r = clean(r)
        if r.get("kind") != "ADDITIONAL_WORK" \
                and r.get("payment_status") in ("pending", "open", "unpaid") \
                and not r.get("fulfilled") and (r.get("created_at") or "") < cutoff:
            r["payment_status"] = "cancelled"
        out.append({k: v for k, v in r.items()
                    if k in ("id", "kind", "service_type", "previous_package", "new_package",
                             "amount", "currency", "payment_status", "created_at",
                             "description", "case_ref")})
    return out


# ---------------------------------------------------- additional work payment requests
class AdditionalWorkIn(BaseModel):
    case_id: str
    description: str
    amount: float
    due_date: Optional[str] = None
    internal_note: Optional[str] = None


@router.post("/payment-requests")
async def create_payment_request(body: AdditionalWorkIn,
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Admin-raised charge for work outside the client's package. Reuses the existing Stripe
    checkout, transaction record, notification and audit infrastructure."""
    case = await db.cases.find_one({"id": body.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="A description of the additional work is required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    tx = {
        "id": str(uuid.uuid4()), "session_id": None, "kind": "ADDITIONAL_WORK",
        "user_id": case["client_user_id"], "client_id": case["client_id"],
        "case_id": case["id"], "case_ref": case["case_ref"],
        "service_type": case["service_type"], "tax_year": case.get("tax_year"),
        "description": body.description.strip(), "internal_note": body.internal_note,
        "due_date": body.due_date, "amount": round(float(body.amount), 2), "currency": "gbp",
        "status": "sent", "payment_status": "pending", "fulfilled": False,
        "created_by": user["id"], "created_by_name": user["name"], "created_by_role": user["role"],
        "sent_at": now_iso(), "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.payment_transactions.insert_one(dict(tx))
    await log_activity(case["id"], f"Additional work payment request sent — £{tx['amount']:.2f}",
                       user, {"payment_request_id": tx["id"], "amount": tx["amount"],
                              "description": tx["description"], "due_date": body.due_date})
    await notify(case["client_user_id"], "Additional work payment required",
                 f"{tx['description']} — £{tx['amount']:.2f}", case["id"], "/subscription",
                 "PAYMENT")
    return clean(tx)


@router.get("/payment-requests")
async def list_payment_requests(case_id: Optional[str] = None,
                                user: dict = Depends(get_current_user)):
    """Admin/accountant see requests for a case; a client only ever sees their own."""
    query = {"kind": "ADDITIONAL_WORK"}
    if user["role"] == "CLIENT":
        query["user_id"] = user["id"]
    elif user["role"] == "ACCOUNTANT":
        if not case_id:
            raise HTTPException(status_code=400, detail="case_id required")
        case = await db.cases.find_one({"id": case_id})
        if not case or case.get("assigned_accountant_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Case not assigned to you")
    if case_id:
        query["case_id"] = case_id
    rows = await db.payment_transactions.find(query).sort("created_at", -1).to_list(100)
    return [{k: v for k, v in clean(r).items() if k != "internal_note"
             or user["role"] in ("ADMIN", "SUPER_ADMIN")} for r in rows]


@router.post("/payment-requests/{request_id}/cancel")
async def cancel_payment_request(request_id: str, body: Optional[dict] = None,
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    req = await db.payment_transactions.find_one({"id": request_id, "kind": "ADDITIONAL_WORK"})
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if req.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="A paid request cannot be cancelled or edited")
    await db.payment_transactions.update_one(
        {"id": request_id}, {"$set": {"status": "cancelled", "payment_status": "cancelled",
                                      "cancelled_by_name": user["name"],
                                      "cancelled_at": now_iso(), "updated_at": now_iso()}})
    await log_activity(req.get("case_id"),
                       f"Additional work payment request cancelled — £{req['amount']:.2f}", user,
                       {"payment_request_id": request_id})
    return {"ok": True}


@router.post("/payment-requests/{request_id}/resend")
async def resend_payment_request(request_id: str,
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    req = await db.payment_transactions.find_one({"id": request_id, "kind": "ADDITIONAL_WORK"})
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if req.get("payment_status") in ("paid", "cancelled"):
        raise HTTPException(status_code=400, detail="This request is no longer outstanding")
    await db.payment_transactions.update_one({"id": request_id},
                                             {"$set": {"sent_at": now_iso(),
                                                       "updated_at": now_iso()}})
    await notify(req["user_id"], "Reminder: additional work payment required",
                 f"{req['description']} — £{req['amount']:.2f}", req.get("case_id"),
                 "/subscription", "PAYMENT")
    await log_activity(req.get("case_id"), "Additional work payment request resent", user,
                       {"payment_request_id": request_id})
    return {"ok": True}


class PayRequestIn(BaseModel):
    origin_url: str


@router.post("/payment-requests/{request_id}/checkout")
async def payment_request_checkout(request_id: str, body: PayRequestIn,
                                   user: dict = Depends(require_roles("CLIENT"))):
    req = await db.payment_transactions.find_one({"id": request_id, "kind": "ADDITIONAL_WORK",
                                                  "user_id": user["id"]})
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if req.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="This request has already been paid")
    if req.get("payment_status") == "cancelled":
        raise HTTPException(status_code=400, detail="This request has been cancelled")
    if req.get("session_id"):
        # Repeated clicks reuse the open session instead of creating a second payable one.
        try:
            s = stripe.checkout.Session.retrieve(req["session_id"])
            if s.status == "open" and s.url:
                return {"checkout_url": s.url, "session_id": req["session_id"],
                        "amount": req["amount"], "reused": True}
        except Exception:
            pass
    session = _checkout(req["amount"], f"Additional work — {req['description'][:80]}",
                        body.origin_url,
                        {"kind": "ADDITIONAL_WORK", "client_id": req["client_id"],
                         "user_id": user["id"], "request_id": request_id})
    await db.payment_transactions.update_one({"id": request_id},
                                             {"$set": {"session_id": session.id,
                                                       "status": "initiated",
                                                       "updated_at": now_iso()}})
    return {"checkout_url": session.url, "session_id": session.id, "amount": req["amount"]}


@router.get("/payments")
async def all_payments(status: Optional[str] = None, kind: Optional[str] = None,
                       include_test: bool = False,
                       user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    query = {}
    if status:
        # Existing statuses only -- Successful maps to the stored "paid".
        query["payment_status"] = {"successful": "paid"}.get(status, status)
    if kind:
        query["kind"] = kind
    rows = await db.payment_transactions.find(query).sort("created_at", -1).to_list(500)
    out = []
    for r in clean_many(rows):
        c = await db.clients.find_one({"id": r.get("client_id")})
        if not include_test and (c is None or c.get("is_test")):
            # Automated-test transactions (including ones whose test client was already
            # cleaned away) stay in the database but out of the normal list.
            continue
        r["client_name"] = c["name"] if c else None
        r["client_ref"] = c.get("client_ref") if c else None
        out.append(r)
    return out


# ------------------------------------------------------------------ recommendations
class RecommendIn(BaseModel):
    recommended_package: Optional[str] = None
    reason: str
    note: Optional[str] = None


async def _accountant_case(case_id: str, user: dict):
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "ACCOUNTANT" and case.get("assigned_accountant_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Case not assigned to you")
    return clean(case)


async def _create_recommendation(case: dict, user: dict, rtype: str, body: RecommendIn):
    existing = await db.recommendations.find_one({
        "case_id": case["id"], "type": rtype, "status": {"$in": ["PENDING", "APPROVED"]}})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"{'A package upgrade' if rtype == 'PACKAGE_UPGRADE' else 'An MTD'} "
                   f"recommendation is already {existing['status'].lower()} on this case",
        )
    if rtype == "PACKAGE_UPGRADE":
        svc = await db.client_services.find_one({"client_id": case["client_id"],
                                                 "service_type": SELF_ASSESSMENT})
        current = await db.packages.find_one({"service_type": SELF_ASSESSMENT,
                                              "code": (svc or {}).get("package_code")})
        target = await _package(SELF_ASSESSMENT, body.recommended_package)
        if current and target["rank"] <= current["rank"]:
            raise HTTPException(status_code=400, detail="Only higher packages can be recommended")
    rec = {
        "id": str(uuid.uuid4()), "type": rtype, "case_id": case["id"],
        "case_ref": case["case_ref"], "client_id": case["client_id"],
        "client_user_id": case["client_user_id"], "client_name": case["client_name"],
        "service_type": SELF_ASSESSMENT if rtype == "PACKAGE_UPGRADE" else MTD,
        "recommended_package": body.recommended_package,
        "reason": body.reason, "note": body.note,
        "raised_by_id": user["id"], "raised_by_name": user["name"], "raised_by_role": user["role"],
        "status": "PENDING", "created_at": now_iso(),
    }
    await db.recommendations.insert_one(dict(rec))
    if body.note:
        await db.internal_notes.insert_one({
            "id": str(uuid.uuid4()), "case_id": case["id"],
            "body": f"{'Package upgrade' if rtype == 'PACKAGE_UPGRADE' else 'MTD'} recommendation: {body.note}",
            "author_id": user["id"], "author_name": user["name"], "author_role": user["role"],
            "created_at": now_iso(),
        })
    label = ("Package upgrade recommended: " + (body.recommended_package or "")
             if rtype == "PACKAGE_UPGRADE" else "MTD service recommended")
    await log_activity(case["id"], label, user, comments=body.reason)
    await _notify_admins(
        "Package upgrade recommended" if rtype == "PACKAGE_UPGRADE" else "MTD recommended",
        f"{case['client_name']} — raised by {user['name']}: {body.reason}",
        case["id"], "/admin/recommendations", "RECOMMENDATION")
    return clean(rec)


@router.post("/cases/{case_id}/recommend-package")
async def recommend_package(case_id: str, body: RecommendIn,
                            user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    if not body.recommended_package:
        raise HTTPException(status_code=400, detail="recommended_package is required")
    case = await _accountant_case(case_id, user)
    return scrub(await _create_recommendation(case, user, "PACKAGE_UPGRADE", body), user)


@router.post("/cases/{case_id}/recommend-mtd")
async def recommend_mtd(case_id: str, body: RecommendIn,
                        user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    case = await _accountant_case(case_id, user)
    return scrub(await _create_recommendation(case, user, "MTD", body), user)


@router.get("/cases/{case_id}/recommendations")
async def case_recommendations(case_id: str,
                               user: dict = Depends(require_roles("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"))):
    await _accountant_case(case_id, user)
    recs = await db.recommendations.find({"case_id": case_id}).sort("created_at", -1).to_list(100)
    return scrub_many(clean_many(recs), user)


@router.get("/recommendations")
async def list_recommendations(status: Optional[str] = None,
                               user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    q = {"status": status} if status else {}
    return clean_many(await db.recommendations.find(q).sort("created_at", -1).to_list(300))


class OfferIn(BaseModel):
    package_code: str
    price: Optional[float] = None
    credit: float = 0.0
    message: Optional[str] = None
    explanation: Optional[str] = None


async def _approve_and_offer(rec: dict, body: OfferIn, user: dict):
    pkg = await _package(rec["service_type"], body.package_code)
    price = body.price if body.price is not None else pkg["price"]
    amount_due = round(max(price - body.credit, 0.0), 2)
    offer = {
        "id": str(uuid.uuid4()), "recommendation_id": rec["id"], "client_id": rec["client_id"],
        "client_user_id": rec["client_user_id"], "client_name": rec["client_name"],
        "service_type": rec["service_type"], "service_name": SERVICE_LABELS.get(rec["service_type"]),
        "package_code": pkg["code"], "package_name": pkg["name"],
        "billing_frequency": pkg["billing_frequency"], "price": price, "credit": body.credit,
        "amount_due": amount_due, "message": body.message,
        "explanation": body.explanation or rec.get("reason"), "status": "PENDING",
        "created_by": user["id"], "created_by_name": user["name"], "created_at": now_iso(),
    }
    await db.offers.insert_one(dict(offer))
    await db.recommendations.update_one({"id": rec["id"]}, {"$set": {
        "status": "APPROVED", "reviewed_by": user["name"], "reviewed_at": now_iso(),
        "offer_id": offer["id"]}})
    await log_activity(rec["case_id"],
                       f"Recommendation approved and released to client: {pkg['name']} (£{amount_due:.2f} due)",
                       user, comments=body.explanation or body.message)
    await notify(rec["client_user_id"], "Additional service recommended",
                 "Your accountant has recommended a service for you to review.",
                 rec["case_id"], f"/recommendation/{offer['id']}", "RECOMMENDATION")
    return clean(offer)


@router.post("/recommendations/{rec_id}/approve")
async def approve_recommendation(rec_id: str, body: OfferIn,
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Recommendation has already been reviewed")
    return await _approve_and_offer(rec, body, user)


@router.post("/recommendations/{rec_id}/reject")
async def reject_recommendation(rec_id: str, body: Optional[RecommendIn] = None,
                                user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Rejected recommendations stay internal — the client is never told."""
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    await db.recommendations.update_one({"id": rec_id}, {"$set": {
        "status": "REJECTED", "reviewed_by": user["name"], "reviewed_at": now_iso(),
        "review_reason": body.reason if body else None}})
    await log_activity(rec["case_id"], "Recommendation rejected by admin (internal only)", user,
                       comments=body.reason if body else None)
    return {"ok": True}


@router.post("/recommendations/{rec_id}/send-offer")
async def send_offer(rec_id: str, body: OfferIn,
                     user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    """Alias of /approve kept for compatibility — approving is what releases the offer."""
    return await approve_recommendation(rec_id, body, user)


@router.get("/my-offers/{offer_id}")
async def my_offer(offer_id: str, user: dict = Depends(require_roles("CLIENT"))):
    offer = await db.offers.find_one({"id": offer_id, "client_user_id": user["id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return clean(offer)


@router.post("/recommendations/{rec_id}/decline")
async def decline_recommendation(rec_id: str, body: Optional[RecommendIn] = None,
                                 user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    await db.recommendations.update_one({"id": rec_id}, {"$set": {
        "status": "DECLINED", "reviewed_by": user["name"], "reviewed_at": now_iso(),
        "review_reason": body.reason if body else None}})
    await log_activity(rec["case_id"], "Recommendation declined by admin", user,
                       comments=body.reason if body else None)
    return {"ok": True}


@router.get("/my-offers")
async def my_offers(user: dict = Depends(require_roles("CLIENT"))):
    rows = await db.offers.find({"client_user_id": user["id"], "status": "PENDING"}).sort("created_at", -1).to_list(50)
    # One live recommendation per service — later approvals supersede earlier ones.
    seen, latest = set(), []
    for r in clean_many(rows):
        if r["service_type"] in seen:
            continue
        seen.add(r["service_type"])
        latest.append(r)
    return latest


# ------------------------------------------------------------------ admin override
class OverrideIn(BaseModel):
    service_type: str = SELF_ASSESSMENT
    package_code: str
    reason: str


@router.post("/clients/{client_user_id}/override-package")
async def override_package(client_user_id: str, body: OverrideIn,
                           user: dict = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    client = await db.clients.find_one({"user_id": client_user_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not body.reason or not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required for an override")
    svc = await db.client_services.find_one({"client_id": client["id"], "service_type": body.service_type})
    if not svc:
        raise HTTPException(status_code=404, detail="Client does not hold this service")
    pkg = await _package(body.service_type, body.package_code)
    previous = svc.get("package_code")
    entry = {"previous_package": previous, "new_package": pkg["code"], "changed_at": now_iso(),
             "changed_by": user["name"], "changed_by_role": user["role"],
             "reason": body.reason, "override": True}
    await db.client_services.update_one({"id": svc["id"]},
                                       {"$set": {"package_code": pkg["code"], "updated_at": now_iso()},
                                        "$push": {"package_history": entry}})
    case = await _sa_case(client["id"]) if body.service_type == SELF_ASSESSMENT else None
    if case:
        await log_activity(case["id"],
                           f"Admin override: package {previous} → {pkg['code']}", user,
                           {"override": True}, comments=body.reason)
    await db.override_audit.insert_one({"id": str(uuid.uuid4()), "client_id": client["id"],
                                        "client_user_id": client_user_id, **entry,
                                        "service_type": body.service_type})
    return {"ok": True, "package_code": pkg["code"]}
