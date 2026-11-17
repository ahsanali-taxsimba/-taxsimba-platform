import { sourceLabel } from "@/lib/format";

const styles: Record<string, string> = {
  outlook: "bg-[#e8f0f8] text-[var(--outlook)]",
  whatsapp: "bg-[#e8f6ef] text-[var(--whatsapp)]",
  website: "bg-[#f8efe4] text-[var(--website)]",
  manual: "bg-[#eef0f2] text-[var(--manual)]",
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      data-testid={`source-${source}`}
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${styles[source] ?? "bg-[var(--mist)]"}`}
    >
      {sourceLabel(source)}
    </span>
  );
}
