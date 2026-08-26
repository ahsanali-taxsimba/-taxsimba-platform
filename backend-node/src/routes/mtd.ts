/** MTD for Income Tax routes — mounted under /api/mtd, separate from the SA workflow. */
import { randomUUID } from "crypto";

import { Request, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import {
  ADMIN_REVIEW,
  advance,
  APPROVED,
  AWAITING_CLIENT,
  decorate,
  DISCLAIMER,
  ensurePeriods,
  IN_PROGRESS,
  MTD,
  NOT_STARTED,
  round2,
  STAFF_STAGE_LABEL,
  SUBMITTED,
  clientStage,
} from "../domain/mtd";
import { OPERATIONAL_ONLY } from "../domain/testdata";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const mtdRouter = Router();

const FiguresIn = z.object({
  income: z.number(),
  expenses: z.number(),
  net_profit: z.number().nullish().default(null),
  estimated_income_tax: z.number().nullish().default(null),
  estimated_national_insurance: z.number().nullish().default(null),
  suggested_set_aside: z.number().nullish().default(null),
  client_note: z.string().nullish().default(null),
});
const ReasonIn = z.object({ reason: z.string() });
const QuarterRequestIn = z.object({
  document_type: z.string(),
  note: z.string().nullish().default(null),
  due_date: z.string().nullish().default(null),
});
const SubmissionIn = z.object({
  submission_reference: z.string(),
  submission_date: z.string(),
  provider: z.string().nullish().default(null),
  outcome: z.string().nullish().default(null),
  note: z.string().nullish().default(null),
});
const PriorSubmissionIn = z.object({
  previous_provider: z.string(),
  submission_date: z.string(),
  submission_reference: z.string().nullish().default(null),
  income: z.number().nullish().default(null),
  expenses: z.number().nullish().default(null),
  net_profit: z.number().nullish().default(null),
  note: z.string().nullish().default(null),
});
const ClientApproveIn = z.object({ version: z.number() });

const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;

async function mtdCase(caseId: string, user: Doc): Promise<Doc> {
  const kase = (await col("cases").findOne({ id: caseId })) as Doc | null;
  if (!kase) throw httpError(404, "Case not found");
  if (kase.service_type !== MTD) throw httpError(400, "Not an MTD case");
  if (user.role === "CLIENT" && kase.client_user_id !== user.id) {
    throw httpError(403, "Not your case");
  }
  if (user.role === "ACCOUNTANT" && kase.assigned_accountant_id !== user.id) {
    throw httpError(403, "Case not assigned to you");
  }
  return clean(kase) as Doc;
}

async function period(periodId: string, user: Doc): Promise<[Doc, Doc]> {
  const row = (await col("mtd_periods").findOne({ id: periodId })) as Doc | null;
  if (!row) throw httpError(404, "Period not found");
  const kase = await mtdCase(row.case_id, user);
  return [clean(row) as Doc, kase];
}

/** Period ids that still have an outstanding document request against them. */
async function waitingPeriodIds(filter: Doc = {}): Promise<Set<string>> {
  const rows = await col("documents")
    .find({ ...filter, status: "Requested", mtd_period_id: { $ne: null } }, {
      projection: { mtd_period_id: 1 },
    })
    .toArray();
  return new Set(rows.map((d) => d.mtd_period_id as string));
}

function draftFrom(body: z.infer<typeof FiguresIn>, user: Doc): Doc {
  // Net profit is derived from income minus expenses unless the accountant overrides it.
  // Tax and NI are never calculated -- they are only whatever the accountant typed in.
  return {
    income: round2(body.income),
    expenses: round2(body.expenses),
    net_profit: round2(body.net_profit ?? body.income - body.expenses),
    estimated_income_tax: body.estimated_income_tax == null ? null : round2(body.estimated_income_tax),
    estimated_national_insurance:
      body.estimated_national_insurance == null ? null : round2(body.estimated_national_insurance),
    suggested_set_aside: body.suggested_set_aside == null ? null : round2(body.suggested_set_aside),
    client_note: (body.client_note ?? "").trim() || null,
    prepared_by_name: user.name,
  };
}

function boolQuery(req: Request, name: string): boolean {
  const v = req.query[name];
  return typeof v === "string" && ["1", "true", "yes"].includes(v.toLowerCase());
}

// ------------------------------------------------------------------ read
mtdRouter.get(
  "/cases/:caseId/periods",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = req.params.caseId;
    const kase = await mtdCase(caseId, me);
    let rows = (await col("mtd_periods").find({ case_id: caseId }).limit(20).toArray()) as Doc[];
    if (!rows.length) {
      await ensurePeriods(kase);
      rows = (await col("mtd_periods").find({ case_id: caseId }).limit(20).toArray()) as Doc[];
    }
    rows = cleanMany(rows);
    rows.sort(
      (a, b) =>
        Number(a.kind === "FINAL_DECLARATION") - Number(b.kind === "FINAL_DECLARATION") ||
        (a.quarter ?? 0) - (b.quarter ?? 0),
    );
    const openRequests = await waitingPeriodIds({ case_id: caseId });
    const out = rows.map((r) => decorate(r, me, kase, openRequests.has(r.id)));
    const escalated = out.filter((r) => r.overdue_waiting_for_client);
    if (escalated.length) {
      // Visible escalation for oversight; notify() collapses repeats so one genuine
      // overdue period produces one standing admin alert.
      const admins = await col("users")
        .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true }, {
          projection: { id: 1 },
        })
        .toArray();
      for (const r of escalated) {
        for (const admin of admins) {
          await notify(
            admin.id as string,
            `Overdue — waiting for client: ${r.label}`,
            `${kase.case_ref} (${kase.client_name}) — deadline ${r.deadline} passed with records still outstanding.`,
            caseId,
            "/admin/mtd?bucket=overdue_waiting_client",
            "DEADLINE",
          );
        }
      }
    }
    if (me.role === "CLIENT") {
      // One genuine in-app reminder per outstanding approval; notify() collapses repeats.
      for (const r of out) {
        if (r.status === AWAITING_CLIENT && (r.days_to_deadline ?? 99) <= 14) {
          await notify(
            me.id,
            `Action needed: approve your ${r.label}`,
            `Due ${r.deadline}. Please review and approve the figures.`,
            caseId,
            "/mtd",
            "REVIEW",
          );
        }
      }
    }
    res.json(out);
  }),
);

