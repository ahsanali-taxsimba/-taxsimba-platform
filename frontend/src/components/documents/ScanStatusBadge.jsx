/**
 * Antivirus scan status chip for client + staff document lists.
 */
const TONE = {
  clean: { bg: "#E9F7EF", fg: "#16A05D", label: "Clean" },
  suspicious: { bg: "#FDF3E3", fg: "#B77A12", label: "Suspicious" },
  corrupt: { bg: "#FDECEC", fg: "#D64545", label: "Corrupt" },
  infected: { bg: "#1A1A1A", fg: "#FFFFFF", label: "Infected" },
  pending: { bg: "#F1F3F2", fg: "#626A65", label: "Scanning" },
};

export default function ScanStatusBadge({ status, testId }) {
  const tone = TONE[status] || TONE.pending;
  return (
    <span
      data-testid={testId || `scan-status-${status || "pending"}`}
      className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: tone.bg, color: tone.fg }}
      title={tone.label}
    >
      {tone.label}
    </span>
  );
}
