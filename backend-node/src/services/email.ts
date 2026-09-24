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

/**
 * Absolute HTTPS logo for email clients (Gmail/Outlook/mobile).
 * Prefer EMAIL_LOGO_URL when set; otherwise `{APP_BASE_URL}/images/logo.png`.
 * PNG only — SVG is blocked or broken in major email clients.
 */
export function emailLogoUrl(): string {
  const override = (env("EMAIL_LOGO_URL") ?? "").trim();
  if (/^https:\/\//i.test(override)) {
    return override.replace(/\/+$/, "");
  }
  const base = appUrl() || "https://taxsimba.co.uk";
  return `${base}/images/logo.png`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Shared TaxSimba transactional email layout.
 *
 * Brand tokens are taken from the live client product (`tax_simba_frontend`):
 *   primary  #37a267  (--theme-color)
 *   accent   #b3ed97  (--theme-lt-color)
 *   deep     #32915c / #2e8a56 (existing green gradient stops)
 *   text     #222222 / #151515
 *   logo     emailLogoUrl() — public HTTPS PNG (never SVG; never localhost)
 *   legal    /privacy-policy, /terms-and-conditions, /contact-us
 *
 * `title` is the on-page heading. Optional `subject` overrides the email subject line
 * without changing how callers pass heading/body copy.
 */
export function renderEmail(params: {
  recipientName?: string | null;
  /** Email subject line; defaults to `title` when omitted. */
  subject?: string | null;
  title: string;
  body: string;
  link?: string | null;
  callToAction?: string | null;
  preheader?: string | null;
}): { subject: string; text: string; html: string } {
  const base = appUrl() || "https://taxsimba.co.uk";
  const href = params.link
    ? params.link.startsWith("http")
      ? params.link
      : `${base}${params.link}`
    : null;
  const cta = params.callToAction ?? "Open TaxSimba";
  const subject = (params.subject ?? params.title).trim();
  const greeting = params.recipientName ? `Hello ${params.recipientName},` : "Hello,";
  const year = new Date().getFullYear();
  const privacyUrl = `${base}/privacy-policy`;
  const termsUrl = `${base}/terms-and-conditions`;
  const contactUrl = `${base}/contact-us`;
  const logoUrl = emailLogoUrl();

  const bodyParagraphs = params.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const textLines: string[] = [greeting, ""];
  for (let i = 0; i < bodyParagraphs.length; i += 1) {
    if (i > 0) textLines.push("");
    textLines.push(bodyParagraphs[i]);
  }
  if (href) textLines.push("", `${cta}: ${href}`);
  textLines.push(
    "",
    "TaxSimba",
    "Simple tax. Expert support.",
    "",
    "This is a service notification about your TaxSimba account.",
    `Privacy Policy: ${privacyUrl}`,
    `Terms & Conditions: ${termsUrl}`,
    `Contact Support: ${contactUrl}`,
    "",
    "Please do not send passwords, payment card details, or sensitive tax documents by email. Use your secure TaxSimba account instead.",
    "",
    `© ${year} TaxSimba Group Limited. All rights reserved.`,
  );

  const htmlBody = bodyParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#222222">${escapeHtml(p)}</p>`,
    )
    .join("");

  const htmlCta = href
    ? [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px">`,
        `<tr><td align="center" bgcolor="#37a267" style="border-radius:50px;background-color:#37a267">`,
        `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:Geist,Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px">${escapeHtml(cta)}</a>`,
        `</td></tr></table>`,
      ].join("")
    : "";

  const preheader = params.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(params.preheader)}</div>`
    : "";

  const html = [
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background-color:#f4f7f5;font-family:Geist,Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#222222">`,
    preheader,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7f5;padding:24px 12px">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3ebe6">`,
    // Header
    `<tr><td style="padding:24px 32px;background:linear-gradient(135deg,#37a267 0%,#32915c 50%,#2e8a56 100%);background-color:#37a267">`,
    `<img src="${escapeHtml(logoUrl)}" width="160" height="43" alt="TaxSimba" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:160px"/>`,
    `</td></tr>`,
    // Accent strip
    `<tr><td style="height:4px;background-color:#b3ed97;font-size:0;line-height:0">&nbsp;</td></tr>`,
    // Body
    `<tr><td style="padding:32px">`,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#222222">${escapeHtml(greeting)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#151515">${escapeHtml(params.title)}</h1>`,
    htmlBody,
    htmlCta,
    `</td></tr>`,
    // Footer
    `<tr><td style="padding:24px 32px;background-color:#f7faf8;border-top:1px solid #e3ebe6">`,
    `<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#37a267">TaxSimba</p>`,
    `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5a6b62">Simple tax. Expert support.</p>`,
    `<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#5a6b62">This is a service notification about your TaxSimba account.</p>`,
    `<p style="margin:0 0 12px;font-size:12px;line-height:1.5">`,
    `<a href="${escapeHtml(privacyUrl)}" style="color:#37a267;text-decoration:underline">Privacy Policy</a>`,
    `<span style="color:#9aaba2"> · </span>`,
    `<a href="${escapeHtml(termsUrl)}" style="color:#37a267;text-decoration:underline">Terms &amp; Conditions</a>`,
    `<span style="color:#9aaba2"> · </span>`,
    `<a href="${escapeHtml(contactUrl)}" style="color:#37a267;text-decoration:underline">Contact Support</a>`,
    `</p>`,
    `<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#5a6b62">Please do not send passwords, payment card details, or sensitive tax documents by email. Use your secure TaxSimba account instead.</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#5a6b62">&copy; ${year} TaxSimba Group Limited. All rights reserved.</p>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join("");

  return { subject, text: textLines.join("\n"), html };
}

export interface QueueParams {
  to: string;
  recipientName?: string | null;
  kind: string;
  /** On-page heading inside the email card. */
  title: string;
  body: string;
  /** Optional subject-line override; defaults to `title`. */
  subject?: string | null;
  link?: string | null;
  callToAction?: string | null;
  preheader?: string | null;
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
/** Presentation helpers for notification-driven emails (subject stays notification.title). */
function emailHeadingFor(notification: Doc): string {
  const type = String(notification.type ?? "INFO");
  const title = String(notification.title ?? "");
  const link = String(notification.link ?? "");
  if (type === "MESSAGE") return "You have a new TaxSimba message";
  if (type === "DOCUMENT") {
    if (/final documents/i.test(title)) return "Your documents are ready";
    return "We need a document from you";
  }
  if (type === "TASK") {
    if (/still needed/i.test(title) || /action needed:/i.test(title)) return "Action needed on your TaxSimba account";
    if (/waiting for information/i.test(title)) return "We're waiting for information from you";
    return "We need some information from you";
  }
  if (type === "PAYMENT") {
    if (/reminder/i.test(title)) return "Your payment request is still outstanding";
    return "Additional work requires your approval";
  }
  if (type === "RECEIPT") return "Payment received";
  if (type === "DEADLINE") return "Your MTD deadline is approaching";
  if (type === "APPROVAL") {
    if (/mtd/i.test(title) || link.includes("/mtd")) return "Your MTD figures need approval";
    return "Your tax calculation is ready";
  }
  if (type === "REVIEW") {
    if (/ready to approve/i.test(title) || /figures are ready/i.test(title)) return "Your MTD figures are ready for approval";
    if (/approve your/i.test(title)) return "Your MTD figures need approval";
    return "Please review your TaxSimba account";
  }
  if (type === "SUBMISSION") {
    if (/mtd/i.test(title) || link.includes("/mtd")) return "Your MTD update has been submitted";
    return "Submission confirmed";
  }
  if (type === "UPLOAD") return "We need a document for your MTD period";
  if (type === "RECOMMENDATION") return "A service has been recommended";
  if (type === "INFO") {
    if (/being corrected|updating your mtd/i.test(title)) return "Your accountant is making an update";
    if (/self assessment is complete|is complete/i.test(title)) return "Your tax return is complete";
    if (/final documents/i.test(title)) return "Your documents are ready";
    if (/service issue has been resolved/i.test(title)) return "Your service issue has been resolved";
    if (/update on your service issue|update on your taxsimba service/i.test(title)) return "Update on your TaxSimba service";
    return "Update from TaxSimba";
  }
  return title || "Update from TaxSimba";
}

function emailCtaFor(notification: Doc): string {
  const type = String(notification.type ?? "INFO");
  const title = String(notification.title ?? "");
  const link = String(notification.link ?? "");
  if (type === "MESSAGE") return "View message securely";
  if (type === "DOCUMENT") {
    if (/final documents/i.test(title)) return "View my documents";
    return "Upload document";
  }
  if (type === "TASK") {
    if (/still needed|action needed:/i.test(title)) return "Complete task";
    if (/waiting for information/i.test(title)) return "View outstanding items";
    return "View request";
  }
  if (type === "PAYMENT") {
    if (/reminder/i.test(title)) return "Review payment request";
    return "Review & pay securely";
  }
  if (type === "RECEIPT") return "View receipt";
  if (type === "DEADLINE") return "Review my MTD account";
  if (type === "APPROVAL") {
    if (/mtd/i.test(title) || link.includes("/mtd")) return "Review figures";
    return "Review my tax return";
  }
  if (type === "REVIEW") {
    if (link.includes("/mtd")) return "Review MTD figures";
    return "Review tax return";
  }
  if (type === "SUBMISSION") {
    if (/mtd/i.test(title) || link.includes("/mtd")) return "View MTD status";
    return "View my tax return";
  }
  if (type === "UPLOAD") return "Open MTD";
  if (type === "RECOMMENDATION") return "Review recommendation";
  if (type === "INFO") {
    if (/being corrected|updating your mtd/i.test(title) || link.includes("/mtd")) return "View MTD status";
    if (/complete/i.test(title)) return "View my account";
    if (/final documents/i.test(title) || link.includes("/documents")) return "View my documents";
    if (/service issue/i.test(title)) return "View service issue";
    return "Open TaxSimba";
  }
  return "Open TaxSimba";
}

export async function emailNotification(notification: Doc): Promise<void> {
  try {
    if (!emailEnabled()) return;
    const user = (await col("users").findOne({ id: notification.user_id })) as Doc | null;
    if (!user || user.is_active === false || !user.email) return;
    if (!(await emailAllowed(user, notification.type ?? "INFO"))) return;
    const subject = String(notification.title ?? "Update from TaxSimba");
    const heading = emailHeadingFor(notification);
    await queueEmail({
      to: user.email,
      recipientName: user.name,
      kind: `NOTIFICATION_${notification.type ?? "INFO"}`,
      subject,
      title: heading,
      body: String(notification.body ?? ""),
      link: notification.link ?? null,
      callToAction: emailCtaFor(notification),
      preheader: subject,
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
    subject: "Your TaxSimba account is ready",
    title: "Set up your TaxSimba account",
    body: staff
      ? `A TaxSimba staff account has been created for you.\n\nUse the secure link below to set your password and access your account.\n\nFor security, this link expires on ${params.expiresAt} and can only be used once.`
      : `An account has been created for you on TaxSimba.\n\nUse the secure link below to set your password and access your account.\n\nFor security, this link expires on ${params.expiresAt} and can only be used once.`,
    link: params.setupLink,
    callToAction: "Set my password",
    preheader: "Your TaxSimba account is ready to set up",
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