mtdRouter.get(
  "/periods",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const bucket = typeof req.query.bucket === "string" ? req.query.bucket : undefined;
    const query: Doc = boolQuery(req, "include_test") ? {} : { ...OPERATIONAL_ONLY };
    const buckets: Record<string, Doc> = {
      not_started: { status: NOT_STARTED },
      preparing: { status: IN_PROGRESS },
      admin_review: { status: ADMIN_REVIEW },
      client_action: { status: AWAITING_CLIENT },
      ready_submission: { status: APPROVED },
      submitted: { status: SUBMITTED },
    };
    if (bucket && buckets[bucket]) Object.assign(query, buckets[bucket]);
    const rows = cleanMany(
      (await col("mtd_periods").find(query).sort({ deadline: 1 }).limit(500).toArray()) as Doc[],
    );
    const waiting = await waitingPeriodIds();
    const cases = new Map<string, Doc>();
    for (const c of await col("cases")
      .find({ service_type: MTD }, {
        projection: { id: 1, assigned_accountant_name: 1, assigned_accountant_id: 1 },
      })
      .toArray()) {
      cases.set(c.id as string, c as Doc);
    }
    let out: Doc[] = rows.map((r) => {
      const kase = cases.get(r.case_id) ?? {};
      return {
        ...decorate(r, me, kase, waiting.has(r.id)),
        assigned_accountant_name: kase.assigned_accountant_name ?? null,
        assigned_accountant_id: kase.assigned_accountant_id ?? null,
      };
    });
    if (bucket === "due_14") {
      out = out.filter((r) => ["DUE_14", "DUE_7", "DUE_3"].includes(r.deadline_warning));
    } else if (bucket === "overdue") out = out.filter((r) => r.deadline_warning === "OVERDUE");
    else if (bucket === "overdue_waiting_client") {
      out = out.filter((r) => r.overdue_waiting_for_client);
    } else if (bucket === "final_declaration") {
      out = out.filter((r) => r.kind === "FINAL_DECLARATION");
    } else if (bucket === "waiting_for_client") out = out.filter((r) => waiting.has(r.id));
    res.json(out);
  }),
);

