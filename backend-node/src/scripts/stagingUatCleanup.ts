/**
 * Removes everything the staging UAT seed created (accounts on @uat-taxsimba.test and all
 * records belonging to them). Leaves every other record untouched.
 *
 * Usage (from backend-node):
 *   MONGO_URL=... DB_NAME=taxsimba_staging STAGING_UAT_SEED=yes node dist/scripts/stagingUatCleanup.js
 */
import { config } from "dotenv";

import { close, col, connect, Doc } from "../db/mongo";

const DOMAIN = "@uat-taxsimba.test";

/** Collections keyed by a case id, cleared for every UAT case. */
const BY_CASE = [
  "activity_logs",
  "assignments",
  "calculation_versions",
  "case_notes",
  "documents",
  "document_requests",
  "internal_notes",
  "invoices",
  "messages",
  "mtd_onboarding",
  "mtd_periods",
  "notifications",
  "payment_transactions",
  "recommendations",
  "service_issues",
  "tasks",
];

/** Collections keyed by a user id. */
const BY_USER = ["notifications", "offers", "contact_access_log", "mfa_challenges"];

async function main(): Promise<void> {
  config();
  if (process.env.STAGING_UAT_SEED !== "yes") {
    throw new Error("Refusing to run: set STAGING_UAT_SEED=yes to confirm this is staging/UAT");
  }
  await connect();

  const users = (await col("users")
    .find({ email: { $regex: `${DOMAIN}$` } })
    .toArray()) as Doc[];
  const userIds = users.map((u) => String(u.id));
  const clients = (await col("clients").find({ user_id: { $in: userIds } }).toArray()) as Doc[];
  const clientIds = clients.map((c) => String(c.id));
  const cases = (await col("cases")
    .find({ $or: [{ client_user_id: { $in: userIds } }, { client_id: { $in: clientIds } }] })
    .toArray()) as Doc[];
  const caseIds = cases.map((c) => String(c.id));

  for (const name of BY_CASE) await col(name).deleteMany({ case_id: { $in: caseIds } });
  for (const name of BY_USER) await col(name).deleteMany({ user_id: { $in: userIds } });
  await col("client_services").deleteMany({ client_id: { $in: clientIds } });
  await col("accountant_profiles").deleteMany({ user_id: { $in: userIds } });
  await col("cases").deleteMany({ id: { $in: caseIds } });
  await col("clients").deleteMany({ id: { $in: clientIds } });
  await col("users").deleteMany({ id: { $in: userIds } });

  // eslint-disable-next-line no-console
  console.log(`Removed ${users.length} UAT users, ${clients.length} clients, ${caseIds.length} cases`);
  await close();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await close().catch(() => undefined);
  process.exit(1);
});
