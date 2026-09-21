/**
 * TS-UAT-029–035: accountant CRUD/status, assignment UUID, case-creation gates.
 */
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
} from "../helpers/app";

describe("P0 UAT 029–035 corrections", () => {
  let app: Express;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    admin = await makeUser("ADMIN", "uat29035admin");
    superAdmin = await makeUser("SUPER_ADMIN", "uat29035super");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("029: accountant table/modal status fields are consistent (isActive + status string)", async () => {
    const accountant = await makeUser("ACCOUNTANT", "uat029acc");
    const list = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const row = list.body.data.accountants.find((a: { id: string }) => a.id === accountant.id);
    expect(row).toBeTruthy();
    expect(typeof row.isActive).toBe("boolean");
    expect(row.status).toBe(row.isActive ? "active" : "inactive");
    expect(row.status).not.toBe(1);
    expect(row).toHaveProperty("surname");
    expect(row).toHaveProperty("mobile");
    expect(row).toHaveProperty("qualification");
    expect(row).toHaveProperty("experience");
    expect(row).toHaveProperty("onboardedAt");
  });

  it("034: accountant create persists surname, phone, qualification, experience", async () => {
    const created = await request(app)
      .post("/api/compat/admin/accountants/create")
      .set(bearer(superAdmin))
      .send({
        name: "Amara",
        surname: "Khan",
        email: `amara.create.${Date.now()}@uat.taxsimba.test`,
        mobile: "07700900444",
        qualification: "ACA",
        experience: "8",
      })
      .expect(201);
    expect(created.body.message).toMatch(/Accountant added successfully/i);
    expect(created.body.data.surname).toBe("Khan");
    expect(created.body.data.phone || created.body.data.mobile).toMatch(/07700900444/);
    expect(created.body.data.qualification).toBe("ACA");
    expect(String(created.body.data.experience)).toBe("8");

    const list = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const row = list.body.data.accountants.find(
      (a: { id: string }) => a.id === created.body.data.id || a.id === created.body.data.userId,
    );
    expect(row).toBeTruthy();
    expect(row.surname).toBe("Khan");
    expect(row.mobile || row.phone).toMatch(/07700900444/);
    expect(row.qualification).toBe("ACA");
    expect(String(row.experience)).toBe("8");
  });

  it("031: accountant update persists fields and rejects invalid phone", async () => {
    const created = await request(app)
      .post("/api/compat/admin/accountants/create")
      .set(bearer(superAdmin))
      .send({
        name: "Ben",
        surname: "Lee",
        email: `ben.update.${Date.now()}@uat.taxsimba.test`,
        mobile: "07700900555",
        qualification: "CTA",
        experience: "3",
      })
      .expect(201);
    const id = created.body.data.id || created.body.data.userId;

    await request(app)
      .put(`/api/compat/admin/accountants/update/${id}`)
      .set(bearer(superAdmin))
      .send({
        name: "Ben",
        surname: "Lee",
        email: created.body.data.email,
        mobile: "1".repeat(40),
        qualification: "CTA",
        experience: "3",
      })
      .expect(400);

    const updated = await request(app)
      .put(`/api/compat/admin/accountants/update/${id}`)
      .set(bearer(superAdmin))
      .send({
        name: "Benjamin",
        surname: "Leeson",
        email: created.body.data.email,
        mobile: "07700900666",
        qualification: "FCA",
        experience: "12",
      })
      .expect(200);
    expect(updated.body.message).toMatch(/Accountant details updated successfully/i);
    expect(updated.body.data.surname).toBe("Leeson");
    expect(updated.body.data.phone || updated.body.data.mobile).toMatch(/07700900666/);
    expect(updated.body.data.qualification).toBe("FCA");
    expect(String(updated.body.data.experience)).toBe("12");
  });

  it("031/034: invalid accountant form data is rejected", async () => {
    await request(app)
      .post("/api/compat/admin/accountants/create")
      .set(bearer(superAdmin))
      .send({
        name: "X",
        surname: "",
        email: "not-an-email",
        mobile: "abc",
      })
      .expect(400);
  });

  it("033: UUID accountant assignment succeeds", async () => {
    const client = await makeClient("uat033client");
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT");
    const accountant = await makeUser("ACCOUNTANT", "uat033acc");

    const res = await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    expect(res.body.assigned_accountant_id).toBe(accountant.id);
    expect(res.body.status).toBe("ASSIGNED");

    // Compat assign with string UUID
    const client2 = await makeClient("uat033client2");
    const { caseId: caseId2 } = await activateClientService(client2, "SELF_ASSESSMENT");
    const accountant2 = await makeUser("ACCOUNTANT", "uat033acc2");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId2,
        accountantId: accountant2.id,
      })
      .expect(200);
  });

  it("032: registration does not create a tax case", async () => {
    const email = `reg.nocase.${Date.now()}@uat.taxsimba.test`;
    await request(app)
      .post("/api/compat/auth/register")
      .send({
        name: "Reg NoCase",
        email,
        password: "RegNoCase1!",
        mobile: "07700900777",
      })
      .expect(200);
    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email });
    expect(user).toBeTruthy();
    const cases = await col("cases")
      .find({ client_user_id: user!.id })
      .toArray();
    expect(cases).toHaveLength(0);
  });

  it("032: unverified / no-entitlement case creation is rejected", async () => {
    const unverified = await makeClient("uat032unverified", { emailVerified: false });
    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    const clientDoc = await col("clients").findOne({ id: unverified.clientId });
    const userDoc = await col("users").findOne({ id: unverified.id });
    const result = await activateService(
      clientDoc!,
      userDoc!,
      "SELF_ASSESSMENT",
      "SIMPLE",
      { reason: "should not create case" },
    );
    expect(result.case).toBeNull();
    expect(result.created_case).toBe(false);

    const unpaid = await makeClient("uat032unpaid");
    await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({
        client_user_id: unpaid.id,
        tax_year: "2031/32",
        service_type: "SELF_ASSESSMENT",
      })
      .expect(403);

    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(unpaid))
      .field("category", "taxSimba")
      .expect(403);
  });

  it("032: valid entitled verified workflow can create/access a case", async () => {
    const client = await makeClient("uat032ok");
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT");
    expect(caseId).toBeTruthy();
    await request(app).get(`/api/cases/${caseId}`).set(bearer(client)).expect(200);

    // Application path against existing activation case
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("category", "taxSimba")
      .expect(201);
  });

  it("035: clients list exposes username/mobile/location/lifecycle mapping fields", async () => {
    const client = await makeClient("uat035client");
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne(
      { id: client.id },
      {
        $set: {
          phone: "07700900888",
          address: "12 High Street, London",
          email_verified_at: new Date().toISOString(),
          is_active: true,
        },
      },
    );
    const res = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({})
      .expect(200);
    const row = res.body.data.clients.find((c: { id: string }) => c.id === client.id);
    expect(row).toBeTruthy();
    expect(row.mobile || row.phone).toBeTruthy();
    expect(String(row.mobile || row.phone)).toMatch(/07/);
    expect(row.location || row.address).toMatch(/High Street/);
    expect(row.username).toBeTruthy();
    expect(row.lifecycle).toBe("ACTIVE");
    expect(row.emailVerified).toBe(true);
    expect(row.createdAt).toBeTruthy();
  });
});
