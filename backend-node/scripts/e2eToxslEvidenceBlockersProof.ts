/**
 * Local E2E proof for Toxsl evidence pack 2026-10-01 blockers.
 * Boots the real Express app (same harness as integration tests) and advances
 * the complete journeys — not mocked unit stubs.
 */
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
  const log = (s: string) => console.log(s);
  const { app } = await bootTestApp();
  const { ensurePhase1bData } = await import("../src/domain/packages");
  await ensurePhase1bData();

  const admin = await makeUser("ADMIN", "e2e-ev-admin");
  const accountant = await makeUser("ACCOUNTANT", "e2e-ev-acc");

  // ——— Blocker 1: submit-tax-info multipart completes ———
  const mtdClient = await makeClient("e2e-ev-mtd");
  await activateClientService(mtdClient, "MTD_INCOME_TAX", "MTD_COMPLY");
  const taxInfo = await request(app)
    .post("/api/compat/client/submit-tax-info")
    .set(bearer(mtdClient))
    .field("additionalNotes", "E2E anything else for accountant")
    .field("govGatewayStatus", "Yes")
    .timeout({ deadline: 15000 });
  if (taxInfo.status !== 200 || !taxInfo.body.success) {
    throw new Error(`blocker1 FAIL ${taxInfo.status}: ${JSON.stringify(taxInfo.body)}`);
  }
  log("BLOCKER1 PASS — submit-tax-info multipart completed");

  // ——— Blocker 2: Admin advance draft_ready → client approve → past Draft Ready ———
  const saClient = await makeClient("e2e-ev-sa");
  const { caseId } = await activateClientService(saClient, "SELF_ASSESSMENT", "SMART");
  await request(app)
    .post("/api/compat/admin/assign")
    .set(bearer(admin))
    .send({ taxReturnId: caseId, accountantId: accountant.id })
    .expect(200);

  const upload = await request(app)
    .post(`/api/compat/accountant/assignments/${caseId}/upload-draft`)
    .set(bearer(accountant))
    .attach("draftReturnFile", PDF, {
      filename: "e2e-draft.pdf",
      contentType: "application/pdf",
    });
  if (upload.status !== 200) {
    throw new Error(`upload FAIL ${upload.status}: ${JSON.stringify(upload.body)}`);
  }
  const draftId = upload.body.data.id as string;
  log(`UPLOAD draft ${draftId} → READY_FOR_ADMIN_REVIEW`);

  const advanced = await request(app)
    .post(`/api/compat/admin/tax-return/${caseId}/progress`)
    .set(bearer(admin))
    .send({ status: "draft_ready" });
  if (advanced.status !== 200) {
    throw new Error(`advance FAIL ${advanced.status}: ${JSON.stringify(advanced.body)}`);
  }
  if (advanced.body.data.status !== "draft_ready") {
    throw new Error(`expected toxel draft_ready, got ${advanced.body.data.status}`);
  }
  log(
    `ADMIN Advance to Draft Ready → nodeStatus=${advanced.body.data.nodeStatus} toxel=${advanced.body.data.status}`,
  );

  const drafts = await request(app)
    .get(`/api/compat/client/drafts/${caseId}`)
    .set(bearer(saClient))
    .expect(200);
  const docs = drafts.body.data?.documents?.draftDocuments || [];
  if (!docs.some((d: { id: string }) => d.id === draftId)) {
    throw new Error("client cannot see released draft after Admin advance");
  }
  log("CLIENT drafts visible after Admin approve/release");

  await request(app)
    .post(`/api/compat/client/drafts/${caseId}/approve`)
    .set(bearer(saClient))
    .send({ approvalNotes: "E2E approve", confirmFinalSubmission: true })
    .expect(200);

  const list = await request(app)
    .post("/api/compat/client/all-tax-returns")
    .set(bearer(saClient))
    .send({})
    .expect(200);
  const row = (list.body.data as Array<{ id: string; taxReturn?: { status?: string } }>).find(
    (r) => r.id === caseId,
  );
  if (row?.taxReturn?.status !== "final_submitted") {
    throw new Error(
      `blocker2 FAIL — expected final_submitted after client approve, got ${row?.taxReturn?.status}`,
    );
  }
  log("BLOCKER2 PASS — client advanced past Draft Ready to final_submitted");

  // ——— Blocker 3: template + messaging ———
  const tmpl = await request(app).get("/api/compat/admin/template").set(bearer(admin));
  if (tmpl.status !== 200 || !tmpl.body.data?.template) {
    throw new Error(`template FAIL ${tmpl.status}: ${JSON.stringify(tmpl.body)}`);
  }
  log("TEMPLATE ok — /admin/template");

  const send = await request(app)
    .post("/api/compat/admin/send-to-client")
    .set(bearer(admin))
    .send({
      taxReturnId: caseId,
      subject: "Update regarding your TaxSimba tax return",
      message: "<p>Hello from Admin E2E</p>",
      htmlContent: "<p>Hello from Admin E2E</p>",
      templateId: "default-staff-case-email",
      priority: "high",
      recipientId: saClient.id,
    });
  if (send.status !== 200) {
    throw new Error(`send FAIL ${send.status}: ${JSON.stringify(send.body)}`);
  }

  const clientSend = await request(app)
    .post("/api/compat/client/send-to-specific-accountant")
    .set(bearer(saClient))
    .send({
      taxReturnId: caseId,
      accountantId: accountant.id,
      subject: "Question",
      message: "Client E2E reply",
      priority: "high",
    });
  if (clientSend.status !== 200) {
    throw new Error(`client send FAIL ${clientSend.status}: ${JSON.stringify(clientSend.body)}`);
  }

  const logRes = await request(app)
    .post(`/api/compat/client/communication-log/${caseId}`)
    .set(bearer(saClient))
    .send({ page: 1, limit: 50 })
    .expect(200);
  const emails = logRes.body.data.emails || [];
  if (!emails.length) throw new Error("communication-log empty");
  const ts = emails[0].sentAt || emails[0].createdAt;
  if (!ts || Number.isNaN(new Date(ts).getTime())) {
    throw new Error(`Invalid Date in communication-log: ${JSON.stringify(emails[0])}`);
  }
  if (!(emails[0].parsedEmailData?.messageText || emails[0].body)) {
    throw new Error("message body missing in DTO");
  }
  log(`BLOCKER3 PASS — template + send + log DTO (sentAt=${ts})`);

  await dropTestDb();
  log("ALL THREE TOXSL EVIDENCE BLOCKERS PASSED (local E2E)");
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await dropTestDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
