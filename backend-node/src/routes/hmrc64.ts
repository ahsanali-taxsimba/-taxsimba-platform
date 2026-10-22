/**
 * HMRC 64-8 authorisation API — staff only (except signing via /esign/sign/:token).
 *
 *   GET    /hmrc64/dashboard
 *   GET    /hmrc64/clients/:clientId/precheck
 *   GET    /hmrc64/clients/:clientId/status
 *   POST   /hmrc64/clients/:clientId/generate
 *   GET    /hmrc64/forms/:id
 *   POST   /hmrc64/forms/:id/send
 *   POST   /hmrc64/forms/:id/resend
 */
import { Request, Router } from "express";
import { z } from "zod";

import { ensureHmrc64Indexes } from "../domain/hmrc64";
import { handler, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  clientHmrc64Status,
  generateHmrc64,
  getHmrc64,
  hmrc64Dashboard,
  precheckHmrc64,
  resendHmrc64,
  sendHmrc64ForSignature,
} from "../services/hmrc64";

export const hmrc64Router = Router();

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureHmrc64Indexes();
  ready = true;
}

function clientMeta(req: Request): { ip?: string } {
  const xf = req.header("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0].trim() : req.ip) || undefined;
  return { ip };
}

const FillOverrides = z
  .object({
    client_full_name: z.string().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    address_line_3: z.string().optional(),
    address_postcode: z.string().optional(),
    date_of_birth: z.string().optional(),
    ni_number: z.string().optional(),
    utr: z.string().optional(),
    business_name: z.string().optional(),
    business_utr: z.string().optional(),
    vat_registration_number: z.string().optional(),
    company_registration_number: z.string().optional(),
    agent_name: z.string().optional(),
    agent_address: z.string().optional(),
    agent_phone: z.string().optional(),
    agent_reference: z.string().optional(),
  })
  .partial();

const GenerateIn = z.object({
  case_id: z.string().nullish(),
  overrides: FillOverrides.optional(),
});

const SendIn = z.object({
  message: z.string().nullish(),
});

hmrc64Router.get(
  "/hmrc64/dashboard",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await hmrc64Dashboard(authed(req)));
  }),
);

hmrc64Router.get(
  "/hmrc64/clients/:clientId/precheck",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await precheckHmrc64(req.params.clientId, authed(req)));
  }),
);

hmrc64Router.get(
  "/hmrc64/clients/:clientId/status",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await clientHmrc64Status(req.params.clientId, authed(req)));
  }),
);

hmrc64Router.post(
  "/hmrc64/clients/:clientId/generate",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(GenerateIn, req.body);
    res.status(201).json(
      await generateHmrc64({
        client_id: req.params.clientId,
        actor: authed(req),
        case_id: body.case_id,
        overrides: body.overrides,
        ip: clientMeta(req).ip,
      }),
    );
  }),
);

hmrc64Router.get(
  "/hmrc64/forms/:id",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await getHmrc64(req.params.id, authed(req)));
  }),
);

hmrc64Router.post(
  "/hmrc64/forms/:id/send",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(SendIn, req.body);
    res.json(
      await sendHmrc64ForSignature({
        form_id: req.params.id,
        actor: authed(req),
        message: body.message,
        ip: clientMeta(req).ip,
      }),
    );
  }),
);

hmrc64Router.post(
  "/hmrc64/forms/:id/resend",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(
      await resendHmrc64({
        form_id: req.params.id,
        actor: authed(req),
        ip: clientMeta(req).ip,
      }),
    );
  }),
);
