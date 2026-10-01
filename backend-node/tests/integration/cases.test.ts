/** Stage 2 parity: case creation, assignment and the full Self Assessment workflow. */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeUser, TestUser } from "../helpers/app";

let app: Express;
let admin: TestUser;
let accountant: TestUser;
let other: TestUser;
let client: TestUser;

const CHECKLIST = {
  client_information_reviewed: true,
  required_documents_reviewed: true,
  income_checked: true,
  allowable_expenses_checked: true,
  tax_calculation_checked: true,
  supporting_documents_attached: true,
  return_ready: true,
};

async function newCase(): Promise<string> {
  const res = await request(app)
    .post("/api/cases")
    .set(bearer(admin))
    .send({ client_user_id: client.id, tax_year: "2024/25" });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

/** Drives a case from creation to READY_FOR_SUBMISSION through every real transition. */
async function readyForSubmission(): Promise<{ caseId: string; calcId: string }> {
  const caseId = await newCase();
  await request(app)
    .post(`/api/cases/${caseId}/assign`)
    .set(bearer(admin))
    .send({ accountant_id: accountant.id })
    .expect(200);
  await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
  const calc = await request(app)
    .post(`/api/cases/${caseId}/calculations`)
    .set(bearer(accountant))
    .send({ total_income: 50000, taxable_income: 37430, tax_due: 7486 })
    .expect(200);
  await request(app)
    .post(`/api/cases/${caseId}/submit-for-admin-review`)
    .set(bearer(accountant))
    .send({ calculation_version_id: calc.body.id, checklist: CHECKLIST })
    .expect(200);
  await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(200);
  const approved = await request(app)
    .post(`/api/cases/${caseId}/client-approve`)
    .set(bearer(client))
    .expect(200);
  expect(approved.body.status).toBe("READY_FOR_SUBMISSION");
  return { caseId, calcId: calc.body.id as string };
}

beforeAll(async () => {
  ({ app } = await bootTestApp());
  admin = await makeUser("ADMIN");
  accountant = await makeUser("ACCOUNTANT");
  other = await makeUser("ACCOUNTANT", "other");
  client = await makeUser("CLIENT");
}, 30000);

afterAll(async () => {
  await dropTestDb();
});

describe("case creation", () => {
  it("issues sequential SA- references and lands in AWAITING_ASSIGNMENT", async () => {
    const first = await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({ client_user_id: client.id, tax_year: "2024/25" })
      .expect(200);
    expect(first.body.case_ref).toMatch(/^SA-\d{4,}$/);
    expect(first.body.status).toBe("AWAITING_ASSIGNMENT");
    expect(first.body.next_action_owner).toBe("ADMIN");
    // 31 January following the end of the 2024/25 tax year.
    expect(first.body.external_deadline).toBe("2026-01-31T23:59:00+00:00");
    expect(first.body._id).toBeUndefined();

    const second = await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({ client_user_id: client.id })
      .expect(200);
    const seq = (ref: string) => parseInt(ref.split("-")[1], 10);
    expect(seq(second.body.case_ref)).toBe(seq(first.body.case_ref) + 1);
  });

  it("rejects a staff create without a client and an unknown client", async () => {
    await request(app).post("/api/cases").set(bearer(admin)).send({}).expect(400);
    await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({ client_user_id: "nope" })
      .expect(404);
  });
});

describe("case visibility", () => {
  it("scopes lists and detail by role", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    const mine = await request(app).get("/api/cases").set(bearer(accountant)).expect(200);
    expect(mine.body.every((c: { assigned_accountant_id: string }) =>
      c.assigned_accountant_id === accountant.id)).toBe(true);

    const theirs = await request(app).get("/api/cases").set(bearer(other)).expect(200);
    expect(theirs.body.find((c: { id: string }) => c.id === caseId)).toBeUndefined();

    await request(app).get(`/api/cases/${caseId}`).set(bearer(other)).expect(403);
    await request(app).get("/api/cases/missing").set(bearer(admin)).expect(404);
  });

  it("rejects an unknown bucket instead of silently listing everything", async () => {
    await request(app).get("/api/cases?bucket=not_a_bucket").set(bearer(admin)).expect(400);
    await request(app).get("/api/cases?bucket=unassigned").set(bearer(admin)).expect(200);
  });

  it("requires authentication", async () => {
    await request(app).get("/api/cases").expect(401);
  });
});

