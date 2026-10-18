/**
 * REST API for the native e-signature module.
 *
 * Staff (authenticated):
 *   GET    /esign/templates
 *   POST   /esign/documents              — create from template + merge fields
 *   POST   /esign/requests               — create (+ optional send) signature request
 *   POST   /esign/requests/:id/send      — (re)send invitations
 *   GET    /esign/requests/:id           — status + signers + events
 *   GET    /esign/requests               — list / dashboard filters
 *   GET    /esign/dashboard              — awaiting + ready-to-file widgets
 *   GET    /esign/requests/:id/download  — signed document + certificate
 *
 * Public (token in path — no session cookie):
 *   GET    /esign/sign/:token            — signing package
 *   POST   /esign/sign/:token            — record signature + consent
 *
 * Fits tax/MTD workflows: staff "Send for approval" → client signs → post-sign
 * hooks lock figures and unlock HMRC submission.
 */
import { Request, Router } from "express";
import { z } from "zod";

import { ensureEsignIndexes, ensureEsignTemplates } from "../domain/esign";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  completeSignature,
  createGeneratedDocument,
  createSignatureRequest,
  dashboardWidgets,
  decorateRequest,
  getSigningPackage,
  listRequests,
  listTemplates,
  sendInvitations,
  buildDownloadBundle,
} from "../services/esign";

export const esignRouter = Router();

let bootstrapped = false;
async function ensureEsignReady(): Promise<void> {
  if (bootstrapped) return;
  await ensureEsignIndexes();
  await ensureEsignTemplates();
  bootstrapped = true;
}

function clientMeta(req: Request): { ip?: string; ua?: string } {
  const xf = req.header("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0].trim() : req.ip) || undefined;
  return { ip, ua: req.header("user-agent") || undefined };
}

const CreateDocumentIn = z.object({
  template_id: z.string().nullish(),
  type: z.enum([
    "VAT_RETURN_APPROVAL",
    "MTD_QUARTERLY_APPROVAL",
    "SA_SUMMARY_APPROVAL",
    "CT_SUMMARY_APPROVAL",
    "ENGAGEMENT_LETTER",
    "AML_PACK",
    "CUSTOM",
  ]),
  case_id: z.string().nullish(),
  mtd_period_id: z.string().nullish(),
  client_id: z.string().nullish(),
  client_user_id: z.string().nullish(),
  client_name: z.string().nullish(),
  tax_period_label: z.string().nullish(),
  calculation_version_id: z.string().nullish(),
  merge_fields: z.record(z.unknown()).default({}),
  firm_id: z.string().nullish(),
});

const SignerIn = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["CLIENT", "AGENT", "DIRECTOR", "PARTNER", "WITNESS"]).optional(),
  auth_method: z.enum(["EMAIL_LINK", "OTP_EMAIL", "OTP_SMS", "SESSION"]).optional(),
  sort_order: z.number().int().optional(),
});

const CreateRequestIn = z.object({
  document_id: z.string().min(1),
  signers: z.array(SignerIn).min(1),
  expires_at: z.string().nullish(),
  channels: z.array(z.enum(["EMAIL", "SMS", "IN_APP"])).optional(),
  message: z.string().nullish(),
  payment_redirect_url: z.string().nullish(),
  send_now: z.boolean().optional(),
});

const SignIn = z.object({
  signature_type: z.enum(["DRAWN", "TYPED", "CLICK"]),
  signature_data: z.string().nullish(),
  consent_accepted: z.boolean(),
  typed_name: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

esignRouter.get(
  "/esign/templates",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    res.json(await listTemplates(type));
  }),
);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

esignRouter.post(
  "/esign/documents",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const body = parseBody(CreateDocumentIn, req.body);
    const doc = await createGeneratedDocument(
      {
        template_id: body.template_id,
        type: body.type,
        case_id: body.case_id,
        mtd_period_id: body.mtd_period_id,
        client_id: body.client_id,
        client_user_id: body.client_user_id,
        client_name: body.client_name,
        tax_period_label: body.tax_period_label,
        calculation_version_id: body.calculation_version_id,
        merge_fields: body.merge_fields as Record<string, unknown>,
        firm_id: body.firm_id,
      },
      authed(req),
    );
    res.status(201).json(doc);
  }),
);

// ---------------------------------------------------------------------------
// Signature requests
// ---------------------------------------------------------------------------

esignRouter.post(
  "/esign/requests",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const body = parseBody(CreateRequestIn, req.body);
    const request = await createSignatureRequest(
      {
        document_id: body.document_id,
        signers: body.signers,
        expires_at: body.expires_at,
        channels: body.channels,
        message: body.message,
        payment_redirect_url: body.payment_redirect_url,
        send_now: body.send_now,
      },
      authed(req),
    );
    res.status(201).json(request);
  }),
);

esignRouter.post(
  "/esign/requests/:id/send",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    res.json(await sendInvitations(req.params.id, authed(req)));
  }),
);

esignRouter.get(
  "/esign/requests/:id",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "CLIENT"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const decorated = await decorateRequest(req.params.id);
    const me = authed(req);
    // Clients may only see requests for their own user id.
    if (me.role === "CLIENT" && decorated.client_user_id !== me.id) {
      throw httpError(403, "Not your signature request");
    }
    res.json(decorated);
  }),
);

esignRouter.get(
  "/esign/requests",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const str = (k: string) =>
      typeof req.query[k] === "string" && req.query[k] ? String(req.query[k]) : undefined;
    res.json(
      await listRequests(authed(req), {
        status: str("status"),
        case_id: str("case_id"),
        mtd_period_id: str("mtd_period_id"),
        awaiting: str("awaiting") === "1" || str("awaiting") === "true",
        ready_to_file: str("ready_to_file") === "1" || str("ready_to_file") === "true",
      }),
    );
  }),
);

esignRouter.get(
  "/esign/dashboard",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    res.json(await dashboardWidgets(authed(req)));
  }),
);

esignRouter.get(
  "/esign/requests/:id/download",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await ensureEsignReady();
    const bundle = await buildDownloadBundle(req.params.id, authed(req));
    res.setHeader("Content-Type", bundle.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.filename}"`);
    res.send(bundle.body);
  }),
);

// ---------------------------------------------------------------------------
// Public signing endpoints (unique expiring token per signer)
// ---------------------------------------------------------------------------

esignRouter.get(
  "/esign/sign/:token",
  handler(async (req, res) => {
    await ensureEsignReady();
    res.json(await getSigningPackage(req.params.token, clientMeta(req)));
  }),
);

esignRouter.post(
  "/esign/sign/:token",
  handler(async (req, res) => {
    await ensureEsignReady();
    const body = parseBody(SignIn, req.body);
    const result = await completeSignature(
      req.params.token,
      {
        signature_type: body.signature_type,
        signature_data: body.signature_data,
        consent_accepted: body.consent_accepted,
        typed_name: body.typed_name,
      },
      clientMeta(req),
    );
    res.json(result);
  }),
);
