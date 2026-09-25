/**
 * Local E2E proof: accountant draft upload → Admin review → client visibility.
 * Boots the real Express app against an isolated test DB (same harness as integration tests).
 */
import { createHash } from "crypto";
import request from "supertest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../tests/helpers/app";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");

async function main() {
  const steps: string[] = [];
  const log = (s: string) => {
    steps.push(s);
    console.log(s);
  };

  const { app } = await bootTestApp();
  const { ensurePhase1bData } = await import("../src/domain/packages");
  await ensurePhase1bData();

  const admin = await makeUser("ADMIN", "e2e-draft-admin");
  const superAdmin = await makeUser("SUPER_ADMIN", "e2e-draft-super");
  const accountant = await makeUser("ACCOUNTANT", "e2e-draft-acc");
  const otherAcc = await makeUser("ACCOUNTANT", "e2e-draft-other");
  const client = await makeClient("e2e-draft-client");
  const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");
  log(`CASE ${caseId}`);

  await request(app)
    .post("/api/compat/admin/assign")
    .set(bearer(admin))
    .send({ taxReturnId: caseId, accountantId: accountant.id })
    .expect(200);
  log("ASSIGN ok → accountant");

  const denied = await request(app)
    .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
    .set(bearer(otherAcc))
    .attach("draftReturnFile", PDF, { filename: "draft.pdf", contentType: "application/pdf" });
  if (denied.status !== 403) throw new Error(`expected 403 unassigned, got ${denied.status}`);
  log("UNASSIGNED upload → 403");

  const saDenied = await request(app)
    .post(`/api/compat/admin/assignments/${caseId}/upload-draft`)
    .set(bearer(superAdmin))
    .attach("draftReturnFile", PDF, { filename: "draft.pdf", contentType: "application/pdf" });
  if (saDenied.status !== 403) throw new Error(`expected 403 SUPER_ADMIN upload, got ${saDenied.status}`);
  log("SUPER_ADMIN upload → 403");

  const uploaded = await request(app)
    .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
    .set(bearer(accountant))
    .field("explanationNotes", "E2E draft")
    .attach("draftReturnFile", PDF, {
      filename: "mtd-q1-draft.pdf",
      contentType: "application/octet-stream",
    });
  if (uploaded.status !== 200) {
    throw new Error(`upload failed ${uploaded.status}: ${JSON.stringify(uploaded.body)}`);
  }
  const draftId = uploaded.body.data.id;
  log(
    `UPLOAD ok draftId=${draftId} reviewStatus=${uploaded.body.data.reviewStatus} isInternal=${uploaded.body.data.isInternal}`,
  );

  const { col } = await import("../src/db/mongo");
  const beforeClient = await request(app)
    .get(`/api/compat/client/drafts/${caseId}`)
    .set(bearer(client))
    .expect(200);
  const visibleBefore =
    beforeClient.body.data?.documents?.draftDocuments || [];
  if (visibleBefore.some((d: { id: string }) => d.id === draftId)) {
    throw new Error("client saw draft before Admin approval");
  }
  log("CLIENT drafts before approval → empty of this draft");

  const dl = await request(app)
    .get(`/api/compat/client/documents/${draftId}/download`)
    .set(bearer(client));
  if (dl.status !== 403) throw new Error(`expected download 403, got ${dl.status}`);
  log("CLIENT download before approval → 403");

  const saApprove = await request(app)
    .post(`/api/compat/admin/manage-review/${caseId}`)
    .set(bearer(superAdmin))
    .send({ action: "approve" });
  if (saApprove.status !== 403) throw new Error(`expected SA approve 403, got ${saApprove.status}`);
  log("SUPER_ADMIN approve → 403");

  const retry = await request(app)
    .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
    .set(bearer(accountant))
    .attach("draftReturnFile", PDF, {
      filename: "mtd-q1-draft.pdf",
      contentType: "application/pdf",
    })
    .expect(200);
  if (!retry.body.data.duplicate || retry.body.data.id !== draftId) {
    throw new Error("duplicate upload did not return same draft");
  }
  const hash = createHash("sha256").update(PDF).digest("hex");
  const n = await col("documents").countDocuments({
    case_id: caseId,
    content_hash: hash,
    is_draft: true,
    is_deleted: { $ne: true },
  });
  if (n !== 1) throw new Error(`expected 1 draft record, got ${n}`);
  log("DUPLICATE retry → same draft id, single DB record");

  await request(app)
    .post(`/api/compat/admin/manage-review/${caseId}`)
    .set(bearer(admin))
    .send({ action: "approve", note: "E2E approved" })
    .expect(200);
  log("ADMIN approve → 200");

  const afterDoc = await col("documents").findOne({ id: draftId });
  if (afterDoc?.is_internal !== false || afterDoc?.review_status !== "APPROVED") {
    throw new Error(`draft not released: ${JSON.stringify(afterDoc)}`);
  }
  log("DRAFT released is_internal=false review_status=APPROVED");

  const afterClient = await request(app)
    .get(`/api/compat/client/drafts/${caseId}`)
    .set(bearer(client))
    .expect(200);
  const visibleAfter = afterClient.body.data?.documents?.draftDocuments || [];
  if (!visibleAfter.some((d: { id: string }) => d.id === draftId)) {
    throw new Error("client cannot see approved draft");
  }
  log("CLIENT drafts after approval → draft visible");

  const notes = await request(app).get("/api/notifications").set(bearer(client)).expect(200);
  const list = Array.isArray(notes.body) ? notes.body : notes.body?.data || [];
  if (!list.some((n: { title?: string }) => /ready to review/i.test(String(n.title || "")))) {
    throw new Error("client missing approval notification");
  }
  log("CLIENT notification after approval → present");

  await dropTestDb();
  log("E2E_PROOF_OK");
  return steps;
}

main().catch(async (e) => {
  console.error("E2E_PROOF_FAILED", e);
  try {
    await dropTestDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
