/**
 * Draft upload → Admin review → client visibility gate.
 *
 * Accountant submits draft (no client notify). Client cannot see until Admin approves.
 * SUPER_ADMIN cannot approve. Duplicate content hash does not create a second draft.
 */
import { createHash } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../helpers/app";
import { DRAFT_REVIEW_AWAITING, DRAFT_REVIEW_APPROVED } from "../../src/compat/documents";

const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

const DOCX_BYTES = Buffer.from("PK\x03\x04fake-docx-content-for-upload-test", "binary");

describe("draft upload admin-review gate", () => {
  let app: Express;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let accountantA: Awaited<ReturnType<typeof makeUser>>;
  let accountantB: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    superAdmin = await makeUser("SUPER_ADMIN", "draft-gate-super");
    admin = await makeUser("ADMIN", "draft-gate-admin");
    accountantA = await makeUser("ACCOUNTANT", "draft-gate-a");
    accountantB = await makeUser("ACCOUNTANT", "draft-gate-b");
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("assigned accountant uploads PDF/DOCX → awaiting Admin; client blocked; Admin approves; client notified", async () => {
    const client = await makeClient("draft-gate-mtd");
    const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);

    // Unassigned accountant cannot upload
    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantB))
      .attach("draftReturnFile", PDF_BYTES, {
        filename: "calc.pdf",
        contentType: "application/pdf",
      })
      .expect(403);

    // SUPER_ADMIN cannot upload draft
    await request(app)
      .post(`/api/compat/admin/assignments/${caseId}/upload-draft`)
      .set(bearer(superAdmin))
      .attach("draftReturnFile", PDF_BYTES, {
        filename: "calc.pdf",
        contentType: "application/pdf",
      })
      .expect(403);

    // Invalid type
    const badType = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .attach("draftReturnFile", Buffer.from("not-a-doc"), {
        filename: "notes.exe",
        contentType: "application/octet-stream",
      });
    expect([400, 415]).toContain(badType.status);

    // Oversized
    const huge = Buffer.alloc(26 * 1024 * 1024, 1);
    const oversized = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .attach("draftReturnFile", huge, {
        filename: "huge.pdf",
        contentType: "application/pdf",
      });
    expect(oversized.status).toBe(413);

    // Valid PDF — empty MIME still accepted via extension
    const upload = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .field("explanationNotes", "Q1 draft for review")
      .attach("draftReturnFile", PDF_BYTES, {
        filename: "mtd-draft.pdf",
        contentType: "application/octet-stream",
      })
      .expect(200);
    expect(upload.body.success).toBe(true);
    expect(upload.body.data.reviewStatus).toBe(DRAFT_REVIEW_AWAITING);
    expect(upload.body.data.isInternal).toBe(true);
    expect(upload.body.data.clientNotified).toBe(false);
    expect(String(upload.body.message || "")).toMatch(/Admin review/i);
    const draftId = upload.body.data.id as string;

    const { col } = await import("../../src/db/mongo");
    const stored = await col("documents").findOne({ id: draftId });
    expect(stored?.review_status).toBe(DRAFT_REVIEW_AWAITING);
    expect(stored?.is_internal).toBe(true);
    expect(stored?.is_draft).toBe(true);

    const kase = await col("cases").findOne({ id: caseId });
    expect(kase?.status).toBe("READY_FOR_ADMIN_REVIEW");

    // Client cannot list draft before approval
    const beforeClient = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const beforeDocs = beforeClient.body.data?.documents?.draftDocuments || [];
    expect(beforeDocs.some((d: { id: string }) => d.id === draftId)).toBe(false);

    // Client cannot download internal draft
    await request(app)
      .get(`/api/compat/client/documents/${draftId}/download`)
      .set(bearer(client))
      .expect(403);

    // No client draft-ready notification yet
    const clientNotes = await request(app)
      .get("/api/notifications")
      .set(bearer(client))
      .expect(200);
    const noteList = Array.isArray(clientNotes.body)
      ? clientNotes.body
      : clientNotes.body?.data || [];
    expect(
      noteList.some((n: { title?: string }) =>
        /draft is ready|ready to review/i.test(String(n.title || "")),
      ),
    ).toBe(false);

    // Admin can see review payload
    const review = await request(app)
      .post(`/api/compat/admin/get-review/${caseId}`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(
      (review.body.data.reviews || []).some(
        (r: { documentId?: string; document_id?: string }) =>
          r.documentId === draftId || r.document_id === draftId,
      ),
    ).toBe(true);

    // SUPER_ADMIN cannot approve
    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(superAdmin))
      .send({ action: "approve", note: "should fail" })
      .expect(403);

    // Duplicate same content → no second record
    const hash = createHash("sha256").update(PDF_BYTES).digest("hex");
    const retry = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .attach("draftReturnFile", PDF_BYTES, {
        filename: "mtd-draft.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    expect(retry.body.data.duplicate).toBe(true);
    expect(retry.body.data.id).toBe(draftId);
    const count = await col("documents").countDocuments({
      case_id: caseId,
      is_draft: true,
      content_hash: hash,
      is_deleted: { $ne: true },
    });
    expect(count).toBe(1);

    // DOCX also accepted
    const docx = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .attach("draftReturnFile", DOCX_BYTES, {
        filename: "mtd-draft.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
      .expect(200);
    expect(docx.body.data.reviewStatus).toBe(DRAFT_REVIEW_AWAITING);

    // Admin approves
    const approved = await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "approve", note: "Looks good" })
      .expect(200);
    expect(approved.body.success).toBe(true);

    const afterDoc = await col("documents").findOne({ id: draftId });
    expect(afterDoc?.review_status).toBe(DRAFT_REVIEW_APPROVED);
    expect(afterDoc?.is_internal).toBe(false);

    const afterClient = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const afterDocs = afterClient.body.data?.documents?.draftDocuments || [];
    expect(afterDocs.some((d: { id: string }) => d.id === draftId)).toBe(true);

    const afterNotes = await request(app)
      .get("/api/notifications")
      .set(bearer(client))
      .expect(200);
    const afterList = Array.isArray(afterNotes.body)
      ? afterNotes.body
      : afterNotes.body?.data || [];
    expect(
      afterList.some((n: { title?: string }) =>
        /ready to review|draft is ready/i.test(String(n.title || "")),
      ),
    ).toBe(true);
  });

  it("Admin can return/reject a draft; client still cannot see it", async () => {
    const client = await makeClient("draft-gate-return");
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);

    const upload = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountantA))
      .attach("draftReturnFile", PDF_BYTES, {
        filename: "sa-draft.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    const draftId = upload.body.data.id as string;

    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "return", reason: "Please revise expense schedule" })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const doc = await col("documents").findOne({ id: draftId });
    expect(doc?.review_status).toBe("RETURNED");
    expect(doc?.is_internal).toBe(true);

    const clientView = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const docs = clientView.body.data?.documents?.draftDocuments || [];
    expect(docs.some((d: { id: string }) => d.id === draftId)).toBe(false);
  });
});
