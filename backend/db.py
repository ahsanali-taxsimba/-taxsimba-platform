import os
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def clean(doc):
    if not doc:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


def clean_many(docs):
    return [clean(d) for d in docs]


# Fields an accountant must never receive about a client (contact / auth / payment data).
PROTECTED_CLIENT_FIELDS = ["client_email", "client_phone", "client_user_id", "email", "phone",
                           "utr", "address", "password_hash", "payment_method", "card",
                           "stripe_customer_id", "stripe_payment_intent_id", "session_id"]


def scrub(doc, user):
    """Strip protected client contact/auth/payment data from accountant-facing payloads."""
    if not doc or user["role"] != "ACCOUNTANT":
        return doc
    for f in PROTECTED_CLIENT_FIELDS:
        doc.pop(f, None)
    return doc


def scrub_many(docs, user):
    return [scrub(x, user) for x in docs]


def mask_email(v):
    if not v or "@" not in v:
        return v
    name, dom = v.split("@", 1)
    return f"{name[0]}***@{dom}"


def mask_phone(v):
    if not v or len(v) < 4:
        return v
    return f"{v[:2]}*** ***{v[-3:]}"


def mask_contact(doc, user):
    """Standard Admin sees masked client contact details; Super Admin sees full."""
    if not doc or user["role"] != "ADMIN":
        return doc
    if doc.get("role") and doc.get("role") != "CLIENT":
        return doc
    if "email" in doc:
        doc["email"] = mask_email(doc["email"])
        doc["contact_masked"] = True
    if "phone" in doc:
        doc["phone"] = mask_phone(doc["phone"])
    return doc


def mask_contact_many(docs, user):
    return [mask_contact(x, user) for x in docs]
