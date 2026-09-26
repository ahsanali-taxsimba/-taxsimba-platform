import * as cheerio from "cheerio";
import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { resolveLiveDomainFromName, isWebsiteLive } from "./resolveWebsite.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";

const log = logger("accountancyAge");

export const ACCOUNTANCY_AGE_TOP50_URL =
  "https://accountancyage.com/rankings/top-5050-accountancy-firms-2025/";

/** Well-known official domains for major UK firms (when name→domain guess is weak). */
const KNOWN_DOMAINS = {
  pwc: "pwc.co.uk",
  deloitte: "deloitte.com",
  ey: "ey.com",
  kpmg: "kpmg.com",
  bdo: "bdo.co.uk",
  "grant thornton uk": "grantthornton.co.uk",
  rsm: "rsmuk.com",
  "azets group (azets uk & blick rothenberg)": "azets.co.uk",
  "forvis mazars": "mazars.co.uk",
  "moore uk": "moore-global.com",
  mha: "mha.co.uk",
  sumer: "sumer.co.uk",
  "pkf uki": "pkf.com",
  "crowe uk": "crowe.com",
  saffery: "saffery.com",
  xeinadin: "xeinadin.com",
  "cooper parry": "cooperparry.com",
  "tc group": "tc-group.com",
  "etl global": "etlglobal.com",
  "begbies traynor group": "begbies-traynorgroup.com",
  "frp advisory": "frpadvisory.com",
  dains: "dains.com",
  aab: "aab.uk",
  menzies: "menzies.co.uk",
  buzzacott: "buzzacott.co.uk",
  "uhy hacker young": "uhy-uk.com",
  haysmac: "haysmac.com",
  "taxassist accountants": "taxassist.co.uk",
  "shaw gibbs": "shawgibbs.com",
  djh: "djhmittenclarke.co.uk",
  gravita: "gravitagroup.com",
  hazlewoods: "hazlewoods.co.uk",
  "kreston reeves": "krestonreeves.com",
  bkl: "bkl.co.uk",
  "armstrong watson": "armstrongwatson.co.uk",
  "bishop fleming": "bishopfleming.co.uk",
  streets: "streetsweb.co.uk",
  "haines watts": "hwca.com",
  "price bailey": "pricebailey.co.uk",
  bhp: "bhp.co.uk",
  "james cowper kreston": "jamescowper.co.uk",
  "harris & trotter": "harrisandtrotter.co.uk",
  "lovewell blake": "lovewell-blake.co.uk",
  "mercer & hole": "mercerhole.co.uk",
  "larking gowen": "larking-gowen.co.uk",
  "hillier hopkins": "hillierhopkins.co.uk",
  "wilson partners": "wilson-partners.co.uk",
  srlv: "srlv.co.uk",
  "gerald edelman": "geraldedelman.com",
  "dow schofield watts": "dswcapital.com",
  "dns accountants": "dnsassociates.co.uk",
  "lubbock fine": "lubbockfine.co.uk",
  westcotts: "westcotts.co.uk",
  "albert goodman": "albertgoodman.co.uk",
  "sopher + co": "sopherco.com",
  sedulo: "sedulo.co.uk",
  "goodman jones": "goodmanjones.com",
  "mitchell charlesworth": "mitchellcharlesworth.co.uk",
  "henderson loggie": "hlca.co.uk",
  andersen: "andersen.com",
  "rpg crouch chapman": "rpgcrouchchapman.co.uk",
  "ecovis wingrave yeats": "ecovis.com",
  "the accountancy partnership": "theaccountancypartnership.com",
  "bevan buckland": "bevanbuckland.co.uk",
  "thompson wright": "thompsonwright.co.uk",
  "harrison beale & owen": "hbo.uk.com",
  "moore thompson": "moorethompson.co.uk",
};

function cleanName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand group names into searchable firm names. */
function expandNames(name) {
  const n = cleanName(name);
  const out = [n];
  const paren = n.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) {
    out.push(paren[1].trim());
    for (const part of paren[2].split(/[&,]/)) {
      const p = part.trim();
      if (p.length > 2) out.push(p);
    }
  }
  return [...new Set(out.map(cleanName).filter(Boolean))];
}

export function parseAccountancyAgeHtml(html) {
  const $ = cheerio.load(html || "");
  const names = [];
  $("#ranking__name").each((_, el) => {
    const t = cleanName($(el).text());
    if (t && t.toLowerCase() !== "name") names.push(t);
  });
  return [...new Set(names)];
}

async function resolveDomainForFirm(name) {
  const key = name.toLowerCase();
  if (KNOWN_DOMAINS[key]) {
    const d = normalizeDomain(KNOWN_DOMAINS[key]);
    if (await isWebsiteLive(d, { timeoutMs: 5000 })) return d;
  }
  for (const candidate of expandNames(name)) {
    const d = await resolveLiveDomainFromName(candidate);
    if (d) return d;
  }
  return null;
}

/**
 * Scrape Accountancy Age Top 50+50 rankings and upsert firms with live websites.
 */
export async function discoverFromAccountancyAge({
  url = ACCOUNTANCY_AGE_TOP50_URL,
} = {}) {
  log.info("Fetching Accountancy Age Top 50+50", { url });
  const res = await fetchText(url, { timeoutMs: 35000, retries: 2 });
  const names = parseAccountancyAgeHtml(res.text);
  log.info(`Parsed ${names.length} firm names from ranking`);

  const found = [];
  const seen = new Set();

  for (const name of names) {
    try {
      const domain = await resolveDomainForFirm(name);
      await sleep(env.crawlDelayMs || 200);
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);

      const row = await upsertAccountancyFirm({
        domain,
        company_name: name,
        location: "UK",
        source: "accountancy_age_top50_2025",
        website_url: `https://${domain}`,
        website_verified: true,
        crawl_status: "pending",
      });
      if (row) found.push(row);
    } catch (e) {
      log.warn(`failed ${name}`, { error: String(e.message || e) });
    }
  }

  log.info("Accountancy Age discovery complete", {
    names: names.length,
    saved: found.length,
  });
  return { names, found };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  discoverFromAccountancyAge()
    .then((r) => {
      console.log(JSON.stringify({ names: r.names.length, saved: r.found.length, domains: r.found.map((f) => f.domain) }, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
