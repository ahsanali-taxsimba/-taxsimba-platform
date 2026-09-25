/**
 * Authoritative MTD (and SA deadline) obligation snapshot for cross-role display.
 * Never invent quarters from questionnaire answers.
 */
import { col, Doc } from "../db/mongo";
import { daysToDeadline, MTD, SUBMITTED, warning } from "./mtd";

export type ObligationSnapshot = {
  serviceType: string;
  taxYear: string | null;
  quarterLabel: string | null;
  quarter: number | null;
  deadline: string | null;
  periodEnd: string | null;
  periodStatus: string | null;
  daysToDeadline: number | null;
  deadlineWarning: string | null;
  /** Positive remaining, negative overdue absolute, or null when no obligation. */
  daysRemainingDisplay: number | null;
  isOverdue: boolean;
  hasObligation: boolean;
};

function quarterLabel(row: Doc | null | undefined): string | null {
  if (!row) return null;
  if (row.kind === "FINAL_DECLARATION") return "Final Declaration";
  if (row.label) return String(row.label);
  if (row.quarter) return `Q${row.quarter}`;
  return null;
}

/**
 * Current open MTD period (or null). Uses stored mtd_periods only.
 */
export async function currentMtdObligation(kase: Doc): Promise<ObligationSnapshot> {
  const serviceType = String(kase.service_type ?? "");
  const taxYear = kase.tax_year ? String(kase.tax_year) : null;

  if (serviceType !== MTD && serviceType !== "MTD") {
    const deadline =
      (kase.external_deadline as string | null) ??
      (kase.internal_deadline as string | null) ??
      null;
    if (!deadline) {
      return {
        serviceType,
        taxYear,
        quarterLabel: null,
        quarter: null,
        deadline: null,
        periodEnd: null,
        periodStatus: null,
        daysToDeadline: null,
        deadlineWarning: null,
        daysRemainingDisplay: null,
        isOverdue: false,
        hasObligation: false,
      };
    }
    const days = daysToDeadline(deadline);
    return {
      serviceType,
      taxYear,
      quarterLabel: null,
      quarter: null,
      deadline,
      periodEnd: null,
      periodStatus: null,
      daysToDeadline: days,
      deadlineWarning: days < 0 ? "OVERDUE" : days <= 14 ? "DUE_14" : null,
      daysRemainingDisplay: days,
      isOverdue: days < 0,
      hasObligation: true,
    };
  }

  const periods = (await col("mtd_periods")
    .find({ case_id: kase.id })
    .limit(20)
    .toArray()) as Doc[];
  periods.sort(
    (a, b) =>
      Number(a.kind === "FINAL_DECLARATION") - Number(b.kind === "FINAL_DECLARATION") ||
      Number(a.quarter ?? 0) - Number(b.quarter ?? 0),
  );
  const quarters = periods.filter((p) => p.kind === "QUARTER");
  const current =
    quarters.find((p) => p.status !== SUBMITTED) ??
    periods.find((p) => p.kind === "FINAL_DECLARATION" && p.status !== SUBMITTED) ??
    null;

  if (!current || !current.deadline) {
    return {
      serviceType,
      taxYear,
      quarterLabel: null,
      quarter: null,
      deadline: null,
      periodEnd: null,
      periodStatus: null,
      daysToDeadline: null,
      deadlineWarning: null,
      daysRemainingDisplay: null,
      isOverdue: false,
      hasObligation: false,
    };
  }

  const warn = warning(current);
  const days = warn.days_to_deadline;
  return {
    serviceType,
    taxYear,
    quarterLabel: quarterLabel(current),
    quarter: current.quarter != null ? Number(current.quarter) : null,
    deadline: String(current.deadline),
    periodEnd: current.period_end ? String(current.period_end) : null,
    periodStatus: String(current.status ?? ""),
    daysToDeadline: days,
    deadlineWarning: warn.deadline_warning,
    daysRemainingDisplay: days,
    isOverdue: Boolean(days != null && days < 0),
    hasObligation: true,
  };
}
