/**
 * Phase 1B — multi-service client accounts, package upgrades, MTD recommendations, payments.
 *
 * Extends the existing Phase 1 architecture; nothing here replaces Self Assessment workflow.
 */
import { randomUUID } from "crypto";

import { clean, col, Doc, update } from "../db/mongo";
import { ensurePeriods } from "./mtd";
import { applyDuePriceSchedules } from "./pricing";
import { deadlineForTaxYear, logActivity, notify, nowIso, STATUS_META } from "./workflow";
import { httpError } from "../http/errors";
import {
  bootstrapClientServices,
  MTD,
  SELF_ASSESSMENT,
  SERVICE_LABELS,
} from "../services/clientServices";

export { MTD, SELF_ASSESSMENT, SERVICE_LABELS };

export const DEFAULT_PACKAGES: Doc[] = [
  {
    service_type: SELF_ASSESSMENT,
    code: "SIMPLE",
    name: "Simple",
    price: 119.0,
    rank: 1,
    billing_frequency: "Per tax year",
  },
  {
    service_type: SELF_ASSESSMENT,
    code: "SMART",
    name: "Smart",
    price: 149.0,
    rank: 2,
    billing_frequency: "Per tax year",
  },
  {
    service_type: SELF_ASSESSMENT,
    code: "ELITE",
    name: "Elite",
    price: 249.0,
    rank: 3,
    billing_frequency: "Per tax year",
  },
  {
    service_type: MTD,
    code: "MTD_ESSENTIAL",
    name: "MTD Essential",
    price: 240.0,
    rank: 1,
    billing_frequency: "Quarterly billing",
  },
  {
    service_type: MTD,
    code: "MTD_PLUS",
    name: "MTD Plus",
    price: 360.0,
    rank: 2,
    billing_frequency: "Quarterly billing",
  },
];

// Configurable late-stage lock: client-initiated package changes are disabled from these statuses.
export const DEFAULT_LOCK_STATUSES = [
  "READY_FOR_ADMIN_REVIEW",
  "ADMIN_REVIEW",
  "ADMIN_APPROVED",
  "AWAITING_CLIENT_APPROVAL",
  "CLIENT_APPROVED",
  "READY_FOR_SUBMISSION",
  "SUBMISSION_IN_PROGRESS",
  "SUBMITTED",
  "SUBMISSION_ISSUE",
  "COMPLETED",
];

const ACTIVATION_TAX_YEAR: Record<string, string> = {
  [SELF_ASSESSMENT]: "2025/26",
  [MTD]: "2026/27",
};

export async function notifyAdmins(
  title: string,
  body: string,
  caseId: string | null = null,
  link = "/admin/recommendations",
  ntype = "INFO",
): Promise<void> {
  for (const admin of await col("users")
    .find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } })
    .toArray()) {
    await notify(admin.id as string, title, body, caseId, link, ntype);
  }
}

/** Unique case reference per service, derived from the highest reference ever issued. */
async function nextServiceCaseRef(serviceType: string): Promise<string> {
  const [prefix, base, counterId] =
    serviceType === SELF_ASSESSMENT
      ? ["SA", 1000, "case_ref"]
      : ["MTD", 2000, "case_ref_mtd"];
  for (;;) {
    const counter = (await col("counters").findOneAndUpdate(
      { id: counterId },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    )) as Doc | null;
    const seq: number = counter?.value ?? 1;
    if (seq <= (base as number)) {
      let highest = base as number;
      const rows = await col("cases")
        .find({ case_ref: { $regex: `^${prefix}-\\d+$` } }, { projection: { case_ref: 1 } })
        .toArray();
      for (const row of rows) {
        const parsed = parseInt(String(row.case_ref).split("-")[1], 10);
        if (!Number.isNaN(parsed)) highest = Math.max(highest, parsed);
      }
      await col("counters").updateOne({ id: counterId }, { $set: { value: highest } }, { upsert: true });
      continue;
    }
    const ref = `${prefix}-${seq}`;
    if (!(await col("cases").findOne({ case_ref: ref }))) return ref;
  }
}

export interface ActivationResult {
  case: Doc;
  created_case: boolean;
  periods_created: number;
  already_active: boolean;
}

/**
 * Single source of truth for service activation. Idempotent: repeat payment/webhook
 * processing can never duplicate a client_service, case or MTD period.
 */
