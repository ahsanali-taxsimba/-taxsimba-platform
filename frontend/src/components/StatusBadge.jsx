export const STATUS_LABELS = {
  NEW: "New",
  ONBOARDING: "Onboarding",
  AWAITING_ASSIGNMENT: "Awaiting Assignment",
  ASSIGNED: "Assigned",
  ACCOUNTANT_REVIEW: "Accountant Review",
  AWAITING_CLIENT: "Awaiting Client",
  IN_PREPARATION: "In Preparation",
  READY_FOR_ADMIN_REVIEW: "Ready for Admin Review",
  ADMIN_REVIEW: "Admin Review",
  CHANGES_REQUIRED: "Changes Required",
  ADMIN_APPROVED: "Admin Approved",
  AWAITING_CLIENT_APPROVAL: "Awaiting Client Approval",
  CLIENT_APPROVED: "Client Approved",
  READY_FOR_SUBMISSION: "Ready for Submission",
  SUBMISSION_IN_PROGRESS: "Submission In Progress",
  SUBMITTED: "Submitted",
  SUBMISSION_ISSUE: "Submission Issue",
  COMPLETED: "Completed",
};

const TONES = {
  AWAITING_ASSIGNMENT: ["#FDF3E3", "#B77A12"],
  NEW: ["#EAF5EE", "#006B3C"],
  ONBOARDING: ["#EAF5EE", "#006B3C"],
  ASSIGNED: ["#EAF5EE", "#006B3C"],
  ACCOUNTANT_REVIEW: ["#EAF5EE", "#078A4B"],
  IN_PREPARATION: ["#EAF5EE", "#078A4B"],
  AWAITING_CLIENT: ["#FDF3E3", "#B77A12"],
  READY_FOR_ADMIN_REVIEW: ["#F0EBFB", "#7656C9"],
  ADMIN_REVIEW: ["#F0EBFB", "#7656C9"],
  CHANGES_REQUIRED: ["#FBEBEB", "#D64545"],
  SUBMISSION_ISSUE: ["#FBEBEB", "#D64545"],
  ADMIN_APPROVED: ["#E9F7EF", "#16A05D"],
  AWAITING_CLIENT_APPROVAL: ["#FDF3E3", "#B77A12"],
  CLIENT_APPROVED: ["#E9F7EF", "#16A05D"],
  READY_FOR_SUBMISSION: ["#E9F7EF", "#16A05D"],
  SUBMISSION_IN_PROGRESS: ["#EAF5EE", "#006B3C"],
  SUBMITTED: ["#E9F7EF", "#16A05D"],
  COMPLETED: ["#F1F3F2", "#626A65"],
};

export function StatusBadge({ status, testId }) {
  const [bg, fg] = TONES[status] || ["#F1F3F2", "#626A65"];
  return (
    <span
      data-testid={testId || `status-badge-${status}`}
      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const PRIORITY = {
  HIGH: ["#FBEBEB", "#D64545"],
  MEDIUM: ["#FDF3E3", "#B77A12"],
  LOW: ["#F1F3F2", "#626A65"],
};

export function PriorityBadge({ priority }) {
  const [bg, fg] = PRIORITY[priority] || PRIORITY.LOW;
  return (
    <span className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: bg, color: fg }}>
      {priority || "LOW"}
    </span>
  );
}

export function DocStatusBadge({ status }) {
  const map = {
    Requested: ["#FDF3E3", "#B77A12"],
    Uploaded: ["#EAF5EE", "#078A4B"],
    "Under Review": ["#F0EBFB", "#7656C9"],
    Accepted: ["#E9F7EF", "#16A05D"],
    "Replacement Required": ["#FBEBEB", "#D64545"],
    Final: ["#EAF5EE", "#006B3C"],
  };
  const [bg, fg] = map[status] || ["#F1F3F2", "#626A65"];
  return (
    <span className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: bg, color: fg }}>
      {status}
    </span>
  );
}
