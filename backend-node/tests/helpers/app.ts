/**
 * Integration test harness: boots the real Express app against an isolated disposable
 * database. Never point TEST_MONGO_URL at production or the operational database.
 */
import { randomUUID } from "crypto";
import net from "net";

import type { Express } from "express";

import { generateKey } from "../../src/services/fernet";

export const ORIGIN = "https://app.test.taxsimba.local";

/** Prefer TEST_MONGO_URL, then a reachable local mongod, else mongodb-memory-server. */
async function resolveTestMongoUrl(): Promise<string> {
  if (process.env.TEST_MONGO_URL) return process.env.TEST_MONGO_URL;
  const local = "mongodb://127.0.0.1:27017";
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 27017 });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
  if (reachable) {
    process.env.TEST_MONGO_URL = local;
    return local;
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  process.env.TEST_MONGO_URL = mongo.getUri();
  (globalThis as { __taxsimbaSharedMemoryMongo?: { stop: () => Promise<boolean> } }).__taxsimbaSharedMemoryMongo =
    mongo;
  return process.env.TEST_MONGO_URL;
}

export async function bootTestApp(): Promise<{ app: Express; dbName: string }> {
  const mongoUrl = await resolveTestMongoUrl();
  const dbName = `taxsimba_test_${randomUUID().slice(0, 8)}`;
  Object.assign(process.env, {
    MONGO_URL: mongoUrl,
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
    SEED_DEMO_DATA: "false",
    EMAIL_DRIVER: process.env.EMAIL_DRIVER ?? "none",
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
export async function makeUser(
  role: string,
  name = role.toLowerCase(),
  opts: { emailVerified?: boolean } = {},
): Promise<TestUser> {
  const { col } = await import("../../src/db/mongo");
  const { createAccessToken } = await import("../../src/services/auth");
  const { nowIso } = await import("../../src/domain/workflow");
  const id = randomUUID();
  const email = `${name}.${id.slice(0, 8)}@parity.taxsimba.local`;
  const verified = opts.emailVerified !== false;
  await col("users").insertOne({
    id,
    email,
    name,
    role,
    is_active: true,
    is_test: false,
    email_verified_at: verified ? nowIso() : null,
    created_at: nowIso(),
  });
  return { id, name, email, role, token: createAccessToken(id, email) };
}

/** A CLIENT user together with the `clients` record and its NOT_ACTIVE service rows. */
export async function makeClient(
  name = "client",
  opts: { isTest?: boolean; emailVerified?: boolean } = {},
): Promise<TestUser & { clientId: string }> {
  const { col } = await import("../../src/db/mongo");
  const { bootstrapClientServices } = await import("../../src/services/clientServices");
  const { nowIso } = await import("../../src/domain/workflow");
  const user = await makeUser("CLIENT", name, { emailVerified: opts.emailVerified });
  const client = {
    id: randomUUID(),
    user_id: user.id,
    name: user.name,
    email: user.email,
    client_ref: `CL-${Math.floor(1000 + Math.random() * 8999)}`,
    is_test: Boolean(opts.isTest),
    created_at: nowIso(),
  };
  await col("clients").insertOne({ ...client });
  await bootstrapClientServices(client);
  return { ...user, clientId: client.id };
}

export function bearer(user: TestUser): Record<string, string> {
  return { Authorization: `Bearer ${user.token}` };
}

/**
 * Activate SA or MTD via the protected activateService spine (preferred case factory).
 * Returns the fulfilment case id. Used by K.5+ fixtures instead of unpaid CLIENT POST /cases.
 */
export async function activateClientService(
  client: TestUser & { clientId: string },
  serviceType: "SELF_ASSESSMENT" | "MTD_INCOME_TAX",
  packageCode?: string,
): Promise<{ caseId: string }> {
  const { col } = await import("../../src/db/mongo");
  const { activateService } = await import("../../src/domain/packages");
  const code =
    packageCode ?? (serviceType === "SELF_ASSESSMENT" ? "SIMPLE" : "MTD_ESSENTIAL");
  const clientDoc = await col("clients").findOne({ id: client.clientId });
  const userDoc = await col("users").findOne({ id: client.id });
  if (!clientDoc || !userDoc) throw new Error("activateClientService: missing client/user");
  const result = await activateService(clientDoc, userDoc, serviceType, code, {
    reason: "test activation",
  });
  return { caseId: String(result.case.id) };
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
