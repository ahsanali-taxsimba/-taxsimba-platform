import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootTestApp, browserHeaders, dropTestDb, ORIGIN } from "../helpers/app";

let app: Express;

const CLIENT = {
  email: "parity.client@example.com",
  password: "Tr0ubl3-Kettle-Marsh",
  name: "Parity Client",
  phone: "07700900000",
};

beforeAll(async () => {
  ({ app } = await bootTestApp());
});

afterAll(async () => {
  await dropTestDb();
});

async function register() {
  return request(app).post("/api/auth/register").send(CLIENT);
}

describe("registration", () => {
  it("creates the user, client record and both service rows", async () => {
    const res = await register();
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("CLIENT");
    expect(res.body.user.password_hash).toBeUndefined();
    // Non-browser callers also receive a bearer token; browsers only get cookies.
    expect(res.body.access_token).toBeTypeOf("string");
    const names = (res.headers["set-cookie"] as unknown as string[]).map(
      (c) => c.split("=")[0],
    );
    expect(names.sort()).toEqual(["access_token", "csrf_token", "refresh_token"]);

    const { col } = await import("../../src/db/mongo");
    const client = await col("clients").findOne({ email: CLIENT.email });
    expect(client?.client_ref).toMatch(/^CL-\d{4}$/);
    const services = await col("client_services")
      .find({ client_id: client?.id })
      .toArray();
    expect(services.map((s) => s.service_type).sort()).toEqual([
      "MTD_INCOME_TAX",
      "SELF_ASSESSMENT",
    ]);
    expect(services.every((s) => s.status === "NOT_ACTIVE")).toBe(true);
  });

  it("rejects a duplicate email with 400", async () => {
    const res = await register();
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("Email already registered");
  });

  it("returns FastAPI-shaped 422 for an invalid payload", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "nope" });
    expect(res.status).toBe(422);
    expect(res.body.detail[0].loc[0]).toBe("body");
  });
});

describe("login", () => {
  it("issues a session for valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(CLIENT.email);
  });

  it("rejects a wrong password with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: "Wr0ng-Password-Here" });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid email or password");
  });

  it("does not reveal whether an account exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Wr0ng-Password-Here" });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid email or password");
  });

  it("locks the ip+email scope after 5 failures and returns Retry-After", async () => {
    const email = "lockout.target@example.com";
    let res;
    for (let i = 0; i < 5; i += 1) {
      res = await request(app).post("/api/auth/login").send({ email, password: "Wr0ng-Pass-01!" });
      expect(res.status).toBe(401);
    }
    res = await request(app).post("/api/auth/login").send({ email, password: "Wr0ng-Pass-01!" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.detail).toMatch(/temporarily locked/);
  });
});

describe("session lifecycle", () => {
  it("authenticates /auth/me by cookie and by bearer token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    const cookies = login.headers["set-cookie"] as unknown as string[];

    const byCookie = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookies.map((c) => c.split(";")[0]).join("; "));
    expect(byCookie.status).toBe(200);
    expect(byCookie.body.email).toBe(CLIENT.email);
    expect(byCookie.body.password_hash).toBeUndefined();

    const byBearer = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.access_token}`);
    expect(byBearer.status).toBe(200);
  });

  it("refuses an unauthenticated request", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Not authenticated");
  });

  it("rotates the refresh token and revokes the old one", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    const cookies = login.headers["set-cookie"] as unknown as string[];

    const refreshed = await request(app).post("/api/auth/refresh").set(browserHeaders(cookies));
    expect(refreshed.status).toBe(200);

    const replayed = await request(app).post("/api/auth/refresh").set(browserHeaders(cookies));
    expect(replayed.status).toBe(401);
    expect(replayed.body.detail).toBe("Session revoked");
  });

  it("rejects a refresh token presented as an API credential", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    const refresh = (login.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("refresh_token="))!
      .split(";")[0]
      .split("=")[1];
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${refresh}`);
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe("Invalid token");
  });

  it("clears the session cookies on logout", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    const cookies = login.headers["set-cookie"] as unknown as string[];
    const res = await request(app).post("/api/auth/logout").set(browserHeaders(cookies));
    expect(res.status).toBe(200);
    const cleared = (res.headers["set-cookie"] as unknown as string[]).map((c) => c.split("=")[0]);
    expect(cleared.sort()).toEqual(["access_token", "csrf_token", "refresh_token"]);
  });
});

describe("csrf", () => {
  it("rejects a browser request without the double-submit token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: CLIENT.email, password: CLIENT.password });
    const jar = (login.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");
    const res = await request(app)
      .post("/api/auth/refresh")
      .set({ Cookie: jar, Origin: ORIGIN, "Sec-Fetch-Mode": "cors" });
    expect(res.status).toBe(403);
    expect(res.body.detail).toBe("Invalid or missing CSRF token");
  });

  it("rejects a cross-site request outright", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set({ "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.body.detail).toBe("Cross-origin request rejected");
  });
});

describe("security headers", () => {
  it("sets the hardening headers on every response", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
