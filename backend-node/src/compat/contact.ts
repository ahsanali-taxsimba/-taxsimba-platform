/**
 * Public Contact Us compatibility adapter.
 *
 * Frontend contract (tax_simba_frontend submitContacts.js):
 *   POST /api/compat/contact-us
 *   body: { name, email, phoneNumber, message }
 *   expects envelope { success, data, message }
 *
 * Uses the existing queueEmail delivery channel. Does not invent a new storage system.
 */

import { createHash, randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { handler, httpError, parseBody } from "../http/errors";
import { emailEnabled, queueEmail } from "../services/email";
import { keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";

const ContactIn = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Valid email is required").max(320),
  phone_number: z.string().trim().min(5, "Phone number is required").max(40),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

/** Prefer dedicated inbox, then reply-to, then the address inside EMAIL_FROM. */
function contactInbox(): string | null {
  const dedicated = env("CONTACT_TO") ?? env("EMAIL_REPLY_TO");
  if (dedicated && dedicated.includes("@")) return dedicated.trim();
  const from = env("EMAIL_FROM") ?? "";
  const angle = from.match(/<([^>]+)>/);
  if (angle?.[1]?.includes("@")) return angle[1].trim();
  if (from.includes("@") && !from.includes("<")) return from.trim();
  return null;
}

function sanitizeLine(value: string): string {
  return value.replace(/[\r\n\u0000]/g, " ").trim();
}

export const compatContactRouter = Router();

compatContactRouter.post(
  "/contact-us",
  handler(async (req, res) => {
    const body = parseBody(ContactIn, keysToSnake(req.body ?? {}));
    const name = sanitizeLine(body.name);
    const email = sanitizeLine(body.email).toLowerCase();
    const phone = sanitizeLine(body.phone_number);
    const message = body.message.trim();

    if (!emailEnabled()) {
      throw httpError(
        503,
        "Contact form email delivery is not configured. Please try again later or call support.",
      );
    }

    const inbox = contactInbox();
    if (!inbox) {
      throw httpError(
        503,
        "Contact form email delivery is not configured. Please try again later or call support.",
      );
    }

    const dedupeKey = `contact-us:${createHash("sha256")
      .update(`${email}|${phone}|${message}|${new Date().toISOString().slice(0, 13)}`)
      .digest("hex")}`;

    const queued = await queueEmail({
      to: inbox,
      recipientName: "TaxSimba Support",
      kind: "CONTACT_US",
      subject: `Contact Us: ${name}`,
      title: "New contact form submission",
      body:
        `A visitor submitted the TaxSimba contact form.\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Phone: ${phone}\n\n` +
        `Message:\n${message}`,
      preheader: "New website contact form message",
      dedupeKey,
      userId: null,
      caseId: null,
    });

    if (!queued) {
      throw httpError(
        503,
        "Unable to send your message right now. Please try again later or call support.",
      );
    }

    sendCompatSuccess(
      res,
      { id: randomUUID(), received: true },
      "Thank you for contacting us. We have received your message.",
      200,
    );
  }),
);
