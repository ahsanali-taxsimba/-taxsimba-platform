import { prisma, type Prisma, SearchIntent } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import { listKeywords, keywordGap, enqueueRankCheck } from "@/server/services/keyword.service";
import { siteHealthSummary, listCrawls, startCrawl } from "@/server/services/crawl.service";
import { createAIJob, generateArticleStub, scoreContent, listAIJobs } from "@/server/services/ai-content.service";
import { listVisibility, aeoShareOfVoice, startAeoScan } from "@/server/services/aeo.service";
import { enqueueJob } from "@/server/queue";

function seed(n: string) {
  return [...n].reduce((a, c) => a + c.charCodeAt(0), 0);
}

function intentFor(phrase: string): SearchIntent {
  const p = phrase.toLowerCase();
  if (/\b(buy|price|pricing|cost|cheap)\b/.test(p)) return "TRANSACTIONAL";
  if (/\b(best|vs|review|compare|top)\b/.test(p)) return "COMMERCIAL";
  if (/\b(login|official)\b/.test(p)) return "NAVIGATIONAL";
  return "INFORMATIONAL";
}

function magicSuggestions(seedPhrase: string) {
  const bases = [
    seedPhrase,
    `${seedPhrase} tool`,
    `${seedPhrase} software`,
    `best ${seedPhrase}`,
    `${seedPhrase} for agencies`,
    `${seedPhrase} pricing`,
    `how to ${seedPhrase}`,
    `${seedPhrase} checklist`,
    `${seedPhrase} examples`,
    `${seedPhrase} vs alternatives`,
    `what is ${seedPhrase}`,
    `${seedPhrase} template`,
  ];
  return bases.map((phrase) => {
    const s = seed(phrase);
    return {
      phrase,
      volume: 200 + (s % 12000),
      difficulty: 20 + (s % 70),
      cpcCents: 40 + (s % 900),
      intent: intentFor(phrase),
      questions: phrase.startsWith("how") || phrase.startsWith("what"),
    };
  });
}

