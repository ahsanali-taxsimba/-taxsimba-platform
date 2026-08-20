import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, MessageSquare, Mail, Route, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { api } from "@/lib/api";

const QUICK = [
  ["Message my accountant", "/messages", MessageSquare],
  ["View my tax journey", "/journey", Route],
];

export default function HelpCentre() {
  const [faqs, setFaqs] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get("/faqs").then(({ data }) => setFaqs(data)).catch(() => {});
    api.get("/faq-categories").then(({ data }) => setCats(data)).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return faqs.filter((f) => {
      if (cat && f.category !== cat) return false;
      if (!needle) return true;
      return (
        f.question.toLowerCase().includes(needle) ||
        f.answer.toLowerCase().includes(needle) ||
        f.category.toLowerCase().includes(needle)
      );
    });
  }, [faqs, q, cat]);

  return (
    <AppShell title="Help Centre" subtitle="How can we help?">
      <div className="space-y-6">
        <Panel testId="help-search-panel">
          <label className="relative block">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" color="#626A65" />
            <input
              data-testid="help-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search help articles…"
              className="w-full rounded-lg border border-[#E3E7E4] pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30"
            />
          </label>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              data-testid="help-cat-all"
              onClick={() => setCat(null)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                !cat ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"
              }`}
            >
              All topics
            </button>
            {cats.map((c) => (
              <button
                key={c}
                data-testid={`help-cat-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                onClick={() => setCat(c === cat ? null : c)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  cat === c ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Quick actions" testId="help-quick-actions">
          <div className="flex flex-wrap gap-3">
            {QUICK.map(([label, to, Icon]) => (
              <Link
                key={to}
                to={to}
                data-testid={`help-quick-${to.replace("/", "")}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors"
              >
                <Icon size={16} color="#078A4B" /> {label}
              </Link>
            ))}
            <a
              href="mailto:support@taxsimba.co.uk"
              data-testid="help-quick-email"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors"
            >
              <Mail size={16} color="#078A4B" /> Email TaxSimba Support
            </a>
          </div>
        </Panel>

        <Panel title={cat || "Frequently asked questions"} testId="help-faqs-panel">
          {!shown.length && <Empty text="No articles matched your search. Try a different word, or message your accountant." />}
          <ul className="space-y-3">
            {shown.map((f) => (
              <li key={f.id} data-testid={`faq-${f.id}`} className="border border-[#E3E7E4] rounded-lg">
                <button
                  data-testid={`faq-toggle-${f.id}`}
                  onClick={() => setOpen(open === f.id ? null : f.id)}
                  className="w-full flex items-start justify-between gap-4 text-left px-5 py-4 hover:bg-[#F7F8F7] transition-colors"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[#161B18]">{f.question}</span>
                    <span className="block text-xs text-[#626A65] mt-1">{f.category}</span>
                  </span>
                  <ChevronDown
                    size={18}
                    color="#626A65"
                    style={{ transform: open === f.id ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                  />
                </button>
                {open === f.id && (
                  <p data-testid={`faq-answer-${f.id}`} className="px-5 pb-5 text-sm text-[#626A65] leading-relaxed">
                    {f.answer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
