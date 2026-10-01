"use client";

import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import {
  FadeIn,
  SlideUp,
  StaggerChildren,
  StaggerChild,
  ScrollParallax,
  DepthLayer,
  hoverLift,
} from "@/ui";
import { PLAN_PRICES_CENTS, PLAN_LIMITS } from "@taxotools/shared";

const MotionLink = m.create(Link);

const PRODUCTS = [
  {
    title: "Taxo Agent",
    body: "Set the goal — it turns strategy into shipped work across SEO, AI answers, and ads.",
    icon: "✦",
  },
  {
    title: "Auto SEO",
    body: "Technical and on-page fixes applied from live search data. No ticket queue.",
    icon: "◎",
  },
  {
    title: "QUEST",
    body: "Maps questions, trusted sources, and AI citation paths for Digital PR and AEO.",
    icon: "◌",
  },
  {
    title: "WILDFIRE + HyperDrive",
    body: "2:1 link exchanges, press releases, and cloud stacks that lift Domain Power.",
    icon: "▲",
  },
  {
    title: "Content Genius",
    body: "Researches, writes, and publishes content that ranks and gets cited.",
    icon: "✎",
  },
  {
    title: "LLM Visibility",
    body: "Tracks ChatGPT, Perplexity, Gemini, and Google AI Mode — and wins citations back.",
    icon: "◈",
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

const PLANS = (["STARTER", "GROWTH", "PRO", "AGENCY"] as const).map((code) => ({
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

const PREVIEW_METRICS = [
  { label: "Health", value: "86" },
  { label: "Keywords", value: "248" },
  { label: "AEO", value: "71%" },
  { label: "Fixes", value: "12" },
];

export default function HomePage() {
  const reduce = useReducedMotion();

  return (
    <main className="min-h-screen overflow-x-hidden bg-grid-fade">
      <FadeIn>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="brand-text font-display text-2xl font-semibold tracking-tight"
          >
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
              className="rounded-pill bg-accent px-5 py-2 font-semibold text-white shadow-none"
              initial={reduce ? false : "rest"}
              whileHover={reduce ? undefined : "hover"}
              whileTap={reduce ? undefined : "tap"}
              variants={reduce ? undefined : hoverLift}
            >
              Start free trial
            </MotionLink>
          </nav>
        </header>
      </FadeIn>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-16 pt-8 md:pb-24 md:pt-14">
        <ScrollParallax
          speed={0.28}
          opacityRange={[0.55, 0.85]}
          className="pointer-events-none absolute inset-x-0 top-0 -z-10"
        >
          <div className="mx-auto h-[min(560px,72vh)] max-w-5xl rounded-[2rem] bg-hero-mesh" />
        </ScrollParallax>

        <ScrollParallax speed={-0.12} className="pointer-events-none absolute -right-8 top-16 -z-10">
          <DepthLayer depth={2} className="h-44 w-44 rounded-full bg-brand-primary/10 blur-2xl" />
        </ScrollParallax>
        <ScrollParallax speed={0.18} className="pointer-events-none absolute -left-6 bottom-10 -z-10">
          <DepthLayer depth={1} className="h-36 w-36 rounded-full bg-accent/20 blur-2xl" />
        </ScrollParallax>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <StaggerChildren className="relative max-w-3xl" stagger={0.08}>
            <StaggerChild>
              <p className="brand-text font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
                Taxotools
              </p>
            </StaggerChild>
            <StaggerChild>
              <h1 className="mt-4 max-w-2xl text-balance text-2xl font-medium leading-snug text-ink-950 md:text-3xl">
                Your SEO runs itself now.
              </h1>
            </StaggerChild>
            <StaggerChild>
              <p className="mt-4 max-w-xl text-base text-ink-500 md:text-lg">
                Taxo Agent finds what holds your site back and deploys the fixes — while you sleep.
                More traffic and leads without more headcount.
              </p>
            </StaggerChild>
            <StaggerChild>
              <div className="mt-8 flex flex-wrap gap-3">
                <MotionLink
                  href="/register"
                  className="rounded-pill bg-brand-primary px-6 py-3 text-sm font-semibold text-white"
                  initial={reduce ? false : "rest"}
                  whileHover={reduce ? undefined : "hover"}
                  whileTap={reduce ? undefined : "tap"}
                  variants={reduce ? undefined : hoverLift}
                >
                  Try Taxotools free
                </MotionLink>
                <MotionLink
                  href="/login"
                  className="rounded-pill border border-ink-100 bg-white/80 px-6 py-3 text-sm font-medium text-ink-900 backdrop-blur"
                  initial={reduce ? false : "rest"}
                  whileHover={reduce ? undefined : "hover"}
                  whileTap={reduce ? undefined : "tap"}
                  variants={reduce ? undefined : hoverLift}
                >
                  Demo · demo@taxotools.com
                </MotionLink>
              </div>
            </StaggerChild>
            <StaggerChild>
              <p className="mt-4 text-xs text-ink-500">7-day trial · $0 today · Full autopilot access</p>
            </StaggerChild>
          </StaggerChildren>

          <SlideUp delay={0.12} className="relative">
            <DepthLayer depth={3} className="overflow-hidden border border-white/70 bg-white/70 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Dashboard preview
                  </p>
                  <p className="brand-text mt-1 font-display text-lg font-semibold">Command center</p>
                </div>
                <span className="rounded-pill bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent-dark">
                  Live
                </span>
              </div>
              <StaggerChildren className="grid grid-cols-2 gap-3" stagger={0.06}>
                {PREVIEW_METRICS.map((metric) => (
                  <StaggerChild key={metric.label}>
                    <DepthLayer
                      depth={1}
                      interactive
                      className="rounded-[16px] border border-ink-100 bg-white/90 p-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        {metric.label}
                      </p>
                      <p className="mt-1 font-display text-2xl font-semibold text-ink-950">
                        {metric.value}
                      </p>
                    </DepthLayer>
                  </StaggerChild>
                ))}
              </StaggerChildren>
              <div className="mt-4 flex h-24 items-end gap-1.5 rounded-[16px] bg-gradient-to-t from-brand-primary/10 to-transparent px-2 pb-2">
                {[36, 52, 44, 70, 58, 76, 64, 88].map((h, i) => (
                  <m.div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-brand-primary to-accent"
                    initial={reduce ? false : { height: 8, opacity: 0.4 }}
                    whileInView={reduce ? undefined : { height: `${h}%`, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    style={reduce ? { height: `${h}%` } : undefined}
                  />
                ))}
              </div>
            </DepthLayer>
          </SlideUp>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <SlideUp>
          <h2 className="font-display text-3xl font-semibold text-ink-950 md:text-4xl">
            One growth engine. Not eight subscriptions.
          </h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            Replace the stack agencies stitch together — SEO, AEO, content, ads, local, and
            reporting — starting at ${PLAN_PRICES_CENTS.STARTER / 100}/mo.
          </p>
        </SlideUp>
        <StaggerChildren className="mt-10 space-y-0 border-t border-ink-100">
          {STACK.map((row) => (
            <StaggerChild key={row.channel}>
              <div className="grid gap-2 border-b border-ink-100 py-4 md:grid-cols-[1.2fr_1.4fr_auto] md:items-center">
                <p className="font-medium text-ink-900">{row.channel}</p>
                <p className="text-sm text-ink-500">{row.replace}</p>
                <p className="text-sm font-semibold text-ink-800 md:text-right">
                  <span className="text-ink-300 line-through">${row.hire}</span>
                  <span className="ml-2 text-accent-dark">included</span>
                </p>
              </div>
            </StaggerChild>
          ))}
        </StaggerChildren>
        <FadeIn>
          <p className="mt-6 font-display text-2xl font-semibold text-ink-900">
            Stack total ~$8,000 → Taxotools from ${PLAN_PRICES_CENTS.STARTER / 100}/mo
          </p>
        </FadeIn>
      </section>

      <section className="border-y border-ink-100 bg-white/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SlideUp>
            <h2 className="font-display text-3xl font-semibold text-ink-950">
              Keeps working after you log off
            </h2>
            <p className="mt-3 max-w-xl text-ink-500">
              Rankings that slip get repaired overnight. Results show up in reports before you ask.
            </p>
          </SlideUp>
          <StaggerChildren className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <StaggerChild key={p.title}>
                <DepthLayer
                  depth={(1 + (i % 3)) as 1 | 2 | 3}
                  interactive
                  className="h-full border border-ink-100/80 bg-white/80 p-5 backdrop-blur-sm"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm text-brand-primary">
                    {p.icon}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{p.body}</p>
                </DepthLayer>
              </StaggerChild>
            ))}
          </StaggerChildren>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <SlideUp>
          <h2 className="font-display text-3xl font-semibold text-ink-950">
            The right level for every-sized team
          </h2>
          <p className="mt-3 text-ink-500">
            Search Atlas–competitive tiers. Taxo Agent + Content Genius on every plan.
          </p>
        </SlideUp>
        <StaggerChildren className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <StaggerChild key={plan.code}>
              <DepthLayer
                depth={plan.popular ? 3 : 1}
                interactive
                className={`flex h-full flex-col border bg-white/85 p-5 backdrop-blur-sm ${
                  plan.popular ? "border-brand-primary/30" : "border-ink-100"
                }`}
              >
                {plan.popular && (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
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
                  className={`mt-6 inline-block rounded-pill px-4 py-2.5 text-center text-sm font-semibold ${
                    plan.popular
                      ? "bg-brand-primary text-white"
                      : "border border-ink-100 bg-white text-ink-900"
                  }`}
                  initial={reduce ? false : "rest"}
                  whileHover={reduce ? undefined : "hover"}
                  whileTap={reduce ? undefined : "tap"}
                  variants={reduce ? undefined : hoverLift}
                >
                  Start trial
                </MotionLink>
              </DepthLayer>
            </StaggerChild>
          ))}
        </StaggerChildren>
      </section>

      <footer className="border-t border-ink-100 py-10 text-center text-sm text-ink-500">
        <StaggerChildren className="mx-auto max-w-md space-y-2" stagger={0.05}>
          <StaggerChild>
            <p className="brand-text font-display text-lg font-semibold">Taxotools</p>
          </StaggerChild>
          <StaggerChild>
            <p>SEO that ships itself · AEO · Ads · Content</p>
          </StaggerChild>
        </StaggerChildren>
      </footer>
    </main>
  );
}
