import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { captureLead, listLeads } from "../leads/store.js";
import { publicApiLimiter } from "../security/ratelimit.js";
import { zodValidate } from "./validate.js";

const LeadSchema = z.object({
  session_id: z.string().min(1).max(128),
  name: z.string().max(120).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  service_interest: z.string().max(120).optional().nullable(),
  query: z.string().max(2000).optional().nullable(),
  conversation_summary: z.string().max(4000).optional().nullable(),
  follow_up_permission: z.boolean(),
});

function limitPublic(req: Request, _res: Response, next: NextFunction) {
  try {
    publicApiLimiter.check(req.ip || "unknown");
    next();
  } catch (err) {
    next(err);
  }
}

export function leadsRouter(): Router {
  const r = Router();

  r.post("/leads", limitPublic, zodValidate(LeadSchema), async (req, res) => {
    const body = req.body as z.infer<typeof LeadSchema>;
    const result = await captureLead({
      session_id: body.session_id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      service_interest: body.service_interest,
      query: body.query,
      conversation_summary: body.conversation_summary,
      follow_up_permission: body.follow_up_permission,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(result.duplicate ? 200 : 201).json({
      lead_id: result.lead.lead_id,
      duplicate: result.duplicate,
      notification_status: result.lead.notification.status,
      notification_channel: result.lead.notification.channel,
      message: result.duplicate
        ? "We already have a recent enquiry with these details — a TaxSimba teammate will follow up."
        : "Thanks — your enquiry has been saved. A TaxSimba teammate will follow up using the details you shared.",
    });
  });

  // Ops-only listing is gated by the shared ops token middleware elsewhere;
  // keep a minimal public-safe health check here.
  r.get("/leads/health", (_req, res) => {
    res.json({
      status: "ok",
      capture: "available",
      smtp_configured: Boolean(process.env.SMTP_HOST),
      recent_count: listLeads(5).length,
    });
  });

  return r;
}
