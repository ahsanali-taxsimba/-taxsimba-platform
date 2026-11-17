import { sql } from "./db";
import type {
  ConnectionSetting,
  IngestEvent,
  Lead,
  LeadInput,
  LeadSource,
  LeadStatus,
} from "./types";

const SOURCES: LeadSource[] = ["outlook", "whatsapp", "website", "manual"];
const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (SOURCES as string[]).includes(value);
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export async function listLeads(
  ownerSub: string,
  opts: { source?: string; status?: string; q?: string } = {},
): Promise<Lead[]> {
  const clauses = ["owner_sub = $1"];
  const params: unknown[] = [ownerSub];

  if (opts.source && isLeadSource(opts.source)) {
    params.push(opts.source);
    clauses.push(`source = $${params.length}`);
  }
  if (opts.status && isLeadStatus(opts.status)) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim().toLowerCase()}%`);
    const i = params.length;
    clauses.push(
      `(lower(name) like $${i} or lower(email) like $${i} or lower(company) like $${i} or lower(subject) like $${i} or lower(phone) like $${i})`,
    );
  }

  return sql<Lead>(
    `select * from leads where ${clauses.join(" and ")} order by created_at desc limit 500`,
    params,
  );
}

export async function getLead(ownerSub: string, id: string): Promise<Lead | null> {
  const rows = await sql<Lead>("select * from leads where owner_sub = $1 and id = $2", [
    ownerSub,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createLead(ownerSub: string, input: LeadInput): Promise<Lead> {
  const rows = await sql<Lead>(
    `insert into leads (
      owner_sub, source, status, name, email, phone, company, subject, message,
      external_id, raw_payload, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
    returning *`,
    [
      ownerSub,
      input.source,
      input.status ?? "new",
      input.name?.trim() ?? "",
      input.email?.trim() ?? "",
      input.phone?.trim() ?? "",
      input.company?.trim() ?? "",
      input.subject?.trim() ?? "",
      input.message?.trim() ?? "",
      input.external_id ?? null,
      JSON.stringify(input.raw_payload ?? {}),
      input.notes?.trim() ?? "",
    ],
  );
  return rows[0];
}

export async function upsertLeadByExternal(
  ownerSub: string,
  input: LeadInput & { external_id: string },
): Promise<Lead> {
  const existing = await sql<Lead>(
    `select * from leads where owner_sub = $1 and source = $2 and external_id = $3`,
    [ownerSub, input.source, input.external_id],
  );
  if (existing[0]) {
    const rows = await sql<Lead>(
      `update leads set
        name = case when $4 <> '' then $4 else name end,
        email = case when $5 <> '' then $5 else email end,
        phone = case when $6 <> '' then $6 else phone end,
        company = case when $7 <> '' then $7 else company end,
        subject = case when $8 <> '' then $8 else subject end,
        message = case when $9 <> '' then $9 else message end,
        raw_payload = $10::jsonb,
        updated_at = now()
      where id = $11
      returning *`,
      [
        ownerSub,
        input.source,
        input.external_id,
        input.name?.trim() ?? "",
        input.email?.trim() ?? "",
        input.phone?.trim() ?? "",
        input.company?.trim() ?? "",
        input.subject?.trim() ?? "",
        input.message?.trim() ?? "",
        JSON.stringify(input.raw_payload ?? {}),
        existing[0].id,
      ],
    );
    return rows[0];
  }
  return createLead(ownerSub, input);
}

export async function updateLead(
  ownerSub: string,
  id: string,
  patch: Partial<{
    status: LeadStatus;
    name: string;
    email: string;
    phone: string;
    company: string;
    subject: string;
    message: string;
    notes: string;
  }>,
): Promise<Lead | null> {
  const current = await getLead(ownerSub, id);
  if (!current) return null;

  const rows = await sql<Lead>(
    `update leads set
      status = $3,
      name = $4,
      email = $5,
      phone = $6,
      company = $7,
      subject = $8,
      message = $9,
      notes = $10,
      updated_at = now()
    where owner_sub = $1 and id = $2
    returning *`,
    [
      ownerSub,
      id,
      patch.status ?? current.status,
      patch.name ?? current.name,
      patch.email ?? current.email,
      patch.phone ?? current.phone,
      patch.company ?? current.company,
      patch.subject ?? current.subject,
      patch.message ?? current.message,
      patch.notes ?? current.notes,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteLead(ownerSub: string, id: string): Promise<boolean> {
  const rows = await sql<{ id: string }>(
    "delete from leads where owner_sub = $1 and id = $2 returning id",
    [ownerSub, id],
  );
  return rows.length > 0;
}

export async function leadStats(ownerSub: string) {
  const byStatus = await sql<{ status: string; count: string }>(
    `select status, count(*)::text as count from leads where owner_sub = $1 group by status`,
    [ownerSub],
  );
  const bySource = await sql<{ source: string; count: string }>(
    `select source, count(*)::text as count from leads where owner_sub = $1 group by source`,
    [ownerSub],
  );
  const total = await sql<{ count: string }>(
    `select count(*)::text as count from leads where owner_sub = $1`,
    [ownerSub],
  );
  return {
    total: Number(total[0]?.count ?? 0),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
    bySource: Object.fromEntries(bySource.map((r) => [r.source, Number(r.count)])),
  };
}

export async function listConnections(ownerSub: string): Promise<ConnectionSetting[]> {
  const rows = await sql<ConnectionSetting>(
    `select * from connection_settings where owner_sub = $1 order by source`,
    [ownerSub],
  );
  const defaults: Array<ConnectionSetting["source"]> = ["outlook", "whatsapp", "website"];
  const map = new Map(rows.map((r) => [r.source, r]));
  return defaults.map(
    (source) =>
      map.get(source) ?? {
        owner_sub: ownerSub,
        source,
        enabled: false,
        label: "",
        config: {},
        last_event_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
  );
}

export async function upsertConnection(
  ownerSub: string,
  source: ConnectionSetting["source"],
  patch: { enabled?: boolean; label?: string; config?: Record<string, unknown> },
): Promise<ConnectionSetting> {
  const rows = await sql<ConnectionSetting>(
    `insert into connection_settings (owner_sub, source, enabled, label, config)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (owner_sub, source) do update set
       enabled = coalesce($3, connection_settings.enabled),
       label = coalesce(nullif($4, ''), connection_settings.label),
       config = case when $5::text = '{}' then connection_settings.config else $5::jsonb end,
       updated_at = now()
     returning *`,
    [
      ownerSub,
      source,
      patch.enabled ?? false,
      patch.label ?? "",
      JSON.stringify(patch.config ?? {}),
    ],
  );
  return rows[0];
}

export async function touchConnection(
  ownerSub: string,
  source: ConnectionSetting["source"],
): Promise<void> {
  await sql(
    `insert into connection_settings (owner_sub, source, enabled, last_event_at)
     values ($1, $2, true, now())
     on conflict (owner_sub, source) do update set
       last_event_at = now(),
       enabled = true,
       updated_at = now()`,
    [ownerSub, source],
  );
}

export async function logIngest(
  ownerSub: string,
  source: string,
  status: string,
  detail: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await sql(
    `insert into ingest_events (owner_sub, source, status, detail, payload)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [ownerSub, source, status, detail, JSON.stringify(payload)],
  );
}

