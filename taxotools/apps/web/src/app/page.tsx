"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  FadeIn,
  SlideUp,
  StaggerChildren,
  StaggerItem,
  AnimateOnScroll,
  ScaleIn,
  buttonHover,
} from "@/motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { PLAN_PRICES_CENTS, PLAN_LIMITS } from "@taxotools/shared";

const MotionLink = m.create(Link);

const PRODUCTS = [
  {
    title: "Taxo Agent",
    body: "Set the goal — it turns strategy into shipped work across SEO, AI answers, and ads.",
  },
  {
    title: "Auto SEO",
    body: "Technical and on-page fixes applied from live search data. No ticket queue.",
  },
  {
    title: "QUEST",
    body: "Maps questions, trusted sources, and AI citation paths for Digital PR and AEO.",
  },
  {
    title: "WILDFIRE + HyperDrive",
    body: "2:1 link exchanges, press releases, and cloud stacks that lift Domain Power.",
  },
  {
    title: "Content Genius",
    body: "Researches, writes, and publishes content that ranks and gets cited.",
  },
  {
    title: "LLM Visibility",
    body: "Tracks ChatGPT, Perplexity, Gemini, and Google AI Mode — and wins citations back.",
  },
];

const STACK = [
  { channel: "AI search · AEO / GEO", replace: "Profound · Searchable", hire: 599 },
  { channel: "SEO & site health", replace: "Semrush · Ahrefs · Screaming Frog", hire: 1949 },
  { channel: "Google + Meta ads", replace: "Ads Manager · AgencyAnalytics", hire: 1098 },
  { channel: "Content written & published", replace: "Surfer · Clearscope · Jasper", hire: 604 },
  { channel: "Local profiles", replace: "BrightLocal · Yext · Local Falcon", hire: 1293 },
  { channel: "PR & links", replace: "Cision · Muck Rack · Pitchbox", hire: 1032 },
];

const PLANS = (
  ["STARTER", "GROWTH", "PRO", "AGENCY"] as const
).map((code) => ({
  code,
  name: code.charAt(0) + code.slice(1).toLowerCase(),
  price: PLAN_PRICES_CENTS[code] / 100,
  seats: PLAN_LIMITS[code].teamSeats,
  otto: PLAN_LIMITS[code].ottoProjects,
  popular: code === "GROWTH",
  blurb:
    code === "STARTER"
      ? "Solo marketers & freelancers"
      : code === "GROWTH"
        ? "Agencies managing multiple sites"
        : code === "PRO"
          ? "High-volume SEO teams"
          : "Client portfolios & white-label",
}));

