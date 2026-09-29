import { afterEach, describe, expect, it } from "vitest";

import {
  adminPublicOrigin,
  staffInviteSetupLink,
} from "../../src/services/staffInviteLinks";

describe("staffInviteSetupLink", () => {
  const prevAdmin = process.env.ADMIN_BASE_URL;
  const prevApp = process.env.APP_BASE_URL;

  afterEach(() => {
    if (prevAdmin === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = prevAdmin;
    if (prevApp === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = prevApp;
  });

  it("prefers ADMIN_BASE_URL and always includes /admin/invite/{token}", () => {
    process.env.ADMIN_BASE_URL = "https://admin.staging.taxsimba.local/";
    process.env.APP_BASE_URL = "https://client.staging.taxsimba.local";
    const link = staffInviteSetupLink("tok-abc");
    expect(link).toBe("https://admin.staging.taxsimba.local/admin/invite/tok-abc");
  });

  it("strips a trailing /admin path from ADMIN_BASE_URL to avoid /admin/admin", () => {
    process.env.ADMIN_BASE_URL = "https://admin.example.com/admin";
    expect(staffInviteSetupLink("t1")).toBe("https://admin.example.com/admin/invite/t1");
  });

  it("falls back to request Origin when ADMIN_BASE_URL is unset", () => {
    delete process.env.ADMIN_BASE_URL;
    delete process.env.APP_BASE_URL;
    const link = staffInviteSetupLink("tok", {
      get: (h) => (h.toLowerCase() === "origin" ? "https://admin.test.local" : undefined),
    });
    expect(link).toBe("https://admin.test.local/admin/invite/tok");
  });

  it("falls back to APP_BASE_URL last, still under /admin/invite", () => {
    delete process.env.ADMIN_BASE_URL;
    process.env.APP_BASE_URL = "https://app.test.taxsimba.local";
    expect(staffInviteSetupLink("x")).toBe(
      "https://app.test.taxsimba.local/admin/invite/x",
    );
  });

  it("returns a relative /admin/invite path when no origin is configured", () => {
    delete process.env.ADMIN_BASE_URL;
    delete process.env.APP_BASE_URL;
    expect(staffInviteSetupLink("solo")).toBe("/admin/invite/solo");
  });

  it("adminPublicOrigin never returns a path segment", () => {
    process.env.ADMIN_BASE_URL = "https://admin.example.com/admin/extra";
    expect(adminPublicOrigin()).toBe("https://admin.example.com");
  });
});
