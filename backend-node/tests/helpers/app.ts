/**
 * Integration test harness: boots the real Express app against an isolated disposable
 * database. Never point TEST_MONGO_URL at production or the operational database.
 */
import { randomUUID } from "crypto";

import type { Express } from "express";

import { generateKey } from "../../src/services/fernet";

export const ORIGIN = "https://app.test.taxsimba.local";

export async function bootTestApp(): Promise<{ app: Express; dbName: string }> {
  const dbName = `taxsimba_test_${randomUUID().slice(0, 8)}`;
  Object.assign(process.env, {
    MONGO_URL: process.env.TEST_MONGO_URL ?? "mongodb://127.0.0.1:27017",
    DB_NAME: dbName,
    JWT_SECRET: "test-jwt-secret-value",
    TOTP_FERNET_KEY: process.env.TOTP_FERNET_KEY ?? generateKey(),
    CORS_ORIGINS: ORIGIN,
    CORS_DEV_ORIGINS: "",
    COOKIE_SECURE: "false",
    COOKIE_SAMESITE: "lax",
    TRUSTED_PROXY_CIDRS: "127.0.0.1/32",
    STORAGE_DRIVER: "local",
    LOCAL_STORAGE_DIR: `/tmp/taxsimba-node-tests/${dbName}`,
    API_RATE_LIMIT_PER_MINUTE: "100000",
  });

  const { connect } = await import("../../src/db/mongo");
  const { createApp, startup } = await import("../../src/app");
  await connect();
  await startup();
  return { app: createApp(), dbName };
}

export async function dropTestDb(): Promise<void> {
  const { db, close } = await import("../../src/db/mongo");
  await db().dropDatabase();
  await close();
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

/** Creates an active user of any role and returns an API bearer token for it. */
export async function makeUser(role: string, name = role.toLowerCase()): Promise<TestUser> {
  const { col } = await import("../../src/db/mongo");
  const { createAccessToken } = await import("../../src/services/auth");
  const { nowIso } = await import("../../src/domain/workflow");
  const id = randomUUID();
  const email = `${name}.${id.slice(0, 8)}@parity.taxsimba.local`;
  await col("users").insertOne({
    id,
    email,
    name,
    role,
    is_active: true,
    is_test: false,
    created_at: nowIso(),
  });
  return { id, name, email, role, token: createAccessToken(id, email) };
}

export function bearer(user: TestUser): Record<string, string> {
  return { Authorization: `Bearer ${user.token}` };
}

/** Headers a browser would send, including the double-submit CSRF token. */
export function browserHeaders(cookies: string[]): Record<string, string> {
  const jar = cookies.map((c) => c.split(";")[0]);
  const csrf = jar.find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
  return {
    Cookie: jar.join("; "),
    Origin: ORIGIN,
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "X-CSRF-Token": csrf,
  };
}
