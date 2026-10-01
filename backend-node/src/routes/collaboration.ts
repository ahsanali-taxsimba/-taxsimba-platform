/** Case conversation, internal notes, audit trail and notifications. */
import { randomUUID } from "crypto";

import { Request, Router } from "express";
import { z } from "zod";

import { clean, cleanMany, col, Doc, scrubMany } from "../db/mongo";
import { getCase, ownedCaseIds } from "../domain/cases";
import { logActivity, notify, nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";

export const collaborationRouter = Router();

const MessageIn = z.object({
  case_id: z.string(),
  body: z.string(),
  recipient_id: z.string().nullish().default(null),
});
const NoteIn = z.object({ body: z.string() });

function str(req: Request, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === "string" && v.length ? v : undefined;
}

// ---------------------------------------------------------------- messages
collaborationRouter.get(
  "/messages",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const caseId = str(req, "case_id");
    if (!caseId) {
      throw httpError(422, [{ loc: ["query", "case_id"], msg: "field required", type: "missing" }]);
    }
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
    res.json(scrubMany(cleanMany(msgs), me));
  }),
);

collaborationRouter.post(
  "/messages",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(MessageIn, req.body);
    const kase = await getCase(body.case_id, me);
    const recipient =
      body.recipient_id ??
      (me.role === "CLIENT" ? kase.assigned_accountant_id : kase.client_user_id);
    const msg: Doc = {
      id: randomUUID(),
      case_id: body.case_id,
      sender_id: me.id,
      sender_name: me.name,
      sender_role: me.role,
      recipient_id: recipient ?? null,
      body: body.body,
      is_read: false,
      created_at: nowIso(),
    };
    await col("messages").insertOne({ ...msg });
    await logActivity(body.case_id, "Message sent", me);
    if (recipient) {
      const recipientUser = await col("users").findOne({ id: recipient }, { projection: { role: 1 } });
      // Staff open the exact case conversation; the client's own thread lives on Messages.
      const link = recipientUser?.role === "CLIENT" ? "/messages" : `/work/cases/${body.case_id}`;
      await notify(
        recipient,
        `New message from ${me.name}`,
        body.body.slice(0, 120),
        body.case_id,
        link,
        "MESSAGE",
      );
    }
    if (
      me.role === "CLIENT" &&
      ["ASSIGNED", "ACCOUNTANT_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUIRED"].includes(kase.status)
    ) {
      // A new client message needs a human response -- put this case in the accountant's
      // "Needs My Action" queue without touching any other case. Cases already past
      // preparation (approved / ready for submission) keep their own next action.
      await col("cases").updateOne(
        { id: body.case_id },
        {
          $set: {
            next_action_owner: "ACCOUNTANT",
            next_action: "Reply to the client's message",
            last_updated: nowIso(),
          },
        },
      );
    }
    res.json(clean(msg));
  }),
);

// ---------------------------------------------------------------- notes / audit
collaborationRouter.get(
  "/cases/:caseId/notes",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const notes = (await col("internal_notes")
      .find({ case_id: req.params.caseId })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(notes), me));
  }),
);

collaborationRouter.post(
  "/cases/:caseId/notes",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    const body = parseBody(NoteIn, req.body);
    await getCase(req.params.caseId, me);
    const note: Doc = {
      id: randomUUID(),
      case_id: req.params.caseId,
      body: body.body,
      author_id: me.id,
      author_name: me.name,
      author_role: me.role,
      created_at: nowIso(),
    };
    await col("internal_notes").insertOne({ ...note });
    await logActivity(req.params.caseId, "Internal note added", me);
    res.json(clean(note));
  }),
);

/**
 * Staff-only. The raw log carries internal comments and staff-only events, so a client must
 * never read it -- clients follow their case through their own journey screens.
 */
collaborationRouter.get(
  "/cases/:caseId/activity",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const logs = (await col("activity_logs")
      .find({ case_id: req.params.caseId })
      .sort({ created_at: -1 })
      .limit(500)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(logs), me));
  }),
);

collaborationRouter.get(
  "/cases/:caseId/reviews",
  auth("ACCOUNTANT", "ADMIN", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const me = authed(req);
    await getCase(req.params.caseId, me);
    const reviews = (await col("reviews")
      .find({ case_id: req.params.caseId })
      .sort({ submitted_at: -1 })
      .limit(100)
      .toArray()) as Doc[];
    res.json(scrubMany(cleanMany(reviews), me));
  }),
);

// ---------------------------------------------------------------- notifications
async function notificationsFor(me: Doc): Promise<Doc[]> {
  const query: Doc = { user_id: me.id };
  if (me.role === "CLIENT") {
    // Belt and braces: a notification must belong to this client AND reference either no
    // case or a case they actually own.
    const owned = await ownedCaseIds(me);
    query.$or = [{ case_id: null }, { case_id: { $in: owned } }];
  }
  let items = (await col("notifications")
    .find(query)
    .sort({ created_at: -1 })
    .limit(200)
    .toArray()) as Doc[];
  if (["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(me.role)) {
    // Notifications raised by automated-test cases must not clutter operational staff views.
    const testIds = new Set(
      (await col("cases").find({ is_test: true }, { projection: { id: 1 } }).toArray()).map(
        (c) => c.id as string,
      ),
    );
    items = items.filter((i) => !i.case_id || !testIds.has(i.case_id)).slice(0, 100);
  } else {
    items = items.slice(0, 100);
  }
  return scrubMany(cleanMany(items), me);
}

collaborationRouter.get(
  "/notifications",
  auth(),
  handler(async (req, res) => {
    res.json(await notificationsFor(authed(req)));
  }),
);

collaborationRouter.get(
  "/notifications/unread-count",
  auth(),
  handler(async (req, res) => {
    const items = await notificationsFor(authed(req));
    res.json({ count: items.filter((n) => !n.is_read).length });
  }),
);

collaborationRouter.post(
  "/notifications/read-all",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await col("notifications").updateMany({ user_id: me.id }, { $set: { is_read: true } });
    res.json({ ok: true });
  }),
);

collaborationRouter.post(
  "/notifications/:notificationId/read",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    await col("notifications").updateOne(
      { id: req.params.notificationId, user_id: me.id },
      { $set: { is_read: true } },
    );
    res.json({ ok: true });
  }),
);
