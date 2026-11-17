import { requireViewer } from "@/lib/auth";
import { listConnections, upsertConnection } from "@/lib/leads";
import { newWebhookToken } from "@/lib/webhooks";
import type { ConnectionSetting } from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCES = new Set(["outlook", "whatsapp", "website"]);

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const connections = await listConnections(viewer.sub);
  const origin = new URL(request.url).origin;

  return Response.json(
    {
      connections: connections.map((c) => serializeConnection(c, origin)),
      secrets: {
        form: Boolean(process.env.FORM_WEBHOOK_SECRET?.trim()),
        outlook: Boolean(process.env.OUTLOOK_WEBHOOK_SECRET?.trim()),
        whatsappVerify: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
        whatsappApp: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
      },
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const source = body.source;
  if (typeof source !== "string" || !SOURCES.has(source)) {
    return Response.json({ error: "invalid_source" }, { status: 400 });
  }

  const existing = (await listConnections(viewer.sub)).find((c) => c.source === source);
  const rotate = body.rotateToken === true;
  const token =
    rotate || !existing?.config?.webhook_token
      ? newWebhookToken()
      : String(existing.config.webhook_token);

  const connection = await upsertConnection(
    viewer.sub,
    source as ConnectionSetting["source"],
    {
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      label: typeof body.label === "string" ? body.label : "",
      config: {
        ...(existing?.config ?? {}),
        webhook_token: token,
        ...(typeof body.phoneNumberId === "string"
          ? { phone_number_id: body.phoneNumberId }
          : {}),
        ...(typeof body.mailbox === "string" ? { mailbox: body.mailbox } : {}),
      },
    },
  );

  const origin = new URL(request.url).origin;
  return Response.json(
    { connection: serializeConnection(connection, origin) },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function serializeConnection(c: ConnectionSetting, origin: string) {
  const token = typeof c.config.webhook_token === "string" ? c.config.webhook_token : "";
  const path =
    c.source === "outlook"
      ? "/api/webhooks/outlook"
      : c.source === "whatsapp"
        ? "/api/webhooks/whatsapp"
        : "/api/webhooks/form";

  return {
    source: c.source,
    enabled: c.enabled,
    label: c.label,
    lastEventAt: c.last_event_at,
    webhookUrl: token ? `${origin}${path}?token=${token}` : null,
    hasToken: Boolean(token),
    config: {
      phoneNumberId: c.config.phone_number_id ?? null,
      mailbox: c.config.mailbox ?? null,
    },
  };
}