export default function HomePage() {
  const reduce = usePrefersReducedMotion();

  return (
    <main className="min-h-screen overflow-x-hidden bg-grid-fade">
      <FadeIn>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink-950">
            Taxotools
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/#pricing" className="hidden px-3 py-2 text-ink-700 hover:text-ink-950 sm:inline">
              Pricing
            </Link>
            <Link href="/login" className="px-3 py-2 text-ink-700 hover:text-ink-950">
              Sign in
            </Link>
            <MotionLink
              href="/register"
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white shadow-sm"
              initial={reduce ? false : "rest"}
              whileHover={reduce ? undefined : "hover"}
              whileTap={reduce ? undefined : "tap"}
              variants={reduce ? undefined : buttonHover}
            >
              Start free trial
            </MotionLink>
          </nav>
        </header>
      </FadeIn>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-16 pt-8 md:pb-24 md:pt-14">
        <ScaleIn className="absolute inset-x-0 top-4 -z-10 mx-auto h-[min(520px,70vh)] max-w-5xl rounded-[2rem] bg-hero-mesh opacity-95" />
        <m.div
          className="pointer-events-none absolute -right-10 top-24 h-40 w-40 rounded-full bg-accent/30 blur-3xl"
          animate={reduce ? undefined : { opacity: [0.35, 0.7, 0.35], scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <SlideUp className="relative max-w-3xl text-white drop-shadow-sm">
          <p className="font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Taxotools
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-2xl font-medium leading-snug md:text-3xl">
            Your SEO runs itself now.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
            Taxo Agent finds what holds your site back and deploys the fixes — while you sleep.
            More traffic and leads without more headcount.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <MotionLink
              href="/register"
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-950"
              initial={reduce ? false : "rest"}
              whileHover={reduce ? undefined : "hover"}
              whileTap={reduce ? undefined : "tap"}
              variants={reduce ? undefined : buttonHover}
            >
              Try Taxotools free
            </MotionLink>
            <Link
              href="/login"
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Demo · demo@taxotools.com
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/70">7-day trial · $0 today · Full autopilot access</p>
        </SlideUp>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <AnimateOnScroll>
          <h2 className="font-display text-3xl font-semibold text-ink-950 md:text-4xl">
            One growth engine. Not eight subscriptions.
          </h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            Replace the stack agencies stitch together — SEO, AEO, content, ads, local, and
            reporting — starting at ${PLAN_PRICES_CENTS.STARTER / 100}/mo.
          </p>
        </AnimateOnScroll>
        <StaggerChildren className="mt-10 space-y-0 border-t border-ink-100">
          {STACK.map((row) => (
            <StaggerItem key={row.channel}>
              <div className="grid gap-2 border-b border-ink-100 py-4 md:grid-cols-[1.2fr_1.4fr_auto] md:items-center">
                <p className="font-medium text-ink-900">{row.channel}</p>
                <p className="text-sm text-ink-500">{row.replace}</p>
                <p className="text-sm font-semibold text-ink-800 md:text-right">
                  <span className="text-ink-300 line-through">${row.hire}</span>
                  <span className="ml-2 text-accent-dark">included</span>
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
        <p className="mt-6 font-display text-2xl font-semibold text-ink-900">
          Stack total ~$8,000 → Taxotools from ${PLAN_PRICES_CENTS.STARTER / 100}/mo
        </p>
      </section>

      <section className="border-y border-ink-100 bg-white/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateOnScroll>
            <h2 className="font-display text-3xl font-semibold text-ink-950">
              Keeps working after you log off
            </h2>
            <p className="mt-3 max-w-xl text-ink-500">
              Rankings that slip get repaired overnight. Results show up in reports before you ask.
            </p>
          </AnimateOnScroll>
          <StaggerChildren className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <StaggerItem key={p.title}>
                <article className="border-t border-ink-100 pt-5">
                  <h3 className="font-display text-xl font-semibold text-ink-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{p.body}</p>
                </article>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <AnimateOnScroll>
          <h2 className="font-display text-3xl font-semibold text-ink-950">
            The right level for every-sized team
          </h2>
          <p className="mt-3 text-ink-500">
            Search Atlas–competitive tiers. Taxo Agent + Content Genius on every plan.
          </p>
        </AnimateOnScroll>
        <StaggerChildren className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.code}>
              <div
                className={`flex h-full flex-col border-t-2 pt-5 ${
                  plan.popular ? "border-accent" : "border-ink-100"
                }`}
              >
                {plan.popular && (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent-dark">
                    Most popular
                  </p>
                )}
                <p className="font-display text-2xl font-semibold">{plan.name}</p>
                <p className="mt-1 text-sm text-ink-500">{plan.blurb}</p>
                <p className="mt-4 text-3xl font-semibold">
                  ${plan.price}
                  <span className="text-sm font-normal text-ink-500">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-ink-600">
                  <li>{plan.otto} Auto SEO project{plan.otto === 1 ? "" : "s"}</li>
                  <li>{plan.seats} user seat{plan.seats === 1 ? "" : "s"}</li>
                  <li>Taxo Agent + Website Studio</li>
                  <li>Content Genius + CMS publish</li>
                  <li>{plan.code === "STARTER" ? "Smart Ads trial" : "Smart Ads included"}</li>
                </ul>
                <MotionLink
                  href="/register"
                  className={`mt-6 inline-block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                    plan.popular
                      ? "bg-accent text-white"
                      : "border border-ink-100 bg-white text-ink-900"
                  }`}
                  initial={reduce ? false : "rest"}
                  whileHover={reduce ? undefined : "hover"}
                  whileTap={reduce ? undefined : "tap"}
                  variants={reduce ? undefined : buttonHover}
                >
                  Start trial
                </MotionLink>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </section>

      <footer className="border-t border-ink-100 py-10 text-center text-sm text-ink-500">
        <p className="font-display text-lg font-semibold text-ink-800">Taxotools</p>
        <p className="mt-1">SEO that ships itself · AEO · Ads · Content</p>
      </footer>
    </main>
  );
}
