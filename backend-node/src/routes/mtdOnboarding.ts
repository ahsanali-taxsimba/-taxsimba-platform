/**
 * Mid-year MTD onboarding questionnaire.
 *
 * A client who joins after the tax year has started has quarters that ended before they came to
 * TaxSimba. This captures, quarter by quarter, whether each one was already filed elsewhere, still
 * needs preparing, or is unknown. Nothing here changes a period's workflow state: a client's answer
 * is a statement, not evidence, so a quarter only becomes "submitted before joining TaxSimba" when
 * staff record it through the existing record-prior-submission route.
 */
import { Router } from "express";
import { z } from "zod";

import { col, Doc } from "../db/mongo";
import { MTD, SUBMITTED } from "../domain/mtd";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const mtdOnboardingRouter = Router();

export const ALREADY_SUBMITTED = "SUBMITTED_ELSEWHERE";
export const NEEDS_TAXSIMBA = "NOT_SUBMITTED";
export const UNSURE = "NOT_SURE";

const AnswerIn = z.object({
  quarter: z.number().int().min(1).max(4),
  status: z.enum([ALREADY_SUBMITTED, NEEDS_TAXSIMBA, UNSURE]),
  previous_provider: z.string().nullish().default(null),
  submission_date: z.string().nullish().default(null),
  submission_reference: z.string().nullish().default(null),
  income: z.number().nullish().default(null),
  expenses: z.number().nullish().default(null),
  document_id: z.string().nullish().default(null),
  note: z.string().nullish().default(null),
});
const QuestionnaireIn = z.object({ answers: z.array(AnswerIn).min(1) });
const ReviewIn = z.object({
  outcome: z.enum(["TAXSIMBA_CATCH_UP", "NEEDS_MORE_INFORMATION"]),
  note: z.string().nullish().default(null),
});
const EvidenceIn = z.object({
  previous_provider: z.string().min(1),
  submission_date: z.string().min(1),
  submission_reference: z.string().nullish().default(null),
  income: z.number().nullish().default(null),
  expenses: z.number().nullish().default(null),
  note: z.string().nullish().default(null),
});

const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;

async function onboardingCase(caseId: string, me: Doc): Promise<Doc> {
  const kase = (await col("cases").findOne({ id: caseId })) as Doc | null;
  if (!kase) throw httpError(404, "Case not found");
  if (kase.service_type !== MTD) throw httpError(400, "Not an MTD case");
  if (me.role === "CLIENT" && kase.client_user_id !== me.id) throw httpError(403, "Not your case");
  if (me.role === "ACCOUNTANT" && kase.assigned_accountant_id !== me.id) {
    throw httpError(403, "Case not assigned to you");
  }
  return kase;
}

/** Quarters that had already ended when the client joined — the only ones the questionnaire asks about. */
function joinedOn(kase: Doc): string {
  return String(kase.mtd_joined_on ?? kase.created_at ?? nowIso()).slice(0, 10);
}

async function quarterRows(kase: Doc): Promise<Doc[]> {
  const rows = (await col("mtd_periods")
    .find({ case_id: kase.id, kind: "QUARTER" })
    .limit(20)
    .toArray()) as Doc[];
  return rows.sort((a, b) => Number(a.quarter) - Number(b.quarter));
}

async function record(caseId: string): Promise<Doc | null> {
  return (await col("mtd_onboarding").findOne({ case_id: caseId })) as Doc | null;
}

function view(kase: Doc, rows: Doc[], saved: Doc | null): Doc {
  const joined = joinedOn(kase);
  const answers = (saved?.answers ?? []) as Doc[];
  return {
    case_id: kase.id,
    case_ref: kase.case_ref,
    tax_year: kase.tax_year,
    joined_on: joined,
    completed_at: saved?.completed_at ?? null,
    completed_by_name: saved?.completed_by_name ?? null,
    quarters: rows.map((r) => ({
      period_id: r.id,
      quarter: r.quarter,
      label: r.label,
      period_start: r.period_start,
      period_end: r.period_end,
      deadline: r.deadline,
      status: r.status,
      prior_to_taxsimba: Boolean(r.prior_to_taxsimba),
      catch_up_required: Boolean(r.catch_up_required),
      eligible: String(r.period_end) < joined && r.status !== SUBMITTED,
      answer: answers.find((a) => a.quarter === r.quarter) ?? null,
    })),
  };
}

/** Whoever should look at a client's answers: the assigned accountant plus every active admin. */
async function reviewers(kase: Doc): Promise<string[]> {
  const admins = (await col("users")
    .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true }, { projection: { id: 1 } })
    .toArray()) as Doc[];
  const ids = admins.map((a) => String(a.id));
  if (kase.assigned_accountant_id) ids.push(String(kase.assigned_accountant_id));
  return [...new Set(ids)];
}

mtdOnboardingRouter.get(
  "/cases/:caseId/onboarding",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await onboardingCase(req.params.caseId, me);
    res.json(view(kase, await quarterRows(kase), await record(kase.id)));
  }),
);

