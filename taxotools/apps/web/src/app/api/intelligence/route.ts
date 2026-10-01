import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/server/http";
import {
  fetchCrawlerIntelligence,
  type IntelligenceResource,
} from "@/server/services/intelligence.service";

const ALLOWED = new Set<IntelligenceResource>([
  "coverage",
  "accountants",
  "firm",
  "backlinks",
  "referring-domains",
  "competitors",
  "geo",
  "seo",
  "aeo",
  "keywords",
  "crawler-status",
  "scorecard",
  "battle-card",
  "backlink-gaps",
  "markets",
  "leads",
  "changes",
  "coverage-uk",
  "content-gaps",
]);

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const resource = (searchParams.get("resource") || "coverage") as IntelligenceResource;
    if (!ALLOWED.has(resource)) {
      return jsonError(new Error("Invalid intelligence resource"));
    }

    const query: Record<string, string | undefined> = {};
    for (const key of [
      "domain",
      "limit",
      "city",
      "q",
      "missing_phone",
      "missing_website",
      "days",
      "format",
      "status",
      "location",
    ]) {
      const value = searchParams.get(key);
      if (value != null) query[key] = value;
    }

    const data = await fetchCrawlerIntelligence(resource, query);
    return jsonOk({ resource, data });
  } catch (err) {
    return jsonError(err);
  }
}
