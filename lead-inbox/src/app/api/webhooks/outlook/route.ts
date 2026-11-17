import { verifyWebhookSecret } from "@/lib/auth";
import { logIngest, touchConnection, upsertLeadByExternal } from "@/lib/leads";
import { extractToken, findOwnerByToken } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/**
 * Accepts Microsoft Graph change notifications (validation + notifications)
 * or a simplified Power Automate / Logic Apps payload.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  const auth = verifyWebhookSecret(request, "OUTLOOK_WEBHOOK_SECRET");
  if (!auth.ok) return auth.response;

  const token = extractToken(request);
  const ownerSub = await findOwnerByToken("outlook", token);
  if (!ownerSub) {
    return Response.json(
      { error: "unknown_token", message: "Enable the Outlook connection and use its webhook URL." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = normalizeOutlookMessages(body);
  const created: string[] = [];

  for (const msg of messages) {
    const lead = await upsertLeadByExternal(ownerSub, {
      source: "outlook",
      external_id: msg.id,
      name: msg.fromName || msg.fromEmail,
      email: msg.fromEmail,
      subject: msg.subject,
      message: msg.bodyPreview,
      company: "",
      phone: "",
      raw_payload: msg.raw,
    });
    created.push(lead.id);
  }

  if (created.length === 0) {
    await logIngest(ownerSub, "outlook", "ignored", "No messages in payload", body);
    return Response.json({ ok: true, created: 0 });
  }

  await touchConnection(ownerSub, "outlook");
  await logIngest(ownerSub, "outlook", "created", `Imported ${created.length} message(s)`, {
    leadIds: created,
  });

  return Response.json({ ok: true, created: created.length, leadIds: created }, { status: 201 });
}

type OutlookMsg = {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  bodyPreview: string;
  raw: Record<string, unknown>;
};

function normalizeOutlookMessages(body: Record<string, unknown>): OutlookMsg[] {
  // Simplified Power Automate shape
  if (body.from || body.subject || body.bodyPreview || body.body) {
    const from = (body.from as Record<string, unknown> | string | undefined) ?? "";
    const fromEmail =
      typeof from === "string"
        ? from
        : str(from.emailAddress && (from.emailAddress as Record<string, unknown>).address) ||
          str(from.address) ||
          str(from.email);
    const fromName =
      typeof from === "string"
        ? from.split("@")[0] || from
        : str(from.emailAddress && (from.emailAddress as Record<string, unknown>).name) ||
          str(from.name) ||
          fromEmail;
    return [
      {
        id: str(body.id) || str(body.messageId) || `outlook-${Date.now()}`,
        fromName,
        fromEmail,
        subject: str(body.subject) || "Outlook message",
        bodyPreview: str(body.bodyPreview || body.body || body.content),
        raw: body,
      },
    ];
  }

  // Graph notification batch — client should expand message before posting, or send value[]
  const value = Array.isArray(body.value) ? body.value : [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const resourceData = (row.resourceData as Record<string, unknown> | undefined) ?? row;
      const from =
        (resourceData.from as Record<string, unknown> | undefined) ??
        (resourceData.sender as Record<string, unknown> | undefined);
      const emailObj = from?.emailAddress as Record<string, unknown> | undefined;
      const fromEmail = str(emailObj?.address) || str(resourceData.fromEmail);
      const fromName = str(emailObj?.name) || fromEmail;
      const id = str(resourceData.id) || str(row.subscriptionId) || `outlook-n-${index}-${Date.now()}`;
      return {
        id,
        fromName,
        fromEmail,
        subject: str(resourceData.subject) || "Outlook notification",
        bodyPreview: str(resourceData.bodyPreview || resourceData.body),
        raw: row,
      } satisfies OutlookMsg;
    })
    .filter((m): m is OutlookMsg => Boolean(m && (m.fromEmail || m.subject)));
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
