/**
 * Role-integrity matrix — founder-approved workflow.
 *
 * ADMIN: assign/reassign cases; cannot add/activate/deactivate/remove accountants.
 * SUPER_ADMIN: full oversight + accountant lifecycle; cannot assign/reassign.
 * ACCOUNTANT: sees only cases assigned to their users.id.
 * Deactivate/remove with active cases → 409, no mutation; Admin must reassign first.
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
import { ACCOUNTANT_ACTIVE_CASES_BLOCK_MESSAGE } from "../../src/domain/accountantIdentity";

describe("role integrity — assign ADMIN-only + deactivate 409 gate", () => {
  let app: Express;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let accountantA: Awaited<ReturnType<typeof makeUser>>;
  let accountantB: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    superAdmin = await makeUser("SUPER_ADMIN", "role-int-super");
    admin = await makeUser("ADMIN", "role-int-admin");
    accountantA = await makeUser("ACCOUNTANT", "role-int-a");
    accountantB = await makeUser("ACCOUNTANT", "role-int-b");
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("ADMIN assign = 200; SUPER_ADMIN assign/reassign = 403 (compat + native)", async () => {
    const client = await makeClient("role-int-assign");
    const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");

    const adminAssign = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);
    expect(adminAssign.body.data.assignedAccountantId).toBe(accountantA.id);

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(superAdmin))
      .send({ taxReturnId: caseId, accountantId: accountantB.id })
      .expect(403);

    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(superAdmin))
      .send({ accountant_id: accountantB.id })
      .expect(403);

    await request(app)
      .post(`/api/cases/${caseId}/unassign`)
      .set(bearer(superAdmin))
      .send({ reason: "should not work" })
      .expect(403);

    // Ownership unchanged after SUPER_ADMIN attempts
    const { col } = await import("../../src/db/mongo");
    const stored = await col("cases").findOne({ id: caseId });
    expect(stored?.assigned_accountant_id).toBe(accountantA.id);
  });

  it("ADMIN accountant activation/deactivation/removal = 403", async () => {
    await request(app)
      .post(`/api/compat/admin/accountants/${accountantB.id}/status`)
      .set(bearer(admin))
      .send({ status: "inactive" })
      .expect(403);

    await request(app)
      .post(`/api/compat/admin/accountants/${accountantB.id}/status`)
      .set(bearer(admin))
      .send({ status: "active" })
      .expect(403);

    await request(app)
      .delete(`/api/compat/admin/accountants/${accountantB.id}`)
      .set(bearer(admin))
      .expect(403);

    await request(app)
      .patch(`/api/users/${accountantB.id}/active?is_active=false`)
      .set(bearer(admin))
      .expect(403);
  });

  it("SUPER_ADMIN deactivate with active cases = 409 and no mutation; Admin reassigns; then deactivate succeeds", async () => {
    const target = await makeUser("ACCOUNTANT", "role-int-deact-target");
    const client = await makeClient("role-int-deact");
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SIMPLE");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: target.id })
      .expect(200);

    const { col } = await import("../../src/db/mongo");
    const beforeUser = await col("users").findOne({ id: target.id });
    expect(beforeUser?.is_active).not.toBe(false);

    const blocked = await request(app)
      .post(`/api/compat/admin/accountants/${target.id}/status`)
      .set(bearer(superAdmin))
      .send({ status: "inactive" })
      .expect(409);

    expect(String(blocked.body.message)).toBe(ACCOUNTANT_ACTIVE_CASES_BLOCK_MESSAGE);
    const needing = blocked.body.data?.activeCasesNeedingReassignment;
    expect(needing).toBeTruthy();
    expect(needing.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(needing.caseIds)).toBe(true);
    expect(needing.caseIds).toContain(caseId);

    // No mutation
    const afterBlock = await col("users").findOne({ id: target.id });
    expect(afterBlock?.is_active).not.toBe(false);
    const caseStill = await col("cases").findOne({ id: caseId });
    expect(caseStill?.assigned_accountant_id).toBe(target.id);

    // Delete path also blocked
    const delBlocked = await request(app)
      .delete(`/api/compat/admin/accountants/${target.id}`)
      .set(bearer(superAdmin))
      .expect(409);
    expect(String(delBlocked.body.message)).toBe(ACCOUNTANT_ACTIVE_CASES_BLOCK_MESSAGE);
    expect((await col("users").findOne({ id: target.id }))?.is_active).not.toBe(false);

    // Native PATCH also 409
    const nativeBlocked = await request(app)
      .patch(`/api/users/${target.id}/active?is_active=false`)
      .set(bearer(superAdmin))
      .expect(409);
    expect(String(nativeBlocked.body.detail?.msg || nativeBlocked.body.detail)).toMatch(
      /Admin must reassign/i,
    );
    expect((await col("users").findOne({ id: target.id }))?.is_active).not.toBe(false);

    // ADMIN reassigns every active case
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantB.id })
      .expect(200);
    expect((await col("cases").findOne({ id: caseId }))?.assigned_accountant_id).toBe(
      accountantB.id,
    );

    // SUPER_ADMIN may now deactivate
    const deact = await request(app)
      .post(`/api/compat/admin/accountants/${target.id}/status`)
      .set(bearer(superAdmin))
      .send({ status: "inactive" })
      .expect(200);
    expect(deact.body.data.isActive).toBe(false);
    expect((await col("users").findOne({ id: target.id }))?.is_active).toBe(false);
  });

  it("Accountant A sees only A’s cases; B cannot access them; Super Admin observes without mutating", async () => {
    const client = await makeClient("role-int-iso");
    const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountantA.id })
      .expect(200);

    const mine = await request(app)
      .post("/api/compat/accountant/tax-return/files")
      .set(bearer(accountantA))
      .send({})
      .expect(200);
    const hit = (mine.body.data.assignments || []).find((a: { id: string }) => a.id === caseId);
    expect(hit).toBeTruthy();
    expect(hit.assignedAccountantId).toBe(accountantA.id);

    const other = await request(app)
      .post("/api/compat/accountant/tax-return/files")
      .set(bearer(accountantB))
      .send({})
      .expect(200);
    expect((other.body.data.assignments || []).some((a: { id: string }) => a.id === caseId)).toBe(
      false,
    );
    await request(app).get(`/api/cases/${caseId}`).set(bearer(accountantB)).expect(403);

    const superView = await request(app)
      .post("/api/compat/admin/tax-return/files")
      .set(bearer(superAdmin))
      .send({})
      .expect(200);
    const observed = (
      superView.body.data.assignments ||
      superView.body.data.taxReturns ||
      []
    ).find((r: { id: string }) => r.id === caseId);
    expect(observed).toBeTruthy();
    expect(observed.assignedAccountantId).toBe(accountantA.id);

    // SUPER_ADMIN cannot change ownership
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(superAdmin))
      .send({ taxReturnId: caseId, accountantId: accountantB.id })
      .expect(403);

    const { col } = await import("../../src/db/mongo");
    expect((await col("cases").findOne({ id: caseId }))?.assigned_accountant_id).toBe(
      accountantA.id,
    );
  });
});
