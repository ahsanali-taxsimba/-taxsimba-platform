/**
 * Toxel response envelope helpers.
 * Native Node routes continue to use {"detail": ...}; compat routes use this shape.
 */

import { NextFunction, Request, Response } from "express";

import { HttpError } from "../http/errors";
import { mapPaymentError, PaymentConfigError } from "../services/paymentErrors";
import { keysToCamel } from "./caseMap";

export interface CompatEnvelope<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
}

export function successEnvelope<T>(data: T, message = "OK"): CompatEnvelope<T> {
  return { success: true, data, message };
}

export function errorEnvelope(message: string, data: unknown = null): CompatEnvelope {
  return { success: false, data, message };
}

/** Human-readable message from a native Node HttpError detail. */
export function messageFromDetail(detail: unknown): string {
  if (detail == null) return "Request failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (e && typeof e === "object" && "msg" in e) return String((e as { msg: unknown }).msg);
        return JSON.stringify(e);
      })
      .join(" ");
  }
  if (typeof detail === "object" && detail && "msg" in detail) {
    return String((detail as { msg: unknown }).msg);
  }
  return String(detail);
}

/** Send a success envelope. By default `data` is camelCased for Toxel. */
export function sendCompatSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  status = 200,
  opts: { camelCaseData?: boolean } = {},
): void {
  const camelCaseData = opts.camelCaseData !== false;
  const payload = successEnvelope(camelCaseData ? keysToCamel(data) : data, message);
  // Always camelCase the envelope keys themselves (success/data/message are already camel).
  res.status(status).json(payload);
}

function isMultipartParseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === "MulterError") return true;
  const msg = String(e.message || "");
  return /Boundary not found|Unexpected end of form|Unexpected field|File too large/i.test(msg);
}

/**
 * Compat-router error middleware: maps Node HttpError `{detail}` into the Toxel envelope
 * without altering native `/api` error behaviour outside this router.
 */
export function compatErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);
    const message = messageFromDetail(err.detail);
    res.status(err.status).json(
      keysToCamel(
        errorEnvelope(message, typeof err.detail === "string" ? null : err.detail),
      ),
    );
    return;
  }
  // Multer / busboy failures (e.g. Content-Type without boundary) → actionable 422, not 500.
  if (isMultipartParseError(err)) {
    const e = err as { code?: string; message?: string };
    const message =
      e.code === "LIMIT_FILE_SIZE"
        ? "File is too large"
        : "Invalid multipart upload. Send the file as multipart/form-data with a proper boundary (do not set Content-Type manually).";
    res.status(422).json(keysToCamel(errorEnvelope(message)));
    return;
  }
  // Payment config / Stripe failures → controlled actionable messages (never secrets).
  if (
    err instanceof PaymentConfigError ||
    (err instanceof Error &&
      (/STRIPE_/i.test(err.message) ||
        /Stripe/i.test(err.name || "") ||
        /payment provider/i.test(err.message)))
  ) {
    const mapped = mapPaymentError(err);
    const message = messageFromDetail(mapped.detail);
    res.status(mapped.status).json(keysToCamel(errorEnvelope(message)));
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json(keysToCamel(errorEnvelope("Internal Server Error")));
}
