import { TaxReturnData } from "@/utils/interface";

/** Map Node case workflow status → Toxel Manage Tax tab keys (mirrors backend nodeToToxelStatus). */
export function nodeToToxelStatus(status: string): string {
  switch (String(status || "").toUpperCase()) {
    case "NEW":
    case "ONBOARDING":
    case "AWAITING_ASSIGNMENT":
      return "pending_assignment";
    case "ASSIGNED":
      return "assigned";
    case "ACCOUNTANT_REVIEW":
    case "AWAITING_CLIENT":
    case "IN_PREPARATION":
    case "READY_FOR_ADMIN_REVIEW":
    case "ADMIN_REVIEW":
    case "CHANGES_REQUIRED":
      return "preparation_started";
    case "ADMIN_APPROVED":
    case "AWAITING_CLIENT_APPROVAL":
    case "CLIENT_APPROVED":
    case "READY_FOR_SUBMISSION":
      return "draft_ready";
    case "SUBMISSION_IN_PROGRESS":
    case "SUBMITTED":
    case "SUBMISSION_ISSUE":
      return "final_submitted";
    case "COMPLETED":
      return "completed";
    default: {
      const lower = String(status || "").toLowerCase();
      if (
        [
          "pending_payment",
          "payment_completed",
          "pending_assignment",
          "assigned",
          "preparation_started",
          "draft_ready",
          "final_submitted",
          "completed",
        ].includes(lower)
      ) {
        return lower;
      }
      return "pending_assignment";
    }
  }
}

/**
 * Canonical compat list payload is `{ files, taxReturns }` (not a bare array).
 * Map each case row into the TaxReturnData shape Manage Tax UI expects.
 */
export function mapTaxReturnListPayload(data: unknown): TaxReturnData[] {
  if (!data || typeof data !== "object") return [];

  const envelope = data as Record<string, unknown>;
  const rowsRaw =
    (Array.isArray(envelope.taxReturns) && envelope.taxReturns) ||
    (Array.isArray(envelope.files) && envelope.files) ||
    (Array.isArray(data) ? data : null);

  if (!rowsRaw) return [];

  return rowsRaw.map((row: any) => {
    // Already in nested TaxReturnData shape
    if (row?.taxReturn && typeof row.taxReturn === "object") {
      const status = nodeToToxelStatus(row.taxReturn.status);
      return {
        ...row,
        taxReturn: { ...row.taxReturn, status },
        files: row.files ?? { allFiles: [] },
      } as TaxReturnData;
    }

    const nameSource = String(row.clientName ?? row.client_name ?? row.client?.name ?? "").trim();
    const nameParts = nameSource.split(/\s+/).filter(Boolean);
    const client = row.client ?? {
      id: row.clientUserId ?? row.client_user_id ?? "",
      name: nameParts[0] || "Client",
      surname: nameParts.slice(1).join(" "),
      email: row.clientEmail ?? row.client?.email ?? "",
    };

    const rawStatus = row.status ?? row.nodeStatus ?? "";
    const taxReturn = {
      id: row.id ?? row.taxReturnId ?? row.tax_return_id,
      taxReturnId: row.taxReturnId ?? row.tax_return_id ?? row.caseRef ?? row.case_ref ?? row.id,
      taxYear: row.taxYear ?? row.tax_year ?? "",
      status: nodeToToxelStatus(String(rawStatus)),
      mtdQuarter: row.mtdQuarter ?? row.mtd_quarter,
      mtdQuarterDueDate: row.mtdQuarterDueDate ?? row.mtd_quarter_due_date,
      client,
      accountant: row.accountant
        ? row.accountant
        : row.assignedAccountantName || row.assigned_accountant_name
          ? {
              id: row.assignedAccountantId ?? row.assigned_accountant_id,
              name: row.assignedAccountantName ?? row.assigned_accountant_name,
            }
          : null,
      type: row.type ?? {
        typeName:
          String(row.serviceType ?? row.service_type ?? "").includes("MTD")
            ? "Making Tax Digital"
            : "Self Assessment",
        typeCode: String(row.serviceType ?? row.service_type ?? "").includes("MTD") ? "MTD" : "SA",
      },
    };

    return {
      taxReturn,
      files: row.files ?? { allFiles: [] },
    } as TaxReturnData;
  });
}
