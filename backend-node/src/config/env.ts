/** Typed environment access. Values are read lazily so tests can set them before use. */

export const APP_NAME = "taxsimba";

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export function required(name: string): string {
  const v = env(name);
  if (v === undefined) throw new Error(`${name} is not configured`);
  return v;
}

export function intEnv(name: string, fallback: number): number {
  const v = env(name);
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function port(): number {
  return intEnv("PORT", 8002);
}

/**
 * Explicit allowlist only. A wildcard or empty value is a hard startup failure so the
 * permissive '*' configuration can never silently return. CORS_ORIGINS holds the official
 * production domains; CORS_DEV_ORIGINS holds preview/development origins.
 */
export function allowedOrigins(): string[] {
  const split = (raw: string) =>
    raw
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  const prod = split(process.env.CORS_ORIGINS ?? "");
  const dev = split(process.env.CORS_DEV_ORIGINS ?? "");
  if (prod.length === 0) throw new Error("CORS_ORIGINS must list at least one approved origin");
  const origins = prod.concat(dev.filter((o) => !prod.includes(o)));
  if (origins.some((o) => o === "*")) throw new Error("CORS_ORIGINS must not contain a wildcard '*'");
  return origins;
}
