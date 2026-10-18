/**
 * Tax Return Document Intake API.
 *
 *   GET    /intake/cases/:caseId
 *   POST   /intake/cases/:caseId/ensure
 *   POST   /intake/categories/:id/upload
 *   PATCH  /intake/categories/:id
 *   GET    /intake/files/:id
 *   POST   /intake/categories/:id/request-alternative
 *   GET    /intake/dashboard
 *   GET    /intake/me?tax_year=
 */
import { Router } from "express";
import { z } from "zod";

import { clientRecord } from "../domain/cases";
import { ensureIntakeIndexes } from "../domain/taxReturnIntake";
import { clean, col, Doc } from "../db/mongo";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { uploadMiddleware, validateUpload } from "../middleware/protections";
import { requestAlternativeDocument } from "../services/fileScan";
import {
  ensureTaxReturnIntake,
  getIntakeFile,
  getIntakeForCase,
  intakeDashboard,
  updateCategoryStatus,
  uploadToCategory,
} from "../services/taxReturnIntake";

export const taxReturnIntakeRouter = Router();
const upload = uploadMiddleware();

let ready = false;
async function boot(): Promise<void> {
  if (ready) return;
  await ensureIntakeIndexes();
  ready = true;
}

const CategoryPatchIn = z.object({
  status: z
    .enum(["NOT_UPLOADED", "UPLOADED", "VERIFIED", "NOT_APPLICABLE", "AWAITING_REPLACEMENT"])
    .optional(),
  accountant_notes: z.string().nullish(),
});

const RequestAltIn = z.object({
  message: z.string().nullish(),
  file_id: z.string().nullish(),
});

taxReturnIntakeRouter.get(
  "/intake/dashboard",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await intakeDashboard(authed(req)));
  }),
);

taxReturnIntakeRouter.get(
  "/intake/cases/:caseId",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    res.json(await getIntakeForCase(req.params.caseId, authed(req)));
  }),
);

taxReturnIntakeRouter.post(
  "/intake/cases/:caseId/ensure",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "CLIENT"),
  handler(async (req, res) => {
    await boot();
    res.status(201).json(await getIntakeForCase(req.params.caseId, authed(req)));
  }),
);

taxReturnIntakeRouter.get(
  "/intake/me",
  auth("CLIENT"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const client = await clientRecord(me);
    if (!client) throw httpError(404, "Client record not found");
    const taxYear =
      typeof req.query.tax_year === "string" && req.query.tax_year
        ? req.query.tax_year
        : null;
    const kase = (await col("cases").findOne(
      {
        client_id: client.id,
        service_type: "SELF_ASSESSMENT",
        ...(taxYear ? { tax_year: taxYear } : {}),
      },
      { sort: { created_at: -1 } },
    )) as Doc | null;
    if (!kase) {
      // No case yet — still allow a year-scoped intake shell.
      const year = taxYear || "2025/26";
      res.json(
        await ensureTaxReturnIntake({
          client: clean(client) as Doc,
          tax_year: year,
          case_id: null,
          actor: me,
        }),
      );
      return;
    }
    res.json(await getIntakeForCase(kase.id as string, me));
  }),
);

taxReturnIntakeRouter.post(
  "/intake/categories/:id/upload",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  upload.single("file"),
  handler(async (req, res) => {
    await boot();
    const file = req.file;
    if (!file) throw httpError(422, "file is required");
    validateUpload(file.mimetype, file.size, file.originalname);
    res.status(201).json(
      await uploadToCategory({
        categoryId: req.params.id,
        actor: authed(req),
        file,
      }),
    );
  }),
);

taxReturnIntakeRouter.patch(
  "/intake/categories/:id",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const body = parseBody(CategoryPatchIn, req.body);
    res.json(
      await updateCategoryStatus({
        categoryId: req.params.id,
        actor: authed(req),
        status: body.status,
        accountant_notes: body.accountant_notes,
      }),
    );
  }),
);

taxReturnIntakeRouter.post(
  "/intake/categories/:id/request-alternative",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const me = authed(req);
    const body = parseBody(RequestAltIn, req.body);
    const category = (await col("tax_return_document_categories").findOne({
      id: req.params.id,
    })) as Doc | null;
    if (!category) throw httpError(404, "Document category not found");
    if (!category.client_user_id) throw httpError(400, "Category has no linked client user");
    res.json(
      await requestAlternativeDocument({
        actor: me,
        case_id: category.case_id ?? null,
        client_user_id: category.client_user_id,
        client_id: category.client_id,
        category_label: category.category_name,
        category_id: category.id,
        file_id: body.file_id ?? null,
        source: "intake",
        message: body.message,
      }),
    );
  }),
);

taxReturnIntakeRouter.get(
  "/intake/files/:id",
  auth("CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    await boot();
    const confirmRisk = ["1", "true", "yes"].includes(
      String(req.query.confirm_risk || "").toLowerCase(),
    );
    const file = await getIntakeFile(req.params.id, authed(req), { confirmRisk });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.fileName.replace(/"/g, "")}"`,
    );
    res.send(file.data);
  }),
);
