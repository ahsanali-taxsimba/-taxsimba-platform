import { describe, expect, it } from "vitest";

import { decrypt, encrypt, InvalidToken } from "../../src/services/fernet";

// Produced by Python's cryptography.fernet with the key below. Existing production TOTP
// secrets must stay decryptable after the migration.
const PY_KEY = "FEQwfVLf5hHoKzYggUMx2BjvE5Sy3lOkDxOPSw7CfKM=";
const PY_TOKEN =
  "gAAAAABqjuroELQmHpZm6KxT-PKpbzEkkmCOM5yRqFXgKT-gMMngTUNzfZiRX1Tqqg-lKJuRp6Jv4-SsLFJKLO0iI69iAc6WeSKJWZ4RaXf9c9UL9HHrag5GArqd1rMHID-F7V-HPE_Q";
const PLAINTEXT = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

describe("fernet", () => {
  it("decrypts a token produced by Python cryptography.fernet", () => {
    expect(decrypt(PY_KEY, PY_TOKEN)).toBe(PLAINTEXT);
  });

  it("round-trips its own tokens", () => {
    expect(decrypt(PY_KEY, encrypt(PY_KEY, "secret value"))).toBe("secret value");
  });

  it("rejects a tampered token", () => {
    const token = encrypt(PY_KEY, PLAINTEXT);
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(() => decrypt(PY_KEY, tampered)).toThrow(InvalidToken);
  });

  it("rejects a token signed with a different key", () => {
    const other = "c2VjcmV0LWtleS1vZi0zMi1ieXRlcy1sZW5ndGghIQ";
    expect(() => decrypt(other, PY_TOKEN)).toThrow(InvalidToken);
  });
});
