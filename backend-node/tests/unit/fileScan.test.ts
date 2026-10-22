import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../src/http/errors";
import { assertDownloadAllowed, stubScan } from "../../src/services/fileScan";

vi.mock("../../src/db/mongo", () => ({
  col: () => ({
    insertOne: vi.fn().mockResolvedValue({ insertedId: "x" }),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  }),
}));

vi.mock("../../src/domain/workflow", () => ({
  logActivity: vi.fn(),
  notify: vi.fn(),
  nowIso: () => "2026-01-01T00:00:00.000Z",
}));

vi.mock("../../src/services/email", () => ({
  queueEmail: vi.fn(),
}));

describe("stubScan", () => {
  it("marks a normal PDF clean", () => {
    const buf = Buffer.from("%PDF-1.4\n% content that is long enough to pass size checks....");
    expect(stubScan(buf, "statement.pdf", "application/pdf").scan_status).toBe("clean");
  });

  it("detects EICAR as infected", () => {
    const buf = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(stubScan(buf, "eicar.com", "application/octet-stream").scan_status).toBe("infected");
  });

  it("flags PDF missing magic bytes as corrupt", () => {
    const buf = Buffer.from("not a pdf but long enough................");
    expect(stubScan(buf, "fake.pdf", "application/pdf").scan_status).toBe("corrupt");
  });

  it("flags non-ZIP docx as suspicious", () => {
    const buf = Buffer.from("OLE-looking content that is not a zip......");
    expect(stubScan(buf, "letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document").scan_status).toBe(
      "suspicious",
    );
  });

  it("rejects empty buffers as corrupt", () => {
    expect(stubScan(Buffer.alloc(0), "empty.pdf", "application/pdf").scan_status).toBe("corrupt");
  });
});

describe("assertDownloadAllowed", () => {
  const staff = { id: "a1", name: "Ada", role: "ACCOUNTANT" };
  const client = { id: "c1", name: "Client", role: "CLIENT" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks infected for staff", async () => {
    await expect(
      assertDownloadAllowed({
        file_id: "f1",
        source: "documents",
        scan_status: "infected",
        actor: staff,
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("requires confirmation for suspicious staff downloads", async () => {
    try {
      await assertDownloadAllowed({
        file_id: "f1",
        source: "documents",
        scan_status: "suspicious",
        actor: staff,
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(409);
      expect((e as HttpError).detail).toMatchObject({
        code: "RISKY_FILE_CONFIRMATION_REQUIRED",
        scan_status: "suspicious",
      });
    }
  });

  it("allows suspicious when staff confirms risk", async () => {
    await expect(
      assertDownloadAllowed({
        file_id: "f1",
        source: "documents",
        scan_status: "corrupt",
        actor: staff,
        confirmRisk: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("allows clean downloads", async () => {
    await expect(
      assertDownloadAllowed({
        file_id: "f1",
        source: "intake",
        scan_status: "clean",
        actor: staff,
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks infected for clients too", async () => {
    await expect(
      assertDownloadAllowed({
        file_id: "f1",
        source: "documents",
        scan_status: "infected",
        actor: client,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
