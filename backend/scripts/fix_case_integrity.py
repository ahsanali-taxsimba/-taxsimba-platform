"""Repair case identity: one case reference = one client = one tax year.

Legacy/demo cases accumulated duplicate references because references used to be derived from
the case count, so a deleted case re-issued its number. This script:

  1. re-issues a fresh unique reference to the later duplicate(s) of any reference, keeping the
     earliest-created case on the original reference,
  2. re-syncs the denormalised client_name on every case from the client's current record,
  3. seeds the case_ref counter above the highest reference ever issued,
  4. adds a unique index on case_ref once the data supports it,
and records each repair in the activity timeline.

Run:  python -m scripts.fix_case_integrity      (from /app/backend)
"""
import asyncio
import sys
import uuid

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

from db import db  # noqa: E402
from workflow import now_iso  # noqa: E402


async def _highest_ref() -> int:
    highest = 1000
    async for c in db.cases.find({"case_ref": {"$regex": r"^SA-\d+$"}}, {"case_ref": 1}):
        try:
            highest = max(highest, int(c["case_ref"].split("-")[1]))
        except (IndexError, ValueError):
            continue
    return highest


async def main():
    seq = await _highest_ref()
    taken = {c["case_ref"] async for c in db.cases.find({}, {"case_ref": 1})}

    groups = await db.cases.aggregate([
        {"$group": {"_id": "$case_ref", "ids": {"$push": "$id"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
    ]).to_list(None)

    reissued = 0
    for g in groups:
        rows = await db.cases.find({"case_ref": g["_id"]}).sort("created_at", 1).to_list(None)
        for case in rows[1:]:
            seq += 1
            while f"SA-{seq}" in taken:
                seq += 1
            new_ref = f"SA-{seq}"
            taken.add(new_ref)
            await db.cases.update_one({"id": case["id"]},
                                      {"$set": {"case_ref": new_ref, "last_updated": now_iso()}})
            await db.tasks.update_many({"case_id": case["id"]}, {"$set": {"case_ref": new_ref}})
            await db.activity_logs.insert_one({
                "id": str(uuid.uuid4()), "case_id": case["id"],
                "action": f"Case reference corrected from {g['_id']} to {new_ref} "
                          "(duplicate reference repair)",
                "user_id": None, "user_name": "System", "role": "SYSTEM",
                "meta": {"previous_case_ref": g["_id"], "case_ref": new_ref},
                "created_at": now_iso(),
            })
            reissued += 1

    renamed = 0
    async for u in db.users.find({"role": "CLIENT"}, {"id": 1, "name": 1}):
        res = await db.cases.update_many(
            {"client_user_id": u["id"], "client_name": {"$ne": u["name"]}},
            {"$set": {"client_name": u["name"]}})
        renamed += res.modified_count

    await db.counters.update_one({"id": "case_ref"},
                                 {"$set": {"value": await _highest_ref()}}, upsert=True)

    try:
        await db.cases.create_index("case_ref", unique=True)
        index = "unique index created"
    except Exception as e:  # duplicates would block it
        index = f"unique index not created: {e}"

    dupes = await db.cases.aggregate([
        {"$group": {"_id": "$case_ref", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}}, {"$count": "dups"},
    ]).to_list(1)

    print({"references_reissued": reissued, "client_names_resynced": renamed,
           "duplicate_refs_remaining": (dupes[0]["dups"] if dupes else 0), "index": index})


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