describe("assignment", () => {
  it("assigns, records history, and reassignment keeps the workflow state", async () => {
    const caseId = await newCase();
    const assigned = await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id, priority: "HIGH" })
      .expect(200);
    expect(assigned.body.status).toBe("ASSIGNED");
    expect(assigned.body.assigned_accountant_id).toBe(accountant.id);

    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const reassigned = await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: other.id })
      .expect(200);
    // Ownership changed but the workflow stage did not.
    expect(reassigned.body.assigned_accountant_id).toBe(other.id);
    expect(reassigned.body.status).toBe("ACCOUNTANT_REVIEW");

    const history = await request(app)
      .get(`/api/cases/${caseId}/assignments`)
      .set(bearer(admin))
      .expect(200);
    expect(history.body).toHaveLength(2);
  });

  it("is admin only and validates the accountant", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(accountant))
      .send({ accountant_id: accountant.id })
      .expect(403);
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: client.id })
      .expect(404);
    await request(app).post(`/api/cases/${caseId}/assign`).set(bearer(admin)).send({}).expect(422);
  });

  it("unassigns back to AWAITING_ASSIGNMENT with a reason", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/unassign`)
      .set(bearer(admin))
      .send({ reason: "not assigned yet" })
      .expect(400);
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    const res = await request(app)
      .post(`/api/cases/${caseId}/unassign`)
      .set(bearer(admin))
      .send({ reason: "capacity" })
      .expect(200);
    expect(res.body.status).toBe("AWAITING_ASSIGNMENT");
    expect(res.body.assigned_accountant_id).toBeNull();
  });
});

describe("client information requests", () => {
  it("creates one task, request and document, and is idempotent on repeat", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);

    const first = await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Bank statements", description: "April to March", message: "Please upload" })
      .expect(200);
    expect(first.body.task_id).toBeTruthy();

    const repeat = await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Bank statements" })
      .expect(200);
    expect(repeat.body.duplicate_prevented).toBe(true);
    expect(repeat.body.task_id).toBe(first.body.task_id);

    const detail = await request(app).get(`/api/cases/${caseId}`).set(bearer(admin)).expect(200);
    expect(detail.body.status).toBe("AWAITING_CLIENT");
    expect(detail.body.waiting_reason).toBe("Bank statements");

    const tasks = await request(app)
      .get(`/api/tasks?case_id=${caseId}`)
      .set(bearer(client))
      .expect(200);
    expect(tasks.body).toHaveLength(1);
    expect(tasks.body[0].tax_year).toBe("2024/25");

    // Completing the client's last open task returns the case to the accountant.
    await request(app)
      .post(`/api/tasks/${first.body.task_id}/complete`)
      .set(bearer(client))
      .expect(200);
    const back = await request(app).get(`/api/cases/${caseId}`).set(bearer(admin)).expect(200);
    expect(back.body.status).toBe("ACCOUNTANT_REVIEW");
  });

  it("is refused at a stage that cannot wait on the client", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(admin))
      .send({ title: "Too early" })
      .expect(400);
  });

  it("refuses to complete another user's task", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const req = await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Receipts" })
      .expect(200);
    await request(app)
      .post(`/api/tasks/${req.body.task_id}/complete`)
      .set(bearer(accountant))
      .expect(403);
  });
});

describe("calculations and review", () => {
  it("versions calculations and hides unapproved versions from the client", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const v1 = await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 40000, taxable_income: 27430, tax_due: 5486 })
      .expect(200);
    const v2 = await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 41000, taxable_income: 28430, tax_due: 5686 })
      .expect(200);
    expect(v1.body.version).toBe(1);
    expect(v2.body.version).toBe(2);
    expect(v2.body.payment_deadline).toBe("31 January 2026");

    const staffView = await request(app)
      .get(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .expect(200);
    expect(staffView.body).toHaveLength(2);
    const clientView = await request(app)
      .get(`/api/cases/${caseId}/calculations`)
      .set(bearer(client))
      .expect(200);
    expect(clientView.body).toHaveLength(0);

    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({
        calculation_version_id: v2.body.id,
        checklist: { ...CHECKLIST, return_ready: false },
      })
      .expect(400);
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: "nope", checklist: CHECKLIST })
      .expect(404);
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: v2.body.id, checklist: CHECKLIST })
      .expect(200);

    const afterSubmit = await request(app)
      .get(`/api/cases/${caseId}`)
      .set(bearer(admin))
      .expect(200);
    expect(afterSubmit.body.status).toBe("READY_FOR_ADMIN_REVIEW");

    const returned = await request(app)
      .post(`/api/cases/${caseId}/admin-return`)
      .set(bearer(admin))
      .send({ reason: "Expenses look wrong", instructions: "Recheck motor expenses" })
      .expect(200);
    expect(returned.body.status).toBe("CHANGES_REQUIRED");

    const accountantTasks = await request(app)
      .get(`/api/tasks?case_id=${caseId}`)
      .set(bearer(accountant))
      .expect(200);
    expect(
      accountantTasks.body.some((t: { name: string }) =>
        t.name.startsWith("Admin changes required")),
    ).toBe(true);

    // A fresh version resolves the change request when admin approves it.
    await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 41000, taxable_income: 28000, tax_due: 5600 })
      .expect(200);
    const v3 = await request(app)
      .get(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: v3.body[0].id, checklist: CHECKLIST })
      .expect(200);
    const approved = await request(app)
      .post(`/api/cases/${caseId}/admin-approve`)
      .set(bearer(admin))
      .send({ note: "Approved" })
      .expect(200);
    expect(approved.body.status).toBe("AWAITING_CLIENT_APPROVAL");
    const openTasks = await request(app)
      .get(`/api/tasks?case_id=${caseId}&status=OPEN`)
      .set(bearer(admin))
      .expect(200);
    expect(openTasks.body).toHaveLength(0);

    const clientCalcs = await request(app)
      .get(`/api/cases/${caseId}/calculations`)
      .set(bearer(client))
      .expect(200);
    expect(clientCalcs.body).toHaveLength(1);
  });

  it("refuses admin approval before work is submitted", async () => {
    const caseId = await newCase();
    await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(400);
  });
});

describe("client approval and submission", () => {
  it("walks the approved case to COMPLETED", async () => {
    const { caseId } = await readyForSubmission();
    const detail = await request(app).get(`/api/cases/${caseId}`).set(bearer(client)).expect(200);
    expect(detail.body.status_label).toBe("Ready for HMRC submission");
    expect(detail.body.approved_version).toBe(1);

    await request(app)
      .post(`/api/cases/${caseId}/record-submission`)
      .set(bearer(admin))
      .send({ submission_date: "2025-06-01", submission_reference: "  " })
      .expect(400);
    const submitted = await request(app)
      .post(`/api/cases/${caseId}/record-submission`)
      .set(bearer(admin))
      .send({
        submission_date: "2025-06-01",
        submission_reference: "HMRC-123",
        provider: "TaxCalc",
      })
      .expect(200);
    expect(submitted.body.status).toBe("SUBMITTED");
    expect(submitted.body.has_submission_record).toBe(true);
    expect(submitted.body.submission_reference).toBe("HMRC-123");

    // Idempotent: a repeated record-submission returns the existing record.
    const repeat = await request(app)
      .post(`/api/cases/${caseId}/record-submission`)
      .set(bearer(admin))
      .send({ submission_date: "2025-07-01", submission_reference: "HMRC-999" })
      .expect(200);
    expect(repeat.body.submission_reference).toBe("HMRC-123");

    const completed = await request(app)
      .post(`/api/cases/${caseId}/complete`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(completed.body.status).toBe("COMPLETED");

    const record = await request(app)
      .get(`/api/cases/${caseId}/submission`)
      .set(bearer(client))
      .expect(200);
    expect(record.body.status).toBe("COMPLETED");

    // Completed cases are locked until an audited reopen.
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(400);
    await request(app)
      .post(`/api/cases/${caseId}/reopen`)
      .set(bearer(admin))
      .send({ reason: "  " })
      .expect(400);
    const reopened = await request(app)
      .post(`/api/cases/${caseId}/reopen`)
      .set(bearer(admin))
      .send({ reason: "HMRC amendment" })
      .expect(200);
    expect(reopened.body.status).toBe("ACCOUNTANT_REVIEW");
  });

  it("refuses a submission that skipped client approval or has open work", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const calc = await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 10000, taxable_income: 0, tax_due: 0 })
      .expect(200);
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: calc.body.id, checklist: CHECKLIST })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(200);
    // Admin approved but the client has not, so the submission is refused.
    const refused = await request(app)
      .post(`/api/cases/${caseId}/record-submission`)
      .set(bearer(admin))
      .send({ submission_date: "2025-06-01", submission_reference: "HMRC-1" })
      .expect(400);
    expect(refused.body.detail).toBe("Client approval is not complete");
    // Client approval is only for the client, and only once the return is released.
    await request(app).post(`/api/cases/${caseId}/client-approve`).set(bearer(admin)).expect(403);
  });

  it("keeps client approval but blocks readiness while work is open", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Outstanding receipts" })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const calc = await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 20000, taxable_income: 7430, tax_due: 1486 })
      .expect(200);
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: calc.body.id, checklist: CHECKLIST })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(200);
    const approved = await request(app)
      .post(`/api/cases/${caseId}/client-approve`)
      .set(bearer(client))
      .expect(200);
    expect(approved.body.status).toBe("CLIENT_APPROVED");
  });

  it("refuses completion of a case that was never submitted", async () => {
    const caseId = await newCase();
    await request(app).post(`/api/cases/${caseId}/complete`).set(bearer(admin)).send({}).expect(400);
  });
});

describe("workflow guard", () => {
  it("cannot skip a stage even when the role is allowed to act", async () => {
    const caseId = await newCase();
    // AWAITING_ASSIGNMENT -> IN_PREPARATION is not a permitted transition.
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    const res = await request(app)
      .post(`/api/cases/${caseId}/mark-reviewed`)
      .set(bearer(accountant))
      .expect(400);
    expect(res.body.detail).toContain("Workflow rule: cannot move from ASSIGNED");
  });
});
