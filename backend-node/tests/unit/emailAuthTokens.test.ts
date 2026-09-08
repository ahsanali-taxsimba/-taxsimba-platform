/** Unit tests for email verification + password reset token services (K.2). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

import { generateKey } from "../../src/services/fernet";

let memoryUri: string | null = null;

beforeAll(async () => {
  if (!process.env.TEST_MONGO_URL) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongo = await MongoMemoryServer.create();
    memoryUri = mongo.getUri();
    process.env.TEST_MONGO_URL = memoryUri;
    (globalThis as { __taxsimbaMemoryMongo?: { stop: () => Promise<boolean> } }).__taxsimbaMemoryMongo =
      mongo;
  }
  Object.assign(process.env, {
    MONGO_URL: process.env.TEST_MONGO_URL,
    DB_NAME: `taxsimba_unit_auth_${randomUUID().slice(0, 8)}`,
    JWT_SECRET: "test-jwt-secret-value",
    TOTP_FERNET_KEY: process.env.TOTP_FERNET_KEY ?? generateKey(),
    EMAIL_DRIVER: "none",
    SEED_DEMO_DATA: "false",
  });
  const { connect } = await import("../../src/db/mongo");
  await connect();
  const { ensureAuthTokenIndexes } = await import("../../src/services/emailVerification");
  await ensureAuthTokenIndexes();
});

afterAll(async () => {
  const { db, close } = await import("../../src/db/mongo");
  await db().dropDatabase();
  await close();
  const mem = (globalThis as { __taxsimbaMemoryMongo?: { stop: () => Promise<boolean> } })
    .__taxsimbaMemoryMongo;
  if (mem) await mem.stop();
});

async function insertUser(email: string, opts: { verified?: boolean; password?: string } = {}) {
  const { col } = await import("../../src/db/mongo");
  const { hashPassword } = await import("../../src/services/auth");
  const { nowIso } = await import("../../src/domain/workflow");
  const user = {
    id: randomUUID(),
    email,
    name: "Token Tester",
    role: "CLIENT",
    is_active: true,
    password_hash: hashPassword(opts.password ?? "Tr0ubl3-Kettle-Marsh"),
    email_verified_at: opts.verified ? nowIso() : null,
    created_at: nowIso(),
  };
  await col("users").insertOne({ ...user });
  return user;
}

describe("email verification tokens", () => {
  it("issues, consumes, and persists email_verified_at", async () => {
    const {
      issueEmailVerification,
      consumeEmailVerification,
      isEmailVerified,
    } = await import("../../src/services/emailVerification");
    const user = await insertUser(`verify.${randomUUID().slice(0, 8)}@example.com`);
    expect(isEmailVerified(user)).toBe(false);
    const issued = await issueEmailVerification(user);
    expect(issued.token.length).toBeGreaterThan(20);

    const verified = await consumeEmailVerification(issued.token);
    expect(verified.email_verified_at).toBeTruthy();
    expect(isEmailVerified(verified)).toBe(true);

    const { col } = await import("../../src/db/mongo");
    const stored = await col("users").findOne({ id: user.id });
    expect(stored?.email_verified_at).toBeTruthy();

    await expect(consumeEmailVerification(issued.token)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("resends for unverified accounts and is enumeration-safe", async () => {
    const { resendEmailVerification, issueEmailVerification } = await import(
      "../../src/services/emailVerification"
    );
    const user = await insertUser(`resend.${randomUUID().slice(0, 8)}@example.com`);
    const first = await issueEmailVerification(user);
    const again = await resendEmailVerification(user.email);
    expect(again.issued).toBe(true);
    // Prior token revoked
    const { consumeEmailVerification } = await import("../../src/services/emailVerification");
    await expect(consumeEmailVerification(first.token)).rejects.toMatchObject({ status: 400 });

    const missing = await resendEmailVerification("nobody-here@example.com");
    expect(missing.issued).toBe(false);
  });
});

describe("password reset tokens", () => {
  it("issues and consumes a reset token to update the password", async () => {
    const { issuePasswordReset, consumePasswordReset } = await import(
      "../../src/services/passwordReset"
    );
    const { verifyPassword } = await import("../../src/services/auth");
    const email = `reset.${randomUUID().slice(0, 8)}@example.com`;
    const user = await insertUser(email, { password: "Tr0ubl3-Kettle-Marsh" });
    const issued = await issuePasswordReset(email);
    expect(issued.issued).toBe(true);
    expect(issued.token).toBeTruthy();

    const next = "N3w-Secure-Phrase!";
    await consumePasswordReset(issued.token!, next);

    const { col } = await import("../../src/db/mongo");
    const stored = await col("users").findOne({ id: user.id });
    expect(verifyPassword(next, stored!.password_hash as string)).toBe(true);
    await expect(consumePasswordReset(issued.token!, "Another-Secure-1!")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns issued:false for unknown emails without throwing", async () => {
    const { issuePasswordReset } = await import("../../src/services/passwordReset");
    const result = await issuePasswordReset("missing@example.com");
    expect(result).toEqual({ issued: false });
  });
});
