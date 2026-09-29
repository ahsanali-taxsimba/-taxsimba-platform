/**
 * Admin client/accountant directory pagination — stable order, no page overlap.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
  TestUser,
} from "../helpers/app";

describe("admin directory pagination", () => {
  let app: Express;
  let admin: TestUser;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "page-admin");
    // Create enough clients for two pages at limit=5.
    for (let i = 0; i < 12; i += 1) {
      await makeClient(`page-client-${i}`);
    }
    for (let i = 0; i < 7; i += 1) {
      await makeUser("ACCOUNTANT", `page-acct-${i}`);
    }
  }, 120000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("returns distinct client pages with stable totals", async () => {
    const page1 = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({ page: 1, limit: 5 })
      .expect(200);
    const page2 = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({ page: 2, limit: 5 })
      .expect(200);

    expect(page1.body.data.pagination.total).toBeGreaterThanOrEqual(12);
    expect(page1.body.data.pagination.total).toBe(page2.body.data.pagination.total);
    expect(page1.body.data.clients).toHaveLength(5);
    expect(page2.body.data.clients).toHaveLength(5);

    const ids1 = page1.body.data.clients.map((c: { id: string }) => c.id);
    const ids2 = page2.body.data.clients.map((c: { id: string }) => c.id);
    expect(new Set(ids1).size).toBe(5);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);

    // Same page again is identical (stable ordering).
    const page1b = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({ page: 1, limit: 5 })
      .expect(200);
    expect(page1b.body.data.clients.map((c: { id: string }) => c.id)).toEqual(ids1);
  });

  it("returns distinct accountant pages", async () => {
    const page1 = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({ page: 1, limit: 3 })
      .expect(200);
    const page2 = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({ page: 2, limit: 3 })
      .expect(200);

    expect(page1.body.data.pagination.total).toBeGreaterThanOrEqual(7);
    expect(page1.body.data.accountants).toHaveLength(3);
    expect(page2.body.data.accountants).toHaveLength(3);
    const ids1 = page1.body.data.accountants.map((a: { id: string }) => a.id);
    const ids2 = page2.body.data.accountants.map((a: { id: string }) => a.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });
});
