/**
 * Batch 01 Content Library import — real PNG bytes from marketing-library-seed.
 * LABEL: Uses local storage + test Mongo. Not live staging UI.
 */
import { readFileSync } from "fs";
import path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

import { bootTestApp, dropTestDb, makeUser, ORIGIN } from "../helpers/app";
import { importOriginalAsset, listAssets, verifyStoredChecksum } from "../../src/marketing-hub/assets";

const SEED = path.resolve(__dirname, "../../marketing-library-seed/batch-01");

const EXPECT: Record<string, string> = {
  "TS-001": "da5a4feba0e71289bd4f1ed804a50c1cf224f18029984a0c93b1acbb2f47b675",
  "TS-002": "07ab42e2f2ae8998f0b6ba8941515dc807bcfb1d8e8f9d5b834f8ccd002a37b9",
  "TS-003": "1e4a6d0f7818dd3d94d07adfb39ac6f625857eb8988580395f620cbd7abf41ae",
  "TS-004": "8f0c9e0013674ef3a52df4fe6f36530f5d2981454b0f9be060a12c26c1deacbd",
  "TS-005": "c907ff22baf9395d89dfcadfa28e3ab7ee42c2afcb2aafa58b1070f913e088f7",
  "TS-006": "19ab85cbd8acea73c0cc80710d6e85e12848e4152ceae23da5672873900750d6",
  "TS-007": "ac71e8dcdd6c4f0b7794b8f40d08476dee017d6e21ede92c427fee6d817026f2",
  "TS-008": "9e69f29fad34303ec8effefd95889d93e02ca4514ec51c1344e0af8e910ba766",
  "TS-009": "0fa6637e7427c18802cf4e20665e186bd03ead45e6eac61b44024989ee41c3d2",
  "TS-010": "2883ff9567fde84d05db42b377698b79d26d1ff050a868a65b87d93190b30563",
};

const META: Record<string, { title: string; category: string }> = {
  "TS-001": { title: "SA Deadline", category: "Self Assessment" },
  "TS-002": { title: "First-Time Filing", category: "Self Assessment" },
  "TS-003": { title: "Landlord Tax", category: "Self Assessment" },
  "TS-004": { title: "Self-Employed", category: "Self Assessment" },
  "TS-005": { title: "CIS Workers", category: "Self Assessment" },
  "TS-006": { title: "MTD Overview", category: "Making Tax Digital" },
  "TS-007": { title: "MTD Eligibility", category: "Making Tax Digital" },
  "TS-008": { title: "Services at a Glance", category: "Services" },
  "TS-009": { title: "Customer Support", category: "Support" },
  "TS-010": { title: "Brand Message", category: "Brand" },
};