/** Operational MTD counts. Test/QA data is excluded by default, like every other view. */
mtdRouter.get(
  "/stats",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const rows = cleanMany(
      (await col("mtd_periods").find({ ...OPERATIONAL_ONLY }).limit(2000).toArray()) as Doc[],
    );
    const activeCases = new Set(
      (
        await col("cases")
          .find({ service_type: MTD, ...OPERATIONAL_ONLY }, { projection: { id: 1 } })
          .toArray()
      ).map((c) => c.id as string),
    );
    const waiting = await waitingPeriodIds({ case_id: { $in: [...activeCases] } });
    const decorated = rows.map((r) => decorate(r, me, null, waiting.has(r.id)));
    const count = (fn: (r: Doc) => boolean, source: Doc[] = rows) => source.filter(fn).length;
    res.json({
      waiting_for_client: count((r) => waiting.has(r.id)),
      overdue_waiting_client: count((r) => r.overdue_waiting_for_client, decorated),
      active_mtd_clients: new Set(
        rows.filter((r) => activeCases.has(r.case_id)).map((r) => r.client_id),
      ).size,
      active_mtd_cases: activeCases.size,
      not_started: count((r) => r.status === NOT_STARTED),
      preparing: count((r) => r.status === IN_PROGRESS),
      admin_review: count((r) => r.status === ADMIN_REVIEW),
      client_action: count((r) => r.status === AWAITING_CLIENT),
      ready_submission: count((r) => r.status === APPROVED),
      submitted: count((r) => r.status === SUBMITTED),
      due_14: count((r) => ["DUE_14", "DUE_7", "DUE_3"].includes(r.deadline_warning), decorated),
      final_declarations: count(
        (r) => r.kind === "FINAL_DECLARATION" && r.status !== SUBMITTED,
      ),
      overdue: count((r) => r.deadline_warning === "OVERDUE", decorated),
    });
  }),
);

mtdRouter.get(
  "/periods/:periodId/documents",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await period(req.params.periodId, me);
    const query: Doc = { mtd_period_id: req.params.periodId, is_deleted: { $ne: true } };
    if (me.role === "CLIENT") query.is_internal = false;
    const rows = (await col("documents")
      .find(query)
      .sort({ created_at: -1 })
      .limit(200)
      .toArray()) as Doc[];
    res.json(cleanMany(rows));
  }),
);

/**
 * Requests one specific document for one specific quarter. Reuses the existing document
 * request architecture; the MTD case workflow status is deliberately not touched.
 */
