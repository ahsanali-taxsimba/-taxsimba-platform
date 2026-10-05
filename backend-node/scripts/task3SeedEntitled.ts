/**
 * Task 3 — seed an entitled SA client + document/review emails for local Mailpit proof.
 *
 * Secrets: uses ephemeral local-only credentials (override via env). Never commit real passwords.
 * Artifacts: writes JSON summary to TASK3_ARTIFACT_DIR (default /opt/cursor/artifacts/task3-local) — outside git.
 *
 * Usage (from backend-node, with Mongo + Mailpit + API SMTP env already configured):
 *   EMAIL_ALLOW_LOCAL_BASE_URL=true APP_BASE_URL=http://127.0.0.1:3000 \
 *     npx tsx scripts/task3SeedEntitled.ts
 */
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { MongoClient } from "mongodb";
import { config } from "dotenv";

config();

// Force local Mailpit SMTP for proof — do not leave EMAIL_DRIVER=none from .env.
process.env.EMAIL_ALLOW_LOCAL_BASE_URL = "true";
process.env.APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
process.env.ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "http://127.0.0.1:3001";
process.env.EMAIL_DRIVER = "smtp";
process.env.SMTP_HOST = process.env.SMTP_HOST || "127.0.0.1";
process.env.SMTP_PORT = process.env.SMTP_PORT || "1025";
process.env.SMTP_SECURE = process.env.SMTP_SECURE || "false";
process.env.EMAIL_FROM =
  process.env.EMAIL_FROM || "TaxSimba Local <no-reply@localhost.localdomain>";
// Clear any cached provider if this module was reloaded in the same process.
delete process.env.RENDER;
delete process.env.APP_ENV;

const ART = process.env.TASK3_ARTIFACT_DIR || "/opt/cursor/artifacts/task3-local";
const CASE_REF = process.env.TASK3_CASE_REF || `SA-TASK3-${randomUUID().slice(0, 6)}`;
const DOC_TITLE = process.env.TASK3_DOC_TITLE || "P60";

