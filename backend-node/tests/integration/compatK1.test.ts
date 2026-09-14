/**
 * K.1 compatibility layer integration tests.
 * Boots the real Express app against an isolated Mongo (memory server when local Mongo is absent).
 */
import type { Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bearer,
  bootTestApp,
  browserHeaders,
  dropTestDb,
  makeClient,
  makeUser,
  ORIGIN,
  TestUser,
} from "../helpers/app";

let app: Express;
let memoryUri: string | null = null;

beforeAll(async () => {
  // Prefer real TEST_MONGO_URL; otherwise start an ephemeral memory server for this suite.
  if (!process.env.TEST_MONGO_URL) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongo = await MongoMemoryServer.create();
    memoryUri = mongo.getUri();
    process.env.TEST_MONGO_URL = memoryUri;
    (globalThis as { __taxsimbaMemoryMongo?: { stop: () => Promise<boolean> } }).__taxsimbaMemoryMongo =
      mongo;
  }
  ({ app } = await bootTestApp());
});

afterAll(async () => {
  await dropTestDb();
  const mem = (globalThis as { __taxsimbaMemoryMongo?: { stop: () => Promise<boolean> } })
    .__taxsimbaMemoryMongo;
  if (mem) await mem.stop();
});

describe("K.1 envelope", () => {
  it("maps success responses to { success, data, message }", async () => {
    const res = await request(app).get("/api/compat/ping").expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { pong: true, layer: "compat" },
      message: "OK",
    });
  });

  it("maps Node HttpError detail into a compat error envelope", async () => {
    const res = await request(app).get("/api/compat/errors/unauthorized").expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toBe("Not authenticated");
    expect(res.body.detail).toBeUndefined();
  });

  it("leaves native routes on the { detail } error contract", async () => {
    const res = await request(app).get("/api/auth/me").expect(401);
    expect(res.body).toEqual({ detail: "Not authenticated" });
    expect(res.body.success).toBeUndefined();
  });
});

describe("K.1 case mapping echo", () => {
  it("accepts camelCase and round-trips via snake_case centrally", async () => {
    const res = await request(app)
      .post("/api/compat/echo")
      .send({ accessToken: "tok", packageCode: "SMART", nested: { taxReturnId: "c1" } })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.asSnake).toEqual({
      access_token: "tok",
      package_code: "SMART",
      nested: { tax_return_id: "c1" },
    });
    expect(res.body.data.roundTripCamel).toEqual({
      accessToken: "tok",
      packageCode: "SMART",
      nested: { taxReturnId: "c1" },
    });
  });
});

describe("K.1 taxReturnId ↔ caseId", () => {
  it("is stable and deterministic (identity)", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const res = await request(app).get(`/api/compat/ids/${id}`).expect(200);
    expect(res.body.data.taxReturnId).toBe(id);
    expect(res.body.data.caseId).toBe(id);
    expect(res.body.data.same).toBe(true);
    expect(res.body.data.decorated.taxReturnId).toBe(id);
  });
});

describe("K.1 Bearer / session auth bridge", () => {
  const CLIENT = {
    email: "compat.k1.client@example.com",
    password: "Tr0ubl3-Kettle-Marsh",
    name: "Compat Client",
    phone: "07700900999",
  };

  beforeAll(async () => {
    await request(app).post("/api/auth/register").send(CLIENT).expect(200);
  });

  it("accepts a valid Bearer token on compat /auth/me", async () => {
    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password })
      .expect(200);
    expect(login.body.success).toBe(true);
    expect(login.body.data.accessToken).toBeTypeOf("string");
    expect(login.body.data.user.roles).toBe("CLIENT");
    expect(login.body.data.user.firstName).toBe("Compat");
    expect(login.body.data.isSubscriptionBuy).toBe(false);

    const me = await request(app)
      .get("/api/compat/auth/me")
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` })
      .expect(200);
    expect(me.body.data.email).toBe(CLIENT.email);
  });

  it("rejects an invalid Bearer token", async () => {
    const res = await request(app)
      .get("/api/compat/auth/me")
      .set({ Authorization: "Bearer not-a-real-token" })
      .expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid token|Not authenticated/i);
  });

  it("rejects an expired Bearer token", async () => {
    const { col } = await import("../../src/db/mongo");
    const user = await col("users").findOne({ email: CLIENT.email });
    const expired = jwt.sign(
      { sub: user!.id, email: CLIENT.email, type: "access" },
      process.env.JWT_SECRET as string,
      { algorithm: "HS256", expiresIn: -10 },
    );
    const res = await request(app)
      .get("/api/compat/auth/me")
      .set({ Authorization: `Bearer ${expired}` })
      .expect(401);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/expired|Invalid/i);
  });

  it("keeps native cookie/session auth working", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .set({ Origin: ORIGIN, "Sec-Fetch-Mode": "cors" })
      .send({ email: CLIENT.email, password: CLIENT.password })
      .expect(200);
    // Browser-like login must NOT put the access token in the JSON body.
    expect(login.body.access_token).toBeUndefined();
    const cookies = login.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);

    const me = await request(app)
      .get("/api/auth/me")
      .set(browserHeaders(cookies))
      .expect(200);
    expect(me.body.email).toBe(CLIENT.email);
    expect(me.body.success).toBeUndefined();
  });

  it("logs out with Bearer without inventing entitlement state", async () => {
    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password })
      .expect(200);
    const res = await request(app)
      .post("/api/compat/auth/logout")
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });
});

describe("K.1 privacy masking on compat", () => {
  let admin: TestUser;
  let superAdmin: TestUser;
  let accountant: TestUser;
  let client: TestUser & { clientId: string };
  const PHONE = "07700900123";

  beforeAll(async () => {
    admin = await makeUser("ADMIN", "k1admin");
    superAdmin = await makeUser("SUPER_ADMIN", "k1super");
    accountant = await makeUser("ACCOUNTANT", "k1accountant");
    client = await makeClient("k1privacy");
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne({ id: client.id }, { $set: { phone: PHONE } });
  });

  it("masks email/phone for ADMIN and never exposes raw contact", async () => {
    const res = await request(app)
      .get("/api/compat/privacy/clients")
      .set(bearer(admin))
      .expect(200);
    const row = res.body.data.clients.find((c: { id: string }) => c.id === client.id);
    expect(row).toBeTruthy();
    expect(row.email).not.toBe(client.email);
    expect(String(row.email)).toContain("***");
    expect(row.phone).not.toBe(PHONE);
    expect(row.contactMasked).toBe(true);
  });

  it("does not weaken SUPER_ADMIN full contact visibility", async () => {
    const res = await request(app)
      .get("/api/compat/privacy/clients")
      .set(bearer(superAdmin))
      .expect(200);
    const row = res.body.data.clients.find((c: { id: string }) => c.id === client.id);
    expect(row.email).toBe(client.email);
    expect(row.phone).toBe(PHONE);
  });

  it("denies ACCOUNTANT access to the compat client contact list", async () => {
    const res = await request(app)
      .get("/api/compat/privacy/clients")
      .set(bearer(accountant))
      .expect(403);
    expect(res.body.success).toBe(false);
  });
});

describe("K.1 registration entitlement unchanged via native path", () => {
  it("keeps new clients NOT_ACTIVE (compat must not alter this)", async () => {
    const email = `k1.reg.${Date.now()}@example.com`;
    await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "K1 Reg",
        phone: "07000000000",
      })
      .expect(200);
    const { col } = await import("../../src/db/mongo");
    const client = await col("clients").findOne({ email });
    const services = await col("client_services").find({ client_id: client!.id }).toArray();
    expect(services.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
  });
});
