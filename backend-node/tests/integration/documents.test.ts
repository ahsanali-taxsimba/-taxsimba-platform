/** Stage 3 parity: documents, tasks linkage, messages, notes, activity and notifications. */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeUser, TestUser } from "../helpers/app";

const PDF = Buffer.from("%PDF-1.4 parity test\n");

describe("documents, messages and notifications", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let otherAccountant: TestUser;
  let client: TestUser;
  let otherClient: TestUser;

  async function newCase(owner: TestUser = client): Promise<string> {
    const res = await request(app)
      .post("/api/cases")
      .set(bearer(owner))
      .send({ tax_year: "2024/25" })
      .expect(200);
    return res.body.id as string;
  }

  async function assigned(): Promise<string> {
    const caseId = await newCase();
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    return caseId;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN");
    accountant = await makeUser("ACCOUNTANT", "accountant-a");
    otherAccountant = await makeUser("ACCOUNTANT", "accountant-b");
    client = await makeUser("CLIENT", "client-a");
    otherClient = await makeUser("CLIENT", "client-b");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  // ------------------------------------------------------------------ upload
  it("stores a client upload against the case and notifies the accountant", async () => {
    const caseId = await assigned();
    const res = await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .field("document_type", "P60")
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(res.body.status).toBe("Uploaded");
    expect(res.body.is_internal).toBe(false);
    expect(res.body.storage_path).toMatch(/^taxsimba\/uploads\//);

    const notes = await request(app).get("/api/notifications").set(bearer(accountant)).expect(200);
    expect(notes.body.some((n: { title: string }) => n.title === "Client upload received")).toBe(
      true,
    );
    const kase = await request(app).get(`/api/cases/${caseId}`).set(bearer(accountant)).expect(200);
    expect(kase.body.next_action_owner).toBe("ACCOUNTANT");
  });

  it("rejects a client uploading an internal document", async () => {
    const caseId = await assigned();
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .field("is_internal", "true")
      .attach("file", PDF, { filename: "internal.pdf", contentType: "application/pdf" })
      .expect(403);
  });

  it("rejects an unsupported file type and an oversized-empty file", async () => {
    const caseId = await assigned();
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", Buffer.from("MZ"), { filename: "x.exe", contentType: "application/x-msdownload" })
      .expect(415);
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", Buffer.alloc(0), { filename: "empty.pdf", contentType: "application/pdf" })
      .expect(400);
  });

  it("cannot upload into another client's case", async () => {
    const caseId = await assigned();
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(otherClient))
      .field("case_id", caseId)
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .expect(403);
  });

  // ------------------------------------------------------------------ request → task → upload
  it("fulfils a document request through the client task and closes it", async () => {
    const caseId = await assigned();
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    await request(app)
      .post(`/api/cases/${caseId}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Send your P60", document_type: "P60" })
      .expect(200);

    const tasks = await request(app).get("/api/tasks").set(bearer(client)).expect(200);
    const task = tasks.body.find((t: { name: string }) => t.name === "Send your P60");
    expect(task).toBeTruthy();

    const requested = await request(app)
      .get("/api/documents")
      .query({ case_id: caseId, filter: "requested" })
      .set(bearer(client))
      .expect(200);
    expect(requested.body).toHaveLength(1);
    const placeholder = requested.body[0];

    const uploaded = await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .field("document_id", placeholder.id)
      .field("task_id", task.id)
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(uploaded.body.id).toBe(placeholder.id);
    expect(uploaded.body.status).toBe("Uploaded");

    const after = await request(app).get("/api/tasks").set(bearer(client)).expect(200);
    expect(after.body.find((t: { id: string }) => t.id === task.id).status).toBe("COMPLETED");
    // Last open client task closed -> the case returns to the accountant.
    const kase = await request(app).get(`/api/cases/${caseId}`).set(bearer(accountant)).expect(200);
    expect(kase.body.status).toBe("ACCOUNTANT_REVIEW");
  });

  it("refuses to move a referenced document to a different case", async () => {
    const caseA = await assigned();
    const caseB = await assigned();
    const first = await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseA)
      .attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" })
      .expect(200);
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseB)
      .field("document_id", first.body.id)
      .attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" })
      .expect(400);
  });

  // ------------------------------------------------------------------ listing scope
  it("scopes listings by role and requires an explicit scope for admins", async () => {
    const caseId = await assigned();
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", PDF, { filename: "scope.pdf", contentType: "application/pdf" })
      .expect(200);

    const mine = await request(app).get("/api/documents").set(bearer(client)).expect(200);
    expect(mine.body.length).toBeGreaterThan(0);
    const theirs = await request(app).get("/api/documents").set(bearer(otherClient)).expect(200);
    expect(theirs.body).toHaveLength(0);

    // Accountants only see documents on their own cases.
    const unrelated = await request(app)
      .get("/api/documents")
      .set(bearer(otherAccountant))
      .expect(200);
    expect(unrelated.body).toHaveLength(0);
    await request(app)
      .get("/api/documents")
      .query({ case_id: caseId })
      .set(bearer(otherAccountant))
      .expect(403);

    // Security correction: an admin may not pull a global document list.
    await request(app).get("/api/documents").set(bearer(admin)).expect(400);
    const scoped = await request(app)
      .get("/api/documents")
      .query({ case_id: caseId })
      .set(bearer(admin))
      .expect(200);
    expect(scoped.body.length).toBeGreaterThan(0);
    const byClient = await request(app)
      .get("/api/documents")
      .query({ client_user_id: client.id })
      .set(bearer(admin))
      .expect(200);
    expect(byClient.body.length).toBeGreaterThan(0);
  });

  it("keeps internal documents away from the client", async () => {
    const caseId = await assigned();
    const internal = await request(app)
      .post("/api/documents/upload")
      .set(bearer(accountant))
      .field("case_id", caseId)
      .field("is_internal", "true")
      .attach("file", PDF, { filename: "workings.pdf", contentType: "application/pdf" })
      .expect(200);
    const visible = await request(app)
      .get("/api/documents")
      .query({ case_id: caseId })
      .set(bearer(client))
      .expect(200);
    expect(visible.body.some((d: { id: string }) => d.id === internal.body.id)).toBe(false);
    await request(app)
      .get(`/api/documents/${internal.body.id}/download`)
      .set(bearer(client))
      .expect(403);
  });

  it("excludes automated-test cases from unscoped operational listings", async () => {
    const caseId = await assigned();
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", PDF, { filename: "test-case.pdf", contentType: "application/pdf" })
      .expect(200);
    const { col } = await import("../../src/db/mongo");
    await col("cases").updateOne({ id: caseId }, { $set: { is_test: true } });
    const listed = await request(app).get("/api/documents").set(bearer(accountant)).expect(200);
    expect(listed.body.some((d: { case_id: string }) => d.case_id === caseId)).toBe(false);
    await col("cases").updateOne({ id: caseId }, { $set: { is_test: false } });
  });

  // ------------------------------------------------------------------ download & status
  it("downloads the stored bytes and enforces case scope", async () => {
    const caseId = await assigned();
    const doc = await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", PDF, { filename: "download.pdf", contentType: "application/pdf" })
      .expect(200);
    const res = await request(app)
      .get(`/api/documents/${doc.body.id}/download`)
      .set(bearer(client))
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(res.body).toString()).toBe(PDF.toString());
    await request(app)
      .get(`/api/documents/${doc.body.id}/download`)
      .set(bearer(otherAccountant))
      .expect(403);
    await request(app).get("/api/documents/does-not-exist/download").set(bearer(admin)).expect(404);
  });

  it("lets staff set a document status but rejects invalid values and clients", async () => {
    const caseId = await assigned();
    const doc = await request(app)
      .post("/api/documents/upload")
      .set(bearer(client))
      .field("case_id", caseId)
      .attach("file", PDF, { filename: "status.pdf", contentType: "application/pdf" })
      .expect(200);
    await request(app)
      .patch(`/api/documents/${doc.body.id}/status`)
      .query({ status: "Accepted" })
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .patch(`/api/documents/${doc.body.id}/status`)
      .query({ status: "Nonsense" })
      .set(bearer(accountant))
      .expect(400);
    await request(app)
      .patch(`/api/documents/${doc.body.id}/status`)
      .query({ status: "Accepted" })
      .set(bearer(client))
      .expect(403);
  });

  // ------------------------------------------------------------------ final documents
  it("only publishes a final client copy once the case is ready for submission", async () => {
    const caseId = await assigned();
    await request(app)
      .post(`/api/cases/${caseId}/final-documents`)
      .set(bearer(admin))
      .attach("file", PDF, { filename: "final.pdf", contentType: "application/pdf" })
      .expect(400);
  });

  // ------------------------------------------------------------------ messages
  it("threads messages between client and accountant and flags the next action", async () => {
    const caseId = await assigned();
    const sent = await request(app)
      .post("/api/messages")
      .set(bearer(client))
      .send({ case_id: caseId, body: "Do you need last year's return?" })
      .expect(200);
    expect(sent.body.recipient_id).toBe(accountant.id);

    const kase = await request(app).get(`/api/cases/${caseId}`).set(bearer(accountant)).expect(200);
    expect(kase.body.next_action).toBe("Reply to the client's message");

    const thread = await request(app)
      .get("/api/messages")
      .query({ case_id: caseId })
      .set(bearer(accountant))
      .expect(200);
    expect(thread.body).toHaveLength(1);
    await request(app)
      .get("/api/messages")
      .query({ case_id: caseId })
      .set(bearer(otherClient))
      .expect(403);
    await request(app).get("/api/messages").set(bearer(accountant)).expect(422);
  });

  // ------------------------------------------------------------------ notes / activity
  it("keeps internal notes and the activity log staff-only", async () => {
    const caseId = await assigned();
    await request(app)
      .post(`/api/cases/${caseId}/notes`)
      .set(bearer(accountant))
      .send({ body: "Chased the client for the P60." })
      .expect(200);
    const notes = await request(app)
      .get(`/api/cases/${caseId}/notes`)
      .set(bearer(accountant))
      .expect(200);
    expect(notes.body).toHaveLength(1);
    await request(app).get(`/api/cases/${caseId}/notes`).set(bearer(client)).expect(403);
    await request(app).get(`/api/cases/${caseId}/activity`).set(bearer(client)).expect(403);

    const activity = await request(app)
      .get(`/api/cases/${caseId}/activity`)
      .set(bearer(admin))
      .expect(200);
    expect(activity.body.some((a: { action: string }) => a.action === "Internal note added")).toBe(
      true,
    );
    await request(app).get(`/api/cases/${caseId}/notes`).set(bearer(otherAccountant)).expect(403);
  });

  // ------------------------------------------------------------------ notifications
  it("marks notifications read and counts only unread ones", async () => {
    const fresh = await makeUser("CLIENT", "client-notify");
    const created = await request(app)
      .post("/api/cases")
      .set(bearer(fresh))
      .send({ tax_year: "2024/25" })
      .expect(200);
    await request(app)
      .post(`/api/cases/${created.body.id}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app)
      .post(`/api/cases/${created.body.id}/start-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/cases/${created.body.id}/request-from-client`)
      .set(bearer(accountant))
      .send({ title: "Send your bank statements" })
      .expect(200);

    const before = await request(app)
      .get("/api/notifications/unread-count")
      .set(bearer(fresh))
      .expect(200);
    expect(before.body.count).toBeGreaterThan(0);

    const items = await request(app).get("/api/notifications").set(bearer(fresh)).expect(200);
    await request(app)
      .post(`/api/notifications/${items.body[0].id}/read`)
      .set(bearer(fresh))
      .expect(200);
    await request(app).post("/api/notifications/read-all").set(bearer(fresh)).expect(200);
    const after = await request(app)
      .get("/api/notifications/unread-count")
      .set(bearer(fresh))
      .expect(200);
    expect(after.body.count).toBe(0);

    // A notification cannot be read on someone else's behalf.
    const otherItems = await request(app).get("/api/notifications").set(bearer(admin)).expect(200);
    expect(
      otherItems.body.every((n: { user_id?: string }) => n.user_id === undefined || n.user_id === admin.id),
    ).toBe(true);
  });
});
