/** Cross-cutting request protections: security headers, general API rate limiting, uploads. */
import { createHash, randomUUID } from "crypto";

import { NextFunction, Request, Response } from "express";
import multer from "multer";

import { intEnv } from "../config/env";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_MB,
} from "../domain/fileSecurity";
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
/** @deprecated Prefer ALLOWED_MIME_TYPES from domain/fileSecurity — kept for older tests. */
export const ALLOWED_UPLOAD_TYPES = ALLOWED_MIME_TYPES;

export function maxUploadBytes(): number {
  return intEnv("MAX_UPLOAD_MB", DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
}

/** Shared multipart parser: memory storage + platform 20MB ceiling. */
export function uploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadBytes(), files: 1 },
  });
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

function extensionOf(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function validateUpload(contentType: string | undefined, size: number, filename: string) {
  const limit = maxUploadBytes();
  const limitMb = Math.floor(limit / (1024 * 1024));
  if (size > limit) {
    throw httpError(
      413,
      `This file is too large. Maximum file size is ${limitMb}MB per file.`,
    );
  }
  if (!size) throw httpError(400, "The file appears to be empty");
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const ext = extensionOf(filename);
  if (!ALLOWED_MIME_TYPES.has(ct) || !ALLOWED_EXTENSIONS.has(ext)) {
    throw httpError(
      415,
      "Unsupported file type. Please upload a PDF, JPG, PNG, Word (.doc/.docx) or Excel (.xls/.xlsx) file",
    );
  }
  return safeFilename(filename);
}
