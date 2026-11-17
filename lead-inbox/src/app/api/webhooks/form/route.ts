import { verifyWebhookSecret } from "@/lib/auth";
import { createLead, logIngest, touchConnection } from "@/lib/leads";
import { extractToken, findOwnerByToken } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = verifyWebhookSecret(request, "FORM_WEBHOOK_SECRET");
  if (!auth.ok) return auth.response;

  const token = extractToken(request);
  const ownerSub = await findOwnerByToken("website", token);
  if (!ownerSub) {
    return Response.json(
      { error: "unknown_token", message: "Enable the website connection and use its webhook URL." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = str(body.name ?? body.full_name ?? body.fullName);
  const email = str(body.email);
  const phone = str(body.phone ?? body.tel ?? body.mobile);
  const company = str(body.company ?? body.organisation ?? body.organization);
  const subject = str(body.subject ?? body.topic ?? "Website form submission");
  const message = str(body.message ?? body.comment ?? body.enquiry ?? body.notes);

  if (!name && !email && !phone) {
    await logIngest(ownerSub, "website", "rejected", "Missing contact fields", body);
    return Response.json({ error: "validation" }, { status: 400 });
  }

  const lead = await createLead(ownerSub, {
    source: "website",
    name: name || email || phone,
    email,
    phone,
    company,
    subject,
    message,
    external_id: str(body.id || body.submission_id) || null,
    raw_payload: body,
  });

  await touchConnection(ownerSub, "website");
  await logIngest(ownerSub, "website", "created", `Lead ${lead.id}`, { leadId: lead.id });

  return Response.json({ ok: true, leadId: lead.id }, { status: 201 });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
