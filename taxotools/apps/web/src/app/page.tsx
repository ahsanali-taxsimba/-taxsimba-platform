import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-grid-fade">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 animate-rise">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink-950">
          Taxotools
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="px-3 py-2 text-ink-700 hover:text-ink-950">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white shadow-sm transition hover:bg-accent-dark"
          >
            Start free trial
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 pt-10 md:pt-16">
        <div className="absolute inset-x-0 top-8 -z-10 mx-auto h-[420px] max-w-5xl rounded-[2rem] bg-hero-mesh opacity-95 animate-pulse-soft" />
        <div className="relative max-w-3xl animate-rise text-white drop-shadow-sm">
          <p className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Taxotools
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-2xl font-medium leading-snug md:text-3xl">
            SEO, AEO, and AI content intelligence in one workspace.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
            Track rankings, crawl site health, generate SEO articles, and measure brand presence
            across ChatGPT, Claude, Gemini, and Google AI Overviews.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-ink-100"
            >
              Create workspace
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              View demo login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-3">
        {[
          {
            title: "Rank + SERP intelligence",
            body: "Daily desktop/mobile ranks, local tracking, and AI Overview detection.",
          },
          {
            title: "Technical + content audits",
            body: "Crawl issues, Core Web Vitals hooks, content scoring, and programmatic SEO.",
          },
          {
            title: "AEO / GEO visibility",
            body: "Scheduled AI prompts, citation tracking, and share of voice across engines.",
          },
        ].map((item, i) => (
          <article
            key={item.title}
            className="animate-rise border-t border-ink-100 pt-5"
            style={{ animationDelay: `${0.15 * (i + 1)}s` }}
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
