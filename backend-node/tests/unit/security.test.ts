import { authenticator } from "otplib";
import { beforeAll, describe, expect, it } from "vitest";

import { generateKey } from "../../src/services/fernet";
import {
  checkPasswordStrength,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  matchRecoveryCode,
  newSecret,
  verifyCode,
} from "../../src/services/security";

beforeAll(() => {
  process.env.TOTP_FERNET_KEY = generateKey();
});

describe("totp", () => {
  it("encrypts secrets at rest and decrypts them back", () => {
    const { secret, uri } = newSecret("staff@example.com");
    expect(secret).toHaveLength(32);
    expect(uri).toContain("otpauth://totp/");
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("accepts a valid code and returns its step", () => {
    const { secret } = newSecret("staff@example.com");
    const code = authenticator.clone({ step: 30, digits: 6 }).generate(secret);
    const [ok, step] = verifyCode(secret, code, null);
    expect(ok).toBe(true);
    expect(step).toBe(Math.floor(Date.now() / 1000 / 30));
  });

  it("refuses to replay the step already consumed", () => {
    const { secret } = newSecret("staff@example.com");
    const step = Math.floor(Date.now() / 1000 / 30);
    const code = authenticator.clone({ step: 30, digits: 6 }).generate(secret);
    expect(verifyCode(secret, code, step)[0]).toBe(false);
  });

  it("rejects malformed codes", () => {
    const { secret } = newSecret("staff@example.com");
    for (const bad of ["", "12345", "abcdef", "1234567"]) {
      expect(verifyCode(secret, bad, null)).toEqual([false, null]);
    }
  });
});

describe("recovery codes", () => {
  it("hashes codes and matches only the correct one", () => {
    const { codes, hashes } = generateRecoveryCodes(3);
    expect(hashes).toHaveLength(3);
    expect(hashes).not.toContain(codes[0]);
    expect(matchRecoveryCode(codes[2], hashes)).toBe(2);
    expect(matchRecoveryCode("not-a-code", hashes)).toBeNull();
  });
});

describe("password policy", () => {
  const bad: [string, string][] = [
    ["Short1!x", "Password must be at least 12 characters long"],
    ["alllowercaseletters", "Password must combine at least three of"],
    ["Password12345!", "This password is too easy to guess"],
  ];

  it.each(bad)("rejects %s", (password, detail) => {
    expect(() => checkPasswordStrength(password)).toThrowError(new RegExp(detail));
  });

  it("rejects a password containing the email local part or name", () => {
    expect(() => checkPasswordStrength("Jonathan-2024!", "jonathan@example.com")).toThrowError(
      /email address/,
    );
    expect(() => checkPasswordStrength("Jonathan-2024!", "x@example.com", "Jonathan Smith")).toThrowError(
      /your name/,
    );
  });

  it("accepts a strong password", () => {
    expect(() => checkPasswordStrength("Tr0ubl3-Kettle-Marsh", "abc@example.com", "Ada")).not.toThrow();
  });
});
