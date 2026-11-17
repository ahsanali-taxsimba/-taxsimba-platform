"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Globe } from "lucide-react";
import { AppShell } from "./AppShell";
import { formatRelative } from "@/lib/format";

type Connection = {
  source: "outlook" | "whatsapp" | "website";
  enabled: boolean;
  label: string;
  lastEventAt: string | null;
  webhookUrl: string | null;
  hasToken: boolean;
  config: { phoneNumberId: string | null; mailbox: string | null };
};

type Secrets = {
  form: boolean;
  outlook: boolean;
  whatsappVerify: boolean;
  whatsappApp: boolean;
};

const meta: Record<
  Connection["source"],
  { title: string; blurb: string; icon: typeof Mail; secretHint: string }
> = {
  outlook: {
    title: "Outlook",
    blurb: "Forward new-business emails via Power Automate or Microsoft Graph into LeadInbox.",
    icon: Mail,
    secretHint: "OUTLOOK_WEBHOOK_SECRET",
  },
  whatsapp: {
    title: "Business WhatsApp",
    blurb: "Point Meta Cloud API webhooks at LeadInbox to capture inbound chats as leads.",
    icon: MessageCircle,
    secretHint: "WHATSAPP_VERIFY_TOKEN + WHATSAPP_APP_SECRET",
  },
  website: {
    title: "Website forms",
    blurb: "POST form submissions from your site, Typeform, or Zapier to the website webhook.",
    icon: Globe,
    secretHint: "FORM_WEBHOOK_SECRET",
  },
};

export function ConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [sampleDatabase, setSampleDatabase] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [meRes, connRes] = await Promise.all([fetch("/api/me"), fetch("/api/connections")]);
      if (!meRes.ok || !connRes.ok) throw new Error("Failed to load connections");
      const me = (await meRes.json()) as { name?: string; sampleDatabase?: boolean };
      const data = (await connRes.json()) as { connections: Connection[]; secrets: Secrets };
      setViewerName(me.name || "You");
      setSampleDatabase(Boolean(me.sampleDatabase));
      setConnections(data.connections);
      setSecrets(data.secrets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function enable(source: Connection["source"], rotate = false) {
    setBusy(source);
    setError("");
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, enabled: true, rotateToken: rotate }),
      });
      if (!res.ok) throw new Error("Could not enable connection");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function disable(source: Connection["source"]) {
    setBusy(source);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, enabled: false }),
      });
      if (!res.ok) throw new Error("Could not disable connection");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function copyUrl(url: string, source: string) {
    await navigator.clipboard.writeText(url);
    setCopied(source);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <AppShell viewerName={viewerName} sampleDatabase={sampleDatabase}>
      <div className="space-y-6">
        <section className="animate-rise rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow)] md:p-8">
          <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">
            Connections
          </p>
          <h1 className="mt-2 max-w-2xl text-lg font-medium text-[var(--ink-soft)]">
            Connect Outlook, Business WhatsApp, and website forms. Each source gets a private
            webhook URL that writes into your lead database.
          </h1>

          {secrets ? (
            <div
              className="mt-5 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--mist)]/70 p-4 text-sm sm:grid-cols-2"
              data-testid="secrets-status"
            >
              <SecretRow label="FORM_WEBHOOK_SECRET" ok={secrets.form} />
              <SecretRow label="OUTLOOK_WEBHOOK_SECRET" ok={secrets.outlook} />
              <SecretRow label="WHATSAPP_VERIFY_TOKEN" ok={secrets.whatsappVerify} />
              <SecretRow label="WHATSAPP_APP_SECRET" ok={secrets.whatsappApp} />
              <p className="sm:col-span-2 text-[var(--muted)]">
                Add missing secrets in Cursor Secrets for this app, then republish. Until then,
                sample leads still work locally.
              </p>
            </div>
          ) : null}
        </section>

        {error ? (
          <p className="text-sm text-[var(--danger)]" data-testid="connections-error">
            {error}
          </p>
        ) : null}

        <div className="stagger grid gap-4 lg:grid-cols-3">
          {connections.map((c) => {
            const info = meta[c.source];
            const Icon = info.icon;
            return (
              <article
                key={c.source}
                data-testid={`connection-${c.source}`}
                className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)]"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[var(--mist)] p-2.5 text-[var(--ink)]">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                      {info.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{info.blurb}</p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-[var(--muted)]">
                  Status:{" "}
                  <span className={c.enabled ? "font-semibold text-[var(--ok)]" : "font-semibold"}>
                    {c.enabled ? "Enabled" : "Not connected"}
                  </span>
                  {c.lastEventAt ? ` · last event ${formatRelative(c.lastEventAt)}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Needs secret: {info.secretHint}</p>

                {c.webhookUrl ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--mist)]/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Webhook URL
                    </p>
                    <p
                      className="mt-1 break-all font-mono text-[11px] leading-relaxed text-[var(--ink-soft)]"
                      data-testid={`webhook-url-${c.source}`}
                    >
                      {c.webhookUrl}
                    </p>
                    <button
                      type="button"
                      data-testid={`copy-webhook-${c.source}`}
                      onClick={() => void copyUrl(c.webhookUrl!, c.source)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold border border-[var(--line)]"
                    >
                      {copied === c.source ? <Check size={14} /> : <Copy size={14} />}
                      {copied === c.source ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {!c.enabled || !c.webhookUrl ? (
                    <button
                      type="button"
                      disabled={busy === c.source}
                      data-testid={`enable-${c.source}`}
                      onClick={() => void enable(c.source)}
                      className="rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busy === c.source ? "Working…" : "Enable & get URL"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy === c.source}
                        data-testid={`rotate-${c.source}`}
                        onClick={() => void enable(c.source, true)}
                        className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium"
                      >
                        Rotate token
                      </button>
                      <button
                        type="button"
                        disabled={busy === c.source}
                        data-testid={`disable-${c.source}`}
                        onClick={() => void disable(c.source)}
                        className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[#f8eaea]"
                      >
                        Disable
                      </button>
                    </>
                  )}
                </div>

                <SetupNotes source={c.source} />
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function SecretRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-[var(--ok)]" : "bg-[var(--accent)]"}`}
      />
      <span className="font-mono text-xs">{label}</span>
      <span className="text-xs text-[var(--muted)]">{ok ? "bound" : "missing"}</span>
    </p>
  );
}

function SetupNotes({ source }: { source: Connection["source"] }) {
  if (source === "website") {
    return (
      <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-[var(--muted)]">
        <li>Enable this connection and copy the webhook URL.</li>
        <li>Set FORM_WEBHOOK_SECRET in Cursor Secrets.</li>
        <li>
          POST JSON with header <code className="font-mono">x-webhook-secret</code> and fields like
          name, email, phone, company, message.
        </li>
      </ol>
    );
  }
  if (source === "outlook") {
    return (
      <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-[var(--muted)]">
        <li>Create a Power Automate flow: when a new email arrives in your leads mailbox.</li>
        <li>HTTP POST to this webhook with OUTLOOK_WEBHOOK_SECRET as x-webhook-secret.</li>
        <li>Send from, subject, bodyPreview (or Graph notification payloads).</li>
      </ol>
    );
  }
  return (
    <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-[var(--muted)]">
      <li>In Meta Developer → WhatsApp → Configuration, set the Callback URL to this webhook.</li>
      <li>Use WHATSAPP_VERIFY_TOKEN for verification and WHATSAPP_APP_SECRET for signatures.</li>
      <li>Subscribe to messages; inbound chats become leads automatically.</li>
    </ol>
  );
}
