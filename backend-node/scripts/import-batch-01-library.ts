/**
 * Import Batch 01 (TS-001…TS-010) into Marketing Hub Content Library.
 * Preserves exact PNG bytes; verifies SHA-256; idempotent.
 *
 * Usage:
 *   STORAGE_DRIVER=local LOCAL_STORAGE_DIR=./.data/marketing-library \
 *   MONGO_URL=... DB_NAME=... JWT_SECRET=... CORS_ORIGINS=http://localhost \
 *   npx ts-node --transpile-only scripts/import-batch-01-library.ts [/path/to/packs]
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";

import { connect, close } from "../src/db/mongo";
import { ensureMarketingHubBoot } from "../src/marketing-hub/router";
import { importOriginalAsset, listAssets, verifyStoredChecksum } from "../src/marketing-hub/assets";

const META: Record<
  string,
  { title: string; category: string; subject: string; expectedSha256: string }
> = {
  "TS-001": {
    title: "SA Deadline",
    category: "Self Assessment",
    subject: "SA Deadline",
    expectedSha256: "7ba0b611de8a1abe260895160378588d920e30b6c5905e0f9b4821eddfb2e0c1",
  },
  "TS-002": {
    title: "First-Time Filing",
    category: "Self Assessment",
    subject: "First-Time Filing",
    expectedSha256: "07ab42e2f2ae8998f0b6ba8941515dc807bcfb1d8e8f9d5b834f8ccd002a37b9",
  },
  "TS-003": {
    title: "Landlord Tax",
    category: "Self Assessment",
    subject: "Landlord Tax",
    expectedSha256: "1e4a6d0f7818dd3d94d07adfb39ac6f625857eb8988580395f620cbd7abf41ae",
  },
  "TS-004": {
    title: "Self-Employed",
    category: "Self Assessment",
    subject: "Self-Employed",
    expectedSha256: "8f0c9e0013674ef3a52df4fe6f36530f5d2981454b0f9be060a12c26c1deacbd",
  },
  "TS-005": {
    title: "CIS Workers",
    category: "Self Assessment",
    subject: "CIS Workers",
    expectedSha256: "c907ff22baf9395d89dfcadfa28e3ab7ee42c2afcb2aafa58b1070f913e088f7",
  },
  "TS-006": {
    title: "MTD Overview",
    category: "Making Tax Digital",
    subject: "MTD Overview",
    expectedSha256: "19ab85cbd8acea73c0cc80710d6e85e12848e4152ceae23da5672873900750d6",
  },
  "TS-007": {
    title: "MTD Eligibility",
    category: "Making Tax Digital",
    subject: "MTD Eligibility",
    expectedSha256: "ac71e8dcdd6c4f0b7794b8f40d08476dee017d6e21ede92c427fee6d817026f2",
  },
  "TS-008": {
    title: "Services at a Glance",
    category: "Services",
    subject: "Services at a Glance",
    expectedSha256: "9e69f29fad34303ec8effefd95889d93e02ca4514ec51c1344e0af8e910ba766",
  },
  "TS-009": {
    title: "Customer Support",
    category: "Support",
    subject: "Customer Support",
    expectedSha256: "0fa6637e7427c18802cf4e20665e186bd03ead45e6eac61b44024989ee41c3d2",
  },
  "TS-010": {
    title: "Brand Message",
    category: "Brand",
    subject: "Brand Message",
    expectedSha256: "2883ff9567fde84d05db42b377698b79d26d1ff050a868a65b87d93190b30563",
  },
};

async function main() {
  const packsRoot =
    process.argv[2] ||
    path.resolve(__dirname, "../marketing-library-seed/batch-01") ||
    "/tmp/batch01/packs";

  if (!process.env.MONGO_URL) throw new Error("MONGO_URL required");
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "import-batch01-temp-secret";
  if (!process.env.CORS_ORIGINS) process.env.CORS_ORIGINS = "http://localhost";
  if (!process.env.STORAGE_DRIVER) process.env.STORAGE_DRIVER = "local";
  if (!process.env.LOCAL_STORAGE_DIR) {
    process.env.LOCAL_STORAGE_DIR = path.resolve(__dirname, "../.data/marketing-library");
  }

  await connect();
  await ensureMarketingHubBoot();

  const results = [];
  for (const id of Object.keys(META).sort()) {
    const meta = META[id];
    const candidates = [
      path.join(packsRoot, id, `${id}.png`),
      path.join(packsRoot, `${id}.png`),
      path.join(packsRoot, id, "original", `${id}.png`),
    ];
    const pngPath = candidates.find((p) => existsSync(p));
    if (!pngPath) throw new Error(`Missing PNG for ${id} under ${packsRoot}`);
    const buffer = readFileSync(pngPath);
    const result = await importOriginalAsset({
      id,
      file: {
        buffer,
        mimetype: "image/png",
        originalname: `${id}.png`,
        size: buffer.length,
      },
      actor: "script:import-batch-01",
      title: meta.title,
      category: meta.category,
      altText: `TaxSimba ${meta.subject} — accountant-led tax support marketing creative`,
      batchId: "batch-01",
      expectedSha256: meta.expectedSha256,
      notes: "Batch 01 locked original. Draft / Awaiting Final QA. Auto-publish disabled.",
    });
    const verify = await verifyStoredChecksum(id);
    results.push({
      id,
      title: meta.title,
      category: meta.category,
      action: result.action,
      sourceSha256: result.sourceSha256,
      storedSha256: result.storedSha256,
      checksumMatch: result.checksumMatch && verify.ok,
      storedPath: result.asset.storedPath,
      publicationStatus: result.asset.publicationStatus,
      databaseId: result.asset.databaseId,
      width: result.asset.width,
      height: result.asset.height,
      byteSize: result.asset.byteSize,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results[results.length - 1]));
  }

  const library = await listAssets({ uploadedOnly: true, q: "TS-00" });
  const batch = library.filter((a) => a.batchId === "batch-01" || /^TS-00([1-9]|10)$/.test(a.id));
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        imported: results.length,
        uniqueIds: [...new Set(results.map((r) => r.id))],
        allChecksumPass: results.every((r) => r.checksumMatch),
        libraryUploadedCount: (await listAssets({ uploadedOnly: true })).length,
        batch01Count: results.length,
        seedDirListing: existsSync(packsRoot) ? readdirSync(packsRoot).slice(0, 20) : [],
      },
      null,
      2,
    ),
  );

  await close();
  if (!results.every((r) => r.checksumMatch) || results.length !== 10) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
