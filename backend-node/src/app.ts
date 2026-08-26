import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";

import { allowedOrigins } from "./config/env";
import { col } from "./db/mongo";
import { errorMiddleware, httpError } from "./http/errors";
import { apiRateLimit, ensureRateIndexes, securityHeaders } from "./middleware/protections";
import { authRouter } from "./routes/auth";
import { casesRouter } from "./routes/cases";
import { ensureIndexes as ensureLoginIndexes } from "./services/loginLockout";
import { ensureMfaIndexes } from "./services/security";

/**
 * Indexes for every hot query path. Without these each list endpoint scans the whole
 * collection, which is what makes a large client base feel slow.
 */
const QUERY_INDEXES: Record<string, string[]> = {
  cases: [
    "client_user_id",
    "assigned_accountant_id",
    "status",
    "is_test",
    "internal_deadline",
    "client_id",
  ],
  documents: ["case_id", "client_user_id", "is_internal", "is_deleted"],
  tasks: ["case_id", "status", "owner_id", "client_user_id"],
  messages: ["case_id", "created_at"],
  notifications: ["user_id", "read_at", "created_at"],
  activity_logs: ["case_id", "created_at", "user_name"],
  payment_transactions: [
    "user_id",
    "client_id",
    "kind",
    "payment_status",
    "session_id",
    "created_at",
  ],
  clients: ["user_id", "is_test", "client_ref"],
  client_services: ["client_id", "service_type", "status"],
  calculation_versions: ["case_id"],
  document_requests: ["case_id", "status"],
  case_notes: ["case_id"],
  recommendations: ["case_id", "status", "type"],
  invoices: ["payment_request_id", "client_user_id", "case_id"],
  staff_invites: ["user_id", "token_hash"],
  users: ["role", "is_test", "created_at"],
};

export async function ensureQueryIndexes(): Promise<void> {
  for (const [collection, fields] of Object.entries(QUERY_INDEXES)) {
    for (const field of fields) {
      try {
        await col(collection).createIndex({ [field]: 1 });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`index ${collection}.${field} skipped: ${String(e)}`);
      }
    }
  }
}

export async function startup(): Promise<void> {
  await ensureLoginIndexes();
  await ensureMfaIndexes();
  await ensureRateIndexes();
  await ensureQueryIndexes();
}

export function createApp(): Express {
  const app = express();
  // Behind an ingress; the real client IP is resolved explicitly against TRUSTED_PROXY_CIDRS.
  app.set("trust proxy", false);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(apiRateLimit);
  app.use(
    cors({
      origin: allowedOrigins(),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));

  app.use("/api", authRouter);
  app.use("/api", casesRouter);

  app.use("/api", (_req, _res, next) => next(httpError(404, "Not Found")));
  app.use(errorMiddleware);
  return app;
}
