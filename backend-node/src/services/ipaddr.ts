/** Minimal IPv4/IPv6 CIDR membership test (replaces Python's ipaddress module usage). */
import { isIP } from "net";

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

function v6ToBytes(ip: string): Uint8Array | null {
  if (isIP(ip) !== 6) return null;
  const [head, tail] = ip.split("::");
  const expand = (s: string) => (s ? s.split(":").filter((g) => g.length > 0) : []);
  const left = expand(head ?? "");
  const right = expand(tail ?? "");
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  groups.forEach((g, i) => {
    const n = parseInt(g, 16);
    bytes[i * 2] = (n >> 8) & 0xff;
    bytes[i * 2 + 1] = n & 0xff;
  });
  return bytes;
}

function normalise(ip: string): string {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4), as Node reports for dual-stack sockets.
  return ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

export function isValid(ip: string): boolean {
  return isIP(normalise(ip)) !== 0;
}

export function inNetwork(ip: string, cidr: string): boolean {
  const addr = normalise(ip);
  const [net, prefixRaw] = cidr.includes("/") ? cidr.split("/") : [cidr, null];
  if (isIP(addr) === 4 && isIP(net) === 4) {
    const prefix = prefixRaw === null ? 32 : Number(prefixRaw);
    const a = v4ToInt(addr);
    const n = v4ToInt(net);
    if (a === null || n === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (a & mask) === (n & mask);
  }
  if (isIP(addr) === 6 && isIP(net) === 6) {
    const prefix = prefixRaw === null ? 128 : Number(prefixRaw);
    const a = v6ToBytes(addr);
    const n = v6ToBytes(net);
    if (!a || !n || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;
    for (let i = 0; i < 16; i += 1) {
      const bits = Math.min(8, Math.max(0, prefix - i * 8));
      const mask = bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff;
      if ((a[i] & mask) !== (n[i] & mask)) return false;
    }
    return true;
  }
  return false;
}

export default { isValid, inNetwork };
