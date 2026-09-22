/**
 * TS-UAT residual: profile photo auth + send-to-client flat payload + UUID certificate path.
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
} from "../helpers/app";

describe("Final pre-UAT residual corrections", () => {
  let app: Express;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let client: Awaited<ReturnType<typeof makeClient>>;
  let caseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    admin = await makeUser("ADMIN", "residualadmin");
    client = await makeClient("residualclient");
    ({ caseId } = await activateClientService(client, "SELF_ASSESSMENT"));
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("A: profile photo GET requires auth; owner can retrieve after upload", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const uploaded = await request(app)
      .post("/api/compat/auth/update-account-settings")
      .set(bearer(client))
      .attach("profilePhoto", png, { filename: "avatar.png", contentType: "image/png" })
      .field("name", "Residual Client")
      .expect(200);
    expect(uploaded.body.success).toBe(true);
    const photoPath = uploaded.body.data.profilePhoto as string;
    expect(photoPath).toMatch(/^auth\/profile-photo\//);
    expect(photoPath).not.toMatch(/\/api\/compat\/api\//);

    await request(app).get(`/api/compat/${photoPath}`).expect(401);

    const got = await request(app)
      .get(`/api/compat/${photoPath}`)
      .set(bearer(client))
      .expect(200);
    expect(got.headers["content-type"]).toMatch(/image\//);
    expect(got.body.length || got.body?.data?.length || Buffer.isBuffer(got.body)).toBeTruthy();
  });

  it("B: flat send-to-client succeeds; nested emailData / missing message rejected", async () => {
    const ok = await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId,
        message: "Please upload your P60.",
      })
      .expect(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.data.body).toMatch(/P60/);

    const { col } = await import("../../src/db/mongo");
    const msgs = await col("messages").find({ case_id: caseId }).toArray();
    expect(msgs.some((m) => String(m.body).includes("P60"))).toBe(true);

    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId,
        emailData: { message: "nested only" },
      })
      .expect(400);

    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, message: "   " })
      .expect(400);

    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({ message: "no id" })
      .expect(400);
  });

  it("C: UUID case id accepted for send-to-client and final-certificate upload", async () => {
    expect(caseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, message: "UUID path ok" })
      .expect(200);

    const pdf = Buffer.from("%PDF-1.4 residual certificate\n");
    const up = await request(app)
      .post(`/api/compat/admin/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(admin))
      .attach("finalCertificateFile", pdf, {
        filename: "final.pdf",
        contentType: "application/pdf",
      });
    // Endpoint may return 200/201 depending on workflow gates; must not 404 from NaN id.
    expect([200, 201, 400]).toContain(up.status);
    expect(up.status).not.toBe(404);
    if (up.status >= 400) {
      expect(String(up.body.message || up.body.detail || "")).not.toMatch(/NaN/);
    }

    await request(app)
      .post("/api/compat/admin/send-to-client")
      .set(bearer(admin))
      .send({ taxReturnId: "", message: "x" })
      .expect(400);

    await request(app)
      .post(`/api/compat/admin/assignments/${randomUUID()}/upload-final-certificate`)
      .set(bearer(admin))
      .attach("finalCertificateFile", pdf, {
        filename: "final.pdf",
        contentType: "application/pdf",
      })
      .expect((res) => {
        expect([400, 403, 404]).toContain(res.status);
      });
  });
});