export async function activateService(
  client: Doc,
  user: Doc | null,
  serviceType: string,
  packageCode: string,
  opts: { reason?: string; paymentSession?: string | null; amount?: number | null } = {},
): Promise<ActivationResult> {
  if (![SELF_ASSESSMENT, MTD].includes(serviceType)) throw httpError(400, "Unknown service type");
  const reason = opts.reason ?? "Service activation";
  const paymentSession = opts.paymentSession ?? null;
  const amount = opts.amount ?? null;
  const actor = user ? { id: user.id, name: user.name, role: user.role ?? "CLIENT" } : null;
  await applyDuePriceSchedules();
  const pkg = (await col("packages").findOne({
    service_type: serviceType,
    code: packageCode,
  })) as Doc | null;
  const existing = (await col("client_services").findOne({
    client_id: client.id,
    service_type: serviceType,
  })) as Doc | null;
  const alreadyActive = Boolean(existing && existing.status === "ACTIVE");
  const taxYear: string = existing?.tax_year ?? ACTIVATION_TAX_YEAR[serviceType];
  const history = {
    previous_package: existing?.package_code ?? null,
    new_package: packageCode,
    changed_at: nowIso(),
    changed_by: user ? user.name : "System",
    reason,
    payment_session: paymentSession,
    amount_paid: amount,
  };
  if (existing) {
    await col("client_services").updateOne(
      { id: existing.id },
      update({
        $set: {
          status: "ACTIVE",
          package_code: packageCode,
          tax_year: taxYear,
          activated_at: existing.activated_at ?? nowIso(),
          // The price agreed at purchase is frozen for this customer.
          agreed_price: alreadyActive ? existing.agreed_price : (pkg?.price ?? null),
          billing_type: pkg?.billing_type ?? "ONE_OFF",
          billing_frequency: pkg?.billing_frequency ?? "Per tax year",
          subscription_started_at: existing.subscription_started_at ?? nowIso(),
          payment_session: paymentSession ?? existing.payment_session ?? null,
          updated_at: nowIso(),
        },
        $push: { package_history: history },
      }),
    );
  } else {
    await col("client_services").insertOne({
      id: randomUUID(),
      client_id: client.id,
      client_user_id: client.user_id ?? null,
      service_type: serviceType,
      status: "ACTIVE",
      package_code: packageCode,
      tax_year: taxYear,
      agreed_price: pkg?.price ?? null,
      billing_type: pkg?.billing_type ?? "ONE_OFF",
      billing_frequency: pkg?.billing_frequency ?? "Per tax year",
      subscription_started_at: nowIso(),
      payment_session: paymentSession,
      activated_at: nowIso(),
      package_history: [history],
      created_at: nowIso(),
    });
  }

  let kase = (await col("cases").findOne(
    { client_id: client.id, service_type: serviceType },
    { sort: { created_at: -1 } },
  )) as Doc | null;
  let createdCase = false;
  if (!kase) {
    const [stage, nextAction, owner] = STATUS_META.AWAITING_ASSIGNMENT;
    kase = {
      id: randomUUID(),
      case_ref: await nextServiceCaseRef(serviceType),
      is_test: Boolean(client.is_test),
      client_id: client.id,
      client_user_id: client.user_id ?? null,
      client_name: client.name,
      service_type: serviceType,
      tax_year: taxYear,
      assigned_accountant_id: null,
      assigned_accountant_name: null,
      admin_reviewer_id: null,
      admin_reviewer_name: null,
      status: "AWAITING_ASSIGNMENT",
      current_stage: stage,
      next_action: nextAction,
      next_action_owner: owner,
      priority: "MEDIUM",
      internal_deadline: null,
      external_deadline: deadlineForTaxYear(taxYear),
      internal_instructions: null,
      waiting_reason: null,
      approved_version_id: null,
      package_code: packageCode,
      created_at: nowIso(),
      last_updated: nowIso(),
    };
    await col("cases").insertOne({ ...kase });
    createdCase = true;
  }

  const periodsCreated = serviceType === MTD ? await ensurePeriods(kase) : 0;

  if (createdCase) {
    const label = SERVICE_LABELS[serviceType] ?? serviceType;
    const paid = amount ? `, £${amount.toFixed(2)} paid` : "";
    await logActivity(
      kase.id,
      `${label} activated (${pkg ? pkg.name : packageCode}${paid})`,
      actor,
      null,
      { newStatus: "AWAITING_ASSIGNMENT" },
    );
    await notifyAdmins(
      `New ${label} service activated — assign an accountant`,
      `${client.name} — ${kase.case_ref}`,
      kase.id,
      `/admin/cases/${kase.id}`,
      "ASSIGNMENT",
    );
  }
  return {
    case: clean(kase) as Doc,
    created_case: createdCase,
    periods_created: periodsCreated,
    already_active: alreadyActive,
  };
}

