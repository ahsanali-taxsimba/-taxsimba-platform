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
