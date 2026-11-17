import { requireIdentity } from "../../cursor/identity";

export type AppIdentity = {
  sub: string;
  email: string;
  name: string;
  kind: "person" | "key";
  stage?: "production" | "preview";
};

export async function requireViewer(
  request: Request,
): Promise<AppIdentity | Response> {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  if (identity.kind === "key") {
    return Response.json(
      { error: "person_required", message: "Sign in to manage leads." },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }

  return {
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    kind: "person",
    stage: identity.stage,
  };
}

/**
 * Shared secret for inbound webhooks.
 * On the published host the secret must be set and match.
 * Locally (no CURSOR_APP_ID) the connection token alone is enough so sample flows work.
 */
export function verifyWebhookSecret(
  request: Request,
  envName: string,
): { ok: true } | { ok: false; response: Response } {
  const expected = process.env[envName]?.trim() ?? "";
  const provided =
    request.headers.get("x-webhook-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  const published = Boolean(process.env.CURSOR_APP_ID?.trim());

  if (expected === "") {
    if (!published) {
      return { ok: true };
    }
    return {
      ok: false,
      response: Response.json(
        {
          error: "webhook_not_configured",
          message: `${envName} is not set. Add it in Cursor Secrets, then republish.`,
        },
        { status: 503 },
      ),
    };
  }

  if (provided === "" || provided !== expected) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}