/** Seeds the package catalogue and the package-change lock setting. Idempotent. */
export async function ensurePhase1bData(): Promise<void> {
  for (const p of DEFAULT_PACKAGES) {
    await col("packages").updateOne(
      { service_type: p.service_type, code: p.code },
      { $setOnInsert: { ...p, id: randomUUID(), is_active: true, created_at: nowIso() } },
      { upsert: true },
    );
  }
  await col("settings").updateOne(
    { key: "package_change_lock" },
    { $setOnInsert: { key: "package_change_lock", locked_statuses: DEFAULT_LOCK_STATUSES } },
    { upsert: true },
  );
  // Give every existing client a service record (one client, many services).
  for (const c of await col("clients").find({}).toArray()) {
    await bootstrapClientServices(c as Doc);
  }
  if (!(await col("clients").findOne({ client_ref: { $exists: true } }))) {
    let n = 42;
    for (const c of await col("clients").find({}).sort({ created_at: 1 }).toArray()) {
      if (!c.client_ref) {
        await col("clients").updateOne(
          { id: c.id },
          { $set: { client_ref: `CL-${String(n).padStart(4, "0")}` } },
        );
        n += 1;
      }
    }
  }
  // Stripe Tax head-office defaults are provider-side configuration already applied for the
  // live account; the Node backend does not re-apply them at boot.
}

export async function lockStatuses(): Promise<string[]> {
  const s = (await col("settings").findOne({ key: "package_change_lock" })) as Doc | null;
  return s?.locked_statuses ?? DEFAULT_LOCK_STATUSES;
}

export async function saCase(clientId: string): Promise<Doc | null> {
  return (await col("cases").findOne(
    { client_id: clientId, service_type: SELF_ASSESSMENT },
    { sort: { created_at: -1 } },
  )) as Doc | null;
}

export async function lockState(
  clientId: string,
): Promise<[boolean, string | null, string | null]> {
  const kase = await saCase(clientId);
  if (!kase) return [false, null, null];
  return [(await lockStatuses()).includes(kase.status), kase.status, kase.id];
}

export async function packageOr404(serviceType: string, code: string | null): Promise<Doc> {
  // Materialise any due scheduled price first, so a purchase always uses the live price.
  await applyDuePriceSchedules();
  const p = (await col("packages").findOne({
    service_type: serviceType,
    code,
    is_active: true,
  })) as Doc | null;
  if (!p) throw httpError(404, "Package not found");
  return clean(p) as Doc;
}

export async function clientOf(user: Doc): Promise<Doc> {
  const c = (await col("clients").findOne({ user_id: user.id })) as Doc | null;
  if (!c) throw httpError(404, "Client record not found");
  return clean(c) as Doc;
}

export function serviceView(s: Doc, pkg: Doc | null): Doc {
  const agreed = "agreed_price" in s ? s.agreed_price : pkg ? pkg.price : null;
  return {
    id: s.id,
    service_type: s.service_type,
    service_name: SERVICE_LABELS[s.service_type] ?? s.service_type,
    status: s.status,
    package_code: s.package_code ?? null,
    package_name: pkg ? pkg.name : null,
    // The client's own agreed price is preserved; the master price can change later.
    package_price: agreed,
    agreed_price: agreed,
    current_master_price: pkg ? pkg.price : null,
    billing_type: "billing_type" in s ? s.billing_type : (pkg?.billing_type ?? "ONE_OFF"),
    billing_frequency:
      "billing_frequency" in s ? s.billing_frequency : (pkg?.billing_frequency ?? "Per tax year"),
    subscription_started_at: s.subscription_started_at ?? s.activated_at ?? null,
    tax_year: s.tax_year ?? null,
    activated_at: s.activated_at ?? null,
    package_history: s.package_history ?? [],
  };
}

export async function servicesFor(client: Doc): Promise<Doc[]> {
  const out: Doc[] = [];
  for (const s of await col("client_services").find({ client_id: client.id }).toArray()) {
    const svc = s as Doc;
    const pkg = svc.package_code
      ? ((await col("packages").findOne({
          service_type: svc.service_type,
          code: svc.package_code,
        })) as Doc | null)
      : null;
    const cases = await col("cases")
      .find({ client_id: client.id, service_type: svc.service_type })
      .limit(100)
      .toArray();
    const view = serviceView(svc, pkg ? (clean(pkg) as Doc) : null);
    view.cases = cases.map((c) => ({
      id: c.id,
      case_ref: c.case_ref,
      tax_year: c.tax_year,
      status: c.status,
      current_stage: c.current_stage,
    }));
    out.push(view);
  }
  const order: Record<string, number> = { [SELF_ASSESSMENT]: 0, [MTD]: 1 };
  return out.sort((a, b) => (order[a.service_type] ?? 9) - (order[b.service_type] ?? 9));
}