mtdOnboardingRouter.post(
  "/cases/:caseId/onboarding",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(QuestionnaireIn, req.body);
    const kase = await onboardingCase(req.params.caseId, me);
    const rows = await quarterRows(kase);
    const joined = joinedOn(kase);

    const seen = new Set<number>();
    for (const answer of body.answers) {
      if (seen.has(answer.quarter)) throw httpError(400, `Quarter ${answer.quarter} was answered twice`);
      seen.add(answer.quarter);
      const row = rows.find((r) => Number(r.quarter) === answer.quarter);
      if (!row) throw httpError(404, `Quarter ${answer.quarter} does not exist on this case`);
      if (String(row.period_end) >= joined) {
        throw httpError(400, `${row.label} had not ended when the client joined`);
      }
      if (row.status === SUBMITTED) {
        throw httpError(400, `${row.label} is already recorded as submitted`);
      }
      if (answer.status === ALREADY_SUBMITTED && !(answer.previous_provider ?? "").trim()) {
        throw httpError(400, `Tell us who filed ${row.label} — the previous accountant or software`);
      }
    }

    const saved = await record(kase.id);
    const existing = ((saved?.answers ?? []) as Doc[]).filter((a) => !seen.has(Number(a.quarter)));
    const stored = body.answers.map((a) => ({
      quarter: a.quarter,
      period_id: rows.find((r) => Number(r.quarter) === a.quarter)?.id ?? null,
      status: a.status,
      previous_provider: (a.previous_provider ?? "").trim() || null,
      submission_date: (a.submission_date ?? "").trim() || null,
      submission_reference: (a.submission_reference ?? "").trim() || null,
      income: a.income ?? null,
      expenses: a.expenses ?? null,
      document_id: a.document_id ?? null,
      note: (a.note ?? "").trim() || null,
      answered_by_name: me.name,
      answered_by_role: me.role,
      answered_at: nowIso(),
      // A client statement is never evidence: staff confirm every answer before anything is recorded.
      staff_review_status: "PENDING_REVIEW",
      staff_outcome: null,
      reviewed_by_name: null,
      reviewed_at: null,
      review_note: null,
    }));
    const answers = [...existing, ...stored].sort((a, b) => Number(a.quarter) - Number(b.quarter));

    await col("mtd_onboarding").updateOne(
      { case_id: kase.id },
      {
        $set: {
          answers,
          completed_at: nowIso(),
          completed_by_name: me.name,
          updated_at: nowIso(),
        },
        $setOnInsert: {
          case_id: kase.id,
          case_ref: kase.case_ref,
          client_user_id: kase.client_user_id,
          created_at: nowIso(),
        },
      },
      { upsert: true },
    );

    const to = await reviewers(kase);
    for (const answer of stored) {
      const row = rows.find((r) => Number(r.quarter) === answer.quarter) as Doc;
      // Only a flag for staff triage — the period stays in its normal workflow either way.
      await col("mtd_periods").updateOne(
        { id: row.id },
        {
          $set: {
            catch_up_required: answer.status === NEEDS_TAXSIMBA,
            onboarding_answer: answer.status,
            onboarding_answered_at: answer.answered_at,
            updated_at: nowIso(),
          },
        },
      );
      const said =
        answer.status === ALREADY_SUBMITTED
          ? `already filed with ${answer.previous_provider}`
          : answer.status === NEEDS_TAXSIMBA
            ? "not filed — TaxSimba to prepare it"
            : "not sure";
      await logActivity(kase.id, `MTD onboarding: ${row.label} reported as ${said}`, me, {
        mtd_period_id: row.id,
        onboarding_answer: answer.status,
        service: "MTD",
      });
      for (const userId of to) {
        await notify(
          userId,
          answer.status === UNSURE
            ? `Follow up: ${row.label} status unclear`
            : `Review onboarding answer: ${row.label}`,
          answer.status === UNSURE
            ? `${kase.case_ref} (${kase.client_name}) is not sure whether ${row.label} was filed. Confirm with the client before preparing or recording it.`
            : `${kase.case_ref} (${kase.client_name}) reported ${row.label} as ${said}. Check the evidence before recording anything.`,
          kase.id,
          `/work/cases/${kase.id}`,
          "REVIEW",
        );
      }
    }
    res.json(view(kase, await quarterRows(kase), await record(kase.id)));
  }),
);

/**
 * Staff conclusion for a quarter that is not a prior submission. Recording a prior submission is
 * the existing record-prior-submission route; this only closes the catch-up and unclear cases.
 */
