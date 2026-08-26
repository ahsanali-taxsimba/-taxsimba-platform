/**
 * Transactional email.
 *
 * Email is a delivery channel bolted onto the notification events that already exist -- it
 * never becomes a dependency of them. Every message is persisted in `email_messages` first
 * and delivered afterwards, so a provider outage degrades to "in-app notification only" and
 * the queued row is retried later instead of failing the user's request.
 *
 * Duplicate suppression is a unique index on `dedupe_key`: the same logical event can be
 * enqueued any number of times and only one message is ever created (and therefore sent).
 *
 * Configuration (environment variables only, never literals):
 *   EMAIL_DRIVER      none (default) | log | smtp | resend
 *   EMAIL_FROM        "TaxSimba <no-reply@taxsimba.co.uk>"
 *   EMAIL_REPLY_TO    optional
 *   APP_BASE_URL      absolute base for links in emails, e.g. https://taxsimba.co.uk
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD   (EMAIL_DRIVER=smtp)
 *   RESEND_API_KEY                                                (EMAIL_DRIVER=resend)
 *   EMAIL_MAX_ATTEMPTS  default 5
 */
import { createHash, randomUUID } from "crypto";

import { env, intEnv, required } from "../config/env";
import { col, Doc } from "../db/mongo";
import { isTestEmail } from "../domain/testdata";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Delivery is disabled: nothing is queued and in-app notifications are unaffected. */
class DisabledProvider implements EmailProvider {
  readonly name = "none";

  async send(): Promise<void> {
    throw new Error("Email delivery is disabled (EMAIL_DRIVER=none)");
  }
}

/** Development aid: records delivery in the log instead of contacting a provider. */
class LogProvider implements EmailProvider {
  readonly name = "log";

  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[email:log] to=${message.to} subject=${message.subject}`);
  }
}

class SmtpProvider implements EmailProvider {
  readonly name = "smtp";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transport: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getTransport(): Promise<any> {
    if (this.transport) return this.transport;
    // Imported lazily so deployments that do not use SMTP never load the driver.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodemailer = await import("nodemailer");
    this.transport = nodemailer.createTransport({
      host: required("SMTP_HOST"),
      port: intEnv("SMTP_PORT", 587),
      secure: (env("SMTP_SECURE") ?? "false").toLowerCase() === "true",
      auth: env("SMTP_USER")
        ? { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") }
        : undefined,
    });
    return this.transport;
  }

  async send(message: EmailMessage): Promise<void> {
    const transport = await this.getTransport();
    await transport.sendMail({
      from: required("EMAIL_FROM"),
      replyTo: env("EMAIL_REPLY_TO"),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${required("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: required("EMAIL_FROM"),
        reply_to: env("EMAIL_REPLY_TO"),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      throw new Error(`resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }
}

let provider: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (provider) return provider;
  const driver = (env("EMAIL_DRIVER") ?? "none").toLowerCase();
  if (driver === "none") provider = new DisabledProvider();
  else if (driver === "log") provider = new LogProvider();
  else if (driver === "smtp") provider = new SmtpProvider();
  else if (driver === "resend") provider = new ResendProvider();
  else throw new Error(`Unknown EMAIL_DRIVER '${driver}' (expected none, log, smtp or resend)`);
  return provider;
}

/** Test seam: lets suites inject a recording provider. */
export function setEmailProvider(custom: EmailProvider | null): void {
  provider = custom;
}

export function emailEnabled(): boolean {
  return emailProvider().name !== "none";
}

export async function ensureEmailIndexes(): Promise<void> {
  await col("email_messages").createIndex({ dedupe_key: 1 }, { unique: true });
  await col("email_messages").createIndex({ status: 1, next_attempt_at: 1 });
}

