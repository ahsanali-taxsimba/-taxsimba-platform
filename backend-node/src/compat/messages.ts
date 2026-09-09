/**
 * Messages / communication-log compat adapters (P0 K.5 / baseline M1).
 */
import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { getCase } from "../domain/cases";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { toCaseId, withTaxReturnId } from "./ids";

export const compatMessagesRouter = Router();

compatMessagesRouter.get(
  "/client/communication-log/:taxReturnId",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    await getCase(caseId, me);
    const msgs = (await col("messages")
      .find({ case_id: caseId })
      .sort({ created_at: 1 })
      .limit(500)
      .toArray()) as Doc[];
    await col("messages").updateMany(
      { case_id: caseId, recipient_id: me.id },
      { $set: { is_read: true } },
    );
    sendCompatSuccess(
      res,
      {
        taxReturnId: caseId,
        caseId,
        messages: scrubMany(cleanMany(msgs), me).map((m) =>
          withTaxReturnId({ ...m, tax_return_id: caseId }),
        ),
      },
      "OK",
    );
  }),
);

/** Some Toxel clients POST the same path to fetch the log. */
compatMessagesRouter.post(
  "/client/communication-log/:taxReturnId",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = toCaseId(req.params.taxReturnId);
    await getCase(caseId, me);
    const msgs = (await col("messages")
      .find({ case_id: caseId })
      .sort({ created_at: 1 })
      .limit(500)
      .toArray()) as Doc[];
    sendCompatSuccess(
      res,
      {
        taxReturnId: caseId,
        caseId,
        messages: scrubMany(cleanMany(msgs), me),
      },
      "OK",
    );
  }),
);

const SendIn = z.object({
  body: z.string().min(1),
  tax_return_id: z.string().optional(),
  taxReturnId: z.string().optional(),
  case_id: z.string().optional(),
  caseId: z.string().optional(),
  recipient_id: z.string().nullish().optional(),
  recipientId: z.string().nullish().optional(),
  message: z.string().optional(),
});

compatMessagesRouter.post(
  "/client/send-to-specific-accountant",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(SendIn, keysToSnake(req.body ?? {}));
    const taxReturnId =
      body.tax_return_id ?? body.taxReturnId ?? body.case_id ?? body.caseId ?? null;
    if (!taxReturnId) throw httpError(400, "taxReturnId is required");
    const caseId = toCaseId(String(taxReturnId));
    const text = (body.body || body.message || "").trim();
    if (!text) throw httpError(400, "message body is required");
    const kase = await getCase(caseId, me);
    const recipient =
      body.recipient_id ??
      body.recipientId ??
      (me.role === "CLIENT" ? kase.assigned_accountant_id : kase.client_user_id);
    const msg: Doc = {
      id: randomUUID(),
      case_id: caseId,
      sender_id: me.id,
      sender_name: me.name,
      sender_role: me.role,
      recipient_id: recipient ?? null,
      body: text,
      is_read: false,
      created_at: nowIso(),
    };
    await col("messages").insertOne({ ...msg });
    await logActivity(caseId, "Message sent", me);
    if (recipient) {
      const recipientUser = await col("users").findOne(
        { id: recipient },
        { projection: { role: 1 } },
      );
      const link = recipientUser?.role === "CLIENT" ? "/messages" : `/work/cases/${caseId}`;
      await notify(
        String(recipient),
        `New message from ${me.name}`,
        text.slice(0, 120),
        caseId,
        link,
        "MESSAGE",
      );
    }
    sendCompatSuccess(
      res,
      withTaxReturnId({ ...clean(msg), tax_return_id: caseId }),
      "Sent",
    );
  }),
);