mtdRouter.post(
  "/periods/:periodId/requests",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(QuarterRequestIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if (!body.document_type.trim()) throw httpError(400, "A document type is required");
    const title = body.document_type.trim();
    const taskName = `${row.label}: ${title}`;
    // Idempotency: a repeated request for the same still-open item reuses the existing records.
    const existingTask = (await col("tasks").findOne({
      case_id: kase.id,
      name: taskName,
      owner_role: "CLIENT",
      status: "OPEN",
    })) as Doc | null;
    if (existingTask) {
      const placeholder = (await col("documents").findOne({
        task_id: existingTask.id,
        status: "Requested",
      })) as Doc | null;
      if (placeholder) {
        res.json(clean(placeholder));
        return;
      }
    }
    const reqId = randomUUID();
    const taskId = existingTask ? (existingTask.id as string) : randomUUID();
    if (!existingTask) {
      // Client-facing task so the request appears in the client's action list, as SA does.
      await col("tasks").insertOne({
        id: taskId,
        case_id: kase.id,
        case_ref: kase.case_ref,
        name: taskName,
        description: body.note,
        owner_role: "CLIENT",
        owner_id: kase.client_user_id,
        due_date: body.due_date,
        status: "OPEN",
        mandatory: false,
        mtd_period_id: req.params.periodId,
        mtd_period_label: row.label,
        created_by: me.id,
        created_by_name: me.name,
        created_at: nowIso(),
        completed_date: null,
        request_id: reqId,
      });
    }
    await col("document_requests").insertOne({
      id: reqId,
      case_id: kase.id,
      client_user_id: kase.client_user_id,
      title,
      description: body.note,
      task_id: taskId,
      mtd_period_id: req.params.periodId,
      mtd_period_label: row.label,
      status: "Requested",
      requested_by: me.id,
      requested_by_name: me.name,
      due_date: body.due_date,
      created_at: nowIso(),
    });
    const placeholder: Doc = {
      id: randomUUID(),
      case_id: kase.id,
      client_user_id: kase.client_user_id,
      tax_year: kase.tax_year,
      document_type: title,
      name: title,
      status: "Requested",
      request_id: reqId,
      task_id: taskId,
      mtd_period_id: req.params.periodId,
      mtd_period_label: row.label,
      note: body.note,
      due_date: body.due_date,
      requested_by_name: me.name,
      requested_at: nowIso(),
      storage_path: null,
      uploader_id: null,
      uploader_name: null,
      content_type: null,
      size: 0,
      is_internal: false,
      is_deleted: false,
      created_at: nowIso(),
      upload_date: null,
    };
    await col("documents").insertOne({ ...placeholder });
    await logActivity(
      kase.id,
      `MTD ${row.label}: document requested from client (${title})`,
      me,
      { mtd_period_id: req.params.periodId, service: "MTD" },
    );
    await notify(
      kase.client_user_id,
      `Document requested for ${row.label}`,
      title,
      kase.id,
      "/mtd",
      "UPLOAD",
    );
    res.json(clean(placeholder));
  }),
);

/**
 * MTD-only workload for the signed-in accountant. Kept entirely separate from the Self
 * Assessment workload counters.
 */
mtdRouter.get(
  "/my-workload",
  auth("ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    const cases = new Map<string, Doc>();
    for (const c of await col("cases")
      .find({ service_type: MTD, assigned_accountant_id: me.id, ...OPERATIONAL_ONLY })
      .toArray()) {
      cases.set(c.id as string, c as Doc);
    }
    const caseIds = [...cases.keys()];
    const rows = caseIds.length
      ? cleanMany(
          (await col("mtd_periods")
            .find({ case_id: { $in: caseIds } })
            .sort({ deadline: 1 })
            .limit(500)
            .toArray()) as Doc[],
        )
      : [];
    const waiting = caseIds.length
      ? await waitingPeriodIds({ case_id: { $in: caseIds } })
      : new Set<string>();
    const items = rows.map((r) => {
      const item = decorate(r, me, cases.get(r.case_id) ?? {}, waiting.has(r.id));
      delete item.draft;
      return item;
    });
    const buckets: Record<string, Doc[]> = {
      needs_my_action: items.filter((i) => i.next_action_owner === "ACCOUNTANT"),
      awaiting_admin_review: items.filter((i) => i.status === ADMIN_REVIEW),
      awaiting_client_approval: items.filter((i) => i.status === AWAITING_CLIENT),
      ready_submission: items.filter((i) => i.status === APPROVED),
      submitted: items.filter((i) => i.status === SUBMITTED),
      due_14: items.filter((i) => ["DUE_14", "DUE_7", "DUE_3"].includes(i.deadline_warning)),
      overdue: items.filter((i) => i.deadline_warning === "OVERDUE"),
      overdue_waiting_client: items.filter((i) => i.overdue_waiting_for_client),
      waiting_for_client: items.filter((i) => waiting.has(i.id)),
    };
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(buckets)) counts[k] = v.length;
    res.json({ counts, buckets });
  }),
);

/**
 * Year-to-date totals from PUBLISHED accountant-entered quarter figures only. Drafts are
 * never included and no tax or NI is ever calculated here.
 */
