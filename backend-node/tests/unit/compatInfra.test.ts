import { describe, expect, it } from "vitest";

import { keysToCamel, keysToSnake } from "../../src/compat/caseMap";
import {
  errorEnvelope,
  messageFromDetail,
  successEnvelope,
} from "../../src/compat/envelope";
import {
  idsReferToSameCase,
  toCaseId,
  toTaxReturnId,
  withTaxReturnId,
} from "../../src/compat/ids";
import { splitDisplayName, toToxelUser } from "../../src/compat/authBridge";

describe("compat caseMap", () => {
  it("maps snake_case keys to camelCase", () => {
    expect(
      keysToCamel({
        access_token: "abc",
        client_user_id: "u1",
        nested: { package_code: "SMART", items: [{ case_id: "c1" }] },
      }),
    ).toEqual({
      accessToken: "abc",
      clientUserId: "u1",
      nested: { packageCode: "SMART", items: [{ caseId: "c1" }] },
    });
  });

  it("maps camelCase keys to snake_case", () => {
    expect(
      keysToSnake({
        accessToken: "abc",
        checkoutUrl: "https://pay.example",
        nested: { taxReturnId: "tr1" },
      }),
    ).toEqual({
      access_token: "abc",
      checkout_url: "https://pay.example",
      nested: { tax_return_id: "tr1" },
    });
  });

  it("round-trips known fields", () => {
    const original = {
      accessToken: "t",
      serviceType: "SELF_ASSESSMENT",
      packageCode: "SIMPLE",
    };
    expect(keysToCamel(keysToSnake(original))).toEqual(original);
  });
});

describe("compat envelope helpers", () => {
  it("builds a success envelope", () => {
    expect(successEnvelope({ ok: true }, "OK")).toEqual({
      success: true,
      data: { ok: true },
      message: "OK",
    });
  });

  it("builds an error envelope", () => {
    expect(errorEnvelope("Nope")).toEqual({
      success: false,
      data: null,
      message: "Nope",
    });
  });

  it("maps Node detail shapes to messages", () => {
    expect(messageFromDetail("Not authenticated")).toBe("Not authenticated");
    expect(messageFromDetail([{ msg: "Field required" }, { msg: "bad" }])).toBe(
      "Field required bad",
    );
  });
});

describe("compat taxReturnId ↔ caseId", () => {
  it("is a stable deterministic identity", () => {
    const id = "case-abc-123";
    expect(toCaseId(id)).toBe(id);
    expect(toTaxReturnId(id)).toBe(id);
    expect(idsReferToSameCase(id, id)).toBe(true);
    expect(withTaxReturnId({ id, case_ref: "SA-1" })).toEqual({
      id,
      case_ref: "SA-1",
      taxReturnId: id,
    });
  });

  it("rejects empty ids", () => {
    expect(() => toCaseId("")).toThrow();
    expect(() => toTaxReturnId("  ")).toThrow();
  });
});

describe("compat auth user shaping", () => {
  it("splits display names and maps roles", () => {
    expect(splitDisplayName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    const user = toToxelUser({
      id: "u1",
      email: "a@b.co",
      name: "Ada Lovelace",
      role: "CLIENT",
      phone: "07",
      is_active: true,
    });
    expect(user).toMatchObject({
      id: "u1",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: "CLIENT",
      role: "CLIENT",
      mobile: "07",
    });
  });
});
