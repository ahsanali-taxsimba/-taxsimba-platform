/**
 * Progress-bar "draft_ready" must not bypass Admin approval
 * (document release + client notification).
 */
import { randomUUID } from "crypto";

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

type Client = TestUser & { clientId: string };

describe("draft_ready progress cannot skip Admin review", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: Client;

  async function makeCase(status: string, patch: Record<string, unknown> = {}) {
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const kase = {
      id: randomUUID(),
      case_ref: `SA-${Math.floor(1000 + Math.random() * 8999)}`,
      client_id: client.clientId,
      client_user_id: client.id,
      client_name: client.name,
      service_type: "SELF_ASSESSMENT",
      tax_year: "2024/25",
      status,
      assigned_accountant_id: accountant.id,
      next_action_owner: "ACCOUNTANT",
      is_test: false,
      created_at: nowIso(),
      last_updated: nowIso(),
      ...patch,
    };
    await col("cases").insertOne({ ...kase });
    return kase;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "drgate-admin");
    accountant = await makeUser("ACCOUNTANT", "drgate-acct");
    client = await makeClient("drgate-client");
  }, 90000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("rejects draft_ready while case is READY_FOR_ADMIN_REVIEW", async () => {
    const { col } = await import("../../src/db/mongo");
    const kase = await makeCase("READY_FOR_ADMIN_REVIEW");
    const docId = randomUUID();
    await col("documents").insertOne({
      id: docId,
      case_id: kase.id,
      client_user_id: client.id,
      document_type: "Draft return",
      name: "draft.pdf",
      is_draft: true,
      is_internal: true,
      review_status: "AWAITING_ADMIN_REVIEW",
      is_deleted: false,
      uploader_id: accountant.id,
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post(`/api/compat/admin/tax-return/${kase.id}/progress`)
      .set(bearer(admin))
      .send({ status: "draft_ready" })
      .expect(400);

    const detail = String(res.body.detail || res.body.message || JSON.stringify(res.body));
    expect(detail).toMatch(/Admin must approve/i);

    const after = await col("cases").findOne({ id: kase.id });
    expect(after?.status).toBe("READY_FOR_ADMIN_REVIEW");

    const doc = await col("documents").findOne({ id: docId });
    expect(doc?.is_internal).toBe(true);
    expect(doc?.review_status).toBe("AWAITING_ADMIN_REVIEW");
  });

  it("maps draft_ready → READY_FOR_ADMIN_REVIEW from IN_PREPARATION", async () => {
    const kase = await makeCase("IN_PREPARATION");

    const res = await request(app)
      .post(`/api/compat/accountant/tax-return/${kase.id}/progress`)
      .set(bearer(accountant))
      .send({ status: "draft_ready" })
      .expect(200);

    expect(res.body.data.nodeStatus).toBe("READY_FOR_ADMIN_REVIEW");
    // Still in preparation bucket until Admin approves.
    expect(res.body.data.status).toBe("preparation_started");
  });

  it("from ADMIN_APPROVED, draft_ready advances to AWAITING_CLIENT_APPROVAL", async () => {
    const kase = await makeCase("ADMIN_APPROVED");

    const res = await request(app)
      .post(`/api/compat/admin/tax-return/${kase.id}/progress`)
      .set(bearer(admin))
      .send({ status: "draft_ready" })
      .expect(200);

    expect(res.body.data.nodeStatus).toBe("AWAITING_CLIENT_APPROVAL");
    expect(res.body.data.status).toBe("draft_ready");
  });
});
