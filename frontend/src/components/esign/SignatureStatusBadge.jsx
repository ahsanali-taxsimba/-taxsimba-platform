/**
 * Status badges for e-sign requests: Draft → Sent → Viewed → Signed → Expired
 * (plus Partially signed / Declined / Cancelled).
 */
const TONES = {
  DRAFT: ["#F1F3F2", "#626A65"],
  SENT: ["#FDF3E3", "#B77A12"],
  VIEWED: ["#F0EBFB", "#7656C9"],
  PARTIALLY_SIGNED: ["#FDF3E3", "#B77A12"],
  SIGNED: ["#E9F7EF", "#16A05D"],
  DECLINED: ["#FBEBEB", "#D64545"],
  EXPIRED: ["#FBEBEB", "#D64545"],
  CANCELLED: ["#F1F3F2", "#626A65"],
};

const LABELS = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_SIGNED: "Partially signed",
  SIGNED: "Signed",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export function SignatureStatusBadge({ status, testId }) {
  const [bg, fg] = TONES[status] || TONES.DRAFT;
  return (
    <span
      data-testid={testId || `esign-status-${status}`}
      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {LABELS[status] || status}
    </span>
  );
}

export default SignatureStatusBadge;
