/**
 * F-002 — SA clients submit onboarding questionnaire (optional UTR, job role, employment).
 * Missing UTR must not block account/dashboard flags.
 */
import type { Express } from "express";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  TestUser,
} from "../helpers/app";
import { col } from "../../src/db/mongo";
import { SELF_ASSESSMENT } from "../../src/domain/packages";

let app: Express;
let client: TestUser & { clientId: string };

describe("F-002 SA submit-tax-info questionnaire", () => {
  beforeAll(async () => {
    ({ app } = await bootTestApp());
    client = await makeClient("f002-sa");
    await activateClientService(client, SELF_ASSESSMENT);
    // Ensure an SA case exists for submit-tax-info attachment.
    const minted = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .send({ serviceType: "SELF_ASSESSMENT", service_type: "SELF_ASSESSMENT" });
    expect([200, 201]).toContain(minted.status);
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("saves SA answers including optional blank UTR, job role, employment; persists after reload", async () => {
    const res = await request(app)
      .post("/api/compat/client/submit-tax-info")
      .set(bearer(client))
      .field("serviceType", "SELF_ASSESSMENT")
      .field("businessType", "Sole Trader")
      .field("businessName", "F002 Test Biz")
      .field("utr", "")
      .field("jobRole", "Freelance designer")
      .field("employmentStatus", "Self-employed")
      .field("currentAccountant", "No — I handle it myself")
      .field("incomeSources", JSON.stringify(["Self-Employment"]))
      .field("annualTurnover", "Under £50,000")
      .field("recordKeepingMethod", "Spreadsheets")
      .field("accountantNotes", "F-002 test");
    expect(res.status).toBe(200);
    expect(res.body?.success !== false).toBe(true);

    const user = await col("users").findOne({ id: client.id });
    expect(user?.sa_tax_info_submitted_at).toBeTruthy();
    expect((user?.sa_tax_info as { jobRole?: string } | undefined)?.jobRole).toBe(
      "Freelance designer",
    );
    expect(
      (user?.sa_tax_info as { employmentStatus?: string } | undefined)?.employmentStatus,
    ).toBe("Self-employed");

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(client))
      .send({});
    expect(details.status).toBe(200);
    const d = details.body?.data || details.body;
    const submitted = d.isTaxInfoSubmitted === true || d.is_tax_info_submitted === true;
    expect(submitted).toBe(true);
    expect(d.jobRole || d.job_role).toBe("Freelance designer");
  });
});
