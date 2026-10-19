/**
 * Who We Are — public company page (firm + software).
 *
 * TODO(content): replace team placeholders with real photos and bios.
 * TODO(compliance): upload / link HMRC, ACSP, and ICO registration certificates.
 * TODO(seo): page-level meta title/description, JSON-LD Organisation schema.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  Cpu,
  HeartHandshake,
  Building2,
  BadgeCheck,
  Lock,
  Mail,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import PublicChrome from "@/components/marketing/PublicChrome";

const WHATSAPP_URL = process.env.REACT_APP_WHATSAPP_URL || "";

const VALUES = [
  {
    icon: Users,
    title: "Team first",
    body: "We have the best group of chaps who love working as a team and genuinely care about our customers.",
  },
  {
    icon: HeartHandshake,
    title: "Service over money",
    body: "We give less priority to money and more priority to service.",
  },
  {
    icon: CheckCircle2,
    title: "Simple tax",
    body: "Our mission is to make tax simple, transparent, and stress-free for every client.",
  },
];

const STATUS = [
  "We are fully compliant UK tax accountants.",
  "We are registered HMRC agents.",
  "We are registered Companies House ACSP agents.",
  "We are registered with the ICO (Information Commissioner’s Office).",
  "We follow UK accounting standards, AML regulations, GDPR, and professional ethics.",
];

const TECH = [
  "We build modern UK accountancy software designed for speed, accuracy, and compliance.",
  "Our platform automates tax returns, MTD obligations, AML checks, e-signing, document intake, and client onboarding.",
  "We use secure UK-based infrastructure and encrypted data storage.",
];

const PROMISE = [
  { title: "Clients first", body: "We put clients first." },
  { title: "Quick responses", body: "We respond quickly." },
  { title: "Kept simple", body: "We keep things simple." },
  { title: "Value first", body: "We deliver value before anything else." },
];

const WHY = [
  "Real UK accountants backed by purpose-built software",
  "HMRC agent, Companies House ACSP, and ICO registered",
  "MTD-ready workflows with clear client portals",
  "Secure handling of documents, identity checks, and e-signatures",
  "A culture that prioritises service over selling",
];

const TEAM = [
  { name: "Alex M.", role: "Managing Partner", initials: "AM" },
  { name: "Jordan K.", role: "Head of Tax", initials: "JK" },
  { name: "Sam R.", role: "Client Success", initials: "SR" },
  { name: "Taylor P.", role: "Product & Platform", initials: "TP" },
];

const BADGES = [
  { label: "HMRC Agent", hint: "Registered HMRC agent" },
  { label: "Companies House ACSP", hint: "Authorised Corporate Service Provider" },
  { label: "ICO Registered", hint: "Information Commissioner’s Office" },
];

function Section({ id, eyebrow, title, children, testId }) {
  return (
    <section
      id={id}
      data-testid={testId || `who-${id}`}
      className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20 border-t border-[#E3E7E4]"
    >
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#078A4B] mb-3">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-[#161B18] mb-6 max-w-2xl">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export default function WhoWeAre() {
  useEffect(() => {
    // TODO(seo): replace with react-helmet / SSR meta once marketing site is split out.
    const prev = document.title;
    document.title = "Who We Are | TaxSimba — UK Accountants & UK Software";
    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const prevDesc = meta.getAttribute("content");
    meta.setAttribute(
      "content",
      "TaxSimba is a UK-based accountancy firm and UK accountancy software company. HMRC agents, ACSP, ICO registered.",
    );
    return () => {
      document.title = prev;
      if (created) meta.remove();
      else if (prevDesc != null) meta.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <PublicChrome active="who-we-are">
      {/* Hero — full-bleed brand plane */}
      <div
        data-testid="who-hero"
        className="relative overflow-hidden border-b border-[#E3E7E4]"
        style={{
          background:
            "radial-gradient(120% 80% at 10% 0%, #D8F0E3 0%, transparent 55%), radial-gradient(90% 70% at 90% 20%, #E8F4EC 0%, transparent 50%), linear-gradient(180deg, #F4FAF6 0%, #F7F8F7 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23006B3C' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24 lg:py-28">
          <p className="font-heading text-sm font-bold tracking-wide text-[#006B3C] mb-4">
            TaxSimba
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#161B18] max-w-3xl leading-[1.05]">
            Who We Are
          </h1>
          <p className="mt-5 text-lg md:text-xl text-[#445049] max-w-xl leading-relaxed">
            UK Accountants. UK Software. One Team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              data-testid="who-hero-contact"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors"
            >
              Contact us <ArrowRight size={16} />
            </a>
            <a
              href="#registrations"
              data-testid="who-hero-registrations"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#C5D4CB] bg-white/70 text-sm font-semibold text-[#161B18] hover:bg-white transition-colors"
            >
              Our registrations
            </a>
          </div>
        </div>
      </div>

      {/* A) Who We Are */}
      <Section id="intro" eyebrow="About TaxSimba" title="Who We Are" testId="who-intro">
        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
          <div className="space-y-4 text-[#445049] text-base md:text-lg leading-relaxed max-w-2xl">
            <p>
              We are a UK-based accountancy firm and a UK-based accountancy software company.
            </p>
            <p>
              We combine real accountants with real technology to deliver the best experience for
              our clients.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Building2, label: "UK firm" },
              { Icon: Cpu, label: "UK software" },
              { Icon: Users, label: "One team" },
              { Icon: ShieldCheck, label: "Regulated" },
            ].map(({ Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-start gap-3 p-4 rounded-xl border border-[#E3E7E4] bg-white"
              >
                <span className="h-10 w-10 rounded-lg bg-[#EAF5EE] text-[#006B3C] flex items-center justify-center">
                  <Icon size={20} />
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Registrations badge row */}
      <Section id="registrations" eyebrow="Credentials" title="Our Registrations" testId="who-registrations">
        <div className="flex flex-wrap gap-3">
          {BADGES.map((b) => (
            <div
              key={b.label}
              title={b.hint}
              data-testid={`reg-badge-${b.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[#C5D4CB] bg-white text-sm font-semibold text-[#161B18]"
            >
              <BadgeCheck size={18} className="text-[#078A4B] shrink-0" />
              {b.label}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#626A65] mt-4">
          {/* TODO(compliance): link each badge to certificate PDFs once uploaded */}
          Registration certificates available on request.
        </p>
      </Section>

      {/* B) Values */}
      <Section id="values" eyebrow="Culture" title="Our Values" testId="who-values">
        <div className="grid sm:grid-cols-3 gap-6">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-t-2 border-[#078A4B] pt-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF5EE] text-[#006B3C] mb-4">
                <Icon size={20} />
              </span>
              <h3 className="font-heading font-bold text-lg text-[#161B18]">{title}</h3>
              <p className="mt-2 text-sm text-[#445049] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* C) Professional status */}
      <Section id="status" eyebrow="Compliance" title="Our Professional Status" testId="who-status">
        <div className="flex items-start gap-4 mb-6">
          <span className="h-12 w-12 rounded-xl bg-[#EAF5EE] text-[#006B3C] flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </span>
          <p className="text-[#445049] text-base leading-relaxed max-w-2xl">
            Professional credibility you can verify — agents, data protection, and ethics built into
            how we work every day.
          </p>
        </div>
        <ul className="space-y-3 max-w-3xl">
          {STATUS.map((line) => (
            <li key={line} className="flex gap-3 text-sm md:text-base text-[#161B18]">
              <CheckCircle2 size={18} className="text-[#078A4B] shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* D) Technology */}
      <Section id="technology" eyebrow="Platform" title="Our Technology" testId="who-technology">
        <div className="flex items-start gap-4 mb-6">
          <span className="h-12 w-12 rounded-xl bg-[#EAF5EE] text-[#006B3C] flex items-center justify-center shrink-0">
            <Cpu size={24} />
          </span>
          <p className="text-[#445049] text-base leading-relaxed max-w-2xl">
            Software built by accountants, for UK tax work — not a bolted-on generic portal.
          </p>
        </div>
        <ul className="space-y-3 max-w-3xl">
          {TECH.map((line) => (
            <li key={line} className="flex gap-3 text-sm md:text-base text-[#161B18]">
              <Lock size={18} className="text-[#078A4B] shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* E) Promise */}
      <Section id="promise" eyebrow="Commitment" title="Our Promise" testId="who-promise">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PROMISE.map((p) => (
            <div key={p.title} className="border-t border-[#E3E7E4] pt-4">
              <h3 className="font-heading font-bold text-[#161B18]">{p.title}</h3>
              <p className="mt-2 text-sm text-[#445049]">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Why choose us */}
      <Section id="why" eyebrow="Difference" title="Why Choose Us" testId="who-why">
        <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-3 max-w-4xl">
          {WHY.map((item) => (
            <li key={item} className="flex gap-3 text-sm md:text-base text-[#161B18]">
              <ArrowRight size={16} className="text-[#078A4B] shrink-0 mt-1" />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* Meet the team */}
      <Section id="team" eyebrow="People" title="Meet the Team" testId="who-team">
        <p className="text-sm text-[#626A65] mb-8 max-w-xl">
          {/* TODO(content): swap placeholders for real team photos and names */}
          Placeholder profiles — photos and full bios coming soon.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {TEAM.map((member) => (
            <div key={member.name} className="text-center" data-testid={`team-${member.initials}`}>
              <div
                className="mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br from-[#C8E6D4] to-[#EAF5EE] text-[#006B3C] font-heading font-extrabold text-2xl flex items-center justify-center border border-[#C5D4CB]"
                aria-hidden
              >
                {member.initials}
              </div>
              <div className="mt-3 font-semibold text-sm text-[#161B18]">{member.name}</div>
              <div className="text-xs text-[#626A65]">{member.role}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" eyebrow="Get in touch" title="Contact Us" testId="who-contact">
        <p className="text-[#445049] mb-6 max-w-xl">
          Questions about our firm, software, or your tax affairs? Reach the team directly.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:support@taxsimba.co.uk"
            data-testid="who-contact-email"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors"
          >
            <Mail size={16} /> Email support
          </a>
          {WHATSAPP_URL ? (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              data-testid="who-contact-whatsapp"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#C5D4CB] bg-white text-sm font-semibold text-[#161B18] hover:bg-[#F1F8F4] transition-colors"
            >
              <MessageCircle size={16} className="text-[#078A4B]" /> WhatsApp
            </a>
          ) : (
            <span
              data-testid="who-contact-whatsapp-pending"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-dashed border-[#C5D4CB] text-sm text-[#626A65]"
            >
              <MessageCircle size={16} /> WhatsApp — configure REACT_APP_WHATSAPP_URL
            </span>
          )}
          <Link
            to="/login"
            data-testid="who-contact-login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#C5D4CB] bg-white text-sm font-semibold text-[#161B18] hover:bg-[#F1F8F4] transition-colors"
          >
            Client portal sign in
          </Link>
        </div>
      </Section>
    </PublicChrome>
  );
}
