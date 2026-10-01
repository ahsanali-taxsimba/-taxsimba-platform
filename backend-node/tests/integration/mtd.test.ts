/** Stage 4 parity: MTD periods (Q1–Q4 + Final Declaration), figures, publish, approval. */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeUser, TestUser } from "../helpers/app";

interface Period {
  id: string;
  kind: string;
  quarter: number | null;
  label: string;
  status: string;
  period_start: string;
  period_end: string;
  deadline: string;
  published_version: number;
  draft?: unknown;
  stage_label: string;
  next_action_owner: string;
}

describe("MTD income tax periods", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let otherAccountant: TestUser;
  let client: TestUser;
  let otherClient: TestUser;

  async function mtdCase(owner: TestUser = client, assign = true): Promise<string> {
    const res = await request(app)
      .post("/api/cases")
      .set(bearer(owner))
      .send({ tax_year: "2024/25", service_type: "MTD_INCOME_TAX" })
      .expect(200);
    const caseId = res.body.id as string;
    if (assign) {
      await request(app)
        .post(`/api/cases/${caseId}/assign`)
        .set(bearer(admin))
        .send({ accountant_id: accountant.id })
        .expect(200);
    }
    return caseId;
  }

  async function periods(caseId: string, as: TestUser = accountant): Promise<Period[]> {
    const res = await request(app)
      .get(`/api/mtd/cases/${caseId}/periods`)
      .set(bearer(as))
      .expect(200);
    return res.body as Period[];
  }

  /** Drives a quarter all the way to APPROVED and returns it. */
  async function approvedQuarter(): Promise<{ caseId: string; period: Period }> {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 10000, expenses: 2500 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    const res = await request(app)
      .post(`/api/mtd/periods/${q1.id}/client-approve`)
      .set(bearer(client))
      .send({ version: 1 })
      .expect(200);
    return { caseId, period: res.body as Period };
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN");
    accountant = await makeUser("ACCOUNTANT", "mtd-accountant-a");
    otherAccountant = await makeUser("ACCOUNTANT", "mtd-accountant-b");
    client = await makeUser("CLIENT", "mtd-client-a");
    otherClient = await makeUser("CLIENT", "mtd-client-b");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  // ------------------------------------------------------------------ schedule
  it("generates four quarters plus the Final Declaration with HMRC dates", async () => {
    const caseId = await mtdCase();
    const rows = await periods(caseId);
    expect(rows.map((r) => r.label)).toEqual([
      "Quarter 1",
      "Quarter 2",
      "Quarter 3",
      "Quarter 4",
      "Final Declaration",
    ]);
    expect(rows[0]).toMatchObject({
      period_start: "2024-04-06",
      period_end: "2024-07-05",
      deadline: "2024-08-07",
    });
    expect(rows[2]).toMatchObject({
      period_start: "2024-10-06",
      period_end: "2025-01-05",
      deadline: "2025-02-07",
    });
    expect(rows[3]).toMatchObject({
      period_start: "2025-01-06",
      period_end: "2025-04-05",
      deadline: "2025-05-07",
    });
    expect(rows[4]).toMatchObject({
      kind: "FINAL_DECLARATION",
      quarter: null,
      period_start: "2024-04-06",
      period_end: "2025-04-05",
      deadline: "2026-01-31",
    });
    expect(rows.every((r) => r.status === "NOT_STARTED")).toBe(true);
  });

  it("is idempotent — listing twice and generating again creates nothing new", async () => {
    const caseId = await mtdCase();
    await periods(caseId);
    await periods(caseId);
    const res = await request(app)
      .post(`/api/mtd/cases/${caseId}/generate-periods`)
      .set(bearer(admin))
      .expect(200);
    expect(res.body.created).toBe(0);
    expect((await periods(caseId)).length).toBe(5);
  });

  it("rejects MTD endpoints on a Self Assessment case", async () => {
    const res = await request(app)
      .post("/api/cases")
      .set(bearer(client))
      .send({ tax_year: "2024/25" })
      .expect(200);
    await request(app)
      .get(`/api/mtd/cases/${res.body.id}/periods`)
      .set(bearer(admin))
      .expect(400);
  });

  // ------------------------------------------------------------------ permissions
  it("scopes periods to the owning client and the assigned accountant", async () => {
    const caseId = await mtdCase();
    await request(app).get(`/api/mtd/cases/${caseId}/periods`).set(bearer(client)).expect(200);
    await request(app).get(`/api/mtd/cases/${caseId}/periods`).set(bearer(otherClient)).expect(403);
    await request(app)
      .get(`/api/mtd/cases/${caseId}/periods`)
      .set(bearer(otherAccountant))
      .expect(403);
  });

  it("never returns staff-only draft figures to the client", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 5000, expenses: 1000, client_note: "internal" })
      .expect(200);
    const staffRow = (await periods(caseId))[0];
    expect(staffRow.draft).toMatchObject({ income: 5000, net_profit: 4000 });

    const clientRow = (await periods(caseId, client))[0];
    expect(clientRow.draft).toBeUndefined();
    expect(clientRow).not.toHaveProperty("published_versions");
    expect(clientRow.stage_label).toBe("Preparing");
    await request(app).get(`/api/mtd/periods/${q1.id}/preview`).set(bearer(client)).expect(403);
  });

  // ------------------------------------------------------------------ preparation
  it("derives net profit and never invents tax or NI", async () => {
    const caseId = await mtdCase();
    const q2 = (await periods(caseId))[1];
    const res = await request(app)
      .post(`/api/mtd/periods/${q2.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 8000.005, expenses: 1500 })
      .expect(200);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.draft).toMatchObject({
      income: 8000.01,
      expenses: 1500,
      net_profit: 6500.01,
      estimated_income_tax: null,
      estimated_national_insurance: null,
      prepared_by_name: accountant.name,
    });
  });

  it("rejects negative figures and previews before figures exist", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: -1, expenses: 0 })
      .expect(400);
    await request(app).get(`/api/mtd/periods/${q1.id}/preview`).set(bearer(accountant)).expect(400);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(400);
  });

  it("locks figures once the period leaves the accountant", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 1000, expenses: 100 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 2000, expenses: 100 })
      .expect(400);
  });

  // ------------------------------------------------------------------ publish and approve
  it("publishes an immutable version and only then shows figures to the client", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 12000, expenses: 4000, estimated_income_tax: 1500 })
      .expect(200);
    const preview = await request(app)
      .get(`/api/mtd/periods/${q1.id}/preview`)
      .set(bearer(accountant))
      .expect(200);
    expect(preview.body).toMatchObject({ version: 1, net_profit: 8000 });

    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    const published = await request(app)
      .post(`/api/mtd/periods/${q1.id}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    expect(published.body.status).toBe("AWAITING_CLIENT_APPROVAL");
    expect(published.body.published).toMatchObject({ version: 1, published_by_name: admin.name });
    expect(published.body.disclaimer).toBeTruthy();

    const clientRow = (await periods(caseId, client))[0];
    expect(clientRow.stage_label).toBe("Ready for your approval");
    const notes = await request(app).get("/api/notifications").set(bearer(client)).expect(200);
    expect(notes.body.some((n: { title: string }) => n.title.includes("ready to approve"))).toBe(
      true,
    );
    // publishing does not submit the period
    expect(published.body.submission_reference).toBeNull();
  });

  it("rejects a stale client approval version with 409", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 100, expenses: 0 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/client-approve`)
      .set(bearer(client))
      .send({ version: 7 })
      .expect(409);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/client-approve`)
      .set(bearer(accountant))
      .send({ version: 1 })
      .expect(403);
  });

  it("returns a period for changes and keeps published history", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 500, expenses: 100 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    const returned = await request(app)
      .post(`/api/mtd/periods/${q1.id}/request-changes`)
      .set(bearer(admin))
      .send({ reason: "Expenses look wrong" })
      .expect(200);
    expect(returned.body.status).toBe("IN_PROGRESS");
    expect(returned.body.changes_reason).toBe("Expenses look wrong");
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/request-changes`)
      .set(bearer(admin))
      .send({ reason: "" })
      .expect(400);

    // second publication increments the version and keeps version 1 as evidence
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/figures`)
      .set(bearer(accountant))
      .send({ income: 500, expenses: 50 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    const republished = await request(app)
      .post(`/api/mtd/periods/${q1.id}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    expect(republished.body.published_version).toBe(1);
    expect(republished.body.published_versions).toHaveLength(1);
  });

  // ------------------------------------------------------------------ submission
  it("records an external submission only after client approval and then locks", async () => {
    const { period } = await approvedQuarter();
    expect(period.status).toBe("APPROVED");
    const submitted = await request(app)
      .post(`/api/mtd/periods/${period.id}/record-submission`)
      .set(bearer(admin))
      .send({ submission_reference: "HMRC-Q1-001", submission_date: "2024-08-01" })
      .expect(200);
    expect(submitted.body.status).toBe("SUBMITTED");
    expect(submitted.body.submitted_by_name).toBe(admin.name);
    await request(app)
      .post(`/api/mtd/periods/${period.id}/record-submission`)
      .set(bearer(admin))
      .send({ submission_reference: "HMRC-Q1-002", submission_date: "2024-08-02" })
      .expect(400);
    await request(app)
      .post(`/api/mtd/periods/${period.id}/reopen`)
      .set(bearer(admin))
      .send({ reason: "correction" })
      .expect(400);
  });

  it("refuses a submission that the client has not approved", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/record-submission`)
      .set(bearer(admin))
      .send({ submission_reference: "X", submission_date: "2024-08-01" })
      .expect(400);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/record-submission`)
      .set(bearer(accountant))
      .send({ submission_reference: "X", submission_date: "2024-08-01" })
      .expect(403);
  });

  it("reopens an approved quarter, superseding the approved version as evidence", async () => {
    const { period } = await approvedQuarter();
    const reopened = await request(app)
      .post(`/api/mtd/periods/${period.id}/reopen`)
      .set(bearer(admin))
      .send({ reason: "Client sent a missing invoice" })
      .expect(200);
    expect(reopened.body.status).toBe("IN_PROGRESS");
    expect(reopened.body.approved_version).toBeNull();
    expect(reopened.body.client_approved_at).toBeNull();
    expect(reopened.body.approval_history).toHaveLength(1);
    expect(reopened.body.published_versions[0]).toMatchObject({
      version: 1,
      superseded_reason: "Client sent a missing invoice",
      superseded_by_name: admin.name,
    });
  });

  it("records a pre-TaxSimba submission as verified history", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    const res = await request(app)
      .post(`/api/mtd/periods/${q1.id}/record-prior-submission`)
      .set(bearer(admin))
      .send({
        previous_provider: "Old Accountants Ltd",
        submission_date: "2024-08-01",
        income: 4000,
        expenses: 1000,
      })
      .expect(200);
    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.prior_to_taxsimba).toBe(true);
    expect(res.body.submitted_by_taxsimba).toBe(false);
    expect(res.body.published).toMatchObject({ verified_historical: true, net_profit: 3000 });
    const clientRow = (await periods(caseId, client))[0];
    expect(clientRow.stage_label).toBe("Submitted before joining TaxSimba");
  });

  // ------------------------------------------------------------------ documents
  it("requests a quarter document idempotently and links it to a client task", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    const first = await request(app)
      .post(`/api/mtd/periods/${q1.id}/requests`)
      .set(bearer(accountant))
      .send({ document_type: "Bank statements", note: "April to June" })
      .expect(200);
    expect(first.body.status).toBe("Requested");
    expect(first.body.mtd_period_id).toBe(q1.id);
    const repeat = await request(app)
      .post(`/api/mtd/periods/${q1.id}/requests`)
      .set(bearer(accountant))
      .send({ document_type: "Bank statements" })
      .expect(200);
    expect(repeat.body.id).toBe(first.body.id);

    const tasks = await request(app).get("/api/tasks").set(bearer(client)).expect(200);
    expect(
      tasks.body.filter((t: { name: string }) => t.name === "Quarter 1: Bank statements"),
    ).toHaveLength(1);

    const docs = await request(app)
      .get(`/api/mtd/periods/${q1.id}/documents`)
      .set(bearer(client))
      .expect(200);
    expect(docs.body).toHaveLength(1);
    await request(app)
      .get(`/api/mtd/periods/${q1.id}/documents`)
      .set(bearer(otherClient))
      .expect(403);
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/requests`)
      .set(bearer(client))
      .send({ document_type: "Bank statements" })
      .expect(403);
  });

  it("flags a period awaiting documents in the client and staff views", async () => {
    const caseId = await mtdCase();
    const q1 = (await periods(caseId))[0];
    await request(app)
      .post(`/api/mtd/periods/${q1.id}/requests`)
      .set(bearer(accountant))
      .send({ document_type: "Mileage log" })
      .expect(200);
    // the 2024/25 Q1 deadline has passed, so the delay stays attributed to the client
    const clientRow = (await periods(caseId, client))[0];
    expect(clientRow.stage_label).toBe("Action required — overdue");
    const staffRow = (await periods(caseId))[0];
    expect(staffRow).toMatchObject({
      stage_label: "Overdue — waiting for client",
      next_action_owner: "CLIENT",
      delay_attributed_to: "CLIENT",
      escalated_to_admin: true,
    });
    const adminNotes = await request(app).get("/api/notifications").set(bearer(admin)).expect(200);
    expect(
      adminNotes.body.some((n: { title: string }) => n.title.startsWith("Overdue — waiting")),
    ).toBe(true);
    const workload = await request(app)
      .get("/api/mtd/my-workload")
      .set(bearer(accountant))
      .expect(200);
    expect(workload.body.counts.waiting_for_client).toBeGreaterThan(0);
    expect(workload.body.buckets.needs_my_action.every((i: Period) => i.draft === undefined)).toBe(
      true,
    );
  });

  // ------------------------------------------------------------------ oversight
  it("summarises the year from published quarters only", async () => {
    const { caseId } = await approvedQuarter();
    const summary = await request(app)
      .get(`/api/mtd/cases/${caseId}/year-summary`)
      .set(bearer(client))
      .expect(200);
    expect(summary.body.published_quarters).toBe(1);
    expect(summary.body.totals).toEqual({ income: 10000, expenses: 2500, net_profit: 7500 });
    expect(summary.body.quarters).toHaveLength(4);
    expect(summary.body.quarters[1].income).toBeNull();
    expect(summary.body.empty_message).toBeNull();
  });

  it("gives admin bucketed periods and stats, and keeps them away from clients", async () => {
    const { period } = await approvedQuarter();
    const ready = await request(app)
      .get("/api/mtd/periods?bucket=ready_submission")
      .set(bearer(admin))
      .expect(200);
    expect(ready.body.some((r: Period) => r.id === period.id)).toBe(true);
    expect(ready.body.every((r: Period) => r.status === "APPROVED")).toBe(true);
    const stats = await request(app).get("/api/mtd/stats").set(bearer(admin)).expect(200);
    expect(stats.body.ready_submission).toBeGreaterThan(0);
    expect(stats.body.active_mtd_cases).toBeGreaterThan(0);
    await request(app).get("/api/mtd/stats").set(bearer(client)).expect(403);
    await request(app).get("/api/mtd/periods").set(bearer(accountant)).expect(403);
    await request(app).get("/api/mtd/my-workload").set(bearer(admin)).expect(403);
  });
});
