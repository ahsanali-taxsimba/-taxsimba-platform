/**
 * Compat Contact Us — POST /api/compat/contact-us
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { bootTestApp, dropTestDb, ORIGIN } from "../helpers/app";

class RecordingProvider {
  readonly name = "recording";
  sent: { to: string; subject: string; text: string }[] = [];
  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(message);
  }
}

describe("compat contact-us", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.EMAIL_DRIVER = "smtp";
    process.env.EMAIL_FROM = "TaxSimba <no-reply@test.taxsimba.local>";
    process.env.CONTACT_TO = "support@test.taxsimba.local";
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    ({ app } = await bootTestApp());
  });

  afterEach(async () => {
    const { setEmailProvider } = await import("../../src/services/email");
    setEmailProvider(null);
  });

  afterAll(async () => {
    delete process.env.EMAIL_DRIVER;
    delete process.env.EMAIL_FROM;
    delete process.env.CONTACT_TO;
    await dropTestDb();
  });

  async function useRecording(): Promise<RecordingProvider> {
    const { setEmailProvider } = await import("../../src/services/email");
    const provider = new RecordingProvider();
    setEmailProvider(provider);
    return provider;
  }

  it("accepts a valid submission and returns a success envelope", async () => {
    await useRecording();
    const res = await request(app)
      .post("/api/compat/contact-us")
      .set("Origin", ORIGIN)
      .send({
        name: "Jane Doe",
        email: "jane@example.com",
        phoneNumber: "07123456789",
        message: "I need help with my self assessment.",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/thank you/i);
    expect(res.body.data?.received).toBe(true);
    expect(res.body.detail).toBeUndefined();
  });

  it("rejects missing required fields with a compat error envelope", async () => {
    await useRecording();
    const res = await request(app)
      .post("/api/compat/contact-us")
      .set("Origin", ORIGIN)
      .send({ name: "Jane" })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/SMTP_|RESEND_|password|stack/i);
  });

  it("rejects an invalid payload (bad email)", async () => {
    await useRecording();
    const res = await request(app)
      .post("/api/compat/contact-us")
      .set("Origin", ORIGIN)
      .send({
        name: "Jane Doe",
        email: "not-an-email",
        phoneNumber: "07123456789",
        message: "Hello",
      })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeTruthy();
  });

  it("returns a friendly error when the email driver is unavailable", async () => {
    const { setEmailProvider } = await import("../../src/services/email");
    // Force disabled delivery path (name === "none")
    setEmailProvider({
      name: "none",
      async send() {
        throw new Error("disabled");
      },
    });

    const res = await request(app)
      .post("/api/compat/contact-us")
      .set("Origin", ORIGIN)
      .send({
        name: "Jane Doe",
        email: "jane@example.com",
        phoneNumber: "07123456789",
        message: "Hello",
      })
      .expect(503);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not configured|try again/i);
    expect(JSON.stringify(res.body)).not.toMatch(/EMAIL_DRIVER|SMTP_|stack|Error:/);
  });

  it("returns a friendly error on internal queue failure without leaking details", async () => {
    await useRecording();
    // Remove inbox configuration so contactInbox() fails after emailEnabled passes
    const prevContact = process.env.CONTACT_TO;
    const prevFrom = process.env.EMAIL_FROM;
    const prevReply = process.env.EMAIL_REPLY_TO;
    delete process.env.CONTACT_TO;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;

    try {
      const res = await request(app)
        .post("/api/compat/contact-us")
        .set("Origin", ORIGIN)
        .send({
          name: "Jane Doe",
          email: "jane@example.com",
          phoneNumber: "07123456789",
          message: "Hello",
        })
        .expect(503);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not configured|try again/i);
      expect(JSON.stringify(res.body)).not.toMatch(/CONTACT_TO|EMAIL_FROM|stack/);
    } finally {
      if (prevContact) process.env.CONTACT_TO = prevContact;
      if (prevFrom) process.env.EMAIL_FROM = prevFrom;
      if (prevReply) process.env.EMAIL_REPLY_TO = prevReply;
    }
  });
});
