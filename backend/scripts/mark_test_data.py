"""Flag historical automated-test cases so they leave the operational accountant/admin views.

Nothing is deleted: cases, tasks, documents, notifications and audit history all stay. Only an
`is_test` marker is added to the client and case records created by automated suites, which the
operational queries then exclude.

Run:  python -m scripts.mark_test_data      (from /app/backend)
"""
import asyncio
import sys

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

from db import db  # noqa: E402
from testdata import is_test_email  # noqa: E402


async def main():
    test_user_ids, genuine_user_ids = [], []
    async for u in db.users.find({"role": "CLIENT"}, {"id": 1, "email": 1}):
        (test_user_ids if is_test_email(u.get("email")) else genuine_user_ids).append(u["id"])

    flagged = await db.cases.update_many({"client_user_id": {"$in": test_user_ids}},
                                         {"$set": {"is_test": True}})
    cleared = await db.cases.update_many({"client_user_id": {"$in": genuine_user_ids}},
                                         {"$set": {"is_test": False}})
    await db.clients.update_many({"user_id": {"$in": test_user_ids}}, {"$set": {"is_test": True}})
    await db.clients.update_many({"user_id": {"$in": genuine_user_ids}},
                                 {"$set": {"is_test": False}})

    print({"test_clients": len(test_user_ids), "genuine_clients": len(genuine_user_ids),
           "cases_flagged_test": flagged.modified_count,
           "cases_marked_operational": cleared.modified_count,
           "operational_cases": await db.cases.count_documents({"is_test": {"$ne": True}})})


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
