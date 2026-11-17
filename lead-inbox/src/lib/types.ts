export type LeadSource = "outlook" | "whatsapp" | "website" | "manual";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export type Lead = {
  id: string;
  owner_sub: string;
  source: LeadSource;
  status: LeadStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  external_id: string | null;
  raw_payload: Record<string, unknown>;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ConnectionSetting = {
  owner_sub: string;
  source: "outlook" | "whatsapp" | "website";
  enabled: boolean;
  label: string;
  config: Record<string, unknown>;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IngestEvent = {
  id: string;
  owner_sub: string;
  source: string;
  status: string;
  detail: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type LeadInput = {
  source: LeadSource;
  status?: LeadStatus;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  external_id?: string | null;
  raw_payload?: Record<string, unknown>;
  notes?: string;
};