describe("Batch 01 Content Library import", () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    process.env.MARKETING_HUB_ENABLED = "true";
    process.env.STORAGE_DRIVER = "local";
    const boot = await bootTestApp();
    app = boot.app;
    token = (await makeUser("SUPER_ADMIN", "batch01")).token;

    for (const id of Object.keys(EXPECT).sort()) {
      const buffer = readFileSync(path.join(SEED, `${id}.png`));
      await importOriginalAsset({
        id,
        file: { buffer, mimetype: "image/png", originalname: `${id}.png`, size: buffer.length },
        actor: "test:batch01",
        title: META[id].title,
        category: META[id].category,
        batchId: "batch-01",
        expectedSha256: EXPECT[id],
      });
    }
  }, 180_000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("creates exactly ten unique library records TS-001..TS-010", async () => {
    const uploaded = await listAssets({ uploadedOnly: true });
    const batch = uploaded.filter((a) => /^TS-00([1-9]|10)$/.test(a.id) || a.id === "TS-010");
    // TS-001..TS-010 inclusive
    const ids = uploaded.map((a) => a.id).filter((id) => EXPECT[id]).sort();
    expect(ids).toEqual(Object.keys(EXPECT).sort());
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    for (const a of uploaded.filter((x) => EXPECT[x.id])) {
      expect(a.publicationStatus).toBe("draft_awaiting_qa");
      expect(a.isFinishedArtwork).toBe(false);
      expect(a.width).toBe(1024);
      expect(a.height).toBe(1536);
    }
    expect(batch.length).toBeGreaterThanOrEqual(10);
  });

  it("stored SHA-256 matches source for all ten", async () => {
    for (const id of Object.keys(EXPECT)) {
      const v = await verifyStoredChecksum(id);
      expect(v.ok).toBe(true);
      expect(v.sourceSha256).toBe(EXPECT[id]);
      expect(v.storedSha256).toBe(EXPECT[id]);
    }
  });

  it("idempotent reimport does not duplicate or change hash", async () => {
    const id = "TS-001";
    const buffer = readFileSync(path.join(SEED, `${id}.png`));
    const again = await importOriginalAsset({
      id,
      file: { buffer, mimetype: "image/png", originalname: `${id}.png`, size: buffer.length },
      actor: "test:batch01",
      title: META[id].title,
      category: META[id].category,
      batchId: "batch-01",
      expectedSha256: EXPECT[id],
    });
    expect(again.action).toBe("unchanged");
    const uploaded = (await listAssets({ uploadedOnly: true })).filter((a) => a.id === id);
    expect(uploaded).toHaveLength(1);
  });

  it("approved TS-001 replacement preserves library id/databaseId and updates checksum", async () => {
    const id = "TS-001";
    const PREV =
      "7ba0b611de8a1abe260895160378588d920e30b6c5905e0f9b4821eddfb2e0c1";
    const previousPath = path.resolve("/tmp/ts001-previous.png");
    const before = (await listAssets({ uploadedOnly: true })).find((a) => a.id === id)!;
    expect(before.databaseId).toBeTruthy();
    expect(before.sha256).toBe(EXPECT[id]);

    // Roll library back to previous artwork (explicit approved replacement), then re-apply approved bytes.
    const previous = readFileSync(previousPath);
    const rolled = await importOriginalAsset({
      id,
      file: {
        buffer: previous,
        mimetype: "image/png",
        originalname: `${id}.png`,
        size: previous.length,
      },
      actor: "test:batch01-replacement",
      title: META[id].title,
      category: META[id].category,
      batchId: "batch-01",
      expectedSha256: PREV,
      allowApprovedReplacement: true,
    });
    expect(rolled.action).toBe("replaced");
    expect(rolled.asset.databaseId).toBe(before.databaseId);
    expect(rolled.asset.sha256).toBe(PREV);
    expect(rolled.asset.title).toBe(META[id].title);
    expect(rolled.asset.category).toBe(META[id].category);
    expect(rolled.asset.publicationStatus).toBe("draft_awaiting_qa");

    const approved = readFileSync(path.join(SEED, `${id}.png`));
    const replaced = await importOriginalAsset({
      id,
      file: {
        buffer: approved,
        mimetype: "image/png",
        originalname: `${id}.png`,
        size: approved.length,
      },
      actor: "test:batch01-replacement",
      title: "SHOULD_NOT_OVERWRITE_TITLE",
      category: "SHOULD_NOT_OVERWRITE_CATEGORY",
      batchId: "batch-01",
      expectedSha256: EXPECT[id],
      allowApprovedReplacement: true,
    });
    expect(replaced.action).toBe("replaced");
    expect(replaced.asset.databaseId).toBe(before.databaseId);
    expect(replaced.asset.title).toBe(META[id].title);
    expect(replaced.asset.category).toBe(META[id].category);
    expect(replaced.asset.publicationStatus).toBe("draft_awaiting_qa");
    expect(replaced.asset.sha256).toBe(EXPECT[id]);
    expect(replaced.checksumMatch).toBe(true);
    expect((await listAssets({ uploadedOnly: true })).filter((a) => a.id === id)).toHaveLength(1);
    // Without allow flag, different hash must refuse
    await expect(
      importOriginalAsset({
        id,
        file: {
          buffer: previous,
          mimetype: "image/png",
          originalname: `${id}.png`,
          size: previous.length,
        },
        actor: "test:batch01-replacement",
        title: META[id].title,
        category: META[id].category,
        expectedSha256: PREV,
      }),
    ).rejects.toThrow(/Hash conflict/);
  });

  it("preview and download return exact original bytes", async () => {
    const id = "TS-006";
    const source = readFileSync(path.join(SEED, `${id}.png`));
    const preview = await request(app)
      .get(`/api/marketing-hub/assets/${id}/preview`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(preview.status).toBe(200);
    expect(Buffer.compare(preview.body as Buffer, source)).toBe(0);
    expect(preview.headers["x-content-sha256"]).toBe(EXPECT[id]);

    const download = await request(app)
      .get(`/api/marketing-hub/assets/${id}/download`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(String(download.headers["content-disposition"] || "")).toMatch(/attachment/);
    expect(Buffer.compare(download.body as Buffer, source)).toBe(0);
  });

  it("search and category filter work", async () => {
    const sa = await request(app)
      .get("/api/marketing-hub/assets?library=true&category=Self%20Assessment")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`);
    expect(sa.status).toBe(200);
    expect(sa.body.items.every((a: { category: string }) => a.category === "Self Assessment")).toBe(
      true,
    );
    expect(sa.body.items.length).toBeGreaterThanOrEqual(5);

    const q = await request(app)
      .get("/api/marketing-hub/assets?library=true&q=MTD")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`);
    expect(q.body.items.some((a: { id: string }) => a.id === "TS-006")).toBe(true);
  });

  it("scheduling allowed; published blocked; persistence across list refresh", async () => {
    const sched = await request(app)
      .post("/api/marketing-hub/assets/TS-002/publication-status")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "scheduled" });
    expect(sched.status).toBe(200);
    expect(sched.body.asset.publicationStatus).toBe("scheduled");

    const pub = await request(app)
      .post("/api/marketing-hub/assets/TS-002/publication-status")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(pub.status).toBe(400);

    const again = await request(app)
      .get("/api/marketing-hub/assets/TS-002")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`);
    expect(again.body.asset.publicationStatus).toBe("scheduled");
    expect(again.body.checksum.ok).toBe(true);
  });
});
