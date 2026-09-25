/**
 * Real HTTP E2E: accountant multipart draft upload using the fixed clientAxios contract.
 */
import http from "http";
import path from "path";
import { createRequire } from "module";
import FormDataNode from "form-data";
import request from "supertest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../tests/helpers/app";

const require = createRequire(
  path.resolve(__dirname, "../../tax_simba_admin_frontend/package.json"),
);
const axios = require("axios");

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");

async function main() {
  const log = (s: string) => console.log(s);
  const { app } = await bootTestApp();
  const { ensurePhase1bData } = await import("../src/domain/packages");
  await ensurePhase1bData();

  const admin = await makeUser("ADMIN", "e2e-mp-admin");
  const superAdmin = await makeUser("SUPER_ADMIN", "e2e-mp-super");
  const accountant = await makeUser("ACCOUNTANT", "e2e-mp-acc");
  const other = await makeUser("ACCOUNTANT", "e2e-mp-other");
  const client = await makeClient("e2e-mp-client");
  const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");
  await request(app)
    .post("/api/compat/admin/assign")
    .set(bearer(admin))
    .send({ taxReturnId: caseId, accountantId: accountant.id })
    .expect(200);
  log(`CASE ${caseId}`);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };

  // Fixed clientAxios: no default Content-Type
  const api = axios.create({
    baseURL: `http://127.0.0.1:${port}/api/compat`,
    timeout: 120000,
  });

  // Prove buggy path still demonstrates the staging defect shape
  {
    const fd = new FormData();
    fd.append("draftReturnFile", new Blob([PDF], { type: "application/pdf" }), "x.pdf");
    fd.append("draftType", "Tax Return Draft");
    const buggy = axios.create({
      baseURL: `http://127.0.0.1:${port}/api/compat`,
      headers: { "Content-Type": "application/json" },
    });
    const probe = await buggy.post(`/accountant/assignments/${caseId}/upload-draft`, fd, {
      headers: { Authorization: `Bearer ${accountant.token}`, "Content-Type": "application/json" },
      validateStatus: () => true,
      adapter: async (config: { data: unknown }) => {
        const body = String(config.data);
        if (!body.includes('"draftReturnFile":{}')) {
          throw new Error("expected FormData JSON stringify defect");
        }
        return {
          data: { success: false, message: "file is required" },
          status: 422,
          statusText: "x",
          headers: {},
          config,
          request: {},
        };
      },
    });
    if (probe.status !== 422 || !/file is required/i.test(probe.data.message)) {
      throw new Error("buggy path did not reproduce file is required");
    }
    log("BUGGY_PATH reproduced file is required via JSON-stringified FormData");
  }

  const makeFd = () => {
    const f = new FormDataNode();
    f.append("draftReturnFile", PDF, {
      filename: "mtd-2004-draft.pdf",
      contentType: "application/pdf",
    });
    f.append("draftType", "Tax Return Draft");
    f.append("explanationNotes", "e2e multipart");
    return f;
  };

  const fd = makeFd();
  const uploaded = await api.post(`/accountant/assignments/${caseId}/upload-draft`, fd, {
    headers: {
      Authorization: `Bearer ${accountant.token}`,
      ...fd.getHeaders(),
    },
    maxBodyLength: Infinity,
  });
  if (uploaded.status !== 200 || !uploaded.data.success) {
    throw new Error(`upload failed ${uploaded.status} ${JSON.stringify(uploaded.data)}`);
  }
  const draftId = uploaded.data.data.id;
  log(
    `UPLOAD ok draftId=${draftId} size=${uploaded.data.data.size} mime=${uploaded.data.data.contentType} review=${uploaded.data.data.reviewStatus} internal=${uploaded.data.data.isInternal}`,
  );
  if (Number(uploaded.data.data.size) <= 0) throw new Error("empty file stored");
  if (uploaded.data.data.reviewStatus !== "AWAITING_ADMIN_REVIEW") {
    throw new Error("expected AWAITING_ADMIN_REVIEW");
  }
  if (uploaded.data.data.isInternal !== true) throw new Error("expected internal draft");

  const deniedOtherFd = makeFd();
  const deniedOther = await api.post(
    `/accountant/assignments/${caseId}/upload-draft`,
    deniedOtherFd,
    {
      headers: { Authorization: `Bearer ${other.token}`, ...deniedOtherFd.getHeaders() },
      maxBodyLength: Infinity,
      validateStatus: () => true,
    },
  );
  if (deniedOther.status !== 403) throw new Error(`unassigned expected 403 got ${deniedOther.status}`);
  log("UNASSIGNED → 403");

  const deniedSaFd = makeFd();
  const deniedSa = await api.post(`/admin/assignments/${caseId}/upload-draft`, deniedSaFd, {
    headers: { Authorization: `Bearer ${superAdmin.token}`, ...deniedSaFd.getHeaders() },
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });
  if (deniedSa.status !== 403) throw new Error(`SA upload expected 403 got ${deniedSa.status}`);
  log("SUPER_ADMIN upload → 403");

  const before = await request(app)
    .get(`/api/compat/client/drafts/${caseId}`)
    .set(bearer(client))
    .expect(200);
  if ((before.body.data?.documents?.draftDocuments || []).some((d: { id: string }) => d.id === draftId)) {
    throw new Error("client saw draft before approval");
  }
  log("CLIENT before approval → hidden");

  await request(app)
    .post(`/api/compat/admin/manage-review/${caseId}`)
    .set(bearer(superAdmin))
    .send({ action: "approve" })
    .expect(403);
  log("SUPER_ADMIN approve → 403");

  await request(app)
    .post(`/api/compat/admin/manage-review/${caseId}`)
    .set(bearer(admin))
    .send({ action: "approve", note: "e2e" })
    .expect(200);
  log("ADMIN approve → 200");

  const after = await request(app)
    .get(`/api/compat/client/drafts/${caseId}`)
    .set(bearer(client))
    .expect(200);
  if (!(after.body.data?.documents?.draftDocuments || []).some((d: { id: string }) => d.id === draftId)) {
    throw new Error("client missing draft after approval");
  }
  log("CLIENT after approval → visible");

  const notes = await request(app).get("/api/notifications").set(bearer(client)).expect(200);
  const list = Array.isArray(notes.body) ? notes.body : notes.body?.data || [];
  if (!list.some((n: { title?: string }) => /ready to review/i.test(String(n.title || "")))) {
    throw new Error("missing client notification");
  }
  log("CLIENT notification → present");
  log("E2E_MULTIPART_PROOF_OK");

  server.close();
  await dropTestDb();
}

main().catch(async (e) => {
  console.error("E2E_MULTIPART_PROOF_FAILED", e);
  try {
    await dropTestDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
