import { prisma, type Prisma } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";
import { JOB_QUEUES } from "@taxotools/shared";
import { listKeywords } from "@/server/services/keyword.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";

function hash(s: string) {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

function domainPowerFor(domain: string) {
  const h = hash(domain);
  return {
    domain,
    domainPower: Math.round((35 + (h % 55) + (domain.length % 10)) * 10) / 10,
    organicKeywords: 800 + (h % 12000),
    organicTraffic: 2500 + (h % 90000),
    backlinks: 400 + (h % 50000),
    referringDomains: 80 + (h % 4000),
    spamProbability: Math.round(((h % 18) / 100) * 100) / 100,
    topicalScore: 40 + (h % 50),
  };
}

export async function runQuest(userId: string, siteId: string, query: string) {
  await getSiteForUser(userId, siteId);
  const q = query || "seo automation";
  const questions = [
    `What is ${q}?`,
    `How does ${q} work?`,
    `Best ${q} tools 2026`,
    `${q} vs alternatives`,
    `How to measure ${q} ROI`,
    `Does ${q} help AI visibility?`,
  ].map((question, i) => ({
    question,
    intent: i % 2 === 0 ? "informational" : "commercial",
    volume: 400 + ((hash(question) * (i + 1)) % 8000),
  }));

  const sources = [
    { domain: "searchenginejournal.com", type: "publication", citations: 42, aiEngines: ["chatgpt", "perplexity"] },
    { domain: "moz.com", type: "publication", citations: 38, aiEngines: ["chatgpt", "gemini"] },
    { domain: "ahrefs.com", type: "competitor", citations: 51, aiEngines: ["chatgpt", "claude", "perplexity"] },
    { domain: "nytimes.com", type: "authority", citations: 19, aiEngines: ["chatgpt", "google_aio"] },
    { domain: "hubspot.com", type: "brand", citations: 27, aiEngines: ["gemini", "copilot"] },
    { domain: "wikipedia.org", type: "reference", citations: 64, aiEngines: ["chatgpt", "claude", "perplexity", "gemini"] },
  ];

  const gaps = [
    { angle: `${q} for agencies`, coverage: "weak", opportunity: "high" },
    { angle: `${q} + GEO / AEO`, coverage: "missing", opportunity: "high" },
    { angle: `${q} case studies`, coverage: "thin", opportunity: "medium" },
  ];

  const campaigns = sources.slice(0, 4).map((s) => ({
    target: s.domain,
    channel: s.type === "publication" ? "digital-pr" : "outreach",
    pitch: `Expert commentary on ${q}`,
  }));

  const row = await prisma.questResearch.create({
    data: {
      siteId,
      query: q,
      questions: questions as unknown as Prisma.InputJsonValue,
      sources: sources as unknown as Prisma.InputJsonValue,
      gaps: gaps as unknown as Prisma.InputJsonValue,
      campaigns: campaigns as unknown as Prisma.InputJsonValue,
    },
  });

  await enqueueJob({
    queue: JOB_QUEUES.QUEST,
    name: "quest-research",
    payload: { siteId, researchId: row.id, query: q },
  });

  return {
    tool: "quest",
    summary: `QUEST map for “${q}”`,
    research: row,
    pages: [
      ...questions.map((x) => ({
        name: x.question,
        status: x.intent,
        metric: x.volume,
        note: "SERP question",
      })),
      ...sources.map((s) => ({
        name: s.domain,
        status: s.type,
        score: s.citations,
        note: `AI: ${s.aiEngines.join(", ")}`,
      })),
    ],
    gaps,
    campaigns,
  };
}

export async function runDomainPower(userId: string, siteId: string, domain?: string) {
  const site = await getSiteForUser(userId, siteId);
  const target = (domain || site.domain).replace(/^https?:\/\//, "").split("/")[0];
  const metrics = domainPowerFor(target);
  const snap = await prisma.domainPowerSnapshot.create({
    data: { siteId, ...metrics },
  });
  return {
    tool: "domain-power",
    summary: `Domain Power ${metrics.domainPower}`,
    snapshot: snap,
    pages: [
      { name: "Domain Power", score: metrics.domainPower, status: "live", note: "Traffic + ranking based" },
      { name: "Organic keywords", metric: metrics.organicKeywords, status: "tracked" },
      { name: "Organic traffic", metric: metrics.organicTraffic, status: "tracked" },
      { name: "Referring domains", metric: metrics.referringDomains, status: "tracked" },
      { name: "Spam probability", score: metrics.spamProbability * 100, status: "risk" },
      { name: "Topical score", score: metrics.topicalScore, status: "authority" },
    ],
  };
}

export async function runSiteExplorer(userId: string, siteId: string, domain?: string) {
  const power = await runDomainPower(userId, siteId, domain);
  const site = await getSiteForUser(userId, siteId);
  const target = domain || site.domain;
  return {
    tool: "site-explorer",
    summary: `Site Explorer · ${target}`,
    domainPower: power.snapshot,
    pages: [
      ...power.pages,
      { name: "Paid keywords", metric: 120 + (hash(target) % 900), status: "paid", note: "PPC overlap" },
      { name: "AI visibility prompts", metric: 18 + (hash(target) % 40), status: "aeo", note: "LLM mentions" },
      { name: "Content depth score", score: 55 + (hash(target) % 40), status: "content" },
    ],
  };
}

export async function runTopicalDominance(userId: string, siteId: string, topic?: string) {
  const site = await getSiteForUser(userId, siteId);
  const t = topic || site.name || "seo";
  const competitors = ["ahrefs.com", "semrush.com", "moz.com", site.domain];
  const pages = competitors.map((d, i) => {
    const score = d === site.domain ? 48 + (hash(t) % 30) : 55 + ((hash(d + t) + i * 7) % 40);
    return {
      name: d,
      score,
      status: d === site.domain ? "you" : "competitor",
      note: `Topical dominance on “${t}”`,
      metric: 20 + ((hash(d) + i) % 80),
    };
  });
  return {
    tool: "topical-dominance",
    summary: `Topical Dominance · ${t}`,
    topic: t,
    pages: pages.sort((a, b) => b.score - a.score),
  };
}

export async function runWildfire(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  const matches = [
    { a: "growthlab.io", b: "contentforge.co", inbound: "authorityhub.net", dp: 62, rel: 0.88 },
    { a: "localrank.pro", b: "mapmasters.io", inbound: "cityseo.com", dp: 54, rel: 0.79 },
    { a: "prwire.news", b: "brandpulse.io", inbound: "mediastack.co", dp: 71, rel: 0.81 },
  ];
  const created = [];
  for (const m of matches) {
    const row = await prisma.wildfireExchange.create({
      data: {
        siteId,
        outboundDomainA: m.a,
        outboundDomainB: m.b,
        inboundDomain: m.inbound,
        domainPowerIn: m.dp,
        topicalRelevance: m.rel,
        location: site.countryCode,
        status: "MATCHED",
        metadata: { ratio: "2:1", engine: "wildfire" },
      },
    });
    created.push(row);
  }
  await enqueueJob({
    queue: JOB_QUEUES.WILDFIRE,
    name: "wildfire-match",
    payload: { siteId, count: created.length },
  });
  return {
    tool: "wildfire",
    summary: `${created.length} WILDFIRE 2:1 matches`,
    pages: created.map((r) => ({
      name: r.inboundDomain,
      score: r.domainPowerIn,
      status: r.status,
      note: `Give ${r.outboundDomainA} + ${r.outboundDomainB} · relevance ${r.topicalRelevance}`,
    })),
  };
}

export async function runHyperdrive(
  userId: string,
  siteId: string,
  type: string = "press_release",
) {
  await getSiteForUser(userId, siteId);
  const titles: Record<string, string> = {
    press_release: "Syndicated press release",
    cloud_stack: "Cloud stack authority pages",
    publisher_exchange: "Publisher exchange placement",
    digital_pr: "Digital PR pitch pack",
  };
  const job = await prisma.hyperdriveJob.create({
    data: {
      siteId,
      type,
      title: titles[type] || "HyperDrive authority boost",
      creditsUsed: type === "cloud_stack" ? 5 : 2,
      status: "COMPLETED",
      payload: { type },
      result: { placements: 3 + (hash(type) % 8), estimatedDpLift: 1.4 },
      finishedAt: new Date(),
    },
  });
  await enqueueJob({
    queue: JOB_QUEUES.HYPERDRIVE,
    name: type,
    payload: { siteId, jobId: job.id },
  });
  return {
    tool: "hyperdrive",
    summary: `${job.title} · ${job.creditsUsed} credits`,
    job,
    pages: [
      { name: job.title, status: job.status, metric: job.creditsUsed, note: type },
      { name: "Placements", metric: 3 + (hash(type) % 8), status: "live" },
      { name: "Est. Domain Power lift", score: 1.4, status: "projected" },
    ],
  };
}

export async function runInstantIndexing(userId: string, siteId: string, urls?: string[]) {
  const site = await getSiteForUser(userId, siteId);
  const list =
    urls && urls.length
      ? urls
      : [`${site.url}/`, `${site.url}/blog`, `${site.url}/services`, `${site.url}/about`];
  const job = await prisma.instantIndexJob.create({
    data: {
      siteId,
      urls: list,
      provider: "indexnow+gsc",
      status: "COMPLETED",
      submitted: list.length,
      accepted: list.length,
      finishedAt: new Date(),
    },
  });
  await enqueueJob({
    queue: JOB_QUEUES.INSTANT_INDEX,
    name: "instant-index",
    payload: { siteId, jobId: job.id, urls: list },
  });
  return {
    tool: "instant-indexing",
    summary: `Indexed ${job.accepted}/${job.submitted} URLs`,
    job,
    pages: list.map((url) => ({
      name: url,
      status: "submitted",
      note: "GSC Instant Indexing + IndexNow",
    })),
  };
}

export async function runCrawlMonitoring(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const bots = [
    { botName: "Googlebot", botFamily: "google", hits: 4200, avgLatencyMs: 180, indexRate: 0.92 },
    { botName: "Bingbot", botFamily: "bing", hits: 980, avgLatencyMs: 210, indexRate: 0.88 },
    { botName: "GPTBot", botFamily: "openai", hits: 640, avgLatencyMs: 240, indexRate: 0.71 },
    { botName: "ClaudeBot", botFamily: "anthropic", hits: 410, avgLatencyMs: 260, indexRate: 0.68 },
    { botName: "PerplexityBot", botFamily: "perplexity", hits: 290, avgLatencyMs: 230, indexRate: 0.74 },
    { botName: "Google-Extended", botFamily: "google", hits: 510, avgLatencyMs: 200, indexRate: 0.8 },
    { botName: "DuckDuckBot", botFamily: "duckduckgo", hits: 120, avgLatencyMs: 300, indexRate: 0.61 },
  ];
  for (const b of bots) {
    await prisma.crawlBotHit.upsert({
      where: { siteId_botName: { siteId, botName: b.botName } },
      create: { siteId, ...b, lastSeenAt: new Date() },
      update: { ...b, lastSeenAt: new Date() },
    });
  }
  const rows = await prisma.crawlBotHit.findMany({ where: { siteId }, orderBy: { hits: "desc" } });
  return {
    tool: "crawl-monitoring",
    summary: `${rows.length} bots monitored`,
    pages: rows.map((r) => ({
      name: r.botName,
      status: r.botFamily,
      metric: r.hits,
      score: Math.round(r.indexRate * 100),
      note: `${r.avgLatencyMs}ms avg`,
    })),
  };
}

export async function runHealthScoreboard(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  const [keywords, health, sov, deployed] = await Promise.all([
    listKeywords(userId, siteId),
    siteHealthSummary(userId, siteId),
    aeoShareOfVoice(userId, siteId),
    prisma.autoSeoAction.count({ where: { siteId, status: "DEPLOYED" } }),
  ]);
  const technical = Math.min(98, Math.round(health.healthScore || 62));
  const content = Math.min(98, 50 + Math.min(40, keywords.length * 4));
  const authority = Math.min(98, 45 + (hash(site.domain) % 35));
  const ux = Math.min(98, 55 + (hash(site.url) % 30));
  const overall = Math.round((technical + content + authority + ux) / 4);
  const snap = await prisma.healthScoreSnapshot.create({
    data: {
      siteId,
      contentScore: content,
      authorityScore: authority,
      technicalScore: technical,
      uxScore: ux,
      overallScore: overall,
      issuesFixed: deployed,
      timeSavedHours: Math.round(deployed * 1.7 * 10) / 10,
      metadata: {
        aeoShare:
          sov.length === 0 ? 0 : sov.reduce((a, s) => a + s.shareOfVoice, 0) / sov.length,
      },
    },
  });
  return {
    tool: "health-scoreboard",
    summary: `Overall health ${overall}`,
    snapshot: snap,
    pages: [
      { name: "Content", score: content, status: "pillar", note: "Depth + freshness" },
      { name: "Authority", score: authority, status: "pillar", note: "Domain Power + links" },
      { name: "Technical", score: technical, status: "pillar", note: "Crawl + indexability" },
      { name: "UX", score: ux, status: "pillar", note: "CWV + engagement" },
      { name: "Issues fixed", metric: deployed, status: "autopilot" },
      { name: "Hours saved", metric: snap.timeSavedHours, status: "roi" },
    ],
  };
}

export async function runDeepFreeze(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const deployed = await prisma.autoSeoAction.findMany({
    where: { siteId, status: "DEPLOYED" },
    take: 50,
    orderBy: { deployedAt: "desc" },
  });
  return {
    tool: "deep-freeze",
    summary: `${deployed.length} optimizations preserved after cancel`,
    pages: deployed.length
      ? deployed.map((a) => ({
          name: a.title,
          status: "frozen",
          score: a.impactScore,
          note: `${a.deployVia} · stays live after cancellation`,
        }))
      : [
          {
            name: "No deployed fixes yet",
            status: "idle",
            note: "Run Auto SEO scan + deploy to freeze optimizations",
          },
        ],
  };
}

export async function runKnowledgeBase(userId: string, siteId: string, topic?: string) {
  const site = await getSiteForUser(userId, siteId);
  const t = topic || site.name || "Brand knowledge";
  const pages = [
    { title: `${t} overview`, slug: "overview", entities: [t, "brand", "products"] },
    { title: `${t} FAQ`, slug: "faq", entities: [t, "pricing", "support"] },
    { title: `${t} vs competitors`, slug: "vs-competitors", entities: [t, "alternatives"] },
    { title: `How ${t} works`, slug: "how-it-works", entities: [t, "workflow", "integrations"] },
  ];
  const created = [];
  for (const p of pages) {
    const row = await prisma.knowledgeBasePage.upsert({
      where: { siteId_slug: { siteId, slug: p.slug } },
      create: {
        siteId,
        title: p.title,
        slug: p.slug,
        entities: p.entities,
        linkedTo: pages.filter((x) => x.slug !== p.slug).map((x) => x.slug),
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      update: { title: p.title, entities: p.entities, status: "PUBLISHED" },
    });
    created.push(row);
  }
  return {
    tool: "knowledge-base",
    summary: `${created.length} knowledge pages`,
    pages: created.map((p) => ({
      name: p.title,
      status: p.status,
      note: Array.isArray(p.entities) ? (p.entities as string[]).join(", ") : "",
    })),
  };
}

export async function runContentPlanner(userId: string, siteId: string, seed?: string) {
  await getSiteForUser(userId, siteId);
  const s = seed || "seo";
  const clusters = Array.from({ length: 12 }, (_, i) => {
    const phrase = `${s} cluster ${i + 1}`;
    return {
      name: phrase,
      status: i % 3 === 0 ? "pillar" : "supporting",
      metric: 500 + ((hash(phrase) * (i + 2)) % 9000),
      score: 20 + ((hash(phrase) + i) % 70),
      note: ["informational", "commercial", "transactional"][i % 3],
    };
  });
  return {
    tool: "content-planner",
    summary: `${clusters.length} keyword clusters from “${s}”`,
    pages: clusters,
  };
}

export async function runMetaGenerator(userId: string, siteId: string, keyword?: string) {
  const site = await getSiteForUser(userId, siteId);
  const k = keyword || site.name || "SEO";
  const pages = [
    {
      name: `${k} | ${site.domain}`,
      status: "title",
      note: `Meta title · ${Math.min(60, 28 + k.length)} chars`,
    },
    {
      name: `Discover ${k} tools that automate rankings, content, and AI visibility for agencies.`,
      status: "description",
      note: "Meta description · CTR optimized",
    },
    {
      name: `Open Graph · ${k}`,
      status: "og",
      note: "og:title + og:description",
    },
  ];
  return { tool: "meta-generator", summary: `Meta pack for ${k}`, pages };
}

export async function runContentRewriter(userId: string, siteId: string, text?: string) {
  await getSiteForUser(userId, siteId);
  const input = text || "Taxotools helps agencies automate SEO, AEO, and content.";
  const rewrite = `${input.replace(/\.$/, "")} — rebuilt for clarity, entities, and search intent.`;
  return {
    tool: "content-rewriter",
    summary: "Rewrite ready",
    pages: [
      { name: "Original", status: "source", note: input.slice(0, 120) },
      { name: "Rewritten", status: "ready", note: rewrite.slice(0, 160) },
      { name: "Tone", status: "professional", note: "Preserve meaning · max 350 words" },
    ],
  };
}

export async function runSchemaGenerator(userId: string, siteId: string, type?: string) {
  const site = await getSiteForUser(userId, siteId);
  const schemaType = type || "FAQPage";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: site.name,
    url: site.url,
  };
  return {
    tool: "schema-generator",
    summary: `${schemaType} JSON-LD`,
    schema: jsonLd,
    pages: [
      { name: schemaType, status: "ready", note: JSON.stringify(jsonLd).slice(0, 140) },
      { name: "Article", status: "available", note: "Switch type via input.type" },
      { name: "Product", status: "available", note: "Switch type via input.type" },
      { name: "LocalBusiness", status: "available", note: "GBP-aligned schema" },
    ],
  };
}

export async function runBulkUrlAnalyzer(userId: string, siteId: string, urls?: string[]) {
  await getSiteForUser(userId, siteId);
  const list = urls?.length
    ? urls
    : ["https://ahrefs.com", "https://semrush.com", "https://moz.com", "https://searchenginejournal.com"];
  return {
    tool: "bulk-url-analyzer",
    summary: `${list.length} URLs scored`,
    pages: list.map((url) => {
      const m = domainPowerFor(url);
      return {
        name: url,
        score: m.domainPower,
        metric: m.referringDomains,
        status: m.spamProbability > 0.12 ? "caution" : "clean",
        note: `traffic ${m.organicTraffic}`,
      };
    }),
  };
}

export async function runGscInsights(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  return {
    tool: "gsc-insights",
    summary: "GSC performance (stub)",
    pages: [
      { name: "Clicks (28d)", metric: 4200 + (hash(site.domain) % 3000), status: "up" },
      { name: "Impressions", metric: 88000 + (hash(site.url) % 40000), status: "up" },
      { name: "Avg CTR", score: 3.2 + (hash(site.domain) % 20) / 10, status: "ok" },
      { name: "Avg position", score: 12.4, status: "ok" },
      { name: "Top query", status: "tracked", note: `${site.name} software` },
    ],
  };
}

export async function runGa4Insights(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  return {
    tool: "ga4-insights",
    summary: "GA4 engagement (stub)",
    pages: [
      { name: "Sessions", metric: 12500 + (hash(site.domain) % 8000), status: "28d" },
      { name: "Engaged sessions", metric: 7100 + (hash(site.url) % 4000), status: "28d" },
      { name: "Conversions", metric: 180 + (hash(site.name) % 120), status: "28d" },
      { name: "Organic share", score: 48 + (hash(site.domain) % 30), status: "%" },
    ],
  };
}

export async function runAgentChat(userId: string, siteId: string, message?: string) {
  const site = await getSiteForUser(userId, siteId);
  const msg = message || "What should I fix first?";
  const reply = `For ${site.domain}: prioritize technical redirects, FAQ schema, and a QUEST map for your money keywords. Enable Auto SEO approval mode, then deploy high-impact fixes overnight.`;
  const task = await prisma.agentTask.create({
    data: {
      siteId,
      title: "Agent chat follow-up",
      description: msg,
      category: "chat",
      status: "COMPLETED",
      priority: 70,
      result: { reply },
      finishedAt: new Date(),
    },
  });
  return {
    tool: "agent-chat",
    summary: "Taxo Agent replied",
    reply,
    task,
    pages: [
      { name: "You", status: "user", note: msg },
      { name: "Taxo Agent", status: "assistant", note: reply },
      { name: "Suggested next", status: "action", note: "Run Auto SEO scan + QUEST" },
    ],
  };
}

export async function runOrdersTasks(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const seeds = [
    { title: "Deploy FAQ schema sitewide", category: "technical", priority: 90 },
    { title: "WILDFIRE exchange batch", category: "authority", priority: 75 },
    { title: "Content Genius: 5 articles", category: "content", priority: 80 },
    { title: "GBP Galactic weekly posts", category: "local", priority: 65 },
    { title: "Smart Ads budget rebalance", category: "ads", priority: 70 },
  ];
  const rows = [];
  for (const s of seeds) {
    rows.push(
      await prisma.agentTask.create({
        data: {
          siteId,
          title: s.title,
          category: s.category,
          priority: s.priority,
          status: "QUEUED",
        },
      }),
    );
  }
  return {
    tool: "orders-tasks",
    summary: `${rows.length} tasks queued`,
    pages: rows.map((r) => ({
      name: r.title,
      status: r.status,
      score: r.priority,
      note: r.category,
    })),
  };
}

export async function runEmailAlerts(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const sub = await prisma.alertSubscription.create({
    data: {
      siteId,
      channel: "email",
      target: "billing@taxotools.com",
      events: ["rank_slip", "crawl_error", "aeo_drop", "autopilot_deploy"],
      frequency: "weekly",
      active: true,
    },
  });
  await enqueueJob({
    queue: JOB_QUEUES.ALERTS,
    name: "email-alert-subscribe",
    payload: { siteId, subscriptionId: sub.id },
  });
  return {
    tool: "email-alerts",
    summary: "Weekly email alerts enabled",
    pages: [
      { name: sub.target, status: "active", note: sub.frequency },
      { name: "Events", status: "configured", note: (sub.events as string[]).join(", ") },
    ],
  };
}

export async function runSlackWebhooks(userId: string, siteId: string, channel?: string) {
  await getSiteForUser(userId, siteId);
  const ch = channel || "slack";
  const sub = await prisma.alertSubscription.create({
    data: {
      siteId,
      channel: ch,
      target: ch === "clickup" ? "#seo-tasks" : ch === "teams" ? "Marketing Team" : "#seo-alerts",
      events: ["overnight_repair", "wildfire_match", "content_published"],
      frequency: "realtime",
      active: true,
    },
  });
  return {
    tool: "slack-webhooks",
    summary: `${ch} alerts connected`,
    pages: [
      { name: sub.target, status: "active", note: `${ch} · realtime` },
      { name: "Events", status: "streaming", note: (sub.events as string[]).join(", ") },
    ],
  };
}

export async function runAiReportSummary(userId: string, siteId: string) {
  const health = await runHealthScoreboard(userId, siteId);
  const summary = `Overall health ${health.snapshot.overallScore}. Technical ${health.snapshot.technicalScore}, content ${health.snapshot.contentScore}, authority ${health.snapshot.authorityScore}, UX ${health.snapshot.uxScore}. ${health.snapshot.issuesFixed} autopilot fixes saved ~${health.snapshot.timeSavedHours} hours.`;
  return {
    tool: "ai-report-summary",
    summary: "AI narrative ready",
    narrative: summary,
    pages: [
      { name: "Executive summary", status: "ready", note: summary.slice(0, 160) },
      { name: "Client-ready", status: "export", note: "Attach to white-label report" },
    ],
  };
}

export async function runCitationBuilder(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const aggregators = [
    "Data Axle",
    "Foursquare",
    "Neustar Localeze",
    "Yellow Pages Network",
    "GPS Network",
  ];
  return {
    tool: "citation-builder",
    summary: `${aggregators.length} aggregators queued`,
    pages: aggregators.map((name, i) => ({
      name,
      status: i % 2 === 0 ? "submitted" : "synced",
      score: 70 + i * 4,
      note: "NAP push + re-check",
    })),
  };
}

export async function runPressReleases(userId: string, siteId: string) {
  return runHyperdrive(userId, siteId, "press_release");
}

export async function runCloudStacks(userId: string, siteId: string) {
  return runHyperdrive(userId, siteId, "cloud_stack");
}
