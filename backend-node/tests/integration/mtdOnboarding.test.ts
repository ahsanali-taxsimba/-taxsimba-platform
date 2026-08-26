/**
 * Mid-year MTD onboarding: the questionnaire captures each earlier quarter's status as an
 * unverified client statement, and only staff turn that into a prior submission or catch-up work.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeUser, TestUser } from "../helpers/app";

interface Answer {
  quarter: number;
  status: string;
  previous_provider: string | null;
  staff_review_status: string;
  staff_outcome: string | null;
  answered_by_name: string;
  confirmed_by_name?: string | null;
  confirmed_by_role?: string | null;
  staff_evidence?: {
    previous_provider: string;
    submission_date: string;
    submission_reference: string | null;
    prepared_by_name: string;
    prepared_by_role: string;
  } | null;
}
interface Quarter {
  period_id: string;
  quarter: number;
  label: string;
  status: string;
  eligible: boolean;
  catch_up_required: boolean;
  prior_to_taxsimba: boolean;
  answer: Answer | null;
}
interface Onboarding {
  case_id: string;
  joined_on: string;
  completed_at: string | null;
  quarters: Quarter[];
}

describe("MTD mid-year onboarding questionnaire", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser;
  let otherClient: TestUser;

  async function newCase(): Promise<string> {
    const res = await request(app)
      .post("/api/cases")
      .set(bearer(client))
      .send({ tax_year: "2024/25", service_type: "MTD_INCOME_TAX" })
      .expect(200);
    const caseId = res.body.id as string;
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    // Generating the schedule is what the client's period view does on first load.
    await request(app).get(`/api/mtd/cases/${caseId}/periods`).set(bearer(client)).expect(200);
    return caseId;
  }

  async function onboarding(caseId: string, as: TestUser = client): Promise<Onboarding> {
    const res = await request(app)
      .get(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(as))
      .expect(200);
    return res.body as Onboarding;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "admin");
    accountant = await makeUser("ACCOUNTANT", "accountant");
    client = await makeUser("CLIENT", "client");
    otherClient = await makeUser("CLIENT", "otherclient");
  });

  afterAll(dropTestDb);

  it("lists the quarters that had already ended when the client joined", async () => {
    const state = await onboarding(await newCase());
    expect(state.quarters).toHaveLength(4);
    expect(state.quarters.every((q) => q.eligible)).toBe(true);
    expect(state.quarters.every((q) => q.answer === null)).toBe(true);
    expect(state.completed_at).toBeNull();
  });

  it("records answers as unverified statements needing staff review", async () => {
    const caseId = await newCase();
    const res = await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({
        answers: [
          {
            quarter: 1,
            status: "SUBMITTED_ELSEWHERE",
            previous_provider: "Previous accountant",
            submission_date: "2024-08-05",
            submission_reference: "PRIOR-Q1",
            income: 9000,
            expenses: 2000,
          },
          { quarter: 2, status: "NOT_SUBMITTED" },
          { quarter: 3, status: "NOT_SURE", note: "Cannot find the paperwork" },
        ],
      })
      .expect(200);
    const state = res.body as Onboarding;
    const q = (n: number) => state.quarters.find((x) => x.quarter === n) as Quarter;

    expect(state.completed_at).not.toBeNull();
    expect(q(1).answer?.staff_review_status).toBe("PENDING_REVIEW");
    // A client saying it was filed must never move the period into a submitted state.
    expect(q(1).status).toBe("NOT_STARTED");
    expect(q(1).prior_to_taxsimba).toBe(false);
    expect(q(2).catch_up_required).toBe(true);
    expect(q(1).catch_up_required).toBe(false);
    expect(q(3).answer?.status).toBe("NOT_SURE");
    expect(q(4).answer).toBeNull();
  });

  it("raises a staff follow-up when the client is not sure", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({ answers: [{ quarter: 2, status: "NOT_SURE" }] })
      .expect(200);
    for (const staff of [admin, accountant]) {
      const res = await request(app).get("/api/notifications").set(bearer(staff)).expect(200);
      const titles = (res.body as { title: string }[]).map((n) => n.title);
      expect(titles.some((t) => t.startsWith("Follow up:") && t.includes("Quarter 2"))).toBe(true);
    }
  });

  it("requires who filed a quarter that is reported as already submitted", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({ answers: [{ quarter: 1, status: "SUBMITTED_ELSEWHERE" }] })
      .expect(400);
  });

  it("keeps the questionnaire scoped to the client's own case", async () => {
    const caseId = await newCase();
    await request(app).get(`/api/mtd/cases/${caseId}/onboarding`).set(bearer(otherClient)).expect(403);
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(otherClient))
      .send({ answers: [{ quarter: 1, status: "NOT_SUBMITTED" }] })
      .expect(403);
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding/quarters/1/review`)
      .set(bearer(client))
      .send({ outcome: "TAXSIMBA_CATCH_UP" })
      .expect(403);
  });

  it("confirms the answer when staff record the quarter as filed before joining", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({
        answers: [
          { quarter: 1, status: "SUBMITTED_ELSEWHERE", previous_provider: "Old Firm" },
          { quarter: 2, status: "NOT_SUBMITTED" },
        ],
      })
      .expect(200);
    const before = await onboarding(caseId);
    const q1 = before.quarters[0];

    await request(app)
      .post(`/api/mtd/periods/${q1.period_id}/record-prior-submission`)
      .set(bearer(admin))
      .send({
        previous_provider: "Old Firm",
        submission_date: "2024-08-05",
        submission_reference: "PRIOR-Q1",
        income: 9000,
        expenses: 2000,
      })
      .expect(200);

    const after = await onboarding(caseId, admin);
    const one = after.quarters[0];
    expect(one.answer?.staff_review_status).toBe("CONFIRMED");
    expect(one.answer?.staff_outcome).toBe("PRIOR_SUBMISSION");
    expect(one.prior_to_taxsimba).toBe(true);
    expect(one.status).toBe("SUBMITTED");
    expect(one.catch_up_required).toBe(false);
    // Quarter 2 stays in the ordinary preparation workflow.
    expect(after.quarters[1].status).toBe("NOT_STARTED");
    expect(after.quarters[1].catch_up_required).toBe(true);
  });

  it("lets staff conclude a catch-up quarter without touching the workflow", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({ answers: [{ quarter: 2, status: "NOT_SURE" }] })
      .expect(200);
    const res = await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding/quarters/2/review`)
      .set(bearer(accountant))
      .send({ outcome: "TAXSIMBA_CATCH_UP", note: "Client confirmed nothing was filed" })
      .expect(200);
    const state = res.body as Onboarding;
    const q2 = state.quarters.find((q) => q.quarter === 2) as Quarter;
    expect(q2.answer?.staff_review_status).toBe("REVIEWED");
    expect(q2.answer?.staff_outcome).toBe("TAXSIMBA_CATCH_UP");
    expect(q2.catch_up_required).toBe(true);
    expect(q2.status).toBe("NOT_STARTED");
  });

  it("lets an accountant enter prior-submission evidence but only an admin confirm it", async () => {
    const caseId = await newCase();
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({ answers: [{ quarter: 1, status: "SUBMITTED_ELSEWHERE", previous_provider: "Old Firm" }] })
      .expect(200);
    const state = await onboarding(caseId);
    const q1 = state.quarters[0];

    const prepared = await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding/quarters/1/evidence`)
      .set(bearer(accountant))
      .send({
        previous_provider: "Old Firm",
        submission_date: "2024-08-05",
        submission_reference: "PRIOR-Q1",
        note: "Confirmation email from the client's previous accountant",
      })
      .expect(200);
    const afterEvidence = (prepared.body as Onboarding).quarters[0];
    expect(afterEvidence.answer?.staff_evidence?.prepared_by_name).toBe(accountant.name);
    expect(afterEvidence.answer?.staff_evidence?.prepared_by_role).toBe("ACCOUNTANT");
    // Entering evidence is a proposal only — the period must not move.
    expect(afterEvidence.status).not.toBe("SUBMITTED");
    expect(afterEvidence.prior_to_taxsimba).toBe(false);

    await request(app)
      .post(`/api/mtd/periods/${q1.period_id}/record-prior-submission`)
      .set(bearer(accountant))
      .send({ previous_provider: "Old Firm", submission_date: "2024-08-05" })
      .expect(403);

    await request(app)
      .post(`/api/mtd/periods/${q1.period_id}/record-prior-submission`)
      .set(bearer(admin))
      .send({ previous_provider: "Old Firm", submission_date: "2024-08-05", submission_reference: "PRIOR-Q1" })
      .expect(200);
    const confirmed = (await onboarding(caseId)).quarters[0];
    expect(confirmed.prior_to_taxsimba).toBe(true);
    expect(confirmed.answer?.confirmed_by_name).toBe(admin.name);
    expect(confirmed.answer?.confirmed_by_role).toBe("ADMIN");
    // Both the accountant who gathered the evidence and the admin who confirmed it stay on record.
    expect(confirmed.answer?.staff_evidence?.prepared_by_name).toBe(accountant.name);

    const activity = await request(app)
      .get(`/api/cases/${caseId}/activity`)
      .set(bearer(admin))
      .expect(200);
    const lines = (activity.body as { action: string }[]).map((a) => a.action);
    expect(lines.some((a) => a.includes("entered for admin review"))).toBe(true);
  });

  it("refuses an answer for a quarter that is already submitted", async () => {
    const caseId = await newCase();
    const state = await onboarding(caseId);
    await request(app)
      .post(`/api/mtd/periods/${state.quarters[0].period_id}/record-prior-submission`)
      .set(bearer(admin))
      .send({ previous_provider: "Old Firm", submission_date: "2024-08-05" })
      .expect(200);
    await request(app)
      .post(`/api/mtd/cases/${caseId}/onboarding`)
      .set(bearer(client))
      .send({ answers: [{ quarter: 1, status: "NOT_SUBMITTED" }] })
      .expect(400);
  });
});
