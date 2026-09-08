/**
 * Toxel compatibility router — K.1 infrastructure.
 *
 * Mounted at `/api/compat`. Native `/api/*` routes remain unchanged.
 * Later phases add thin adapters under this tree; they must call existing domain services.
 */

import { Router } from "express";

import { clean, col, Doc } from "../db/mongo";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { compatAuthRouter } from "./authBridge";
import { keysToCamel, keysToSnake } from "./caseMap";
import { compatErrorMiddleware, sendCompatSuccess } from "./envelope";
import { idsReferToSameCase, toCaseId, toTaxReturnId, withTaxReturnId } from "./ids";
import { maskContactsForViewer } from "./privacy";

export const compatRouter = Router();

compatRouter.use(compatAuthRouter);

/** Health / envelope success probe. */
compatRouter.get(
  "/ping",
  handler(async (_req, res) => {
    sendCompatSuccess(res, { pong: true, layer: "compat" }, "OK");
  }),
);

/**
 * Echo probe: camelCase request body → snake_case internally → camelCase envelope data.
 * Proves central case mapping without touching domain logic.
 */
compatRouter.post(
  "/echo",
  handler(async (req, res) => {
    const snake = keysToSnake(req.body ?? {});
    const roundTrip = keysToCamel(snake);
    // Keep `asSnake` in snake_case so the probe can assert central mapping without
    // the envelope re-camelCasing the demonstration payload.
    sendCompatSuccess(
      res,
      {
        receivedCamel: req.body ?? {},
        asSnake: snake,
        roundTripCamel: roundTrip,
      },
      "Echo OK",
      200,
      { camelCaseData: false },
    );
  }),
);

/** Deterministic taxReturnId ↔ caseId identity probe. */
compatRouter.get(
  "/ids/:taxReturnId",
  handler(async (req, res) => {
    const caseId = toCaseId(req.params.taxReturnId);
    const taxReturnId = toTaxReturnId(caseId);
    sendCompatSuccess(
      res,
      {
        taxReturnId,
        caseId,
        same: idsReferToSameCase(taxReturnId, caseId),
        decorated: withTaxReturnId({ id: caseId, case_ref: "SA-PROBE" }),
      },
      "OK",
    );
  }),
);

/**
 * Privacy probe: lists CLIENT users through maskContactMany.
 * ADMIN sees masked email/phone; SUPER_ADMIN sees full; ACCOUNTANT blocked (403).
 * Does not add a parallel user-management system — read-only sample for K.1 tests.
 */
compatRouter.get(
  "/privacy/clients",
  auth("ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(async (req, res) => {
    const me = authed(req);
    if (me.role === "ACCOUNTANT") {
      // Accountants must not receive client contact lists via compat either.
      throw httpError(403, "Insufficient permissions");
    }
    const users = (await col("users")
      .find({ role: "CLIENT" })
      .project({ password_hash: 0, totp: 0, recovery_code_hashes: 0 })
      .limit(50)
      .toArray()) as Doc[];
    const cleaned = users.map((u) => clean(u) as Doc);
    const masked = maskContactsForViewer(cleaned, me);
    sendCompatSuccess(res, keysToCamel({ clients: masked }), "OK");
  }),
);

/** Forced error probe for envelope error mapping tests. */
compatRouter.get(
  "/errors/unauthorized",
  handler(async () => {
    throw httpError(401, "Not authenticated");
  }),
);

compatRouter.get(
  "/errors/forbidden",
  handler(async () => {
    throw httpError(403, "Insufficient permissions");
  }),
);

compatRouter.use(compatErrorMiddleware);

export { keysToCamel, keysToSnake } from "./caseMap";
export { toCaseId, toTaxReturnId, withTaxReturnId, idsReferToSameCase } from "./ids";
export { successEnvelope, errorEnvelope, messageFromDetail } from "./envelope";
export { toToxelUser, splitDisplayName } from "./authBridge";
export { maskContactForViewer, maskContactsForViewer } from "./privacy";
