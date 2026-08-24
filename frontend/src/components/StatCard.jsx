// Shared presentation primitives. Styling only -- no behaviour lives here.
const TINT = {
  "#006B3C": "bg-[#EAF5EE]",
  "#078A4B": "bg-[#EAF5EE]",
  "#16A05D": "bg-[#EAF5EE]",
  "#E6A23C": "bg-[#FFF4E5]",
  "#D64545": "bg-[#FBEBEB]",
  "#7656C9": "bg-[#F1EEFB]",
  "#626A65": "bg-[#F1F8F4]",
};

export function StatCard({ label, value, onClick, tone = "#006B3C", testId, active, hint }) {
  const interactive = typeof onClick === "function";
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`group text-left bg-white border rounded-xl p-5 w-full shadow-sm transition-[background-color,border-color,box-shadow] duration-200 ${
        interactive ? "hover:border-[#078A4B]/40 hover:shadow-md cursor-pointer" : "cursor-default"
      } ${active ? "border-[#078A4B] ring-2 ring-[#078A4B]/20" : "border-[#E3E7E4]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#626A65] leading-snug">
          {label}
        </div>
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${TINT[tone] || "bg-[#F1F8F4]"}`}
          style={{ backgroundColor: tone, opacity: 0.9 }} />
      </div>
      <div className="mt-4 text-3xl font-bold tabular-nums tracking-tight" style={{ color: tone }}>
        {value ?? "—"}
      </div>
      {hint && <div className="mt-1.5 text-xs text-[#626A65]">{hint}</div>}
    </button>
  );
}

export function Panel({ title, action, children, className = "", testId }) {
  return (
    <section data-testid={testId}
      className={`bg-white border border-[#E3E7E4] rounded-xl shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E3E7E4]">
          <h3 className="text-base font-semibold text-[#161B18] tracking-tight">{title}</h3>
          {action}
        </header>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function Empty({ text }) {
  return <p className="text-sm text-[#626A65] py-8 text-center">{text}</p>;
}
