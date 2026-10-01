/** Cross-cutting request protections: security headers, general API rate limiting, uploads. */
import { createHash, randomUUID } from "crypto";

import { NextFunction, Request, Response } from "express";

import { intEnv } from "../config/env";
import { col } from "../db/mongo";
import { httpError } from "../http/errors";
import { clientIp } from "../services/loginLockout";

const WINDOW_SECONDS = 60;

function maxRequests(): number {
  return intEnv("API_RATE_LIMIT_PER_MINUTE", 300);
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const setDefault = (name: string, value: string) => {
    if (!res.getHeader(name)) res.setHeader(name, value);
  };
  setDefault("X-Content-Type-Options", "nosniff");
  setDefault("X-Frame-Options", "DENY");
  setDefault("Referrer-Policy", "strict-origin-when-cross-origin");
  setDefault("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  setDefault("Cross-Origin-Opener-Policy", "same-origin");
  setDefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // API responses are data, never documents — nothing may be framed or executed.
  setDefault(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; " +
      "img-src 'self' data:; style-src 'unsafe-inline'",
  );
  setDefault("X-Request-ID", (req as Request & { requestId?: string }).requestId ?? randomUUID());
  next();
}

/**
 * Per-caller request ceiling for the whole API, counted in MongoDB so the ceiling holds
 * across replicas. Login has its own stricter lockout policy.
 */
export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  (req as Request & { requestId?: string }).requestId = randomUUID();
  const token = req.header("authorization") ?? req.cookies?.access_token ?? "";
  const key = token ? createHash("sha256").update(token).digest("hex").slice(0, 32) : clientIp(req);
  const now = new Date();
  const bucket = Math.floor(now.getTime() / 1000 / WINDOW_SECONDS);
  col("api_rate_buckets")
    .findOneAndUpdate(
      { key, bucket },
      {
        $inc: { count: 1 },
        $setOnInsert: { expires_at: new Date(now.getTime() + WINDOW_SECONDS * 3000) },
      },
      { upsert: true, returnDocument: "after" },
    )
    .then((doc) => (doc?.count as number) ?? 1)
    .catch(() => 0) // never let the limiter take the API down
    .then((count) => {
      if (count > maxRequests()) {
        res
          .status(429)
          .set("Retry-After", String(WINDOW_SECONDS))
          .json({ detail: "Too many requests — please slow down" });
        return;
      }
      next();
    })
    .catch(next);
}

export async function ensureRateIndexes(): Promise<void> {
  await col("api_rate_buckets").createIndex({ key: 1, bucket: 1 }, { unique: true });
  await col("api_rate_buckets").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
}

// ------------------------------------------------------------------ upload validation
export const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
]);

export function maxUploadBytes(): number {
  return intEnv("MAX_UPLOAD_MB", 25) * 1024 * 1024;
}

/** Strips any path component and anything that could be interpreted by a shell or path. */
export function safeFilename(name: string | undefined | null): string {
  const base = (name || "file").replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = Array.from(base)
    .filter((c) => /[\p{L}\p{N}]/u.test(c) || " ._-()".includes(c))
    .join("")
    .trim();
  return (cleaned || "file").slice(0, 120);
}

export function validateUpload(contentType: string | undefined, size: number, filename: string) {
  const limit = maxUploadBytes();
  if (size > limit) {
    throw httpError(413, `Files must be ${Math.floor(limit / (1024 * 1024))}MB or smaller`);
  }
  if (!size) throw httpError(400, "The file appears to be empty");
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.has(ct)) {
    throw httpError(
      415,
      "Unsupported file type. Please upload a PDF, image, CSV, Word or Excel file",
    );
  }
  return safeFilename(filename);
}
