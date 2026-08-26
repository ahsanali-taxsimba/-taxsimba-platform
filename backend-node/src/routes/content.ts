/**
 * Configurable customer-facing wording. Additive routes only: no existing endpoint, contract
 * or frontend journey changes. Reads are open to any signed-in user so client screens can
 * adopt a key later; every write is SUPER_ADMIN-only, allow-listed and audited.
 */
import { Router } from "express";
import { z } from "zod";

import { cleanMany } from "../db/mongo";
import {
  CONTENT_DEFAULTS,
  CONTENT_GROUPS,
  contentEntries,
  contentHistory,
  contentMap,
  isEditableKey,
  resetContent,
  setContent,
} from "../domain/content";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const contentRouter = Router();

const ContentIn = z.object({ value: z.string() });

/** Effective wording for every allow-listed key: defaults merged with any override. */
contentRouter.get(
  "/content",
  auth(),
  handler(async (_req, res) => {
    res.json(await contentMap());
  }),
);

/** Management view: default, current value, whether it is overridden, and its group. */
contentRouter.get(
  "/content/settings",
  auth("SUPER_ADMIN"),
  handler(async (_req, res) => {
    res.json({ groups: [...CONTENT_GROUPS], entries: await contentEntries() });
  }),
);

contentRouter.put(
  "/content/:key",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const key = req.params.key;
    if (!isEditableKey(key)) throw httpError(404, "This content key is not editable");
    const body = parseBody(ContentIn, req.body);
    let value: string;
    try {
      value = await setContent(key, body.value, me);
    } catch (e) {
      throw httpError(400, String((e as Error).message));
    }
    res.json({ key, value, default_value: CONTENT_DEFAULTS[key].value, is_overridden: true });
  }),
);

/** Revert to the code default. The default is never deleted, so nothing can go blank. */
contentRouter.delete(
  "/content/:key",
  auth("SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const key = req.params.key;
    if (!isEditableKey(key)) throw httpError(404, "This content key is not editable");
    const value = await resetContent(key, me);
    res.json({ key, value, default_value: value, is_overridden: false });
  }),
);

contentRouter.get(
  "/content/:key/history",
  auth("ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = req.params.key;
    if (!isEditableKey(key)) throw httpError(404, "This content key is not editable");
    res.json(cleanMany(await contentHistory(key)));
  }),
);
