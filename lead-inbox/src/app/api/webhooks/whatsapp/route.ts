import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { logIngest, touchConnection, upsertLeadByExternal } from "@/lib/leads";
import { extractToken, findOwnerByToken, timingSafeEqual } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Meta webhook verification challenge */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";

  if (mode === "subscribe" && challenge && expected && token && timingSafeEqual(token, expected)) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  return Response.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = authenticateWhatsApp(request, rawBody);
  if (!auth.ok) return auth.response;

  const token = extractToken(request);
  const ownerSub = await findOwnerByToken("whatsapp", token);
  if (!ownerSub) {
    return Response.json(
      { error: "unknown_token", message: "Enable the WhatsApp connection and use its webhook URL." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = extractWhatsAppMessages(body);
  const created: string[] = [];

  for (const msg of messages) {
    const lead = await upsertLeadByExternal(ownerSub, {
      source: "whatsapp",
      external_id: msg.id,
      name: msg.name || msg.from,
      phone: msg.from,
      email: "",
      company: "",
      subject: "WhatsApp message",
      message: msg.text,
      raw_payload: msg.raw,
    });
    created.push(lead.id);
  }

  if (created.length === 0) {
    await logIngest(ownerSub, "whatsapp", "ignored", "No inbound messages", body);
    return Response.json({ ok: true, created: 0 });
  }

  await touchConnection(ownerSub, "whatsapp");
  await logIngest(ownerSub, "whatsapp", "created", `Imported ${created.length} message(s)`, {
    leadIds: created,
  });

  return Response.json({ ok: true, created: created.length, leadIds: created }, { status: 201 });
}

function authenticateWhatsApp(
  request: Request,
  rawBody: string,
): { ok: true } | { ok: false; response: Response } {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const signature = request.headers.get("x-hub-signature-256")?.replace(/^sha256=/, "") ?? "";

  if (appSecret && signature) {
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length === b.length && nodeTimingSafeEqual(a, b)) {
      return { ok: true };
    }
    return { ok: false, response: Response.json({ error: "bad_signature" }, { status: 401 }) };
  }

  // Manual / Power Automate / test posts: shared header secret
  const provided =
    request.headers.get("x-webhook-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  const fallback = appSecret || verifyToken;
  const published = Boolean(process.env.CURSOR_APP_ID?.trim());
  if (!fallback) {
    if (!published) return { ok: true };
    return {
      ok: false,
      response: Response.json(
        {
          error: "webhook_not_configured",
          message: "Set WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN in Cursor Secrets.",
        },
        { status: 503 },
      ),
    };
  }
  if (!provided || !timingSafeEqual(provided, fallback)) {
    return { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

type WaMsg = {
  id: string;
  from: string;
  name: string;
  text: string;
  raw: Record<string, unknown>;
};

function extractWhatsAppMessages(body: Record<string, unknown>): WaMsg[] {
  if (body.from || body.text || body.message) {
    return [
      {
        id: str(body.id) || `wa-${Date.now()}`,
        from: str(body.from || body.phone),
        name: str(body.name || body.profile_name),
        text: str(body.text || body.message),
        raw: body,
      },
    ].filter((m) => m.from || m.text);
  }

  const entries = Array.isArray(body.entry) ? body.entry : [];
  const out: WaMsg[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes)
      ? ((entry as Record<string, unknown>).changes as unknown[])
      : [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
      if (!value) continue;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const contactName =
        str(
          contacts[0] &&
            typeof contacts[0] === "object" &&
            (contacts[0] as Record<string, unknown>).profile &&
            ((contacts[0] as Record<string, unknown>).profile as Record<string, unknown>).name,
        ) || "";
      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const m = message as Record<string, unknown>;
        const textObj = m.text as Record<string, unknown> | undefined;
        out.push({
          id: str(m.id) || `wa-${Date.now()}-${out.length}`,
          from: str(m.from),
          name: contactName,
          text: str(textObj?.body) || str(m.type),
          raw: m,
        });
      }
    }
  }
  return out;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
