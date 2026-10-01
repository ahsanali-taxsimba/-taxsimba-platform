/**
 * Byte-compatible Fernet (spec v0x80) implementation.
 *
 * Deliberately interoperable with Python's `cryptography.fernet`: existing production TOTP
 * secrets encrypted by the Python backend must remain decryptable by Node using the SAME
 * TOTP_FERNET_KEY. Do not rotate that key without a re-encryption procedure.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const VERSION = 0x80;

export class InvalidToken extends Error {}

function keyParts(key: string): { signing: Buffer; encryption: Buffer } {
  const raw = Buffer.from(key, "base64url");
  if (raw.length !== 32) throw new InvalidToken("Fernet key must be 32 url-safe base64 bytes");
  return { signing: raw.subarray(0, 16), encryption: raw.subarray(16) };
}

export function encrypt(key: string, plaintext: string, iv = randomBytes(16)): string {
  const { signing, encryption } = keyParts(key);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const cipher = createCipheriv("aes-128-cbc", encryption, iv);
  const body = Buffer.concat([
    Buffer.from([VERSION]),
    timestamp,
    iv,
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const mac = createHmac("sha256", signing).update(body).digest();
  return Buffer.concat([body, mac]).toString("base64url");
}

export function decrypt(key: string, token: string): string {
  const { signing, encryption } = keyParts(key);
  const raw = Buffer.from(token, "base64url");
  if (raw.length < 57 || raw[0] !== VERSION) throw new InvalidToken("Malformed token");
  const body = raw.subarray(0, raw.length - 32);
  const mac = raw.subarray(raw.length - 32);
  const expected = createHmac("sha256", signing).update(body).digest();
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    throw new InvalidToken("Signature did not match");
  }
  const decipher = createDecipheriv("aes-128-cbc", encryption, body.subarray(9, 25));
  try {
    return Buffer.concat([decipher.update(body.subarray(25)), decipher.final()]).toString("utf8");
  } catch {
    throw new InvalidToken("Payload could not be decrypted");
  }
}

export function generateKey(): string {
  return randomBytes(32).toString("base64url");
}