mtdRouter.get(
  "/cases/:caseId/year-summary",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await mtdCase(req.params.caseId, me);
    const rows = cleanMany(
      (await col("mtd_periods").find({ case_id: req.params.caseId }).limit(20).toArray()) as Doc[],
    );
    const quarters = rows
      .filter((r) => r.kind === "QUARTER")
      .sort((a, b) => (a.quarter ?? 0) - (b.quarter ?? 0));
    const totals: Record<string, number> = { income: 0, expenses: 0, net_profit: 0 };
    let publishedCount = 0;
    const out = quarters.map((r) => {
      const pub = r.published as Doc | null;
      if (pub) {
        publishedCount += 1;
        for (const k of Object.keys(totals)) totals[k] += Number(pub[k] ?? 0);
      }
      return {
        quarter: r.quarter,
        label: r.label,
        period_start: r.period_start,
        period_end: r.period_end,
        deadline: r.deadline,
        stage_label:
          me.role === "CLIENT" ? clientStage(r, kase, false) : STAFF_STAGE_LABEL[r.status],
        status: r.status,
        prior_to_taxsimba: Boolean(r.prior_to_taxsimba),
        income: pub ? pub.income : null,
        expenses: pub ? pub.expenses : null,
        net_profit: pub ? pub.net_profit : null,
      };
    });
    res.json({
      tax_year: kase.tax_year,
      case_ref: kase.case_ref,
      quarters: out,
      published_quarters: publishedCount,
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round2(v)])),
      empty_message: publishedCount ? null : "No quarterly figures published yet.",
      note:
        "Year-to-date totals of the figures your accountant has prepared and published so " +
        "far. This is accountant-prepared information, not your final tax liability.",
    });
  }),
);

/**
 * Mid-year onboarding: a quarter filed elsewhere before the client joined TaxSimba.
 * Recorded as verified history — TaxSimba never claims it made this submission.
 */
mtdRouter.post(
  "/periods/:periodId/record-prior-submission",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(PriorSubmissionIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status === SUBMITTED) throw httpError(400, "This period is already submitted and locked");
    if (!body.previous_provider.trim() || !body.submission_date.trim()) {
      throw httpError(400, "The previous provider and submission date are required");
    }
    let verified: Doc | null = null;
    if (body.income != null && body.expenses != null) {
      verified = {
        income: round2(body.income),
        expenses: round2(body.expenses),
        net_profit: round2(body.net_profit ?? body.income - body.expenses),
        estimated_income_tax: null,
        estimated_national_insurance: null,
        suggested_set_aside: null,
        client_note: `Filed by ${body.previous_provider.trim()} before joining TaxSimba.`,
        prepared_by_name: body.previous_provider.trim(),
        verified_historical: true,
        version: 1,
        published_at: nowIso(),
        published_by_name: me.name,
      };
    }
    const extra: Doc = {
      prior_to_taxsimba: true,
      submitted_by_taxsimba: false,
      previous_provider: body.previous_provider.trim(),
      submission_reference: (body.submission_reference ?? "").trim() || null,
      submission_date: body.submission_date.trim(),
      submitted_by_name: null,
      submitted_at: null,
      verified_by_name: me.name,
      verified_at: nowIso(),
    };
    if (verified) {
      extra.published = verified;
      extra.published_version = 1;
      extra.published_versions = [verified];
    }
    res.json(
      await advance(
        row,
        kase,
        SUBMITTED,
        `recorded as submitted before joining TaxSimba (${body.previous_provider.trim()})`,
        me,
        extra,
        body.note ?? null,
      ),
    );
  }),
);

mtdRouter.post(
  "/cases/:caseId/generate-periods",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const kase = await mtdCase(req.params.caseId, me);
    const created = await ensurePeriods(kase);
    if (created) await logActivity(req.params.caseId, `MTD schedule generated (${created} periods)`, me);
    res.json({ created });
  }),
);

