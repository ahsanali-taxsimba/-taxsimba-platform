export function StatCard({ label, value, onClick, tone = "#006B3C", testId, active }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`text-left bg-white border rounded-xl p-5 transition-colors hover:bg-[#F1F8F4] w-full ${
        active ? "border-[#078A4B] ring-2 ring-[#078A4B]/20" : "border-[#E3E7E4]"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[#626A65]">{label}</div>
      <div className="mt-3 text-3xl font-bold" style={{ color: tone }}>
        {value ?? "—"}
      </div>
    </button>
  );
}

export function Panel({ title, action, children, className = "", testId }) {
  return (
    <section data-testid={testId} className={`bg-white border border-[#E3E7E4] rounded-xl ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E3E7E4]">
          <h3 className="text-base font-semibold text-[#161B18]">{title}</h3>
          {action}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Empty({ text }) {
  return <p className="text-sm text-[#626A65] py-6 text-center">{text}</p>;
}
