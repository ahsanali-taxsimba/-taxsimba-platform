/**
 * Engagement Letter API — replaces the former Client Care Letter flow.
 *
 *   GET  /engagement/me              — current letter + gate status (client)
 *   POST /engagement/me/generate     — refresh from live services (client/staff)
 *   POST /engagement/me/sign         — in-app e-sign (client session)
 *   GET  /engagement/clients/:userId — staff view of a client's letter
 *   GET  /engagement/gate            — { ok, reason } for ServiceGuard
 */
import { Request, Router } from "express";
import { z } from "zod";

import { clientRecord } from "../domain/cases";
import { ensureEngagementIndexes } from "../domain/engagementLetter";
import { clean, col, Doc } from "../db/mongo";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  decorateEngagement,
  engagementGate,
  generateEngagementLetter,
  getClientEngagement,
  signEngagementLetter,
} from "../services/engagementLetter";

export const engagementRouter = Router();

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureEngagementIndexes();
  ready = true;
}

function meta(req: Request): { ip?: string; ua?: string } {
  const xf = req.header("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0].trim() : req.ip) || undefined;
  return { ip, ua: req.header("user-agent") || undefined };
}

async function clientOf(user: Doc): Promise<Doc> {
  const client = await clientRecord(user);
  if (!client) throw httpError(404, "Client record not found");
  return client;
}

const SignIn = z.object({
  signature_type: z.enum(["CLICK", "TYPED", "DRAWN"]),
  signature_data: z.string().nullish(),
  typed_name: z.string().nullish(),
  early_start_instructed: z.boolean().default(false),
  consent_accepted: z.boolean(),
});

engagementRouter.get(
  "/engagement/me",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientOf(me);
    const gate = await engagementGate(client);
    res.json({
      ...gate,
      // Convenience aliases for the modal / ServiceGuard.
      pending_signature: !gate.ok && Boolean(gate.engagement),
      message: gate.ok ? null : "Engagement letter pending signature",
    });
  }),
);

engagementRouter.get(
  "/engagement/gate",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const gate = await engagementGate(await clientOf(authed(req)));
    res.json({
      ok: gate.ok,
      reason: gate.reason,
      status: gate.status,
      engagement_id: gate.engagement_id,
    });
  }),
);

engagementRouter.post(
  "/engagement/me/generate",
  auth("CLIENT", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    let client: Doc;
    if (me.role === "CLIENT") {
      client = await clientOf(me);
    } else {
      const userId = (req.body as Doc)?.client_user_id;
      if (!userId) throw httpError(400, "client_user_id is required for staff");
      const found = (await col("clients").findOne({ user_id: userId })) as Doc | null;
      if (!found) throw httpError(404, "Client not found");
      client = clean(found) as Doc;
    }
    const letter = await generateEngagementLetter(client, { force: true, actor: me });
    res.status(201).json(letter);
  }),
);

engagementRouter.post(
  "/engagement/me/sign",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientOf(me);
    const body = parseBody(SignIn, req.body);
    const m = meta(req);
    const signed = await signEngagementLetter(client, me, {
      signature_type: body.signature_type,
      signature_data: body.signature_data,
      typed_name: body.typed_name,
      early_start_instructed: body.early_start_instructed,
      consent_accepted: body.consent_accepted,
      ip: m.ip,
      user_agent: m.ua,
    });
    res.json(signed);
  }),
);

engagementRouter.get(
  "/engagement/clients/:clientUserId",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const client = (await col("clients").findOne({
      user_id: req.params.clientUserId,
    })) as Doc | null;
    if (!client) throw httpError(404, "Client not found");
    const engagement = await getClientEngagement(clean(client) as Doc);
    if (!engagement) {
      res.json({ engagement: null, status: null });
      return;
    }
    res.json(engagement);
  }),
);

engagementRouter.get(
  "/engagement/:id",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const decorated = await decorateEngagement(req.params.id);
    if (me.role === "CLIENT" && decorated.client_user_id !== me.id) {
      throw httpError(403, "Not your engagement letter");
    }
    res.json(decorated);
  }),
);