export async function runTool(
  userId: string,
  siteId: string,
  toolId: string,
  input: Record<string, unknown> = {},
) {
  const site = await getSiteForUser(userId, siteId);

  switch (toolId) {
    case "keyword-research": {
      const keywords = await listKeywords(userId, siteId);
      return {
        tool: toolId,
        summary: `${keywords.length} tracked keywords`,
        keywords,
      };
    }
    case "keyword-magic": {
      const q = String(input.query || site.name || "seo").toLowerCase();
      return { tool: toolId, query: q, suggestions: magicSuggestions(q) };
    }
    case "keyword-gap": {
      const competitor = String(input.competitorDomain || "semrush.com");
      const gap = await keywordGap(userId, siteId, competitor);
      return { tool: toolId, ...gap };
    }
    case "organic-research": {
      const domain = String(input.domain || site.domain);
      let rows = await prisma.organicSnapshot.findMany({
        where: { siteId, OR: [{ competitorDomain: domain }, { competitorDomain: null }] },
        orderBy: { trafficShare: "desc" },
        take: 50,
      });
      if (!rows.length) {
        const phrases = magicSuggestions(domain.split(".")[0] || "seo").slice(0, 12);
        await prisma.organicSnapshot.createMany({
          data: phrases.map((p, i) => ({
            siteId,
            competitorDomain: domain === site.domain ? null : domain,
            keyword: p.phrase,
            position: (i % 20) + 1,
            url: `https://${domain}/${p.phrase.replace(/\s+/g, "-")}`,
            trafficShare: Math.max(0.01, 0.2 - i * 0.012),
            volume: p.volume,
          })),
        });
        rows = await prisma.organicSnapshot.findMany({
          where: { siteId },
          orderBy: { trafficShare: "desc" },
          take: 50,
        });
      }
      return { tool: toolId, domain, pages: rows };
    }
    case "position-tracking": {
      const keywords = await listKeywords(userId, siteId);
      return {
        tool: toolId,
        keywords: keywords.map((k) => ({
          phrase: k.phrase,
          device: k.device,
          location: k.location || "National",
          position: k.ranks[0]?.position ?? null,
          previous: k.ranks[0]?.previousPosition ?? null,
          hasAiOverview: k.ranks[0]?.hasAiOverview ?? false,
        })),
      };
    }
    case "serp-features": {
      const features = await prisma.sERPFeature.findMany({
        where: { keyword: { siteId } },
        include: { keyword: { select: { phrase: true } } },
        orderBy: { checkedAt: "desc" },
        take: 100,
      });
      return { tool: toolId, features };
    }
    case "backlink-analytics": {
      const backlinks = await prisma.backlink.findMany({
        where: { siteId },
        include: { sourceDomain: true },
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      });
      const avgToxic =
        backlinks.length === 0
          ? 0
          : backlinks.reduce((a, b) => a + (b.toxicScore ?? 0), 0) / backlinks.length;
      return {
        tool: toolId,
        totals: {
          backlinks: backlinks.length,
          referringDomains: new Set(backlinks.map((b) => b.sourceUrl.split("/")[2])).size,
          avgToxicScore: avgToxic,
        },
        backlinks,
      };
    }
    case "backlink-audit": {
      let items = await prisma.backlinkAuditItem.findMany({
        where: { siteId },
        orderBy: { toxicScore: "desc" },
      });
      if (!items.length) {
        const links = await prisma.backlink.findMany({ where: { siteId }, take: 20 });
        if (links.length) {
          await prisma.backlinkAuditItem.createMany({
            data: links.map((l) => ({
              siteId,
              sourceUrl: l.sourceUrl,
              targetUrl: l.targetUrl,
              toxicScore: l.toxicScore ?? 0.2,
              reason: (l.toxicScore ?? 0) > 0.6 ? "High spam signals / weak anchor relevance" : "OK",
              action: (l.toxicScore ?? 0) > 0.6 ? "disavow" : "keep",
            })),
          });
          items = await prisma.backlinkAuditItem.findMany({
            where: { siteId },
            orderBy: { toxicScore: "desc" },
          });
        }
      }
      return { tool: toolId, items };
    }
    case "link-building": {
      let prospects = await prisma.linkBuildingProspect.findMany({
        where: { siteId },
        orderBy: { authority: "desc" },
      });
      if (!prospects.length) {
        await prisma.linkBuildingProspect.createMany({
          data: [
            {
              siteId,
              domain: "marketingland.example",
              pageUrl: "https://marketingland.example/guest",
              authority: 72,
              status: "PROSPECT",
              notes: "Accepts expert SEO guest posts",
            },
            {
              siteId,
              domain: "saasroundup.example",
              pageUrl: "https://saasroundup.example/contribute",
              authority: 58,
              status: "CONTACTED",
              contactEmail: "editor@saasroundup.example",
            },
            {
              siteId,
              domain: "growthops.example",
              authority: 64,
              status: "PROSPECT",
            },
          ],
        });
        prospects = await prisma.linkBuildingProspect.findMany({ where: { siteId } });
      }
      return { tool: toolId, prospects };
    }
    case "site-audit": {
      const health = await siteHealthSummary(userId, siteId);
      const crawls = await listCrawls(userId, siteId);
      return { tool: toolId, health, crawls };
    }
    case "on-page-checker": {
      const url = String(input.url || site.url);
      const keyword = String(input.keyword || "seo tools");
      const check = await prisma.onPageCheck.create({
        data: {
          siteId,
          url,
          targetKeyword: keyword,
          score: 62 + (seed(url + keyword) % 30),
          ideasJson: {
            ideas: [
              { severity: "high", text: `Add target keyword “${keyword}” to H1` },
              { severity: "medium", text: "Improve meta description length (120–155 chars)" },
              { severity: "medium", text: "Add FAQ section targeting PAA queries" },
              { severity: "low", text: "Increase internal links to topical cluster pages" },
            ],
          } as Prisma.InputJsonValue,
        },
      });
      return { tool: toolId, check };
    }
    case "seo-content-template": {
      const keyword = String(input.keyword || "seo tools");
      const tpl = await prisma.seoContentTemplate.create({
        data: {
          siteId,
          targetKeyword: keyword,
          titleIdeas: [
            `${keyword}: Complete Guide (2026)`,
            `How to Master ${keyword} for Growth`,
            `Best Practices for ${keyword}`,
          ] as Prisma.InputJsonValue,
          outlineJson: {
            h2: [
              `What is ${keyword}?`,
              `Why ${keyword} matters`,
              `Step-by-step framework`,
              `Tools and metrics`,
              `FAQs`,
            ],
          } as Prisma.InputJsonValue,
          semanticsJson: {
            mustHave: [keyword, "search visibility", "rankings", "content strategy"],
            related: magicSuggestions(keyword).slice(0, 8).map((s) => s.phrase),
          } as Prisma.InputJsonValue,
          readabilityTarget: 60,
        },
      });
      return { tool: toolId, template: tpl };
    }
    case "seo-writing-assistant":
    case "ai-writing-assistant": {
      const keyword = String(input.keyword || "seo");
      const draft = String(input.text || generateArticleStub({ keyword }).bodyMarkdown);
      const scored = await scoreContent({
        userId,
        siteId,
        url: String(input.url || `${site.url}/draft`),
        targetKeyword: keyword,
        text: draft,
      });
      const session = await prisma.writingAssistantSession.create({
        data: {
          siteId,
          title: `Draft: ${keyword}`,
          targetKeyword: keyword,
          draftText: draft,
          score: scored.score,
          suggestions: {
            tips: [
              "Add more semantic entities from the content template",
              "Target featured snippet with a concise definition paragraph",
              "Include 2–3 internal links",
            ],
          } as Prisma.InputJsonValue,
        },
      });
      return { tool: toolId, session, contentPage: scored };
    }
    case "log-file-analyzer": {
      const analysis = await prisma.logFileAnalysis.create({
        data: {
          siteId,
          status: "COMPLETED",
          fileName: String(input.fileName || "access.log"),
          linesParsed: 12500,
          botHits: 1840,
          errorHits: 96,
          summaryJson: {
            topBots: ["Googlebot", "Bingbot", "GPTBot"],
            orphanCandidates: ["/old-promo", "/legacy/docs"],
          } as Prisma.InputJsonValue,
          finishedAt: new Date(),
          hits: {
            create: [
              { path: "/", statusCode: 200, botName: "Googlebot", hits: 420 },
              { path: "/pricing", statusCode: 200, botName: "Googlebot", hits: 188 },
              { path: "/legacy/docs", statusCode: 404, botName: "Bingbot", hits: 44, isError: true },
            ],
          },
        },
        include: { hits: true },
      });
      return { tool: toolId, analysis };
    }
    case "topic-research": {
      let ideas = await prisma.topicIdea.findMany({ where: { siteId }, take: 30 });
      if (!ideas.length) {
        const seedTopic = String(input.topic || "seo");
        await prisma.topicIdea.createMany({
          data: magicSuggestions(seedTopic).map((s) => ({
            siteId,
            topic: seedTopic,
            headline: s.phrase.replace(/^\w/, (c) => c.toUpperCase()),
            difficulty: s.difficulty,
            volume: s.volume,
            contentType: s.questions ? "faq" : "guide",
            relatedJson: { related: magicSuggestions(s.phrase).slice(0, 4).map((x) => x.phrase) },
          })),
        });
        ideas = await prisma.topicIdea.findMany({ where: { siteId }, take: 30 });
      }
      return { tool: toolId, ideas };
    }
    case "content-audit": {
      const pages = await prisma.contentPage.findMany({
        where: { siteId },
        orderBy: { score: "asc" },
        take: 50,
      });
      const audit = await prisma.contentAudit.create({
        data: {
          siteId,
          status: "COMPLETED",
          thinCount: pages.filter((p) => (p.wordCount ?? 0) < 400).length,
          duplicateCount: 0,
          outdatedCount: pages.filter(
            (p) => !p.lastScoredAt || p.lastScoredAt < new Date(Date.now() - 180 * 86400000),
          ).length,
          summaryJson: { reviewed: pages.length } as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      return { tool: toolId, audit, pages };
    }
    case "marketing-calendar": {
      let events = await prisma.marketingCalendarEvent.findMany({
        where: { siteId },
        orderBy: { scheduledAt: "asc" },
      });
      if (!events.length) {
        const now = Date.now();
        await prisma.marketingCalendarEvent.createMany({
          data: [
            {
              siteId,
              title: "Publish AEO visibility guide",
              channel: "blog",
              status: "planned",
              scheduledAt: new Date(now + 3 * 86400000),
            },
            {
              siteId,
              title: "LinkedIn carousel: rank tracking tips",
              channel: "linkedin",
              status: "planned",
              scheduledAt: new Date(now + 5 * 86400000),
            },
            {
              siteId,
              title: "Newsletter: monthly SEO + AI report",
              channel: "email",
              status: "draft",
              scheduledAt: new Date(now + 10 * 86400000),
            },
          ],
        });
        events = await prisma.marketingCalendarEvent.findMany({
          where: { siteId },
          orderBy: { scheduledAt: "asc" },
        });
      }
      return { tool: toolId, events };
    }
    case "post-tracking": {
      let posts = await prisma.trackedPost.findMany({ where: { siteId } });
      if (!posts.length) {
        await prisma.trackedPost.createMany({
          data: [
            {
              siteId,
              url: `${site.url}/blog/seo-guide`,
              title: "SEO Guide",
              publishedAt: new Date(Date.now() - 40 * 86400000),
              backlinks: 12,
              shares: 84,
              organicTraffic: 2200,
            },
            {
              siteId,
              url: `${site.url}/blog/aeo-basics`,
              title: "AEO Basics",
              publishedAt: new Date(Date.now() - 12 * 86400000),
              backlinks: 3,
              shares: 41,
              organicTraffic: 640,
            },
          ],
        });
        posts = await prisma.trackedPost.findMany({ where: { siteId } });
      }
      return { tool: toolId, posts };
    }
    case "content-templates": {
      let templates = await prisma.contentTemplate.findMany({ where: { siteId } });
      if (!templates.length) {
        await prisma.contentTemplate.createMany({
          data: [
            {
              siteId,
              name: "Pillar Guide",
              type: "article",
              structureJson: { sections: ["intro", "framework", "examples", "faq", "cta"] },
            },
            {
              siteId,
              name: "Comparison Post",
              type: "article",
              structureJson: { sections: ["criteria", "table", "verdict"] },
            },
            {
              siteId,
              name: "Programmatic Location Page",
              type: "programmatic",
              structureJson: { slots: ["city", "service", "proof", "faq"] },
            },
          ],
        });
        templates = await prisma.contentTemplate.findMany({ where: { siteId } });
      }
      return { tool: toolId, templates };
    }
    case "advertising-research": {
      const domain = String(input.domain || "competitor.com");
      let ads = await prisma.adCopy.findMany({ where: { siteId, competitorDomain: domain } });
      let kws = await prisma.adKeyword.findMany({ where: { siteId, competitorDomain: domain } });
      if (!ads.length) {
        await prisma.adCopy.createMany({
          data: [
            {
              siteId,
              competitorDomain: domain,
              title: `Try ${domain.split(".")[0]} — Free Trial`,
              description: "All-in-one SEO platform. Start today.",
              displayUrl: domain,
            },
            {
              siteId,
              competitorDomain: domain,
              title: `Best ${domain.split(".")[0]} Alternative?`,
              description: "Compare plans, features, and pricing.",
              displayUrl: domain,
            },
          ],
        });
        ads = await prisma.adCopy.findMany({ where: { siteId, competitorDomain: domain } });
      }
      if (!kws.length) {
        await prisma.adKeyword.createMany({
          data: magicSuggestions(domain.split(".")[0] || "seo").slice(0, 10).map((s, i) => ({
            siteId,
            competitorDomain: domain,
            phrase: s.phrase,
            cpcCents: s.cpcCents,
            competition: Math.min(1, s.difficulty / 100),
            volume: s.volume,
            adPosition: 1 + (i % 4) * 0.7,
            trafficPct: Math.max(0.01, 0.15 - i * 0.01),
            intent: s.intent,
          })),
        });
        kws = await prisma.adKeyword.findMany({ where: { siteId, competitorDomain: domain } });
      }
      return { tool: toolId, domain, adCopies: ads, paidKeywords: kws };
    }
    case "keyword-cpc": {
      const query = String(input.query || "seo software");
      const suggestions = magicSuggestions(query).map((s) => ({
        ...s,
        competition: Math.min(1, s.difficulty / 100),
        estimatedCpc: `$${(s.cpcCents / 100).toFixed(2)}`,
      }));
      await prisma.adKeyword.createMany({
        data: suggestions.slice(0, 8).map((s) => ({
          siteId,
          phrase: s.phrase,
          cpcCents: s.cpcCents,
          competition: s.competition,
          volume: s.volume,
          intent: s.intent,
        })),
      });
      return { tool: toolId, query, suggestions };
    }
    case "pla-research": {
      const domain = String(input.domain || "shop.example");
      let products = await prisma.plaProduct.findMany({
        where: { siteId, competitorDomain: domain },
      });
      if (!products.length) {
        await prisma.plaProduct.createMany({
          data: [
            {
              siteId,
              competitorDomain: domain,
              title: "Wireless SEO Headset Pro",
              priceCents: 12999,
              keyword: "seo headset",
              position: 2,
              landingUrl: `https://${domain}/p/headset`,
            },
            {
              siteId,
              competitorDomain: domain,
              title: "Rank Tracker Bundle",
              priceCents: 4999,
              keyword: "rank tracker software",
              position: 1,
              landingUrl: `https://${domain}/p/rank-bundle`,
            },
            {
              siteId,
              competitorDomain: domain,
              title: "Agency SEO Playbook (PDF)",
              priceCents: 2900,
              keyword: "seo playbook",
              position: 4,
              landingUrl: `https://${domain}/p/playbook`,
            },
          ],
        });
        products = await prisma.plaProduct.findMany({
          where: { siteId, competitorDomain: domain },
        });
      }
      return { tool: toolId, domain, products };
    }
    case "adclarity": {
      let ads = await prisma.displayAd.findMany({ where: { siteId }, take: 40 });
      if (!ads.length) {
        await prisma.displayAd.createMany({
          data: [
            {
              siteId,
              advertiser: "Competitor A",
              channel: "display",
              landingUrl: "https://competitor-a.example",
              impressionsEst: 220000,
              shareOfVoice: 0.18,
            },
            {
              siteId,
              advertiser: "Competitor B",
              channel: "video",
              landingUrl: "https://competitor-b.example",
              impressionsEst: 91000,
              shareOfVoice: 0.09,
            },
            {
              siteId,
              advertiser: "Competitor C",
              channel: "social",
              landingUrl: "https://competitor-c.example",
              impressionsEst: 150000,
              shareOfVoice: 0.14,
            },
          ],
        });
        ads = await prisma.displayAd.findMany({ where: { siteId } });
      }
      return { tool: toolId, ads };
    }
    case "ads-launch-assistant": {
      const keyword = String(input.keyword || "seo software");
      const copy = {
        headlines: [
          `${keyword} — Start Free`,
          `Top-Rated ${keyword}`,
          `Grow Faster with ${keyword}`,
        ],
        descriptions: [
          `Launch campaigns with AI-assisted ad copy tuned for ${keyword}.`,
          `Track CPC, competition, and conversions in Taxotools.`,
        ],
        extensions: ["Free trial", "No credit card", "Agency plans"],
      };
      const job = await createAIJob({
        userId,
        siteId,
        type: "AD_COPY",
        input: { keyword, copy },
      });
      return { tool: toolId, copy, job };
    }
    case "ai-visibility": {
      const [records, shareOfVoice] = await Promise.all([
        listVisibility(userId, siteId),
        aeoShareOfVoice(userId, siteId),
      ]);
      return { tool: toolId, records, shareOfVoice };
    }
    case "ai-citations": {
      const citations = await prisma.aICitation.findMany({
        where: { record: { siteId } },
        include: { engine: true, record: { select: { prompt: true, checkedAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { tool: toolId, citations };
    }
    case "geo-overviews": {
      const aio = await prisma.sERPFeature.findMany({
        where: { keyword: { siteId }, type: "AI_OVERVIEW" },
        include: { keyword: true },
        orderBy: { checkedAt: "desc" },
        take: 50,
      });
      const engine = await prisma.aIEngine.findFirst({ where: { code: "google_aio" } });
      const visibility = engine
        ? await prisma.aIVisibilityRecord.findMany({
            where: { siteId, engineId: engine.id },
            include: { citations: true },
            orderBy: { checkedAt: "desc" },
            take: 50,
          })
        : [];
      return { tool: toolId, aioFeatures: aio, visibility };
    }
    case "programmatic-seo": {
      const name = String(input.name || "Location pages");
      const cities = (input.cities as string[]) || ["Austin", "Denver", "Seattle", "Miami"];
      const job = await prisma.programmaticSeoJob.create({
        data: {
          siteId,
          name,
          template: String(input.template || "Best {service} in {city}"),
          variablesJson: { cities, service: String(input.service || "SEO") } as Prisma.InputJsonValue,
          status: "COMPLETED",
          pagesQueued: cities.length,
          pagesDone: cities.length,
          outputJson: {
            urls: cities.map(
              (c) => `${site.url}/${String(input.service || "seo").toLowerCase()}-${c.toLowerCase()}`,
            ),
          } as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      return { tool: toolId, job };
    }
    case "bulk-ai-content": {
      const phrases = (input.keywords as string[]) || ["seo audit", "aeo tracking", "rank tracker"];
      const jobs = [];
      for (const phrase of phrases.slice(0, 10)) {
        const job = await createAIJob({
          userId,
          siteId,
          type: "BULK_ARTICLES",
          input: { keyword: phrase },
        });
        jobs.push(job);
      }
      return { tool: toolId, queued: jobs.length, jobs };
    }
    default:
      throw new Error(`Unknown tool: ${toolId}`);
  }
}

export async function triggerToolAction(
  userId: string,
  siteId: string,
  toolId: string,
  action: string,
  input: Record<string, unknown> = {},
) {
  await getSiteForUser(userId, siteId);
  if (toolId === "position-tracking" && action === "run") {
    return enqueueRankCheck(userId, siteId);
  }
  if (toolId === "site-audit" && action === "crawl") {
    return startCrawl({ userId, siteId, maxPages: Number(input.maxPages) || 100 });
  }
  if (toolId === "ai-visibility" && action === "scan") {
    return startAeoScan({
      userId,
      siteId,
      prompts: (input.prompts as string[]) || [`best ${input.brand || "brand"} alternative`],
    });
  }
  if (action === "enqueue") {
    return enqueueJob({
      queue: "taxotools-ppc-research",
      name: toolId,
      payload: { siteId, toolId, input },
    });
  }
  return runTool(userId, siteId, toolId, input);
}

export async function listRecentAI(userId: string, siteId: string) {
  return listAIJobs(userId, siteId);
}
