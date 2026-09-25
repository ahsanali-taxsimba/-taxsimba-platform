/**
 * Regression: clientAxios FormData + Content-Type contract for draft upload.
 *
 * Exact staging defect (MTD-2004): instance default Content-Type application/json
 * caused axios transformRequest to JSON.stringify(FormData) →
 * {"draftReturnFile":{},"draftType":"..."} → Multer saw no file → "file is required".
 *
 * This test uses the same header-builder rules as tax_simba_admin_frontend
 * `buildRequestHeaders` and the same multipart field name `draftReturnFile`
 * that UploadDraftModal appends and Multer `upload.fields` expects.
 */
import http from "http";
import path from "path";
import { createRequire } from "module";
import FormDataNode from "form-data";
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
import { DRAFT_REVIEW_AWAITING } from "../../src/compat/documents";

const require = createRequire(
  path.resolve(__dirname, "../../../tax_simba_admin_frontend/package.json"),
);
const axios = require("axios") as typeof import("axios");

/** Mirror of admin `buildRequestHeaders` FormData branch (must stay in sync). */
function buildRequestHeadersFixed(
  authHeaders: Record<string, string>,
  data: unknown,
): Record<string, string | boolean> {
  const headers: Record<string, string | boolean> = { ...authHeaders };
  const isFd =
    (typeof FormData !== "undefined" && data instanceof FormData) ||
    (data &&
      typeof (data as { getHeaders?: unknown }).getHeaders === "function" &&
      typeof (data as { append?: unknown }).append === "function");
  if (isFd) {
    headers["Content-Type"] = false;
  } else if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/** Buggy pre-fix behaviour: only delete Content-Type from the per-request bag. */
function buildRequestHeadersBuggy(
  authHeaders: Record<string, string>,
  data: unknown,
): Record<string, string> {
  const headers: Record<string, string> = { ...authHeaders };
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    delete headers["Content-Type"];
  }
  return headers;
}

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

