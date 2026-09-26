import { normalizeDomain } from "../utils/normalizeDomain.js";
import { getSupabase } from "../supabase/client.js";

export async function getKeywordsHandler(req, res) {
  const domain = normalizeDomain(req.query.domain || "");
  if (!domain) return res.status(400).json({ error: "domain required" });
  const { data, error } = await getSupabase()
    .from("keyword_data")
    .select("*")
    .eq("domain", domain)
    .order("search_volume", { ascending: false, nullsFirst: false })
    .limit(Number(req.query.limit || 100));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ domain, count: data?.length || 0, keywords: data || [] });
}

export async function getSeoHandler(req, res) {
  const domain = normalizeDomain(req.query.domain || "");
  if (!domain) return res.status(400).json({ error: "domain required" });
  const { data, error } = await getSupabase()
    .from("seo_data")
    .select("*")
    .eq("domain", domain)
    .order("crawled_at", { ascending: false })
    .limit(Number(req.query.limit || 100));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ domain, count: data?.length || 0, pages: data || [] });
}

export async function getGeoHandler(req, res) {
  const domain = normalizeDomain(req.query.domain || "");
  if (!domain) return res.status(400).json({ error: "domain required" });
  const { data, error } = await getSupabase()
    .from("geo_data")
    .select("*")
    .eq("domain", domain)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ domain, geo: data || null });
}

export async function getAeoHandler(req, res) {
  const domain = normalizeDomain(req.query.domain || "");
  if (!domain) return res.status(400).json({ error: "domain required" });
  const { data, error } = await getSupabase()
    .from("aeo_data")
    .select("*")
    .eq("domain", domain)
    .order("updated_at", { ascending: false })
    .limit(Number(req.query.limit || 50));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ domain, count: data?.length || 0, aeo: data || [] });
}

export async function getCompetitorsHandler(req, res) {
  const domain = normalizeDomain(req.query.domain || "");
  if (!domain) return res.status(400).json({ error: "domain required" });
  const { data, error } = await getSupabase()
    .from("competitor_profiles")
    .select("*")
    .eq("domain", domain)
    .order("competitor_backlinks", { ascending: false })
    .limit(Number(req.query.limit || 50));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ domain, count: data?.length || 0, competitors: data || [] });
}

export async function getCrawlerStatusHandler(_req, res) {
  const { data, error } = await getSupabase()
    .from("crawler_control")
    .select("*")
    .eq("id", "uk-accountancy")
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ control: data || null });
}
