/**
 * Email Template Library API (Admin + Accountant).
 *
 *   GET    /email-templates?category=admin|accountant
 *   GET    /email-templates/:id
 *   GET    /email-templates/merge-suggestions?client_user_id=&case_id=
 *   POST   /email-templates/:id/preview
 *   POST   /email-templates/:id/send
 *   PATCH  /email-templates/:id          (admin only)
 *   GET    /email-templates/send-log
 */
import { Router } from "express";
import { z } from "zod";

import { ensureEmailTemplateIndexes, ensureEmailTemplates } from "../domain/emailTemplates";
import { handler, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import {
  getEmailTemplate,
  listEmailTemplates,
  listSendLog,
  normalizeMergeValues,
  previewTemplate,
  sendTemplateEmail,
  suggestMergeValues,
  updateEmailTemplate,
} from "../services/emailTemplates";

export const emailTemplatesRouter = Router();

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureEmailTemplateIndexes();
  await ensureEmailTemplates();
  ready = true;
}

const MergeIn = z.record(z.string().nullish()).optional();

const PreviewIn = z.object({
  merge_values: MergeIn,
});

const SendIn = z.object({
  client_user_id: z.string().min(1),
  case_id: z.string().nullish(),
  merge_values: MergeIn,
  subject_override: z.string().nullish(),
  body_override: z.string().nullish(),
});

const PatchIn = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

emailTemplatesRouter.get(
  "/email-templates",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const activeOnly = req.query.active !== "0";
    res.json(await listEmailTemplates(authed(req), { category, active_only: activeOnly }));
  }),
);

emailTemplatesRouter.get(
  "/email-templates/send-log",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const templateId =
      typeof req.query.template_id === "string" ? req.query.template_id : undefined;
    res.json(await listSendLog(authed(req), { template_id: templateId }));
  }),
);

emailTemplatesRouter.get(
  "/email-templates/merge-suggestions",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const str = (k: string) =>
      typeof req.query[k] === "string" && req.query[k] ? String(req.query[k]) : null;
    res.json(
      await suggestMergeValues({
        actor: authed(req),
        client_user_id: str("client_user_id"),
        client_id: str("client_id"),
        case_id: str("case_id"),
      }),
    );
  }),
);

emailTemplatesRouter.get(
  "/email-templates/:id",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await getEmailTemplate(req.params.id, authed(req)));
  }),
);

emailTemplatesRouter.post(
  "/email-templates/:id/preview",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(PreviewIn, req.body);
    const template = await getEmailTemplate(req.params.id, authed(req));
    const merge = normalizeMergeValues(
      (body.merge_values || {}) as Record<string, string | null | undefined>,
    );
    res.json({ template_id: template.id, ...previewTemplate(template, merge), merge_values: merge });
  }),
);

emailTemplatesRouter.post(
  "/email-templates/:id/send",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(SendIn, req.body);
    res.json(
      await sendTemplateEmail({
        actor: authed(req),
        template_id: req.params.id,
        client_user_id: body.client_user_id,
        case_id: body.case_id,
        merge_values: body.merge_values as Record<string, string> | undefined,
        subject_override: body.subject_override,
        body_override: body.body_override,
      }),
    );
  }),
);

emailTemplatesRouter.patch(
  "/email-templates/:id",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(PatchIn, req.body);
    res.json(await updateEmailTemplate(authed(req), req.params.id, body));
  }),
);