export async function recentIngest(ownerSub: string, limit = 20): Promise<IngestEvent[]> {
  return sql<IngestEvent>(
    `select * from ingest_events where owner_sub = $1 order by created_at desc limit $2`,
    [ownerSub, limit],
  );
}

export async function seedSampleLeads(ownerSub: string): Promise<number> {
  const existing = await sql<{ count: string }>(
    `select count(*)::text as count from leads where owner_sub = $1`,
    [ownerSub],
  );
  if (Number(existing[0]?.count ?? 0) > 0) return 0;

  const samples: LeadInput[] = [
    {
      source: "website",
      name: "Amelia Hart",
      email: "amelia@northbridge.co.uk",
      company: "Northbridge Advisory",
      subject: "Website enquiry — corporation tax",
      message: "We need help with CT returns for a new subsidiary.",
      phone: "+44 7700 900123",
    },
    {
      source: "outlook",
      name: "James Okonkwo",
      email: "james@okonkwo.group",
      company: "Okonkwo Group",
      subject: "Intro from LinkedIn — R&D tax claim",
      message: "Following up on our conversation about R&D relief eligibility.",
      external_id: "outlook-sample-1",
    },
    {
      source: "whatsapp",
      name: "Priya Shah",
      email: "",
      phone: "+44 7700 900456",
      company: "Shah Retail Ltd",
      subject: "WhatsApp enquiry",
      message: "Hi — can you help with Making Tax Digital for VAT?",
      external_id: "wa-sample-1",
    },
    {
      source: "website",
      status: "contacted",
      name: "Tom Brennan",
      email: "tom@brennan.studio",
      company: "Brennan Studio",
      subject: "Bookkeeping quote",
      message: "Looking for monthly bookkeeping for a design studio.",
    },
    {
      source: "manual",
      status: "qualified",
      name: "Sofia Mendes",
      email: "sofia@mendes.estate",
      company: "Mendes Estate",
      phone: "+44 20 7946 0958",
      subject: "Referral — property portfolio",
      message: "Referred by an existing client. Owns 4 buy-to-lets.",
      notes: "Warm referral — call this week.",
    },
  ];

  for (const sample of samples) {
    await createLead(ownerSub, {
      ...sample,
      raw_payload: { sample: true },
    });
  }

  for (const source of ["outlook", "whatsapp", "website"] as const) {
    await upsertConnection(ownerSub, source, {
      enabled: false,
      label: source === "outlook" ? "Outlook inbox" : source === "whatsapp" ? "Business WhatsApp" : "Website forms",
    });
  }

  return samples.length;
}
