/**
 * Owner-approved TS-001 artwork replacement evidence.
 * Seeds Batch 01 with previous TS-001, then applies approved PNG with allowApprovedReplacement.
 * Preserves library id + databaseId + title/category/batch; refreshes checksum.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const EXPECTED_SHA =
  "da5a4feba0e71289bd4f1ed804a50c1cf224f18029984a0c93b1acbb2f47b675";
const PREVIOUS_SHA =
  "7ba0b611de8a1abe260895160378588d920e30b6c5905e0f9b4821eddfb2e0c1";

async function main() {
  const root = path.resolve(__dirname, "..");
  const approvedPath =
    process.argv[2] || path.join(root, "marketing-library-seed/batch-01/TS-001.png");
  const previousPath = process.argv[3] || "/tmp/ts001-previous.png";
  if (!existsSync(approvedPath)) throw new Error(`Missing approved PNG ${approvedPath}`);
  if (!existsSync(previousPath)) throw new Error(`Missing previous PNG ${previousPath}`);

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri();
  process.env.DB_NAME = "taxsimba_ts001_replacement";
  process.env.JWT_SECRET = "ts001-replacement-secret";
  process.env.CORS_ORIGINS = "http://localhost";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = path.join(root, ".data/marketing-library");
  process.env.MARKETING_HUB_ENABLED = "true";
  process.env.APP_NAME = "taxsimba";

  const { connect, close } = await import("../src/db/mongo");
  const { ensureMarketingHubBoot } = await import("../src/marketing-hub/router");
  const { importOriginalAsset, listAssets, verifyStoredChecksum, sha256Buffer } = await import(
    "../src/marketing-hub/assets"
  );

  await connect();
  await ensureMarketingHubBoot();

  const seed = path.join(root, "marketing-library-seed/batch-01");
  const META: Record<string, { title: string; category: string; sha: string }> = {
    "TS-001": { title: "SA Deadline", category: "Self Assessment", sha: PREVIOUS_SHA },
    "TS-002": {
      title: "First-Time Filing",
      category: "Self Assessment",
      sha: "07ab42e2f2ae8998f0b6ba8941515dc807bcfb1d8e8f9d5b834f8ccd002a37b9",
    },
    "TS-003": {
      title: "Landlord Tax",
      category: "Self Assessment",
      sha: "1e4a6d0f7818dd3d94d07adfb39ac6f625857eb8988580395f620cbd7abf41ae",
    },
    "TS-004": {
      title: "Self-Employed",
      category: "Self Assessment",
      sha: "8f0c9e0013674ef3a52df4fe6f36530f5d2981454b0f9be060a12c26c1deacbd",
    },
    "TS-005": {
      title: "CIS Workers",
      category: "Self Assessment",
      sha: "c907ff22baf9395d89dfcadfa28e3ab7ee42c2afcb2aafa58b1070f913e088f7",
    },
    "TS-006": {
      title: "MTD Overview",
      category: "Making Tax Digital",
      sha: "19ab85cbd8acea73c0cc80710d6e85e12848e4152ceae23da5672873900750d6",
    },
    "TS-007": {
      title: "MTD Eligibility",
      category: "Making Tax Digital",
      sha: "ac71e8dcdd6c4f0b7794b8f40d08476dee017d6e21ede92c427fee6d817026f2",
    },
    "TS-008": {
      title: "Services at a Glance",
      category: "Services",
      sha: "9e69f29fad34303ec8effefd95889d93e02ca4514ec51c1344e0af8e910ba766",
    },
    "TS-009": {
      title: "Customer Support",
      category: "Support",
      sha: "0fa6637e7427c18802cf4e20665e186bd03ead45e6eac61b44024989ee41c3d2",
    },
    "TS-010": {
      title: "Brand Message",
      category: "Brand",
      sha: "2883ff9567fde84d05db42b377698b79d26d1ff050a868a65b87d93190b30563",
    },
  };

  for (const id of Object.keys(META).sort()) {
    const meta = META[id];
    const buf =
      id === "TS-001" ? readFileSync(previousPath) : readFileSync(path.join(seed, `${id}.png`));
    await importOriginalAsset({
      id,
      file: { buffer: buf, mimetype: "image/png", originalname: `${id}.png`, size: buf.length },
      actor: "script:seed-before-ts001-replace",
      title: meta.title,
      category: meta.category,
      batchId: "batch-01",
      expectedSha256: meta.sha,
    });
  }

  const before = (await listAssets({ uploadedOnly: true })).find((a) => a.id === "TS-001")!;
  const approved = readFileSync(approvedPath);
  if (sha256Buffer(approved) !== EXPECTED_SHA) {
    throw new Error(`Approved PNG hash mismatch: ${sha256Buffer(approved)}`);
  }

  const result = await importOriginalAsset({
    id: "TS-001",
    file: {
      buffer: approved,
      mimetype: "image/png",
      originalname: "TS-001.png",
      size: approved.length,
    },
    actor: "script:approved-ts001-replacement",
    title: "SHOULD_NOT_OVERWRITE_TITLE",
    category: "SHOULD_NOT_OVERWRITE_CATEGORY",
    batchId: "batch-01",
    expectedSha256: EXPECTED_SHA,
    allowApprovedReplacement: true,
    notes: `Owner-approved TS-001 replacement. Previous sha=${PREVIOUS_SHA}. Draft / Awaiting Final QA.`,
  });

  const verify = await verifyStoredChecksum("TS-001");
  const others = (await listAssets({ uploadedOnly: true })).filter((a) =>
    /^TS-00([2-9]|10)$/.test(a.id),
  );
  const othersOk = (
    await Promise.all(others.map(async (a) => (await verifyStoredChecksum(a.id)).ok))
  ).every(Boolean);

  const payload = {
    timestamp: new Date().toISOString(),
    previousSha256: PREVIOUS_SHA,
    approvedSha256: EXPECTED_SHA,
    replacement: {
      id: "TS-001",
      action: result.action,
      sourceSha256: result.sourceSha256,
      storedSha256: result.storedSha256,
      checksumMatch: result.checksumMatch && verify.ok,
      databaseIdBefore: before.databaseId,
      databaseIdAfter: result.asset.databaseId,
      databaseIdPreserved: before.databaseId === result.asset.databaseId,
      titlePreserved: result.asset.title === "SA Deadline",
      categoryPreserved: result.asset.category === "Self Assessment",
      publicationStatus: result.asset.publicationStatus,
      storedPath: result.asset.storedPath,
      byteSize: result.asset.byteSize,
      width: result.asset.width,
      height: result.asset.height,
    },
    othersUnchangedCount: others.length,
    othersChecksumPass: othersOk,
  };

  const out = path.resolve(
    root,
    "../docs/marketing-hub/evidence/batch-01/ts001-replacement-results.json",
  );
  writeFileSync(out, JSON.stringify(payload, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));

  await close();
  await mongo.stop();
  if (
    result.action !== "replaced" ||
    !payload.replacement.checksumMatch ||
    !payload.replacement.databaseIdPreserved ||
    !payload.othersChecksumPass
  ) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
