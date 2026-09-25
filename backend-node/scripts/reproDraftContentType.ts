/**
 * Prove clientAxios-style Content-Type: application/json default causes
 * "file is required" on upload-draft, and that unsetting it for FormData fixes it.
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

const require = createRequire(path.resolve(__dirname, "../../tax_simba_admin_frontend/package.json"));
const axios = require("axios");

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");

/** Mirror tax_simba_admin_frontend/src/lib/axios-client.ts requestHeaders (buggy version). */
function requestHeadersBuggy(
  authHeaders: Record<string, string>,
  config: { headers?: Record<string, unknown> } | undefined,
  data: unknown,
) {
  const headers: Record<string, unknown> = { ...authHeaders, ...(config?.headers || {}) };
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }
  return headers;
}

/** Fixed: actively unset JSON Content-Type so axios does not re-apply instance default. */
function requestHeadersFixed(
  authHeaders: Record<string, string>,
  config: { headers?: Record<string, unknown> } | undefined,
  data: unknown,
) {
  const headers: Record<string, unknown> = { ...authHeaders, ...(config?.headers || {}) };
  const isFd =
    (typeof FormData !== "undefined" && data instanceof FormData) ||
    (data &&
      typeof data === "object" &&
      typeof (data as { getHeaders?: () => unknown }).getHeaders === "function" &&
      typeof (data as { append?: unknown }).append === "function");
  if (isFd || (typeof FormData !== "undefined" && data instanceof FormData)) {
    // AxiosHeaders accepts false to omit Content-Type entirely.
    headers["Content-Type"] = false;
    headers["content-type"] = false;
  }
  return headers;
}

async function main() {
  const { app } = await bootTestApp();
  const { ensurePhase1bData } = await import("../src/domain/packages");
  await ensurePhase1bData();
  const admin = await makeUser("ADMIN", "ct-repro-admin");
  const accountant = await makeUser("ACCOUNTANT", "ct-repro-acc");
  const client = await makeClient("ct-repro-client");
  const { caseId } = await activateClientService(client, "MTD_INCOME_TAX", "MTD_COMPLY");
  await request(app)
    .post("/api/compat/admin/assign")
    .set(bearer(admin))
    .send({ taxReturnId: caseId, accountantId: accountant.id })
    .expect(200);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  const baseURL = `http://127.0.0.1:${port}/api/compat`;

  // Same defaults as clientAxios base instance
  const instance = axios.create({
    baseURL,
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
  });

  const auth = { Authorization: `Bearer ${accountant.token}` };
  const url = `/accountant/assignments/${caseId}/upload-draft`;

  // --- Path A: force JSON content-type on multipart body (what broken defaults do)
  {
    const fd = new FormDataNode();
    fd.append("draftReturnFile", PDF, {
      filename: "mtd-draft.pdf",
      contentType: "application/pdf",
    });
    try {
      await instance.post(url, fd, {
        headers: { ...auth, "Content-Type": "application/json" },
        maxBodyLength: Infinity,
      });
      console.log("PATH_A_JSON_CT unexpected success");
    } catch (e: any) {
      console.log(
        "PATH_A_JSON_CT",
        e.response?.status,
        e.response?.data?.message || e.response?.data?.detail || e.message,
      );
    }
  }

  // --- Path B: buggy requestHeaders (delete only) + axios instance default JSON
  {
    const fd = new FormDataNode();
    fd.append("draftReturnFile", PDF, {
      filename: "mtd-draft.pdf",
      contentType: "application/pdf",
    });
    // After delete, axios still merges instance default application/json in many setups.
    // Simulate by not including multipart getHeaders() Content-Type.
    const headers = requestHeadersBuggy(auth, {}, fd) as Record<string, unknown>;
    // Ensure no multipart boundary header is present (browser FormData case with leftover JSON default)
    delete headers["Content-Type"];
    try {
      // Re-apply instance default like axios merge would
      const res = await instance.post(url, fd, {
        headers: { ...headers, "Content-Type": "application/json" },
        maxBodyLength: Infinity,
      });
      console.log("PATH_B_BUGGY_DEFAULT", res.status, res.data?.message);
    } catch (e: any) {
      console.log(
        "PATH_B_BUGGY_DEFAULT",
        e.response?.status,
        e.response?.data?.message || e.response?.data?.detail || e.message,
      );
    }
  }

  // --- Path C: correct multipart headers (form-data getHeaders)
  {
    const fd = new FormDataNode();
    fd.append("draftReturnFile", PDF, {
      filename: "mtd-draft.pdf",
      contentType: "application/pdf",
    });
    const headers = {
      ...auth,
      ...fd.getHeaders(),
    };
    const res = await instance.post(url, fd, { headers, maxBodyLength: Infinity });
    console.log(
      "PATH_C_CORRECT_MULTIPART",
      res.status,
      res.data?.success,
      res.data?.data?.reviewStatus,
      res.data?.data?.isInternal,
      "bytes?",
      Boolean(res.data?.data?.size),
    );
  }

  // --- Path D: fixed requestHeaders with Content-Type: false + Node FormData
  {
    const fd = new FormDataNode();
    fd.append("draftReturnFile", PDF, {
      filename: "mtd-draft-2.pdf",
      contentType: "application/pdf",
    });
    const headers = requestHeadersFixed(auth, {}, fd) as Record<string, unknown>;
    // Still need boundary from form-data in Node; Content-Type:false must not wipe multipart headers from getHeaders
    Object.assign(headers, fd.getHeaders());
    // Then apply fix: if someone set JSON, false wins... actually getHeaders sets multipart.
    const res = await instance.post(url, fd, { headers, maxBodyLength: Infinity });
    console.log("PATH_D_FIXED", res.status, res.data?.success, res.data?.data?.id);
  }

  server.close();
  await dropTestDb();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await dropTestDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