// ------------------------------------------------------------------ accountant preparation
mtdRouter.post(
  "/periods/:periodId/figures",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(FiguresIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if ([ADMIN_REVIEW, AWAITING_CLIENT, APPROVED, SUBMITTED].includes(row.status)) {
      throw httpError(
        400,
        "Figures are locked while this period is under review, awaiting the client or already submitted",
      );
    }
    if (body.income < 0 || body.expenses < 0) throw httpError(400, "Figures cannot be negative");
    res.json(
      await advance(row, kase, IN_PROGRESS, "draft figures saved", me, {
        draft: draftFrom(body, me),
        draft_saved_by: me.name,
        draft_saved_at: nowIso(),
        changes_reason: null,
      }),
    );
  }),
);

/** Exactly what the client would see if this draft were published. Staff only. */
mtdRouter.get(
  "/periods/:periodId/preview",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const [row] = await period(req.params.periodId, me);
    if (!row.draft) throw httpError(400, "Enter the figures first");
    res.json({
      label: row.label,
      period_start: row.period_start,
      period_end: row.period_end,
      deadline: row.deadline,
      version: row.published_version + 1,
      disclaimer: DISCLAIMER,
      ...row.draft,
    });
  }),
);

mtdRouter.post(
  "/periods/:periodId/submit-for-review",
  auth(...STAFF),
  handler(async (req, res) => {
    const me = authed(req);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status !== IN_PROGRESS || !row.draft) throw httpError(400, "Enter the figures first");
    const out = await advance(
      row,
      kase,
      ADMIN_REVIEW,
      "published to client for release — sent for admin review",
      me,
    );
    for (const admin of await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true })
      .toArray()) {
      await notify(
        admin.id as string,
        "MTD period ready for review",
        `${kase.client_name} — ${kase.case_ref} ${row.label}`,
        kase.id,
        `/admin/cases/${kase.id}`,
        "REVIEW",
      );
    }
    res.json(out);
  }),
);

// ------------------------------------------------------------------ admin review and release
/** Publishes a new immutable version to the client. Publishing does NOT submit the period. */
mtdRouter.post(
  "/periods/:periodId/admin-approve",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status !== ADMIN_REVIEW) throw httpError(400, "This period is not awaiting admin review");
    if (!row.draft) throw httpError(400, "There are no prepared figures to publish");
    const version = row.published_version + 1;
    const snapshot = {
      ...row.draft,
      version,
      published_by_name: me.name,
      published_at: nowIso(),
    };
    const history = [...((row.published_versions as Doc[]) ?? []), snapshot];
    const out = await advance(
      row,
      kase,
      AWAITING_CLIENT,
      `figures published to client (version ${version})`,
      me,
      {
        published: snapshot,
        published_version: version,
        published_versions: history,
        client_approved_at: null,
        approved_version: null,
        approved_snapshot: null,
      },
    );
    await notify(
      kase.client_user_id,
      `MTD ${row.label} ready to approve`,
      `Your ${String(row.label).toLowerCase()} figures have been published for approval.`,
      kase.id,
      "/mtd",
      "REVIEW",
    );
    res.json(out);
  }),
);

mtdRouter.post(
  "/periods/:periodId/request-changes",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ReasonIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if (![ADMIN_REVIEW, AWAITING_CLIENT].includes(row.status)) {
      throw httpError(400, "Nothing to return at this stage");
    }
    if (!body.reason.trim()) throw httpError(400, "A reason is required");
    const out = await advance(
      row,
      kase,
      IN_PROGRESS,
      "returned for changes",
      me,
      { changes_reason: body.reason.trim() },
      body.reason,
    );
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "MTD changes required",
        `${kase.case_ref} ${row.label}: ${body.reason}`,
        kase.id,
        `/work/cases/${kase.id}`,
        "CHANGES",
      );
    }
    res.json(out);
  }),
);

