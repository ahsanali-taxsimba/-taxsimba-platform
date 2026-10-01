/**
 * Regression for Toxsl evidence pack 2026-10-01:
 * 1) Engagement / submit-tax-info must complete (multipart, no hang).
 * 2) Admin "Advance to Draft Ready" / approve must release draft; client can approve
 *    and then advance past draft_ready (CLIENT_APPROVED → final_submitted).
 * 3) Staff email template + send-to-client + client communication-log DTO.
 */
import { randomUUID } from "crypto";

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
  TestUser,
} from "../helpers/app";

describe("Toxsl evidence blockers 2026-10-01", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "ev-admin");
    accountant = await makeUser("ACCOUNTANT", "ev-acc");
  }, 120000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("blocker1: submit-tax-info multipart completes without hanging", async () => {
    const client = await makeClient(`ev-mtd-${randomUUID().slice(0, 6)}`);
    await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");

    const res = await request(app)
      .post("/api/compat/client/submit-tax-info")
      .set(bearer(client))
      .field(
        "additionalNotes",
        "Is there anything else your accountant should know? (Optional)",
      )
      .field("govGatewayStatus", "Yes")
      .timeout({ deadline: 15000 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it("blocker2: Admin progress draft_ready approves+releases; client advances after approve", async () => {
    const client = await makeClient(`ev-sa-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SMART");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    const upload = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
      .set(bearer(accountant))
      .attach("draftReturnFile", Buffer.from("%PDF-1.4 toxsl-draft"), {
        filename: "toxsl-draft.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    const draftId = upload.body.data.id as string;

    // Accountant cannot approve via progress.
    await request(app)
      .post(`/api/compat/accountant/tax-return/${caseId}/progress`)
      .set(bearer(accountant))
      .send({ status: "draft_ready" })
      .expect(400);

    // Toxsl tax-return-list "Advance to Draft Ready" → full Admin approve path.
    const advanced = await request(app)
      .post(`/api/compat/admin/tax-return/${caseId}/progress`)
      .set(bearer(admin))
      .send({ status: "draft_ready" })
      .expect(200);

    expect(advanced.body.data.status).toBe("draft_ready");
    expect(["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"]).toContain(
      advanced.body.data.nodeStatus,
    );

    const drafts = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const docs = drafts.body.data?.documents?.draftDocuments || [];
    expect(docs.some((d: { id: string }) => d.id === draftId)).toBe(true);

    // Client list must show toxel draft_ready (not raw Node status).
    const listBefore = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const rowBefore = (
      listBefore.body.data as Array<{
        id: string;
        taxReturn?: { status?: string; nodeStatus?: string };
      }>
    ).find((r) => r.id === caseId || r.taxReturn?.status);
    const beforeStatus =
      (listBefore.body.data as Array<{ id: string; taxReturn?: { status?: string } }>).find(
        (r) => r.id === caseId,
      )?.taxReturn?.status ||
      rowBefore?.taxReturn?.status;
    expect(beforeStatus).toBe("draft_ready");

    await request(app)
      .post(`/api/compat/client/drafts/${caseId}/approve`)
      .set(bearer(client))
      .send({ approvalNotes: "Looks good", confirmFinalSubmission: true })
      .expect(200);

    const listAfter = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const afterStatus = (
      listAfter.body.data as Array<{ id: string; taxReturn?: { status?: string } }>
    ).find((r) => r.id === caseId)?.taxReturn?.status;
    // Must advance past Draft Ready after client approval.
    expect(["client_approved", "ready_for_submission", "final_submitted"]).toContain(
      afterStatus,
    );
    expect(afterStatus).not.toBe("draft_ready");
  });

  it("blocker3: staff template loads; send-to-client + client log DTO are valid", async () => {
    const client = await makeClient(`ev-msg-${randomUUID().slice(0, 6)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "ELITE");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    const tmplAdmin = await request(app)
      .get("/api/compat/admin/template")
      .set(bearer(admin))
      .expect(200);
    expect(tmplAdmin.body.success).toBe(true);
    expect(tmplAdmin.body.data.template?.templateContent || tmplAdmin.body.data.template?.bodyHtml)
      .toBeTruthy();

    const tmplAcc = await request(app)
      .get("/api/compat/accountant/template")
      .set(bearer(accountant))
      .expect(200);
    expect(tmplAcc.body.success).toBe(true);

    // Shape that previously surfaced as "invalid" (extra FE fields).
    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId,
        subject: "Update regarding your TaxSimba tax return",
        message: "<p>Hello from Admin</p>",
        htmlContent: "<p>Hello from Admin</p>",
        templateId: "default-staff-case-email",
        priority: "high",
        recipientId: client.id,
      })
      .expect(200);

    await request(app)
      .post("/api/compat/client/send-to-specific-accountant")
      .set(bearer(client))
      .send({
        taxReturnId: caseId,
        accountantId: accountant.id,
        subject: "Question",
        message: "Client reply body",
        priority: "high",
      })
      .expect(200);

    const staffLog = await request(app)
      .post(`/api/compat/admin/communication-log/${caseId}`)
      .set(bearer(admin))
      .send({ page: 1, limit: 50 })
      .expect(200);
    expect(Array.isArray(staffLog.body.data.emails)).toBe(true);
    expect(staffLog.body.data.emails.length).toBeGreaterThan(0);
    expect(staffLog.body.data.emails[0].sentAt || staffLog.body.data.emails[0].createdAt).toBeTruthy();

    const clientLog = await request(app)
      .post(`/api/compat/client/communication-log/${caseId}`)
      .set(bearer(client))
      .send({ page: 1, limit: 50 })
      .expect(200);
    const emails = clientLog.body.data.emails || [];
    expect(emails.length).toBeGreaterThan(0);
    const first = emails[0];
    expect(first.sentAt || first.createdAt).toBeTruthy();
    expect(first.parsedEmailData?.messageText || first.body).toBeTruthy();
    expect(Number.isNaN(new Date(first.sentAt || first.createdAt).getTime())).toBe(false);
  });
});