mtdOnboardingRouter.post(
  "/cases/:caseId/onboarding/quarters/:quarter/review",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ReviewIn, req.body);
    const kase = await onboardingCase(req.params.caseId, me);
    const quarter = Number(req.params.quarter);
    const saved = await record(kase.id);
    const answers = (saved?.answers ?? []) as Doc[];
    const answer = answers.find((a) => Number(a.quarter) === quarter);
    if (!answer) throw httpError(404, "No onboarding answer for that quarter");
    Object.assign(answer, {
      staff_review_status: "REVIEWED",
      staff_outcome: body.outcome,
      reviewed_by_name: me.name,
      reviewed_at: nowIso(),
      review_note: (body.note ?? "").trim() || null,
    });
    await col("mtd_onboarding").updateOne(
      { case_id: kase.id },
      { $set: { answers, updated_at: nowIso() } },
    );
    const rows = await quarterRows(kase);
    const row = rows.find((r) => Number(r.quarter) === quarter);
    if (row) {
      await col("mtd_periods").updateOne(
        { id: row.id },
        {
          $set: {
            catch_up_required: body.outcome === "TAXSIMBA_CATCH_UP",
            updated_at: nowIso(),
          },
        },
      );
      await logActivity(
        kase.id,
        `MTD onboarding: ${row.label} reviewed — ${
          body.outcome === "TAXSIMBA_CATCH_UP"
            ? "TaxSimba to prepare it as catch-up work"
            : "more information needed from the client"
        }`,
        me,
        { mtd_period_id: row.id, onboarding_outcome: body.outcome, service: "MTD" },
        { comments: (body.note ?? "").trim() || null },
      );
    }
    res.json(view(kase, await quarterRows(kase), await record(kase.id)));
  }),
);

/**
 * Evidence an accountant has gathered for a quarter the client says was filed elsewhere. This is a
 * proposal for an admin to check: it never marks the period as submitted, which stays with the
 * ADMIN/SUPER_ADMIN-only record-prior-submission route.
 */
mtdOnboardingRouter.post(
  "/cases/:caseId/onboarding/quarters/:quarter/evidence",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(EvidenceIn, req.body);
    const kase = await onboardingCase(req.params.caseId, me);
    const quarter = Number(req.params.quarter);
    const rows = await quarterRows(kase);
    const row = rows.find((r) => Number(r.quarter) === quarter);
    if (!row) throw httpError(404, "Quarter not found");
    if (row.status === SUBMITTED) throw httpError(400, `${row.label} is already submitted`);

    const saved = await record(kase.id);
    const answers = (saved?.answers ?? []) as Doc[];
    let answer = answers.find((a) => Number(a.quarter) === quarter);
    if (!answer) {
      answer = { quarter, status: ALREADY_SUBMITTED, staff_review_status: "PENDING_REVIEW" };
      answers.push(answer);
    }
    const evidence = {
      previous_provider: body.previous_provider.trim(),
      submission_date: body.submission_date.trim(),
      submission_reference: (body.submission_reference ?? "").trim() || null,
      income: body.income ?? null,
      expenses: body.expenses ?? null,
      note: (body.note ?? "").trim() || null,
      prepared_by_name: me.name,
      prepared_by_role: me.role,
      prepared_at: nowIso(),
    };
    Object.assign(answer, { staff_evidence: evidence, staff_review_status: "PENDING_REVIEW" });
    await col("mtd_onboarding").updateOne(
      { case_id: kase.id },
      {
        $set: { answers, updated_at: nowIso() },
        $setOnInsert: { case_id: kase.id, created_at: nowIso() },
      },
      { upsert: true },
    );
    await logActivity(
      kase.id,
      `MTD onboarding: previous submission details for ${row.label} entered for admin review (${evidence.previous_provider})`,
      me,
      { mtd_period_id: row.id, service: "MTD" },
      { comments: evidence.note },
    );
    for (const userId of await reviewers(kase)) {
      if (userId === me.id) continue;
      await notify(
        userId,
        `Check previous submission details: ${row.label}`,
        `${me.name} entered previous submission details for ${row.label} on ${kase.case_ref} (${kase.client_name}). An admin must check the evidence before recording it.`,
        kase.id,
        `/work/cases/${kase.id}`,
        "REVIEW",
      );
    }
    res.json(view(kase, rows, await record(kase.id)));
  }),
);

/** Closes the questionnaire loop once staff record a quarter as filed before joining. */
export async function confirmPriorAnswer(kase: Doc, row: Doc, me: Doc): Promise<void> {
  const saved = await record(kase.id);
  if (!saved) return;
  const answers = (saved.answers ?? []) as Doc[];
  const answer = answers.find((a) => Number(a.quarter) === Number(row.quarter));
  if (!answer) return;
  Object.assign(answer, {
    staff_review_status: "CONFIRMED",
    staff_outcome: "PRIOR_SUBMISSION",
    reviewed_by_name: me.name,
    reviewed_at: nowIso(),
    confirmed_by_name: me.name,
    confirmed_by_role: me.role,
    confirmed_at: nowIso(),
  });
  await col("mtd_onboarding").updateOne(
    { case_id: kase.id },
    { $set: { answers, updated_at: nowIso() } },
  );
  // Filed before joining, so there is nothing for TaxSimba to catch up on or charge for.
  await col("mtd_periods").updateOne({ id: row.id }, { $set: { catch_up_required: false } });
}