mtdRouter.post(
  "/periods/:periodId/client-approve",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status !== AWAITING_CLIENT) throw httpError(400, "This period is not awaiting your approval");
    const hasBody = req.body && Object.keys(req.body as Doc).length > 0;
    if (hasBody) {
      const body = parseBody(ClientApproveIn, req.body);
      if (body.version !== row.published_version) {
        throw httpError(
          409,
          "These figures have been updated since you opened them. Please refresh and review the latest version.",
        );
      }
    }
    const out = await advance(row, kase, APPROVED, "approved by the client", me, {
      client_approved_at: nowIso(),
      approved_version: row.published_version,
      approved_snapshot: row.published,
    });
    for (const admin of await col("users")
      .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, is_active: true })
      .toArray()) {
      await notify(
        admin.id as string,
        "MTD period approved by client",
        `${kase.client_name} — ${kase.case_ref} ${row.label}`,
        kase.id,
        `/admin/cases/${kase.id}`,
        "SUBMISSION",
      );
    }
    res.json(out);
  }),
);

/**
 * Reopens a client-approved quarter for correction. A quarter that has already been recorded
 * as externally submitted stays locked. Nothing is deleted or overwritten.
 */
mtdRouter.post(
  "/periods/:periodId/reopen",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(ReasonIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status === SUBMITTED) {
      throw httpError(
        400,
        "This period has already been submitted externally and is locked. A separate correction process is required.",
      );
    }
    if (row.status !== APPROVED) {
      throw httpError(400, "Only a quarter the client has approved can be reopened for correction");
    }
    if (!body.reason.trim()) throw httpError(400, "A reason is required");
    // The published version and the approval that superseded it are kept as evidence.
    const history = ((row.published_versions as Doc[]) ?? []).map((v) =>
      v.version === row.approved_version
        ? {
            ...v,
            superseded_at: nowIso(),
            superseded_reason: body.reason.trim(),
            superseded_by_name: me.name,
            client_approved_at: row.client_approved_at,
          }
        : v,
    );
    const approvals = [
      ...((row.approval_history as Doc[]) ?? []),
      {
        version: row.approved_version,
        approved_at: row.client_approved_at,
        snapshot: row.approved_snapshot,
        reopened_at: nowIso(),
        reopened_by_name: me.name,
        reopened_by_role: me.role,
        reason: body.reason.trim(),
      },
    ];
    const out = await advance(
      row,
      kase,
      IN_PROGRESS,
      `reopened for correction (approved version ${row.approved_version} superseded)`,
      me,
      {
        published_versions: history,
        approval_history: approvals,
        approved_version: null,
        approved_snapshot: null,
        client_approved_at: null,
        changes_reason: body.reason.trim(),
        reopened_by_name: me.name,
        reopened_at: nowIso(),
      },
      body.reason,
    );
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "MTD period reopened for correction",
        `${kase.case_ref} ${row.label}: ${body.reason}`,
        kase.id,
        `/work/cases/${kase.id}`,
        "CHANGES",
      );
    }
    await notify(
      kase.client_user_id,
      `MTD ${row.label} being corrected`,
      "Your accountant is making a correction. Updated figures will be sent to you for approval.",
      kase.id,
      "/mtd",
      "INFO",
    );
    res.json(out);
  }),
);

/** The accountant files externally with approved software; TaxSimba records the outcome. */
mtdRouter.post(
  "/periods/:periodId/record-submission",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(SubmissionIn, req.body);
    const [row, kase] = await period(req.params.periodId, me);
    if (row.status === SUBMITTED) throw httpError(400, "This period is already submitted and locked");
    if (row.status !== APPROVED) {
      throw httpError(400, "Client approval is required before a submission can be recorded");
    }
    if (!body.submission_reference.trim() || !body.submission_date.trim()) {
      throw httpError(400, "A submission reference and date are required");
    }
    const out = await advance(
      row,
      kase,
      SUBMITTED,
      `submission recorded (ref ${body.submission_reference.trim()})`,
      me,
      {
        submission_reference: body.submission_reference.trim(),
        submission_date: body.submission_date.trim(),
        submission_provider: body.provider,
        submission_outcome: body.outcome,
        submitted_by_name: me.name,
        submitted_at: nowIso(),
      },
      body.note ?? null,
    );
    await notify(
      kase.client_user_id,
      `MTD ${row.label} submitted`,
      `Submission reference ${body.submission_reference.trim()}`,
      kase.id,
      "/mtd",
      "SUBMISSION",
    );
    res.json(out);
  }),
);
