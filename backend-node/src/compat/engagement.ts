/**
 * Engagement letter compat adapters (baseline G1 / G2).
 */
import { Router } from "express";
import { z } from "zod";

import { handler, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  acceptEngagementLetter,
  engagementStatusForUser,
} from "../services/engagement";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";

export const compatEngagementRouter = Router();

const AcceptIn = z.object({
  signature: z.string().min(1),
  accepted: z.boolean(),
  agreement_version: z.string().nullish(),
  agreementVersion: z.string().nullish(),
});

compatEngagementRouter.post(
  "/client/accept-engagement-letter",
  auth("CLIENT"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(AcceptIn, keysToSnake(req.body ?? {}));
    const row = await acceptEngagementLetter(me, {
      signature: body.signature,
      accepted: body.accepted,
      agreementVersion: body.agreement_version ?? body.agreementVersion ?? null,
    });
    sendCompatSuccess(
      res,
      keysToCamel({
        ok: true,
        is_engagement_letter_accepted: true,
        accepted_at: row.accepted_at,
        agreement_version: row.agreement_version,
        service_types: row.service_types ?? [],
        case_ids: row.case_ids ?? [],
      }),
      "Engagement letter accepted",
    );
  }),
);

compatEngagementRouter.get(
  "/client/engagement-letter-status",
  auth("CLIENT"),
  handler(async (req, res) => {
    const status = await engagementStatusForUser(authed(req));
    sendCompatSuccess(res, keysToCamel(status), "OK");
  }),
);
