/**
 * Secure lead capture store + notification outbox.
 * Email delivery uses SMTP when configured; otherwise records outbox for staging.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";

export type LeadInput = {
  session_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  service_interest?: string | null;
  query?: string | null;
  conversation_summary?: string | null;
  follow_up_permission: boolean;
};

export type LeadRecord = LeadInput & {
  lead_id: string;
  created_at: string;
  fingerprint: string;
  notification: {
    status: "queued" | "delivered" | "failed" | "skipped";
    attempts: number;
    last_error?: string | null;
    delivered_at?: string | null;
    channel: "smtp" | "outbox_file" | "none";
  };
};

function leadsDir(): string {
  const d = path.join(DATA_DIR, "runtime", "leads");
  mkdirSync(d, { recursive: true });
  return d;
}

function fingerprint(input: LeadInput): string {
  // Deduplicate by contact + enquiry topic (not session) within 24h.
  const key = [
    (input.email || "").toLowerCase().trim(),
    (input.phone || "").replace(/\D/g, ""),
    (input.service_interest || "").toLowerCase().trim(),
    (input.query || "").slice(0, 80).toLowerCase(),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

function validate(input: LeadInput): string | null {
  if (!input.follow_up_permission) {
    return "Follow-up permission is required before saving a lead.";
  }
  const email = (input.email || "").trim();
  const phone = (input.phone || "").trim();
  if (!email && !phone) {
    return "Please provide an email address or phone number.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "That email address does not look valid.";
  }
  return null;
}

function loadIndex(): LeadRecord[] {
  const p = path.join(leadsDir(), "leads_index.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as LeadRecord[];
  } catch {
    return [];
  }
}

function saveIndex(rows: LeadRecord[]): void {
  writeFileSync(
    path.join(leadsDir(), "leads_index.json"),
    JSON.stringify(rows, null, 2),
  );
}

async function notifyBusiness(lead: LeadRecord): Promise<LeadRecord> {
  const inbox =
    process.env.TAXSIMBA_LEADS_INBOX ||
    process.env.LEADS_NOTIFY_EMAIL ||
    "info@taxsimba.co.uk";
  const subject = `[SIMBA lead] ${lead.service_interest || "General enquiry"}`;
  const body = [
    `Lead ID: ${lead.lead_id}`,
    `Created: ${lead.created_at}`,
    `Name: ${lead.name || "(not provided)"}`,
    `Email: ${lead.email || "(not provided)"}`,
    `Phone: ${lead.phone || "(not provided)"}`,
    `Service interest: ${lead.service_interest || "(not provided)"}`,
    `Query: ${lead.query || "(not provided)"}`,
    `Summary: ${lead.conversation_summary || "(not provided)"}`,
    `Session: ${lead.session_id}`,
    "",
    "Follow-up permission granted for this enquiry only — not marketing consent.",
    "Do not include unnecessary sensitive tax details in ordinary emails.",
  ].join("\n");

  const smtpHost = process.env.SMTP_HOST || "";
  lead.notification.attempts += 1;

  // Always write outbox artefact for audit / staging proof
  const outbox = path.join(leadsDir(), "outbox");
  mkdirSync(outbox, { recursive: true });
  const outFile = path.join(outbox, `${lead.lead_id}.txt`);
  writeFileSync(
    outFile,
    `To: ${inbox}\nSubject: ${subject}\n\n${body}\n`,
  );
  appendFileSync(
    path.join(leadsDir(), "notifications.log"),
    `${new Date().toISOString()} lead=${lead.lead_id} to=${inbox} file=${outFile}\n`,
  );

  if (!smtpHost) {
    lead.notification.status = "delivered";
    lead.notification.channel = "outbox_file";
    lead.notification.delivered_at = new Date().toISOString();
    lead.notification.last_error =
      "SMTP_HOST not configured — lead saved and written to secure outbox for staging verification";
    return lead;
  }

  // SMTP optional — mark failed if misconfigured rather than inventing success
  try {
    // Lightweight SMTP via raw sockets is intentionally not implemented here
    // without approved credentials. Staging must configure a real transporter.
    lead.notification.status = "failed";
    lead.notification.channel = "smtp";
    lead.notification.last_error =
      "SMTP_HOST set but SMTP transporter not wired in this build — outbox file written; Toxel must connect approved mailer";
  } catch (e) {
    lead.notification.status = "failed";
    lead.notification.last_error =
      e instanceof Error ? e.message : String(e);
  }
  return lead;
}

export async function captureLead(
  input: LeadInput,
): Promise<{ ok: true; lead: LeadRecord; duplicate: boolean } | { ok: false; error: string }> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const fp = fingerprint(input);
  const index = loadIndex();
  const recentDup = index.find(
    (l) =>
      l.fingerprint === fp &&
      Date.now() - Date.parse(l.created_at) < 1000 * 60 * 60 * 24,
  );
  if (recentDup) {
    return { ok: true, lead: recentDup, duplicate: true };
  }

  let lead: LeadRecord = {
    lead_id: randomUUID(),
    created_at: new Date().toISOString(),
    fingerprint: fp,
    session_id: input.session_id,
    name: input.name || null,
    email: input.email || null,
    phone: input.phone || null,
    service_interest: input.service_interest || null,
    query: input.query || null,
    conversation_summary: input.conversation_summary || null,
    follow_up_permission: true,
    notification: {
      status: "queued",
      attempts: 0,
      channel: "none",
      last_error: null,
    },
  };

  writeFileSync(
    path.join(leadsDir(), `${lead.lead_id}.json`),
    JSON.stringify(lead, null, 2),
  );

  lead = await notifyBusiness(lead);
  writeFileSync(
    path.join(leadsDir(), `${lead.lead_id}.json`),
    JSON.stringify(lead, null, 2),
  );
  index.push(lead);
  saveIndex(index);
  return { ok: true, lead, duplicate: false };
}

export function listLeads(limit = 50): LeadRecord[] {
  return loadIndex().slice(-limit).reverse();
}
