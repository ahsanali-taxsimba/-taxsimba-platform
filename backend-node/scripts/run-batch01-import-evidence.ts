/**
 * One-shot Batch 01 import into memory Mongo + local storage; write evidence JSON.
 * LABEL: Local/dev evidence — not staging credentials.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const META: Record<
  string,
  { title: string; category: string; expectedSha256: string }
> = {
  "TS-001": {
    title: "SA Deadline",
    category: "Self Assessment",
    expectedSha256: "da5a4feba0e71289bd4f1ed804a50c1cf224f18029984a0c93b1acbb2f47b675",
  },
  "TS-002": {
    title: "First-Time Filing",
    category: "Self Assessment",
    expectedSha256: "07ab42e2f2ae8998f0b6ba8941515dc807bcfb1d8e8f9d5b834f8ccd002a37b9",
  },
  "TS-003": {
    title: "Landlord Tax",
    category: "Self Assessment",
    expectedSha256: "1e4a6d0f7818dd3d94d07adfb39ac6f625857eb8988580395f620cbd7abf41ae",
  },
  "TS-004": {
    title: "Self-Employed",
    category: "Self Assessment",
    expectedSha256: "8f0c9e0013674ef3a52df4fe6f36530f5d2981454b0f9be060a12c26c1deacbd",
  },
  "TS-005": {
    title: "CIS Workers",
    category: "Self Assessment",
    expectedSha256: "c907ff22baf9395d89dfcadfa28e3ab7ee42c2afcb2aafa58b1070f913e088f7",
  },
  "TS-006": {
    title: "MTD Overview",
    category: "Making Tax Digital",
    expectedSha256: "19ab85cbd8acea73c0cc80710d6e85e12848e4152ceae23da5672873900750d6",
  },
  "TS-007": {
    title: "MTD Eligibility",
    category: "Making Tax Digital",
    expectedSha256: "ac71e8dcdd6c4f0b7794b8f40d08476dee017d6e21ede92c427fee6d817026f2",
  },
  "TS-008": {
    title: "Services at a Glance",
    category: "Services",
    expectedSha256: "9e69f29fad34303ec8effefd95889d93e02ca4514ec51c1344e0af8e910ba766",
  },
  "TS-009": {
    title: "Customer Support",
    category: "Support",
    expectedSha256: "0fa6637e7427c18802cf4e20665e186bd03ead45e6eac61b44024989ee41c3d2",
  },
  "TS-010": {
    title: "Brand Message",
    category: "Brand",
    expectedSha256: "2883ff9567fde84d05db42b377698b79d26d1ff050a868a65b87d93190b30563",
  },
};

async function main() {
  const root = path.resolve(__dirname, "..");
  const storageDir = path.join(root, ".data/marketing-library");
  mkdirSync(storageDir, { recursive: true });

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();

  process.env.MONGO_URL = mongo.getUri();
  process.env.DB_NAME = "taxsimba_batch01_import";
  process.env.JWT_SECRET = "batch01-import-secret";
  process.env.CORS_ORIGINS = "http://localhost";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = storageDir;
  process.env.MARKETING_HUB_ENABLED = "true";
  process.env.APP_NAME = "taxsimba";

  const { connect, close } = await import("../src/db/mongo");
  const { ensureMarketingHubBoot } = await import("../src/marketing-hub/router");
  const { importOriginalAsset, listAssets, verifyStoredChecksum } = await import(
    "../src/marketing-hub/assets"
  );

  await connect();
  await ensureMarketingHubBoot();

  const packs = path.join(root, "marketing-library-seed/batch-01");
  const imported = [];

  for (const id of Object.keys(META).sort()) {
    const meta = META[id];
    const pngPath = existsSync(path.join(packs, `${id}.png`))
      ? path.join(packs, `${id}.png`)
      : path.join(packs, id, `${id}.png`);
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
      altText: `TaxSimba ${meta.title} — accountant-led tax support marketing creative`,
      batchId: "batch-01",
      expectedSha256: meta.expectedSha256,
      notes: "Batch 01 locked original. Draft / Awaiting Final QA. Auto-publish disabled.",
    });
    const verify = await verifyStoredChecksum(id);
    imported.push({
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
    console.log(JSON.stringify(imported[imported.length - 1]));
  }

  const reimport = [];
  for (const id of Object.keys(META).sort()) {
    const meta = META[id];
    const buffer = readFileSync(path.join(packs, `${id}.png`));
    const again = await importOriginalAsset({
      id,
      file: {
        buffer,
        mimetype: "image/png",
        originalname: `${id}.png`,
        size: buffer.length,
      },
      actor: "script:import-batch-01-reimport",
      title: meta.title,
      category: meta.category,
      batchId: "batch-01",
      expectedSha256: meta.expectedSha256,
    });
    reimport.push({ id, action: again.action, databaseId: again.asset.databaseId });
  }

  const uploaded = await listAssets({ uploadedOnly: true });
  const batch = uploaded.filter((a) => META[a.id]);

  const outPath = path.resolve(root, "../docs/marketing-hub/evidence/batch-01/import-results.json");
  const payload = {
    timestamp: new Date().toISOString(),
    storageDir,
    imported,
    reimportActions: reimport,
    uniqueCount: new Set(imported.map((r) => r.id)).size,
    allChecksumPass: imported.every((r) => r.checksumMatch === true),
    libraryUploadedMatchingBatch: batch.length,
    allDraftAwaitingQa: batch.every((a) => a.publicationStatus === "draft_awaiting_qa"),
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        wrote: outPath,
        count: imported.length,
        allChecksumPass: payload.allChecksumPass,
        reimportAllUnchanged: reimport.every((r) => r.action === "unchanged"),
      },
      null,
      2,
    ),
  );

  await close();
  await mongo.stop();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
