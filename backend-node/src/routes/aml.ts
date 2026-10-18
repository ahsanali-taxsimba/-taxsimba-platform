/**
 * AML / KYC REST API.
 *
 * Client:
 *   GET    /aml/me
 *   GET    /aml/gate
 *   PATCH  /aml/me/profile
 *   POST   /aml/me/documents          (multipart)
 *   POST   /aml/me/submit
 *   GET    /aml/documents/:id/file    (own docs preview)
 *
 * Staff:
 *   GET    /aml/cases
 *   GET    /aml/dashboard
 *   GET    /aml/cases/:id
 *   POST   /aml/cases/:id/review
 *   GET    /aml/cases/:id/audit
 *   GET    /aml/documents/:id/file
 *   POST   /aml/cases/:id/screening   (PEP stub re-run)
 */
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { clientRecord } from "../domain/cases";
import { ensureAmlIndexes } from "../domain/aml";
import { clean, col, Doc } from "../db/mongo";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { validateUpload } from "../middleware/protections";
import {
  amlDashboard,
  amlGate,
  createAmlCase,
  decorateAmlCase,
  decorateAmlCaseForStaff,
  ensureAmlCase,
  exportAmlAudit,
  getAmlDocumentFile,
  listAmlCases,
  recordScreeningStub,
  reviewAmlCase,
  submitAmlCase,
  updateAmlProfile,
  uploadAmlDocument,
} from "../services/aml";

export const amlRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureAmlIndexes();
  ready = true;
}

async function clientOf(user: Doc): Promise<Doc> {
  const client = await clientRecord(user);
  if (!client) throw httpError(404, "Client record not found");
  return client;
}

const ProfileIn = z.object({
  date_of_birth: z.string().nullish(),
  residential_address: z.string().nullish(),
  country_of_residence: z.string().nullish(),
  occupation: z.string().nullish(),
  source_of_funds_note: z.string().nullish(),
  complexity_note: z.string().nullish(),
  client_type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  id_document_kind: z.enum(["PASSPORT", "DRIVING_LICENCE"]).nullish(),
});

const ReviewIn = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "REQUIRES_REUPLOAD"]),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  comments: z.string().nullish(),
  edd_required: z.boolean().optional(),
  reupload_message: z.string().nullish(),
  checklist: z.object({
    id_matches_client: z.boolean(),
    address_docs_valid_and_recent: z.boolean(),
    selfie_matches_id: z.boolean(),
    pep_sanctions_cleared: z.boolean().nullish(),
  }),
});

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

amlRouter.get(
  "/aml/me",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const client = await clientOf(authed(req));
    const amlCase = await ensureAmlCase(client, authed(req));
    const gate = await amlGate(client);
    const decorated = await decorateAmlCase(amlCase.id);
    delete decorated._documents_internal;
    res.json({
      ...gate,
      engagement_blocked_until_aml: !gate.ok,
      case: decorated,
      message: gate.ok
        ? null
        : "To comply with UK Anti-Money Laundering regulations, we must verify your identity and address.",
    });
  }),
);

amlRouter.get(
  "/aml/gate",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    res.json(await amlGate(await clientOf(authed(req))));
  }),
);

amlRouter.patch(
  "/aml/me/profile",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientOf(me);
    const amlCase = await ensureAmlCase(client, me);
    const body = parseBody(ProfileIn, req.body);
    const updated = await updateAmlProfile(amlCase.id, client, body, me);
    delete updated._documents_internal;
    res.json(updated);
  }),
);

amlRouter.post(
  "/aml/me/documents",
  auth("CLIENT"),
  upload.single("file"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientOf(me);
    const amlCase = await ensureAmlCase(client, me);
    const type = String((req.body as Doc)?.type || "");
    const file = req.file;
    if (!file) throw httpError(422, "file is required");
    validateUpload(file.mimetype, file.size, file.originalname);
    const updated = await uploadAmlDocument({
      caseId: amlCase.id,
      client,
      actor: me,
      type: type as never,
      file,
      notes: (req.body as Doc)?.notes ? String((req.body as Doc).notes) : null,
    });
    delete updated._documents_internal;
    res.status(201).json(updated);
  }),
);

amlRouter.post(
  "/aml/me/submit",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientOf(me);
    const amlCase = await ensureAmlCase(client, me);
    const updated = await submitAmlCase(amlCase.id, client, me);
    delete updated._documents_internal;
    res.json(updated);
  }),
);

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

amlRouter.get(
  "/aml/dashboard",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (_req, res) => {
    await boot();
    res.json(await amlDashboard());
  }),
);

amlRouter.get(
  "/aml/cases",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const str = (k: string) =>
      typeof req.query[k] === "string" && req.query[k] ? String(req.query[k]) : undefined;
    res.json(
      await listAmlCases({
        status: str("status"),
        pending: str("pending") === "1" || str("pending") === "true",
        overdue: str("overdue") === "1" || str("overdue") === "true",
      }),
    );
  }),
);

amlRouter.get(
  "/aml/cases/:id",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await decorateAmlCaseForStaff(req.params.id));
  }),
);

amlRouter.post(
  "/aml/cases/:id/review",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(ReviewIn, req.body);
    res.json(
      await reviewAmlCase(req.params.id, authed(req), {
        decision: body.decision,
        risk_level: body.risk_level,
        comments: body.comments,
        edd_required: body.edd_required,
        reupload_message: body.reupload_message,
        checklist: body.checklist,
      }),
    );
  }),
);

amlRouter.get(
  "/aml/cases/:id/audit",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await exportAmlAudit(req.params.id));
  }),
);

amlRouter.post(
  "/aml/cases/:id/screening",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const amlCase = await decorateAmlCaseForStaff(req.params.id);
    res.json(await recordScreeningStub(amlCase.id, amlCase.client_id, authed(req)));
  }),
);

amlRouter.post(
  "/aml/clients/:clientUserId/ensure",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const client = (await col("clients").findOne({
      user_id: req.params.clientUserId,
    })) as Doc | null;
    if (!client) throw httpError(404, "Client not found");
    res.status(201).json(await createAmlCase(clean(client) as Doc, { actor: authed(req) }));
  }),
);

amlRouter.get(
  "/aml/documents/:id/file",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const file = await getAmlDocumentFile(req.params.id, authed(req));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.fileName.replace(/"/g, "")}"`,
    );
    // TODO(security): add short-lived signed URLs instead of streaming through the API long-term.
    res.send(file.data);
  }),
);
