/**
 * Task 3 — queue document/review/purchase emails for an already-seeded entitled client.
 *
 * Reads identity from TASK3_ARTIFACT_DIR/entitled_seed.json (produced by task3SeedEntitled.ts)
 * or from TASK3_* env vars. No hardcoded credentials.
 *
 * Usage:
 *   EMAIL_ALLOW_LOCAL_BASE_URL=true npx tsx scripts/task3QueueDocEmails.ts
 */
import { readFileSync, existsSync } from "fs";
import { config } from "dotenv";

config();

process.env.EMAIL_ALLOW_LOCAL_BASE_URL ??= "true";
process.env.APP_BASE_URL ??= "http://127.0.0.1:3000";
process.env.ADMIN_BASE_URL ??= "http://127.0.0.1:3001";
process.env.EMAIL_DRIVER ??= "smtp";
process.env.SMTP_HOST ??= "127.0.0.1";
process.env.SMTP_PORT ??= "1025";
process.env.SMTP_SECURE ??= "false";
process.env.EMAIL_FROM ??= "TaxSimba Local <no-reply@localhost.localdomain>";

const ART = process.env.TASK3_ARTIFACT_DIR || "/opt/cursor/artifacts/task3-local";

function loadSeed(): {
  email: string;
  userId: string;
  caseId: string;
  caseRef?: string;
  docTitle?: string;
} {
  const seedPath = `${ART}/entitled_seed.json`;
  if (existsSync(seedPath)) {
    return JSON.parse(readFileSync(seedPath, "utf8"));
  }
  const email = process.env.TASK3_PROOF_EMAIL;
  const userId = process.env.TASK3_PROOF_USER_ID;
  const caseId = process.env.TASK3_PROOF_CASE_ID;
  if (!email || !userId || !caseId) {
    throw new Error(
      `Missing seed: run task3SeedEntitled.ts first, or set TASK3_PROOF_EMAIL / TASK3_PROOF_USER_ID / TASK3_PROOF_CASE_ID`,
    );
  }
  return {
    email,
    userId,
    caseId,
    caseRef: process.env.TASK3_CASE_REF || "SA-TASK3",
    docTitle: process.env.TASK3_DOC_TITLE || "P60",
  };
}

async function main() {
  const seed = loadSeed();
  const caseRef = seed.caseRef || "SA-TASK3";
  const docTitle = seed.docTitle || "P60";
  const { connect } = await import("../src/db/mongo.ts");
  await connect();
  const {
    queueEmail,
    setEmailProvider,
    clientDocumentUploadPath,
    clientReviewDocumentsPath,
  } = await import("../src/services/email.ts");
  setEmailProvider(null);

  const stamp = Date.now();
  const doc = await queueEmail({
    to: seed.email,
    recipientName: "Entitled",
    kind: "NOTIFICATION_DOCUMENT",
    subject: "Documents needed for your tax return",
    title: "We need a document from you",
    body: `Please upload your ${docTitle} for ${caseRef} through Tax Tracker.`,
    link: clientDocumentUploadPath(seed.caseId),
    callToAction: "Upload document",
    dedupeKey: `task3-doc:${seed.caseId}:${stamp}`,
    userId: seed.userId,
    caseId: seed.caseId,
  });
  const rev = await queueEmail({
    to: seed.email,
    recipientName: "Entitled",
    kind: "NOTIFICATION_APPROVAL",
    subject: "Your tax return is ready to review",
    title: "Your tax calculation is ready",
    body: `Please review your figures for ${caseRef}.`,
    link: clientReviewDocumentsPath(seed.caseId),
    callToAction: "Review my tax return",
    dedupeKey: `task3-review:${seed.caseId}:${stamp}`,
    userId: seed.userId,
    caseId: seed.caseId,
  });
  const sa = await queueEmail({
    to: seed.email,
    recipientName: "Entitled",
    kind: "PURCHASE_CONFIRMATION",
    subject: "Welcome to TaxSimba",
    title: "Your Self Assessment package is ready",
    body: "Thanks for purchasing.",
    link: "/dashboard",
    callToAction: "Open my dashboard",
    dedupeKey: `task3-purchase:${seed.caseId}:${stamp}`,
    userId: seed.userId,
    caseId: seed.caseId,
  });
  const mtd = await queueEmail({
    to: seed.email,
    recipientName: "Entitled",
    kind: "PURCHASE_CONFIRMATION",
    subject: "Welcome to TaxSimba MTD",
    title: "Your MTD package is ready",
    body: "Thanks for purchasing MTD.",
    link: "/mtd-dashboard",
    callToAction: "Open my MTD dashboard",
    dedupeKey: `task3-purchase-mtd:${seed.caseId}:${stamp}`,
    userId: seed.userId,
    caseId: seed.caseId,
  });
  const admin = await queueEmail({
    to: "admin.review@mailpit.local",
    recipientName: "Admin",
    kind: "NOTIFICATION_REVIEW",
    subject: "Draft ready for Admin review",
    title: "Draft ready for Admin review",
    body: `Draft submitted for ${caseRef}.`,
    link: `/admin/manage-tax/${seed.caseId}`,
    callToAction: "Review tax return",
    dedupeKey: `task3-admin-review:${seed.caseId}:${stamp}`,
    caseId: seed.caseId,
  });

  console.log(JSON.stringify({ doc, rev, sa, mtd, admin, caseId: seed.caseId, caseRef }, null, 2));
  await new Promise((r) => setTimeout(r, 4000));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
