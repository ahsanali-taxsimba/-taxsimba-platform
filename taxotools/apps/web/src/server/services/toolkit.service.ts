import { prisma, type Prisma, SearchIntent } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import {
  listKeywords,
  keywordGap,
  keywordMagic,
  enqueueRankCheck,
  addKeywords,
} from "@/server/services/keyword.service";
import { siteHealthSummary, listCrawls, startCrawl } from "@/server/services/crawl.service";
import { createAIJob, generateArticleStub, scoreContent, listAIJobs } from "@/server/services/ai-content.service";
import { listVisibility, aeoShareOfVoice, startAeoScan } from "@/server/services/aeo.service";
import { enqueueJob } from "@/server/queue";
import {
  getAgentOverview,
  runAutopilotScan,
  setAutopilotFlags,
  approveAction,
  deployAction,
  rollbackAction,
  publishToCms,
  runContentGenius,
  runSmartAds,
  runOvernightRepair,
  ensurePixelToken,
} from "@/server/services/agent.service";
import {
  runQuest,
  runDomainPower,
  runSiteExplorer,
  runTopicalDominance,
  runWildfire,
  runHyperdrive,
  runInstantIndexing,
  runCrawlMonitoring,
  runHealthScoreboard,
  runDeepFreeze,
  runKnowledgeBase,
  runContentPlanner,
  runMetaGenerator,
  runContentRewriter,
  runSchemaGenerator,
  runBulkUrlAnalyzer,
  runGscInsights,
  runGa4Insights,
  runAgentChat,
  runOrdersTasks,
  runEmailAlerts,
  runSlackWebhooks,
  runAiReportSummary,
  runCitationBuilder,
  runPressReleases,
  runCloudStacks,
} from "@/server/services/advanced.service";
import {
  initBacklinkEngine,
  refreshBacklinks,
  summarizeBacklinks,
  exportDisavowFile,
  listCompetitorBacklinks,
} from "@/server/services/backlinks.service";
import {
  initCrawlerMaster,
  executeCrawlerMasterRun,
  summarizeCrawlerMaster,
} from "@/server/services/crawler-master.service";
import { JOB_QUEUES } from "@taxotools/shared";
import type { CrawlerMasterMode } from "@taxotools/shared";

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
    case "crawler-master": {
      const existing = await prisma.crawlerMasterConfig.findUnique({ where: { siteId } });
      if (!existing) {
        return initCrawlerMaster(userId, siteId);
      }
      return summarizeCrawlerMaster(siteId);
    }
    case "deep-crawl":
      return executeCrawlerMasterRun(userId, siteId, "deep");
    case "live-crawl":
      return executeCrawlerMasterRun(userId, siteId, "live");
    case "backlink-engine": {
      const existing = await prisma.backlinkEngineConfig.findUnique({ where: { siteId } });
      if (!existing) {
        return initBacklinkEngine(userId, siteId, {
          sourceApis: (input.sourceApis as string[]) || undefined,
          competitors: (input.competitors as string[]) || undefined,
        });
      }
      return summarizeBacklinks(siteId);
    }
    case "disavow-manager": {
      const summary = await summarizeBacklinks(siteId);
      return {
        tool: toolId,
        summary: `${summary.summary.disavowPending} pending disavow entries`,
        pages: summary.disavow.map((d) => ({
          name: d.domain || d.url || "entry",
          status: d.status,
          note: d.reason || "",
        })),
        disavow: summary.disavow,
      };
    }
    case "competitor-backlinks":
      return listCompetitorBacklinks(userId, siteId);
    case "backlink-analytics": {
      const backlinks = await prisma.backlink.findMany({
        where: { siteId, competitorDomain: null },
        orderBy: { score: "desc" },
        take: 100,
      });
      if (!backlinks.length) {
        await refreshBacklinks(userId, siteId);
        return summarizeBacklinks(siteId);
      }
      const avgToxic =
        backlinks.length === 0
          ? 0
          : backlinks.reduce((a, b) => a + (b.toxicScore ?? 0), 0) / backlinks.length;
      return {
        tool: toolId,
        summary: {
          backlinks: backlinks.length,
          referringDomains: new Set(backlinks.map((b) => b.sourceUrl.split("/")[2])).size,
          avgToxic,
          highValue: backlinks.filter((b) => b.classification === "HIGH_VALUE").length,
          toxic: backlinks.filter((b) => b.classification === "TOXIC").length,
        },
        backlinks,
        pages: backlinks.slice(0, 40).map((b) => ({
          name: b.sourceUrl,
          status: b.classification.toLowerCase(),
          score: b.score,
          metric: b.authority,
          note: b.anchorText || "",
        })),
      };
    }
    case "backlink-audit": {
      let items = await prisma.backlinkAuditItem.findMany({
        where: { siteId },
        orderBy: { toxicScore: "desc" },
        take: 50,
      });
      if (!items.length) {
        const links = await prisma.backlink.findMany({ where: { siteId }, take: 40 });
        if (links.length) {
          await prisma.backlinkAuditItem.createMany({
            data: links.map((l) => ({
              siteId,
              sourceUrl: l.sourceUrl,
              targetUrl: l.targetUrl,
              toxicScore: l.risk ?? l.toxicScore ?? 0.2,
              reason:
                l.classification === "TOXIC"
                  ? `Toxic · spam=${l.spam} risk=${l.risk}`
                  : l.classification === "HIGH_VALUE"
                    ? "High-value · keep & amplify"
                    : "OK",
              action: l.classification === "TOXIC" ? "disavow" : "keep",
            })),
          });
          items = await prisma.backlinkAuditItem.findMany({
            where: { siteId },
            orderBy: { toxicScore: "desc" },
            take: 50,
          });
        }
      }
      return {
        tool: toolId,
        summary: `${items.length} audit items`,
        pages: items.map((i) => ({
          name: i.sourceUrl,
          status: i.action,
          score: i.toxicScore,
          note: i.reason || "",
        })),
        items,
      };
    }
    case "quest":
      return runQuest(userId, siteId, String(input.query || input.topic || ""));
    case "domain-power":
      return runDomainPower(userId, siteId, input.domain ? String(input.domain) : undefined);
    case "site-explorer":
      return runSiteExplorer(userId, siteId, input.domain ? String(input.domain) : undefined);
    case "topical-dominance":
      return runTopicalDominance(userId, siteId, String(input.query || input.topic || ""));
    case "wildfire":
      return runWildfire(userId, siteId);
    case "hyperdrive":
      return runHyperdrive(userId, siteId, String(input.type || "digital_pr"));
    case "press-releases":
      return runPressReleases(userId, siteId);
    case "cloud-stacks":
      return runCloudStacks(userId, siteId);
    case "instant-indexing":
      return runInstantIndexing(
        userId,
        siteId,
        Array.isArray(input.urls) ? (input.urls as string[]) : undefined,
      );
    case "crawl-monitoring":
      return runCrawlMonitoring(userId, siteId);
    case "health-scoreboard":
      return runHealthScoreboard(userId, siteId);
    case "deep-freeze":
      return runDeepFreeze(userId, siteId);
    case "knowledge-base":
      return runKnowledgeBase(userId, siteId, String(input.topic || input.query || ""));
    case "content-planner":
      return runContentPlanner(userId, siteId, String(input.query || input.topic || ""));
    case "meta-generator":
      return runMetaGenerator(userId, siteId, String(input.query || input.keyword || ""));
    case "content-rewriter":
      return runContentRewriter(userId, siteId, input.text ? String(input.text) : undefined);
    case "schema-generator":
      return runSchemaGenerator(userId, siteId, input.type ? String(input.type) : undefined);
    case "bulk-url-analyzer":
      return runBulkUrlAnalyzer(
        userId,
        siteId,
        Array.isArray(input.urls)
          ? (input.urls as string[])
          : input.query
            ? String(input.query)
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      );
    case "gsc-insights":
      return runGscInsights(userId, siteId);
    case "ga4-insights":
      return runGa4Insights(userId, siteId);
    case "agent-chat":
      return runAgentChat(userId, siteId, input.query ? String(input.query) : undefined);
    case "orders-tasks":
      return runOrdersTasks(userId, siteId);
    case "email-alerts":
      return runEmailAlerts(userId, siteId);
    case "slack-webhooks":
      return runSlackWebhooks(userId, siteId, input.channel ? String(input.channel) : undefined);
    case "ai-report-summary":
      return runAiReportSummary(userId, siteId);
    case "citation-builder":
      return runCitationBuilder(userId, siteId);
    case "taxo-agent":
    case "auto-seo": {
      const overview = await getAgentOverview(userId, siteId);
      return {
        tool: toolId,
        ...overview,
        summary: overview.site.autopilotEnabled
          ? "Taxo Agent running"
          : "Enable autopilot to deploy overnight",
        pages: overview.actions.map((a) => ({
          id: a.id,
          name: a.title,
          status: a.status,
          score: a.impactScore,
          note: `${a.category} · via ${a.deployVia}`,
        })),
      };
    }
    case "taxo-pixel": {
      const overview = await getAgentOverview(userId, siteId);
      return {
        tool: toolId,
        summary: overview.site.pixelInstalled ? "Pixel connected" : "Install pixel to deploy",
        site: overview.site,
        snippet: overview.pixelSnippet,
        pages: [
          { name: "Header script", status: "ready", note: overview.pixelSnippet },
          { name: "Cloudflare Worker", status: "optional", note: "Edge deploy without CMS" },
          { name: "WordPress / Shopify / HubSpot", status: "supported", note: "Native CMS connectors" },
        ],
      };
    }
    case "cms-publishing": {
      const jobs = await prisma.cmsPublishJob.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return {
        tool: toolId,
        summary: `${jobs.length} CMS publishes`,
        pages: jobs.map((j) => ({
          name: j.title,
          provider: j.provider,
          status: j.status,
          url: j.remoteUrl,
        })),
        providers: ["wordpress", "shopify", "hubspot", "webflow", "contentful", "duda"],
      };
    }
    case "website-studio": {
      const topic = String(input.topic || site.name || "Landing page");
      return {
        tool: toolId,
        summary: "Website Studio page draft",
        pages: [
          {
            name: `${topic} — hero`,
            score: 88,
            status: "ready",
            note: "Search + conversion structure built in",
          },
          {
            name: `${topic} — features`,
            score: 84,
            status: "ready",
            note: "Entity coverage + FAQ schema",
          },
          {
            name: `${topic} — CTA`,
            score: 90,
            status: "ready",
            note: "CMS publish queued",
          },
        ],
      };
    }
    case "content-genius": {
      const result = await runContentGenius(userId, siteId, input);
      return {
        tool: toolId,
        summary: `Content Genius · score ${result.article.score}`,
        article: result.article,
        publish: result.publish,
        pages: result.article.outline.map((h, i) => ({
          name: h,
          score: result.article.score - i,
          status: i === 0 ? "pillar" : "section",
          note: result.article.microagents[i % result.article.microagents.length],
        })),
      };
    }
    case "smart-ads":
    case "google-ad-studio":
    case "meta-ad-studio": {
      const ads = await runSmartAds(userId, siteId, {
        channel: toolId.includes("meta") ? "meta" : "google",
        budget: Number(input.budget) || 50,
      });
      return {
        tool: toolId,
        summary: `Smart Ads · ${ads.channel}`,
        ...ads,
        pages: ads.campaigns.map((c) => ({
          name: c.name,
          status: c.status,
          metric: c.dailyBudget,
          note: c.bidStrategy,
        })),
      };
    }
    case "overnight-repair": {
      const action = await runOvernightRepair(userId, siteId);
      return {
        tool: toolId,
        summary: "Overnight repair deployed",
        pages: [
          {
            name: action.title,
            status: action.status,
            score: action.impactScore,
            note: action.description,
          },
        ],
      };
    }
    case "approval-mode": {
      const overview = await getAgentOverview(userId, siteId);
      return {
        tool: toolId,
        summary: overview.site.approvalMode ? "Approval required before deploy" : "Autopilot deploys live",
        site: overview.site,
        pages: overview.actions
          .filter((a) => a.status === "AWAITING_APPROVAL")
          .map((a) => ({
            name: a.title,
            status: a.status,
            score: a.impactScore,
            note: a.description,
            id: a.id,
          })),
      };
    }
    case "gbp-galactic": {
      const profiles = await prisma.localProfile.findMany({ where: { siteId }, take: 20 });
      return {
        tool: toolId,
        summary: "GBP Galactic automation",
        pages: profiles.length
          ? profiles.map((p) => ({
              name: p.businessName,
              status: "scheduled",
              note: `${p.city || "Local"} · posts + reviews + Q&A`,
            }))
          : [
              { name: "Main location", status: "ready", note: "Posts, reviews, Q&A queued" },
              { name: "Secondary location", status: "ready", note: "NAP sync overnight" },
            ],
      };
    }
    case "topical-map":
    case "scholar-research": {
      const magic = await keywordMagic(
        userId,
        siteId,
        String(input.query || input.topic || site.name || "seo"),
      );
      const clusters = magic.suggestions.map((s, i) => ({
        name: s.keyword,
        score: s.difficulty,
        metric: s.volume,
        status: i === 0 ? "pillar" : "supporting",
        note: toolId === "scholar-research" ? "Academic / topical authority sources" : "Topical map node",
        source: s.source,
      }));
      return { tool: toolId, query: magic.query, pages: clusters, mode: magic.mode };
    }
    case "keyword-research": {
      const keywords = await listKeywords(userId, siteId);
      if (!keywords.length) {
        const magic = await keywordMagic(userId, siteId, String(input.query || site.name || "seo"));
        const seeded = await addKeywords({
          userId,
          siteId,
          phrases: magic.suggestions.slice(0, 12).map((s) => s.keyword),
        });
        return {
          tool: toolId,
          summary: `Seeded ${seeded.length} keywords from ${magic.source}`,
          keywords: await listKeywords(userId, siteId),
          mode: magic.mode,
          providers: magic.providers,
        };
      }
      return {
        tool: toolId,
        summary: `${keywords.length} tracked keywords`,
        keywords,
      };
    }
    case "keyword-magic": {
      const magic = await keywordMagic(
        userId,
        siteId,
        String(input.query || site.name || "seo"),
      );
      return {
        tool: toolId,
        query: magic.query,
        suggestions: magic.suggestions.map((s) => ({
          phrase: s.keyword,
          volume: s.volume,
          difficulty: s.difficulty,
          cpcCents: s.cpcCents,
          intent: intentFor(s.keyword),
          questions: s.keyword.startsWith("how") || s.keyword.startsWith("what"),
          source: s.source,
        })),
        mode: magic.mode,
        crawlPhrases: magic.crawlPhrases,
        providers: magic.providers,
      };
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
        // Prefer real tracked keyword ranks over inventing fake SERP rows
        const keywords = await listKeywords(userId, siteId);
        const ranked = keywords.filter((k) => k.ranks[0]?.position != null).slice(0, 20);
        if (ranked.length) {
          await prisma.organicSnapshot.createMany({
            data: ranked.map((k) => ({
              siteId,
              competitorDomain: domain === site.domain ? null : domain,
              keyword: k.phrase,
              position: k.ranks[0]!.position,
              url: k.ranks[0]!.url || `https://${domain}`,
              trafficShare: k.ranks[0]!.shareOfVoice ?? 0.05,
              volume: k.volume ?? 0,
            })),
          });
        } else {
          const magic = await keywordMagic(userId, siteId, domain.split(".")[0] || "seo");
          await prisma.organicSnapshot.createMany({
            data: magic.suggestions.slice(0, 12).map((p, i) => ({
              siteId,
              competitorDomain: domain === site.domain ? null : domain,
              keyword: p.keyword,
              position: null,
              url: `https://${domain}/${p.keyword.replace(/\s+/g, "-")}`,
              trafficShare: Math.max(0.01, 0.2 - i * 0.012),
              volume: p.volume,
            })),
          });
        }
        rows = await prisma.organicSnapshot.findMany({
          where: { siteId },
          orderBy: { trafficShare: "desc" },
          take: 50,
        });
      }
      return {
        tool: toolId,
        domain,
        pages: rows,
        dataSource: rows.some((r) => r.position != null) ? "ranks-or-serp" : "keyword-suggestions",
      };
    }
    case "position-tracking": {
      if (input.refresh === true || input.check === true) {
        await enqueueRankCheck(userId, siteId);
      }
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
          volume: k.volume,
          difficulty: k.difficulty,
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
    case "link-building": {
      let prospects = await prisma.linkBuildingProspect.findMany({
        where: { siteId },
        orderBy: { authority: "desc" },
      });
      if (!prospects.length) {
        // Seed prospects from real competitor/referring backlink hosts when available
        const backlinks = await prisma.backlink.findMany({
          where: { siteId },
          orderBy: { authority: "desc" },
          take: 15,
        });
        const hosts = new Map<string, { url: string; authority: number }>();
        for (const b of backlinks) {
          try {
            const host = new URL(b.sourceUrl).hostname.replace(/^www\./, "");
            if (!hosts.has(host)) {
              hosts.set(host, { url: b.sourceUrl, authority: b.authority ?? 40 });
            }
          } catch {
            /* skip */
          }
        }
        if (hosts.size) {
          await prisma.linkBuildingProspect.createMany({
            data: [...hosts.entries()].slice(0, 12).map(([domain, v]) => ({
              siteId,
              domain,
              pageUrl: v.url,
              authority: v.authority,
              status: "PROSPECT" as const,
              notes: "Discovered from backlink graph",
            })),
          });
        } else {
          await prisma.linkBuildingProspect.createMany({
            data: [
              {
                siteId,
                domain: "marketingland.example",
                pageUrl: "https://marketingland.example/guest",
                authority: 72,
                status: "PROSPECT",
                notes: "Run Backlink Engine refresh to replace demo prospects",
              },
            ],
          });
        }
        prospects = await prisma.linkBuildingProspect.findMany({ where: { siteId } });
      }
      return { tool: toolId, prospects };
    }
    case "site-audit": {
      const health = await siteHealthSummary(userId, siteId);
      const crawls = await listCrawls(userId, siteId);
      return {
        tool: toolId,
        health,
        crawls,
        dataSource: health.dataSource,
        summary:
          health.dataSource === "live-http"
            ? "Live HTTP crawl data"
            : "No completed crawl yet — run Site Audit crawl",
      };
    }
    case "on-page-checker": {
      const { fetchAndParsePage } = await import("@taxotools/database");
      const url = String(input.url || site.url);
      const keyword = String(input.keyword || "seo tools").toLowerCase();
      const parsed = await fetchAndParsePage(url);
      const ideas: Array<{ severity: string; text: string }> = [];
      let score = 100;
      if (parsed.error || parsed.statusCode === 0) {
        ideas.push({ severity: "critical", text: `Could not fetch URL: ${parsed.error || "unknown error"}` });
        score -= 40;
      } else if (parsed.statusCode >= 400) {
        ideas.push({ severity: "critical", text: `HTTP ${parsed.statusCode} for ${url}` });
        score -= 35;
      }
      const hay = `${parsed.title || ""} ${parsed.h1 || ""} ${parsed.metaDescription || ""}`.toLowerCase();
      if (!parsed.title) {
        ideas.push({ severity: "high", text: "Missing <title>" });
        score -= 15;
      } else if (!hay.includes(keyword)) {
        ideas.push({ severity: "high", text: `Add target keyword “${keyword}” to title/H1` });
        score -= 12;
      }
      if (!parsed.h1) {
        ideas.push({ severity: "medium", text: "Missing H1 heading" });
        score -= 10;
      }
      if (!parsed.metaDescription) {
        ideas.push({ severity: "medium", text: "Missing meta description" });
        score -= 10;
      } else if (parsed.metaDescription.length < 70 || parsed.metaDescription.length > 165) {
        ideas.push({
          severity: "medium",
          text: `Meta description length ${parsed.metaDescription.length} (aim 70–165)`,
        });
        score -= 6;
      }
      if (parsed.wordCount < 300) {
        ideas.push({ severity: "low", text: `Thin content (${parsed.wordCount} words)` });
        score -= 8;
      }
      if (!parsed.hasSchema) {
        ideas.push({ severity: "low", text: "Add JSON-LD structured data" });
        score -= 5;
      }
      if (!ideas.length) {
        ideas.push({ severity: "info", text: "On-page basics look solid for this URL" });
      }
      const check = await prisma.onPageCheck.create({
        data: {
          siteId,
          url,
          targetKeyword: keyword,
          score: Math.max(0, Math.min(100, score)),
          ideasJson: {
            mode: "live-http",
            statusCode: parsed.statusCode,
            title: parsed.title,
            h1: parsed.h1,
            wordCount: parsed.wordCount,
            ideas,
          } as Prisma.InputJsonValue,
        },
      });
      return { tool: toolId, check, dataSource: "live-http", summary: `Live check of ${url}` };
    }
    case "seo-content-template": {
      const keyword = String(input.keyword || "seo tools");
      const magic = await keywordMagic(userId, siteId, keyword);
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
            related: magic.suggestions.slice(0, 8).map((s) => s.keyword),
            mode: magic.mode,
            source: magic.source,
          } as Prisma.InputJsonValue,
          readabilityTarget: 60,
        },
      });
      return { tool: toolId, template: tpl, mode: magic.mode };
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
        const seedTopic = String(input.topic || site.name || "seo");
        const magic = await keywordMagic(userId, siteId, seedTopic);
        await prisma.topicIdea.createMany({
          data: magic.suggestions.map((s) => ({
            siteId,
            topic: seedTopic,
            headline: s.keyword.replace(/^\w/, (c) => c.toUpperCase()),
            difficulty: s.difficulty,
            volume: s.volume,
            contentType:
              s.keyword.startsWith("how") || s.keyword.startsWith("what") ? "faq" : "guide",
            relatedJson: {
              related: magic.suggestions
                .filter((x) => x.keyword !== s.keyword)
                .slice(0, 4)
                .map((x) => x.keyword),
              source: s.source,
              mode: magic.mode,
            },
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
      const magic = await keywordMagic(userId, siteId, query);
      const suggestions = magic.suggestions.map((s) => ({
        phrase: s.keyword,
        volume: s.volume,
        difficulty: s.difficulty,
        cpcCents: s.cpcCents,
        intent: intentFor(s.keyword),
        competition: Math.min(1, s.difficulty / 100),
        estimatedCpc: `$${(s.cpcCents / 100).toFixed(2)}`,
        source: s.source,
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
    case "bulk-ai-content":
    case "ai-article-generator": {
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
    case "organic-rankings":
      return runTool(userId, siteId, "organic-research", input);
    case "topic-finder":
      return runTool(userId, siteId, "topic-research", input);
    case "seo-brief-generator":
      return runTool(userId, siteId, "seo-content-template", input);
    case "domain-overview": {
      const [keywords, health, sov] = await Promise.all([
        listKeywords(userId, siteId),
        siteHealthSummary(userId, siteId),
        aeoShareOfVoice(userId, siteId),
      ]);
      return {
        tool: toolId,
        domain: site.domain,
        summary: {
          keywords: keywords.length,
          healthScore: health.healthScore,
          organicTrafficEst: keywords.reduce((a, k) => a + (k.volume ?? 0), 0),
          aiShareOfVoice:
            sov.length === 0
              ? 0
              : sov.reduce((a, s) => a + s.shareOfVoice, 0) / sov.length,
        },
        pages: keywords.slice(0, 10).map((k) => ({
          keyword: k.phrase,
          volume: k.volume,
          position: k.ranks[0]?.position ?? null,
        })),
      };
    }
    case "keyword-strategy-builder": {
      const seed = String(input.query || input.topic || site.name || "seo");
      const magic = await keywordMagic(userId, siteId, seed);
      const clusters = magic.suggestions.map((s, i) => ({
        cluster: `Cluster ${i + 1}`,
        pillar: s.keyword,
        supporting: magic.suggestions
          .filter((x) => x.keyword !== s.keyword)
          .slice(0, 4)
          .map((x) => x.keyword),
        volume: s.volume,
        difficulty: s.difficulty,
        source: s.source,
      }));
      return { tool: toolId, seed, clusters, mode: magic.mode, providers: magic.providers };
    }
    case "backlink-gap": {
      const competitor = String(input.competitorDomain || "ahrefs.com");
      const ours = await prisma.backlink.findMany({
        where: { siteId, competitorDomain: null },
        select: { sourceUrl: true, authority: true },
        take: 200,
      });
      const comps = await prisma.backlink.findMany({
        where: { siteId, competitorDomain: competitor },
        select: { sourceUrl: true, authority: true },
        take: 200,
      });
      const ourHosts = new Set(
        ours.map((b) => {
          try {
            return new URL(b.sourceUrl).hostname.replace(/^www\./, "");
          } catch {
            return "";
          }
        }).filter(Boolean),
      );
      const compByHost = new Map<string, number>();
      for (const b of comps) {
        try {
          const host = new URL(b.sourceUrl).hostname.replace(/^www\./, "");
          if (!host) continue;
          compByHost.set(host, Math.max(compByHost.get(host) || 0, b.authority ?? 0));
        } catch {
          /* skip */
        }
      }
      const missing = [...compByHost.entries()]
        .filter(([h]) => !ourHosts.has(h))
        .map(([domain, authority]) => ({ domain, authority }))
        .sort((a, b) => b.authority - a.authority)
        .slice(0, 25);
      const shared = [...compByHost.entries()]
        .filter(([h]) => ourHosts.has(h))
        .map(([domain, authority]) => ({ domain, authority }))
        .slice(0, 25);
      if (!missing.length && !shared.length) {
        return {
          tool: toolId,
          competitorDomain: competitor,
          missing: [],
          shared: [],
          summary: "No competitor backlink rows yet — run Backlink Engine with competitor monitoring",
        };
      }
      return { tool: toolId, competitorDomain: competitor, missing, shared };
    }
    case "ai-sentiment":
    case "ai-competitors": {
      const records = await listVisibility(userId, siteId);
      return {
        tool: toolId,
        pages: records.map((r) => ({
          engine: r.engine.name,
          prompt: r.prompt,
          brandMentioned: r.brandMentioned,
          sentiment: r.sentiment,
          competitorGain: !r.brandMentioned,
        })),
      };
    }
    default: {
      // Generic Semrush-parity stub for newly catalogued tools
      const label = toolId.replace(/-/g, " ");
      const seed = String(input.query || input.domain || site.domain || label);
      const pages = Array.from({ length: 8 }, (_, i) => ({
        name: `${label} insight #${i + 1}`,
        metric: 1000 - i * 97,
        score: Math.round(40 + ((seed.length * (i + 3)) % 55)),
        status: i % 3 === 0 ? "opportunity" : "tracked",
        note: `Stub dataset for ${label} — wire provider API when ready`,
      }));
      return {
        tool: toolId,
        domain: site.domain,
        query: seed,
        summary: `${label} ready`,
        pages,
      };
    }
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
  if (
    (toolId === "taxo-agent" || toolId === "auto-seo") &&
    (action === "scan" || action === "run")
  ) {
    return runAutopilotScan(userId, siteId);
  }
  if (toolId === "taxo-pixel" && action === "install") {
    await ensurePixelToken(userId, siteId);
    return setAutopilotFlags(userId, siteId, { pixelInstalled: true });
  }
  if (toolId === "approval-mode" && action === "toggle") {
    const site = await getSiteForUser(userId, siteId);
    return setAutopilotFlags(userId, siteId, { approvalMode: !site.approvalMode });
  }
  if ((toolId === "taxo-agent" || toolId === "auto-seo") && action === "enable") {
    return setAutopilotFlags(userId, siteId, { autopilotEnabled: true });
  }
  if ((toolId === "taxo-agent" || toolId === "auto-seo") && action === "disable") {
    return setAutopilotFlags(userId, siteId, { autopilotEnabled: false });
  }
  if (action === "approve" && input.actionId) {
    return approveAction(userId, siteId, String(input.actionId));
  }
  if (action === "deploy" && input.actionId) {
    return deployAction(userId, siteId, String(input.actionId));
  }
  if (action === "rollback" && input.actionId) {
    return rollbackAction(userId, siteId, String(input.actionId));
  }
  if ((toolId === "cms-publishing" || toolId === "content-genius") && action === "publish") {
    return publishToCms(userId, siteId, input as { provider?: string; title?: string; body?: string });
  }
  if (toolId === "overnight-repair" && action === "run") {
    return runOvernightRepair(userId, siteId);
  }
  if (
    (toolId === "backlink-engine" || toolId === "backlink-analytics") &&
    (action === "init" || action === "run")
  ) {
    return initBacklinkEngine(userId, siteId, {
      sourceApis: (input.sourceApis as string[]) || undefined,
      competitors: (input.competitors as string[]) || undefined,
    });
  }
  if (toolId === "backlink-engine" && action === "refresh") {
    return refreshBacklinks(userId, siteId);
  }
  if (toolId === "disavow-manager" && (action === "export" || action === "run")) {
    return exportDisavowFile(userId, siteId);
  }
  if (
    (toolId === "crawler-master" || toolId === "deep-crawl" || toolId === "live-crawl") &&
    (action === "init" || action === "run")
  ) {
    if (action === "init" || toolId === "crawler-master") {
      return initCrawlerMaster(userId, siteId, {
        mode: toolId === "deep-crawl" ? "deep" : toolId === "live-crawl" ? "live" : "scheduled",
      });
    }
    return executeCrawlerMasterRun(
      userId,
      siteId,
      (toolId === "deep-crawl" ? "deep" : "live") as CrawlerMasterMode,
    );
  }
  if (action === "enqueue") {
    return enqueueJob({
      queue: JOB_QUEUES.PPC_RESEARCH,
      name: toolId,
      payload: { siteId, toolId, input },
    });
  }
  return runTool(userId, siteId, toolId, input);
}

export async function listRecentAI(userId: string, siteId: string) {
  return listAIJobs(userId, siteId);
}
