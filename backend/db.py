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
