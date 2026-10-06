/**
 * Task 3 — ensure engagement acceptance exists for a seeded entitled client.
 * Reads identity from TASK3_ARTIFACT_DIR/entitled_seed.json. No hardcoded IDs.
 */
import { config } from "dotenv";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { MongoClient } from "mongodb";

config();

const ART = process.env.TASK3_ARTIFACT_DIR || "/opt/cursor/artifacts/task3-local";

async function main() {
  const seedPath = `${ART}/entitled_seed.json`;
  if (!existsSync(seedPath)) {
    throw new Error(`Missing ${seedPath} — run task3SeedEntitled.ts first`);
  }
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
    email: string;
    userId: string;
    clientId: string;
    caseId: string;
  };

  const client = new MongoClient(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db(process.env.DB_NAME || "taxsimba_node");
  const now = new Date().toISOString();
  await db.collection("engagement_acceptances").updateOne(
    { user_id: seed.userId },
    {
      $set: {
        id: randomUUID(),
        user_id: seed.userId,
        status: "ACCEPTED",
        agreement_version: process.env.ENGAGEMENT_AGREEMENT_VERSION || "client-care-v1",
        accepted_at: now,
        signature_hash: "local",
        signature: "local",
        service_types: ["SELF_ASSESSMENT"],
        case_ids: [seed.caseId],
      },
    },
    { upsert: true },
  );
  const svc = await db.collection("client_services").find({ client_id: seed.clientId }).toArray();
  console.log(
    JSON.stringify(
      { email: seed.email, services: svc.length, status: svc[0]?.status, caseId: seed.caseId },
      null,
      2,
    ),
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
