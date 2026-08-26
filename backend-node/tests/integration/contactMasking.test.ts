/**
 * Client contact exposure rule: an accountant never receives client contact fields, a standard
 * admin only ever sees them masked, and only a super admin can read them in full (audited). This
 * sweeps every staff-reachable surface that carries client data and fails if a raw address or
 * phone number appears anywhere in the response.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";

const PHONE = "07700900123";

describe("client contact masking across roles", () => {
  let app: Express;
  let accountant: TestUser;
  let admin: TestUser;
  let superAdmin: TestUser;
  let client: TestUser & { clientId: string };
  let saCase: string;
  let mtdCase: string;

  /** Every staff-readable surface that could carry a client's contact details. */
  function surfaces(): string[] {
    return [
      "/api/cases",
      `/api/cases/${saCase}`,
      `/api/cases/${mtdCase}`,
      `/api/cases/${saCase}/activity`,
      `/api/cases/${saCase}/assignments`,
      `/api/cases/${saCase}/notes`,
      `/api/cases/${saCase}/calculations`,
      `/api/documents?case_id=${saCase}`,
      `/api/messages?case_id=${saCase}`,
      "/api/tasks",
      "/api/notifications",
      `/api/mtd/cases/${mtdCase}/periods`,
      `/api/mtd/cases/${mtdCase}/onboarding`,
      "/api/users?role=CLIENT",
      "/api/work",
      "/api/my-workload",
      "/api/payment-requests",
    ];
  }

  async function sweep(as: TestUser): Promise<{ path: string; body: string }[]> {
    const seen: { path: string; body: string }[] = [];
    for (const path of surfaces()) {
      const res = await request(app).get(path).set(bearer(as));
      // 403/404 on a surface a role cannot reach is itself compliant.
      if (res.status !== 200) continue;
      seen.push({ path, body: JSON.stringify(res.body) });
    }
    return seen;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    accountant = await makeUser("ACCOUNTANT", "accountant");
    admin = await makeUser("ADMIN", "admin");
    superAdmin = await makeUser("SUPER_ADMIN", "superadmin");
    client = await makeClient("contactclient");

    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne({ id: client.id }, { $set: { phone: PHONE } });
    await col("clients").updateOne({ user_id: client.id }, { $set: { phone: PHONE } });

    for (const service_type of ["SELF_ASSESSMENT", "MTD_INCOME_TAX"]) {
      const res = await request(app)
        .post("/api/cases")
        .set(bearer(client))
        .send({ tax_year: "2024/25", service_type })
        .expect(200);
      if (service_type === "SELF_ASSESSMENT") saCase = res.body.id;
      else mtdCase = res.body.id;
      await request(app)
        .post(`/api/cases/${res.body.id}/assign`)
        .set(bearer(admin))
        .send({ accountant_id: accountant.id })
        .expect(200);
    }
    await request(app).get(`/api/mtd/cases/${mtdCase}/periods`).set(bearer(client)).expect(200);
    await request(app)
      .post("/api/messages")
      .set(bearer(client))
      .send({ case_id: saCase, body: "Please call me back" })
      .expect(200);
  });

  afterAll(dropTestDb);

  it("never exposes client email or phone to an accountant", async () => {
    const swept = await sweep(accountant);
    expect(swept.length).toBeGreaterThan(5);
    for (const { path, body } of swept) {
      expect(body, `${path} leaked the client email to an accountant`).not.toContain(client.email);
      expect(body, `${path} leaked the client phone to an accountant`).not.toContain(PHONE);
    }
  });

  it("never exposes full client email or phone to a standard admin", async () => {
    const swept = await sweep(admin);
    expect(swept.length).toBeGreaterThan(5);
    for (const { path, body } of swept) {
      expect(body, `${path} leaked the full client email to an admin`).not.toContain(client.email);
      expect(body, `${path} leaked the full client phone to an admin`).not.toContain(PHONE);
    }
    // The admin still gets a usable masked identifier rather than nothing at all.
    const users = await request(app)
      .get("/api/users?role=CLIENT")
      .set(bearer(admin))
      .expect(200);
    const row = (users.body as { id: string; email: string; contact_masked?: boolean }[]).find(
      (u) => u.id === client.id,
    );
    expect(row?.contact_masked).toBe(true);
    expect(row?.email).toContain("***");
  });

  it("refuses an admin or accountant the audited super-admin contact reveal", async () => {
    for (const staff of [accountant, admin]) {
      await request(app)
        .post(`/api/clients/${client.id}/reveal-contact`)
        .set(bearer(staff))
        .send({ reason: "checking" })
        .expect(403);
    }
  });

  it("gives a super admin the full contact details and audits the reveal", async () => {
    const users = await request(app)
      .get("/api/users?role=CLIENT")
      .set(bearer(superAdmin))
      .expect(200);
    const row = (users.body as { id: string; email: string; contact_masked?: boolean }[]).find(
      (u) => u.id === client.id,
    );
    expect(row?.email).toBe(client.email);
    expect(row?.contact_masked).not.toBe(true);

    const revealed = await request(app)
      .post(`/api/clients/${client.id}/reveal-contact`)
      .set(bearer(superAdmin))
      .send({ reason: "Client asked us to call them" })
      .expect(200);
    expect(JSON.stringify(revealed.body)).toContain(client.email);

    const log = await request(app)
      .get("/api/contact-access-log")
      .set(bearer(superAdmin))
      .expect(200);
    expect(JSON.stringify(log.body)).toContain("Client asked us to call them");
  });
});
