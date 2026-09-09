import { NextResponse } from 'next/server';

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatDate = (date = new Date()) => date.toISOString().slice(0, 10);

async function getSlugs() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.taxsimba.com/api/';
  const url = new URL('slugs', apiBase).toString();

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json?.data || {};
  } catch (err) {
    console.error('Failed to load sitemap slugs', err);
    return {};
  }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://taxsimba.co.uk';
  const today = formatDate();
  const staticUrls = [
    { path: '/', lastmod: today, changefreq: 'daily', priority: 1.0 },
    { path: '/about-us', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { path: '/contact-us', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { path: '/testimonials', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { path: '/faq', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/privacy-policy', lastmod: today, changefreq: 'monthly', priority: 0.6 },
    { path: '/cookie-policy', lastmod: today, changefreq: 'monthly', priority: 0.5 },
    { path: '/tax-filing', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { path: '/mtd-information', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/check-mtd', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/pricing', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { path: '/calculators', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    // Service sub-pages
    { path: '/cis-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/self-employed-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/rental-income-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/private-client-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/capital-gains-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/high-net-worth-service', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    // Service sub-pages (legacy/API slugs for backward compatibility/crawlers)
    { path: '/services/self-employed-tax-return-services-uk', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/cis-tax-returns', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/rental-income-tax-returns', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/private-client-tax-returns', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/capital-gains-tax-returns-advice', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/high-net-worth-individuals-tax-returns', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { path: '/services/non-resident-landlord-taxes-expat-tax-services-uk', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    // Calculators (HMRC-compliant paths matching src/lib/calculators/metadata.js)
    { path: '/calculators/ni', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/combined-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/salary-after-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/income-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/pension-tax-relief', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/child-benefit', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/late-penalty', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/rental-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/cis-rebate', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/ebay-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/stamp-duty', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/uber-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/tax-code', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/mileage-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/dividend-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/crypto-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { path: '/calculators/corporation-tax', lastmod: today, changefreq: 'monthly', priority: 0.7 },
  ];

  const slugsData = await getSlugs();
  const categories = Array.isArray(slugsData?.categories) ? slugsData.categories : [];
  const subCategories = Array.isArray(slugsData?.subCategories) ? slugsData.subCategories : [];
  const services = Array.isArray(slugsData?.services) ? slugsData.services : [];
  const blogs = Array.isArray(slugsData?.blogs) ? slugsData.blogs : [];

  const dynamicUrls = [
    // ...categories.map((slug) => ({
    //   path: `/${slug}`,
    //   lastmod: today,
    //   changefreq: 'weekly',
    //   priority: 0.7,
    // })),
    ...subCategories.map((slug) => ({
      path: `/${slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.7,
    })),
    ...services.map((slug) => ({
      path: `/services/${slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })),
    ...blogs.map((slug) => ({
      path: `/blogs/${slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })),
  ];

  const byPath = new Map();
  for (const item of [...staticUrls, ...dynamicUrls]) {
    byPath.set(item.path, item);
  }

  const sitemapBody = Array.from(byPath.values())
    .map(
      ({ path, lastmod, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(`${baseUrl}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join('');

  const sitemap = 
  `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapBody}
  </urlset>`;

  return new NextResponse(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}



// import { NextResponse } from 'next/server';


// async function getDynamicURLS() {
//   try {
//     const res = await fetch(process.env.NEXT_PUBLIC_API_URL+'/sitemap.xml')
//           const xml = await res.text();
//       // Extract only <url>...</url> blocks using RegExp
//       const urlMatches = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
//       return urlMatches; // these are full <url> blocks
//   } catch (error) {
//     console.error('Failed to fetch blog categories', error);
//     return [];
//   }
// }

// function generateSitemap(paths) {

//   return `<?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
//     ${[...paths].join("\n")}
// </urlset>`;
// }

// export async function GET() {

//   // Then combine with other paths
//   const externalUrlBlocks = await getDynamicURLS();
//   const sitemap = generateSitemap( externalUrlBlocks);

//   return new NextResponse(sitemap, {
//     status: 200,
//     headers: {
//       'Content-Type': 'application/xml',
//     },
//   });
// }
