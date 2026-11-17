create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  source text not null check (source in ('outlook', 'whatsapp', 'website', 'manual')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  subject text not null default '',
  message text not null default '',
  external_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_owner_external_uidx
  on leads (owner_sub, source, external_id)
  where external_id is not null;

create index if not exists leads_owner_created_idx on leads (owner_sub, created_at desc);
create index if not exists leads_owner_status_idx on leads (owner_sub, status);
create index if not exists leads_owner_source_idx on leads (owner_sub, source);

create table if not exists connection_settings (
  owner_sub text not null,
  source text not null check (source in ('outlook', 'whatsapp', 'website')),
  enabled boolean not null default false,
  label text not null default '',
  config jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_sub, source)
);

create table if not exists ingest_events (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  source text not null,
  status text not null default 'received',
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ingest_events_owner_created_idx
  on ingest_events (owner_sub, created_at desc);