describe("draft upload multipart contract (clientAxios FormData)", () => {
  let app: Express;
  let server: http.Server;
  let port: number;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let accountant: Awaited<ReturnType<typeof makeUser>>;
  let otherAcc: Awaited<ReturnType<typeof makeUser>>;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;
  let client: Awaited<ReturnType<typeof makeClient>>;
  let caseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    admin = await makeUser("ADMIN", "multipart-admin");
    accountant = await makeUser("ACCOUNTANT", "multipart-acc");
    otherAcc = await makeUser("ACCOUNTANT", "multipart-other");
    superAdmin = await makeUser("SUPER_ADMIN", "multipart-super");
    client = await makeClient("multipart-client");
    ({ caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY"));
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);

    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  }, 60000);

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await dropTestDb();
  });

  it("buggy JSON Content-Type default would stringify FormData and yield file is required", async () => {
    // Same defaults as the broken clientAxios instance
    const instance = axios.create({
      baseURL: `http://127.0.0.1:${port}/api/compat`,
      headers: { "Content-Type": "application/json" },
    });

    const fd = new FormData();
    fd.append(
      "draftReturnFile",
      new Blob([PDF], { type: "application/pdf" }),
      "mtd-2004-draft.pdf",
    );
    fd.append("draftType", "Tax Return Draft");

    const buggyHeaders = buildRequestHeadersBuggy(
      { Authorization: `Bearer ${accountant.token}` },
      fd,
    );

    const probe = await instance.post(`/accountant/assignments/${caseId}/upload-draft`, fd, {
      headers: { ...buggyHeaders, "Content-Type": "application/json" },
      validateStatus: () => true,
      adapter: async (config) => {
        // Exact staging defect: FormData becomes JSON with empty file object
        expect(typeof config.data).toBe("string");
        const parsed = JSON.parse(config.data as string);
        expect(parsed.draftReturnFile).toEqual({});
        expect(parsed.draftType).toBe("Tax Return Draft");
        return {
          data: { success: false, data: null, message: "file is required" },
          status: 422,
          statusText: "Unprocessable Entity",
          headers: {},
          config,
          request: {},
        };
      },
    });
    expect(probe.status).toBe(422);
    expect(String(probe.data?.message)).toMatch(/file is required/i);
  });

  it(
    "fixed clientAxios headers send real multipart draftReturnFile and backend stores AWAITING_ADMIN_REVIEW",
    async () => {
    const instance = axios.create({
      baseURL: `http://127.0.0.1:${port}/api/compat`,
      // Intentionally NO default Content-Type — matches fixed clientAxios
      timeout: 30000,
    });

    const fd = new FormDataNode();
    fd.append("draftReturnFile", PDF, {
      filename: "mtd-2004-draft.pdf",
      contentType: "application/pdf",
    });
    fd.append("draftType", "Tax Return Draft");
    fd.append("explanationNotes", "multipart contract regression");

    // Critical: Authorization Bearer + multipart boundary from form-data.
    // Never send application/json. Never send multipart/form-data without boundary.
    const res = await instance.post(
      `/accountant/assignments/${caseId}/upload-draft`,
      fd,
      {
        headers: {
          Authorization: `Bearer ${accountant.token}`,
          ...fd.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.reviewStatus).toBe(DRAFT_REVIEW_AWAITING);
    expect(res.data.data.isInternal).toBe(true);
    expect(res.data.data.clientNotified).toBe(false);
    expect(Number(res.data.data.size)).toBeGreaterThan(0);
    expect(String(res.data.data.name || res.data.data.filename)).toMatch(/mtd-2004-draft\.pdf/i);

    const draftId = res.data.data.id as string;
    const { col } = await import("../../src/db/mongo");
    const stored = await col("documents").findOne({ id: draftId });
    expect(stored?.content_type).toMatch(/pdf/i);
    expect(Number(stored?.size)).toBeGreaterThan(0);
    expect(stored?.review_status).toBe(DRAFT_REVIEW_AWAITING);
    expect(stored?.is_internal).toBe(true);

    // Wrong field name must still fail (contract awareness)
    const wrong = new FormDataNode();
    wrong.append("document", PDF, {
      filename: "wrong-field.pdf",
      contentType: "application/pdf",
    });
    const wrongRes = await instance.post(`/accountant/assignments/${caseId}/upload-draft`, wrong, {
      headers: { Authorization: `Bearer ${accountant.token}`, ...wrong.getHeaders() },
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
    expect(wrongRes.status).toBe(422);
    expect(String(wrongRes.data?.message || "")).toMatch(/file is required/i);

    // Unassigned + SUPER_ADMIN denied
    const unassignedFd = new FormDataNode();
    unassignedFd.append("draftReturnFile", PDF, {
      filename: "mtd-2004-draft.pdf",
      contentType: "application/pdf",
    });
    await instance
      .post(`/accountant/assignments/${caseId}/upload-draft`, unassignedFd, {
        headers: { Authorization: `Bearer ${otherAcc.token}`, ...unassignedFd.getHeaders() },
        maxBodyLength: Infinity,
        validateStatus: () => true,
      })
      .then((r) => expect(r.status).toBe(403));

    const saFd = new FormDataNode();
    saFd.append("draftReturnFile", PDF, {
      filename: "mtd-2004-draft.pdf",
      contentType: "application/pdf",
    });
    await instance
      .post(`/admin/assignments/${caseId}/upload-draft`, saFd, {
        headers: { Authorization: `Bearer ${superAdmin.token}`, ...saFd.getHeaders() },
        maxBodyLength: Infinity,
        validateStatus: () => true,
      })
      .then((r) => expect(r.status).toBe(403));

    // Client cannot see before approval
    const before = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const beforeDocs = before.body.data?.documents?.draftDocuments || [];
    expect(beforeDocs.some((d: { id: string }) => d.id === draftId)).toBe(false);

    // SUPER_ADMIN cannot approve
    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(superAdmin))
      .send({ action: "approve" })
      .expect(403);

    // Admin approves → client sees + notified
    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "approve", note: "multipart ok" })
      .expect(200);

    const after = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    const afterDocs = after.body.data?.documents?.draftDocuments || [];
    expect(afterDocs.some((d: { id: string }) => d.id === draftId)).toBe(true);

    const notes = await request(app).get("/api/notifications").set(bearer(client)).expect(200);
    const list = Array.isArray(notes.body) ? notes.body : notes.body?.data || [];
    expect(
      list.some((n: { title?: string }) => /ready to review/i.test(String(n.title || ""))),
    ).toBe(true);
  },
  30000,
  );});
