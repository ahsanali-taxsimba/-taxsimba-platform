import { statusLabel } from "@/lib/format";

const styles: Record<string, string> = {
  new: "bg-[#e8f3ef] text-[var(--ok)]",
  contacted: "bg-[#eef3f8] text-[#2563a8]",
  qualified: "bg-[var(--accent-soft)] text-[var(--accent)]",
  won: "bg-[#e7f6ec] text-[#0b7a3b]",
  lost: "bg-[#f8eaea] text-[var(--danger)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid={`status-${status}`}
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-[var(--mist)] text-[var(--muted)]"}`}
    >
      {statusLabel(status)}
    </span>
  );
}
