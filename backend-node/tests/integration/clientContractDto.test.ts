/**
 * CLIENT FE ↔ BE contract alignment for uploads, Tax Tracker, messages, my-files.
 */
import { randomUUID } from "crypto";

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
  TestUser,
} from "../helpers/app";

describe("client FE/BE contract DTOs", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser & { clientId: string };
  let caseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "ccon-admin");
    accountant = await makeUser("ACCOUNTANT", "ccon-acc");
    client = await makeClient("ccon-client");
    const activated = await activateClientService(client, "SELF_ASSESSMENT", "SMART");
    caseId = activated.caseId;
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);
  }, 120000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("accepts SA upload with canonical field `file` and legacy `documents`", async () => {
    const pdf = Buffer.from("%PDF-1.4 contract-file");
    const viaFile = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", pdf, { filename: "p60-file.pdf", contentType: "application/pdf" })
      .field("documentType", "P60")
      .expect(200);
    expect(viaFile.body.success).toBe(true);
    expect(viaFile.body.data.filename).toBe("p60-file.pdf");
    expect(String(viaFile.body.data.downloadUrl)).toContain("/client/documents/");

    const viaDocs = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("documents", Buffer.from("%PDF-1.4 legacy"), {
        filename: "p60-legacy.pdf",
        contentType: "application/pdf",
      })
      .field("documentType", "P60")
      .expect(200);
    expect(viaDocs.body.data.filename).toBe("p60-legacy.pdf");
  });

  it("my-files returns nested files.documents with filename + downloadUrl", async () => {
    const res = await request(app)
      .post("/api/compat/client/my-files")
      .set(bearer(client))
      .send({})
      .expect(200);
    const nested = res.body.data.files?.documents;
    expect(Array.isArray(nested)).toBe(true);
    expect(nested.length).toBeGreaterThan(0);
    expect(nested[0].filename).toBeTruthy();
    expect(String(nested[0].downloadUrl)).toMatch(/client\/documents\/.+\/download/);
  });

  it("all-tax-returns returns taxReturn.id and files.allFiles for Tax Tracker", async () => {
    const res = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const rows = res.body.data;
    expect(Array.isArray(rows)).toBe(true);
    const row = rows.find((r: { id: string }) => r.id === caseId);
    expect(row).toBeTruthy();
    expect(row.taxReturn.id).toBe(caseId);
    expect(Array.isArray(row.files.allFiles)).toBe(true);
    expect(row.files.allFiles.length).toBeGreaterThan(0);
  });

  it("communication-log returns both messages and emails aliases", async () => {
    await request(app)
      .post("/api/compat/client/send-to-specific-accountant")
      .set(bearer(client))
      .send({ taxReturnId: caseId, message: "Hello accountant", subject: "Hi" })
      .expect(200);

    const res = await request(app)
      .post(`/api/compat/client/communication-log/${caseId}`)
      .set(bearer(client))
      .send({})
      .expect(200);
    expect(Array.isArray(res.body.data.messages)).toBe(true);
    expect(Array.isArray(res.body.data.emails)).toBe(true);
    expect(res.body.data.emails.length).toBe(res.body.data.messages.length);
    expect(res.body.data.emails.length).toBeGreaterThan(0);
  });

  it("other client cannot download owned document", async () => {
    const other = await makeClient("ccon-other");
    await activateClientService(other, "SELF_ASSESSMENT", "SIMPLE");
    const mine = await request(app)
      .post("/api/compat/client/my-files")
      .set(bearer(client))
      .send({})
      .expect(200);
    const docId = mine.body.data.files.documents[0].id as string;
    await request(app)
      .get(`/api/compat/client/documents/${docId}/download`)
      .set(bearer(other))
      .expect(403);
  });

  it("rejects missing multipart file on SA upload", async () => {
    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .field("documentType", "P60")
      .expect(422);
  });

  it("MTD checkout uses subscription mode for RECURRING catalogue", async () => {
    const { FakePaymentProvider, WEBHOOK_SIGNATURE } = await import("../helpers/payments");
    const { setPaymentProvider } = await import("../../src/services/payments");
    const fake = new FakePaymentProvider();
    setPaymentProvider(fake);
    const mtdClient = await makeClient(`ccon-mtd-${randomUUID().slice(0, 6)}`);
    // verify already done by makeClient
    const plans = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const comply = (plans.body.data || plans.body).find?.(
      (p: { code?: string }) => p.code === "MTD_COMPLY",
    ) || (Array.isArray(plans.body) ? plans.body.find((p: { code: string }) => p.code === "MTD_COMPLY") : null);
    // Compat envelope varies — resolve package via native catalogue.
    const pkgs = await request(app).get("/api/packages?service_type=MTD_INCOME_TAX").set(bearer(mtdClient));
    const row = (pkgs.body as { code: string; id: string; billing_type: string }[]).find(
      (p) => p.code === "MTD_COMPLY",
    );
    expect(row?.billing_type).toBe("RECURRING");
    const checkout = await request(app)
      .post("/api/compat/client/subscription/checkout-session")
      .set(bearer(mtdClient))
      .send({ planId: row!.id, origin_url: "https://app.test.taxsimba.local" })
      .expect(200);
    expect(checkout.body.data.sessionId || checkout.body.data.session_id).toBeTruthy();
    expect(fake.last().mode).toBe("subscription");
    expect(fake.last().billing_type).toBe("RECURRING");
    void WEBHOOK_SIGNATURE;
    void comply;
    setPaymentProvider(null);
  });
});
