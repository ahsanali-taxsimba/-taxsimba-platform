/**
 * Notifications compat adapters (P0 K.5 / baseline M2–M4).
 * Remap is_read ↔ read. DELETE remains HIDE/DEFER — no backend delete API.
 */
import { Router } from "express";

import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { ownedCaseIds } from "../domain/cases";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { sendCompatSuccess } from "./envelope";

export const compatNotificationsRouter = Router();

async function notificationsFor(me: Doc): Promise<Doc[]> {
  const query: Doc = { user_id: me.id };
  if (me.role === "CLIENT") {
    const owned = await ownedCaseIds(me);
    query.$or = [{ case_id: null }, { case_id: { $in: owned } }];
  }
  let items = (await col("notifications")
    .find(query)
    .sort({ created_at: -1 })
    .limit(200)
    .toArray()) as Doc[];
  if (["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(String(me.role))) {
    const testIds = new Set(
      (await col("cases").find({ is_test: true }, { projection: { id: 1 } }).toArray()).map(
        (c) => c.id as string,
      ),
    );
    items = items.filter((i) => !i.case_id || !testIds.has(i.case_id as string)).slice(0, 100);
  } else {
    items = items.slice(0, 100);
  }
  return scrubMany(cleanMany(items), me);
}

/** Map Node is_read → Toxel `read` (and keep isRead for camelCase consumers). */
function toToxelNotification(n: Doc): Doc {
  const read = Boolean(n.is_read ?? n.isRead ?? n.read);
  return {
    ...n,
    read,
    is_read: read,
    isRead: read,
  };
}

compatNotificationsRouter.post(
  "/all-notifications",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const page = Math.max(1, Number(body.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 10) || 10));
    const unreadOnly = body.unreadOnly === 1 || body.unreadOnly === true || body.unread_only;
    const type = String(body.type ?? "all").toLowerCase();
    const search = String(body.search ?? "").trim().toLowerCase();

    let items = (await notificationsFor(me)).map(toToxelNotification);
    if (unreadOnly) items = items.filter((n) => !n.read);
    if (type && type !== "all") {
      items = items.filter((n) => String(n.type ?? n.ntype ?? "").toLowerCase().includes(type));
    }
    if (search) {
      items = items.filter(
        (n) =>
          String(n.title ?? "")
            .toLowerCase()
            .includes(search) ||
          String(n.body ?? "")
            .toLowerCase()
            .includes(search),
      );
    }
    const unreadCount = (await notificationsFor(me)).filter((n) => !n.is_read).length;
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const slice = items.slice((page - 1) * limit, page * limit);

    sendCompatSuccess(
      res,
      {
        notifications: slice,
        pagination: { page, limit, pages, total, unreadCount },
        filters: { typeCounts: {} },
      },
      "OK",
    );
  }),
);

compatNotificationsRouter.patch(
  "/notifications/:notificationId/read",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const result = await col("notifications").updateOne(
      { id: req.params.notificationId, user_id: me.id },
      { $set: { is_read: true } },
    );
    if (!result.matchedCount) throw httpError(404, "Notification not found");
    sendCompatSuccess(res, { ok: true, read: true }, "OK");
  }),
);

compatNotificationsRouter.post(
  "/notifications/:notificationId/read",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const result = await col("notifications").updateOne(
      { id: req.params.notificationId, user_id: me.id },
      { $set: { is_read: true } },
    );
    if (!result.matchedCount) throw httpError(404, "Notification not found");
    sendCompatSuccess(res, { ok: true, read: true }, "OK");
  }),
);

compatNotificationsRouter.patch(
  "/notifications/mark-all-read",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await col("notifications").updateMany({ user_id: me.id }, { $set: { is_read: true } });
    sendCompatSuccess(res, { ok: true }, "OK");
  }),
);

compatNotificationsRouter.post(
  "/notifications/read-all",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await col("notifications").updateMany({ user_id: me.id }, { $set: { is_read: true } });
    sendCompatSuccess(res, { ok: true }, "OK");
  }),
);

/**
 * M4 HIDE/DEFER — explicitly refuse delete rather than inventing a backend API.
 * FE should hide the control; this endpoint remains a hard 405/404 if called.
 */
compatNotificationsRouter.delete(
  "/notifications/:notificationId",
  auth(),
  handler(async () => {
    throw httpError(405, "Notification delete is not available in P0");
  }),
);
