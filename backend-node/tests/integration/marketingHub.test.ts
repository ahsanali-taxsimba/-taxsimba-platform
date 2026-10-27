/**
 * Marketing Hub API integration tests (fixture / mocked credentials).
 * LABEL: These do NOT verify live platform publishing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

import { bootTestApp, dropTestDb, makeUser, ORIGIN } from "../helpers/app";

describe("marketing hub API (mocked / fixture)", () => {
  let app: Express;
  let superToken: string;

  beforeAll(async () => {
    process.env.MARKETING_HUB_ENABLED = "true";
    process.env.MARKETING_HUB_PAUSED = "false";
    process.env.MARKETING_HUB_FIXTURE_MODE = "true";
    process.env.MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED = "false";
    const boot = await bootTestApp();
    app = boot.app;
    const superAdmin = await makeUser("SUPER_ADMIN", "mh-super");
    superToken = superAdmin.token;
  }, 120_000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("returns status and brand palette", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/status")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.brand.green).toBe("#37A267");
    expect(res.body.organicPublishAuthorised).toBe(false);
    expect(res.body.proposedStartingPrices.selfAssessmentGbp).toBe(119);
  });

  it("dashboard shows Not Connected / No Data rather than fabricated traffic", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/dashboard")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const traffic = res.body.metrics.find((m: { key: string }) => m.key === "website_traffic");
    expect(traffic.value).toBeNull();
    expect(["not_connected", "no_data"]).toContain(traffic.state);
  });

  it("exposes 120 templates with no false approvals", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/templates")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(120);
    expect(res.body.items.every((t: { status: string }) => t.status !== "approved")).toBe(true);
  });

  it("runs fixture daily engine and blocks unauthorised publish", async () => {
    const run = await request(app)
      .post("/api/marketing-hub/engine/run-daily")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(run.status).toBe(200);
    expect(run.body.created.length).toBeGreaterThan(0);
    expect(run.body.created[0].fixtureMode).toBe(true);

    const id = run.body.created[0].id;
    await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "content_qa" })
      .expect(200);
    await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "approval" })
      .expect(200);
    await request(app)
      .post(`/api/marketing-hub/drafts/${id}/advance`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ stage: "scheduled" })
      .expect(200);

    const pub = await request(app)
      .post(`/api/marketing-hub/drafts/${id}/publish`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ platforms: ["facebook_pages"] });
    expect(pub.status).toBe(400);
    expect(String(pub.body.detail || "")).toMatch(/not authorised|Organic/i);
  });

  it("lists connections as not_connected except TikTok manual", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/connections")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const tiktok = res.body.items.find((i: { platform: string }) => i.platform === "tiktok_manual");
    expect(tiktok.status).toBe("manual_only");
    const fb = res.body.items.find((i: { platform: string }) => i.platform === "facebook_pages");
    expect(fb.status).toBe("not_connected");
  });

  it("seo report preserves 120 guides and requires review", async () => {
    const res = await request(app)
      .get("/api/marketing-hub/seo")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.articlePreservation.found).toBe(120);
    expect(res.body.articlePreservation.ok).toBe(true);
    expect(res.body.google.searchConsole).toBe("not_connected");
    expect(res.body.recommendations.every((r: { requiresHumanReview: boolean }) => r.requiresHumanReview)).toBe(
      true,
    );
  });
});