async function main() {
  mkdirSync(ART, { recursive: true });
  const { hashPassword } = await import("../src/services/auth.ts");
  const {
    queueEmail,
    setEmailProvider,
    clientDocumentUploadPath,
    clientReviewDocumentsPath,
  } = await import("../src/services/email.ts");

  const mongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
  const dbName = process.env.DB_NAME || "taxsimba_node";
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  const email =
    process.env.TASK3_PROOF_EMAIL ||
    `task3.entitled.${randomUUID().slice(0, 6)}@mailpit.local`;
  // Ephemeral local-only password for Mailpit proof accounts — not a production secret.
  const password = process.env.TASK3_PROOF_PASSWORD || "Task3Entitle!99";
  const userId = randomUUID();
  const clientId = randomUUID();
  const caseId = randomUUID();
  const now = new Date().toISOString();

  await db.collection("users").insertOne({
    id: userId,
    email,
    name: "Entitled Client",
    role: "CLIENT",
    password_hash: hashPassword(password),
    is_active: true,
    email_verified_at: now,
    created_at: now,
    is_engagement_letter_accepted: true,
    engagement_accepted_at: now,
  });
  await db.collection("clients").insertOne({
    id: clientId,
    user_id: userId,
    name: "Entitled Client",
    first_name: "Entitled",
    onboarding_intent: "SELF_ASSESSMENT",
    created_at: now,
    client_ref: "CL-TASK3",
  });
  await db.collection("client_services").insertOne({
    id: randomUUID(),
    client_id: clientId,
    user_id: userId,
    service_type: "SELF_ASSESSMENT",
    status: "ACTIVE",
    package_code: "SIMPLE",
    created_at: now,
  });
  await db.collection("engagement_acceptances").updateOne(
    { user_id: userId },
    {
      $set: {
        id: randomUUID(),
        user_id: userId,
        status: "ACCEPTED",
        agreement_version: process.env.ENGAGEMENT_AGREEMENT_VERSION || "client-care-v1",
        accepted_at: now,
        signature_hash: "local",
        signature: "local",
        service_types: ["SELF_ASSESSMENT"],
        case_ids: [caseId],
      },
    },
    { upsert: true },
  );
  await db.collection("cases").insertOne({
    id: caseId,
    case_ref: CASE_REF,
    client_id: clientId,
    client_user_id: userId,
    client_name: "Entitled Client",
    service_type: "SELF_ASSESSMENT",
    tax_year: "2024/25",
    status: "AWAITING_CLIENT",
    next_action: `Please upload your ${DOC_TITLE}`,
    next_action_owner: "CLIENT",
    is_test: false,
    created_at: now,
    last_updated: now,
  });
  const requestId = randomUUID();
  const taskId = randomUUID();
  await db.collection("tasks").insertOne({
    id: taskId,
    case_id: caseId,
    case_ref: CASE_REF,
    name: DOC_TITLE,
    description: `Please upload your ${DOC_TITLE}`,
    owner_role: "CLIENT",
    owner_id: userId,
    due_date: null,
    status: "OPEN",
    mandatory: true,
    created_by: userId,
    created_by_name: "System",
    created_at: now,
    completed_date: null,
    request_id: requestId,
  });
  await db.collection("document_requests").insertOne({
    id: requestId,
    case_id: caseId,
    client_user_id: userId,
    title: DOC_TITLE,
    description: `Please upload your ${DOC_TITLE}`,
    task_id: taskId,
    status: "Requested",
    requested_by: userId,
    requested_by_name: "System",
    due_date: null,
    created_at: now,
  });
  await db.collection("documents").insertOne({
    id: randomUUID(),
    case_id: caseId,
    client_user_id: userId,
    tax_year: "2024/25",
    document_type: DOC_TITLE,
    name: DOC_TITLE,
    status: "Requested",
    request_id: requestId,
    task_id: taskId,
    storage_path: null,
    uploader_id: null,
    uploader_name: null,
    content_type: null,
    size: 0,
    is_internal: false,
    is_deleted: false,
    created_at: now,
    upload_date: null,
  });

  setEmailProvider(null);
  const docEmailId = await queueEmail({
    to: email,
    recipientName: "Entitled",
    kind: "NOTIFICATION_DOCUMENT",
    subject: "Documents needed for your tax return",
    title: "We need a document from you",
    body: `Please upload your ${DOC_TITLE} for ${CASE_REF} through Tax Tracker.`,
    link: clientDocumentUploadPath(caseId),
    callToAction: "Upload document",
    dedupeKey: `task3-doc:${caseId}`,
    userId,
    caseId,
  });
  const reviewEmailId = await queueEmail({
    to: email,
    recipientName: "Entitled",
    kind: "NOTIFICATION_APPROVAL",
    subject: "Your tax return is ready to review",
    title: "Your tax calculation is ready",
    body: `Please review your figures for ${CASE_REF}.`,
    link: clientReviewDocumentsPath(caseId),
    callToAction: "Review my tax return",
    dedupeKey: `task3-review:${caseId}`,
    userId,
    caseId,
  });

  // Give SMTP a moment when the API process is not the sender (direct queueEmail).
  await new Promise((r) => setTimeout(r, 2500));

  const summary = {
    email,
    // Password is ephemeral local-only; written to artifact dir (gitignored path), not stdout by default.
    password,
    userId,
    clientId,
    caseId,
    caseRef: CASE_REF,
    docTitle: DOC_TITLE,
    docEmailId,
    reviewEmailId,
    docCtaPath: clientDocumentUploadPath(caseId),
    reviewCtaPath: clientReviewDocumentsPath(caseId),
  };
  writeFileSync(`${ART}/entitled_seed.json`, JSON.stringify(summary, null, 2));
  // Redacted console line for CI logs.
  console.log(
    JSON.stringify(
      {
        email,
        userId,
        clientId,
        caseId,
        caseRef: CASE_REF,
        docTitle: DOC_TITLE,
        docEmailId,
        reviewEmailId,
        docCtaPath: clientDocumentUploadPath(caseId),
        reviewCtaPath: clientReviewDocumentsPath(caseId),
        artifact: `${ART}/entitled_seed.json`,
      },
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