function appUrl(): string {
  return (env("APP_BASE_URL") ?? "").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One house layout for every message. The wording itself is the notification wording that
 * already exists, so email says exactly what the in-app notification says.
 */
export function renderEmail(params: {
  recipientName?: string | null;
  title: string;
  body: string;
  link?: string | null;
  callToAction?: string | null;
}): { subject: string; text: string; html: string } {
  const base = appUrl();
  const href = params.link ? (params.link.startsWith("http") ? params.link : `${base}${params.link}`) : null;
  const cta = params.callToAction ?? "Open TaxSimba";
  const greeting = params.recipientName ? `Hello ${params.recipientName},` : "Hello,";
  const textLines = [greeting, "", params.body];
  if (href) textLines.push("", `${cta}: ${href}`);
  textLines.push("", "TaxSimba", "This is an automated message — please do not reply.");
  const htmlLink = href
    ? `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#0F7B4F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta)}</a></p>`
    : "";
  const html = [
    `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1B2A22;max-width:560px">`,
    `<h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(params.title)}</h2>`,
    `<p style="margin:0 0 8px">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 8px;line-height:1.5">${escapeHtml(params.body)}</p>`,
    htmlLink,
    `<p style="font-size:12px;color:#6B7A72;margin-top:32px">TaxSimba — automated message, please do not reply.</p>`,
    `</div>`,
  ].join("");
  return { subject: params.title, text: textLines.join("\n"), html };
}

export interface QueueParams {
  to: string;
  recipientName?: string | null;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  callToAction?: string | null;
  /** Stable identity of the underlying event; the same key is never delivered twice. */
  dedupeKey: string;
  userId?: string | null;
  caseId?: string | null;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Persist a message and attempt delivery in the background. Never throws: callers are
 * request handlers whose primary job (the state change and the in-app notification) has
 * already succeeded.
 */
export async function queueEmail(params: QueueParams): Promise<string | null> {
  try {
    if (!emailEnabled()) return null;
    if (!params.to || !params.to.includes("@")) return null;
    // Seeded demo/QA addresses must never receive real mail.
    if (isTestEmail(params.to)) return null;
    const rendered = renderEmail(params);
    const id = randomUUID();
    const now = new Date();
    const doc: Doc = {
      id,
      dedupe_key: hashKey(params.dedupeKey),
      kind: params.kind,
      to: params.to,
      user_id: params.userId ?? null,
      case_id: params.caseId ?? null,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      status: "QUEUED",
      attempts: 0,
      last_error: null,
      next_attempt_at: now,
      created_at: now,
      sent_at: null,
    };
    try {
      await col("email_messages").insertOne(doc);
    } catch (e) {
      // Duplicate key: this event has already produced a message. Nothing to do.
      if ((e as Doc)?.code === 11000) return null;
      throw e;
    }
    void deliver(doc).catch(() => undefined);
    return id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`email queue failed (${params.kind}): ${String(e)}`);
    return null;
  }
}

/**
 * Notification type -> the client's existing notification preference key. Types absent from
 * this map (INFO, DEADLINE) are service notices and deadlines that are always delivered.
 * Preferences gate email only; the in-app notification is created either way.
 */
const PREFERENCE_FOR_TYPE: Record<string, string> = {
  MESSAGE: "accountant_message",
  DOCUMENT: "document_requested",
  TASK: "document_requested",
  REVIEW: "calculation_ready",
  APPROVAL: "approval_required",
  SUBMISSION: "submission_update",
  PAYMENT: "payment_update",
};

async function emailAllowed(user: Doc, ntype: string): Promise<boolean> {
  if (user.role !== "CLIENT") return true;
  const key = PREFERENCE_FOR_TYPE[ntype];
  if (!key) return true;
  const row = (await col("notification_preferences").findOne({ user_id: user.id })) as Doc | null;
  return (row?.preferences?.[key] ?? true) !== false;
}

/**
 * Email counterpart of an in-app notification. The notification id is the dedupe key, so the
 * collapsing already performed by `notify()` carries through to email unchanged.
 */
export async function emailNotification(notification: Doc): Promise<void> {
  try {
    if (!emailEnabled()) return;
    const user = (await col("users").findOne({ id: notification.user_id })) as Doc | null;
    if (!user || user.is_active === false || !user.email) return;
    if (!(await emailAllowed(user, notification.type ?? "INFO"))) return;
    await queueEmail({
      to: user.email,
      recipientName: user.name,
      kind: `NOTIFICATION_${notification.type ?? "INFO"}`,
      title: notification.title,
      body: notification.body,
      link: notification.link ?? null,
      dedupeKey: `notification:${notification.id}`,
      userId: user.id,
      caseId: notification.case_id ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`notification email skipped: ${String(e)}`);
  }
}

/** Invitations are the one email that has no in-app counterpart: the user cannot sign in yet. */
export async function emailInvitation(params: {
  to: string;
  name: string;
  role: string;
  setupLink: string;
  expiresAt: string;
  inviteId: string;
}): Promise<void> {
  const staff = params.role !== "CLIENT";
  await queueEmail({
    to: params.to,
    recipientName: params.name,
    kind: "INVITATION",
    title: staff ? "Your TaxSimba staff account" : "Your TaxSimba account",
    body:
      `An account has been created for you on TaxSimba. Use the link below to set your password ` +
      `and sign in. For security the link expires on ${params.expiresAt} and can only be used once.`,
    link: params.setupLink,
    callToAction: "Set your password",
    // Keyed on the invitation, so a reissued invitation sends a fresh email and a repeated
    // call for the same invitation does not.
    dedupeKey: `invite:${params.inviteId}`,
    userId: null,
  });
}

const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];

async function deliver(doc: Doc): Promise<boolean> {
  const attempt = (doc.attempts ?? 0) + 1;
  try {
    await emailProvider().send({
      to: doc.to,
      subject: doc.subject,
      text: doc.text,
      html: doc.html,
    });
    await col("email_messages").updateOne(
      { id: doc.id },
      { $set: { status: "SENT", attempts: attempt, sent_at: new Date(), last_error: null } },
    );
    return true;
  } catch (e) {
    const maxAttempts = intEnv("EMAIL_MAX_ATTEMPTS", 5);
    const exhausted = attempt >= maxAttempts;
    const backoff = RETRY_BACKOFF_MINUTES[Math.min(attempt - 1, RETRY_BACKOFF_MINUTES.length - 1)];
    await col("email_messages").updateOne(
      { id: doc.id },
      {
        $set: {
          status: exhausted ? "FAILED" : "QUEUED",
          attempts: attempt,
          last_error: String(e).slice(0, 500),
          next_attempt_at: new Date(Date.now() + backoff * 60_000),
        },
      },
    );
    return false;
  }
}

/**
 * Retry queued messages whose backoff has elapsed. Called by the reminder worker tick so a
 * provider outage heals itself without an operator replaying anything.
 */
export async function flushEmailQueue(limit = 50): Promise<{ sent: number; failed: number }> {
  if (!emailEnabled()) return { sent: 0, failed: 0 };
  const due = (await col("email_messages")
    .find({ status: "QUEUED", next_attempt_at: { $lte: new Date() } })
    .sort({ next_attempt_at: 1 })
    .limit(limit)
    .toArray()) as Doc[];
  let sent = 0;
  let failed = 0;
  for (const doc of due) {
    if (await deliver(doc)) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
