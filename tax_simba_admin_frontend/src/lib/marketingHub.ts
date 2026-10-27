/**
 * Marketing Hub API client — native `/api/marketing-hub/*` routes.
 * Admin NEXT_PUBLIC_API_URL often points at `/api/compat/`, so we use absolute `/api/...` paths.
 */
import { clientAxios } from "@/lib/axios-client";

async function get<T>(path: string): Promise<T> {
  const res = await clientAxios.get<T>(path, true);
  return res.data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await clientAxios.post<T>(path, body ?? {}, true);
  return res.data;
}

export type MetricState = "ok" | "no_data" | "not_connected";

export const marketingHubApi = {
  status: () => get<Record<string, unknown>>("/api/marketing-hub/status"),
  dashboard: () => get<Record<string, unknown>>("/api/marketing-hub/dashboard"),
  templates: (batch?: number) =>
    get<Record<string, unknown>>(
      batch ? `/api/marketing-hub/templates?batch=${batch}` : "/api/marketing-hub/templates",
    ),
  drafts: () => get<{ items: Array<Record<string, unknown>> }>("/api/marketing-hub/drafts"),
  runDaily: () => post<Record<string, unknown>>("/api/marketing-hub/engine/run-daily"),
  advance: (id: string, stage: string, detail?: string) =>
    post<{ draft: Record<string, unknown> }>(`/api/marketing-hub/drafts/${id}/advance`, {
      stage,
      detail,
    }),
  publish: (id: string, platforms: string[]) =>
    post<{ draft: Record<string, unknown>; note: string }>(
      `/api/marketing-hub/drafts/${id}/publish`,
      { platforms },
    ),
  tiktokPack: (id: string) => get<Record<string, unknown>>(`/api/marketing-hub/drafts/${id}/tiktok-pack`),
  seo: () => get<Record<string, unknown>>("/api/marketing-hub/seo"),
  connections: () => get<{ items: Array<Record<string, unknown>>; oauthNote: string }>("/api/marketing-hub/connections"),
  beginConnect: (platform: string, mockConnect?: boolean) =>
    post<Record<string, unknown>>("/api/marketing-hub/connections/begin", { platform, mockConnect }),
  disconnect: (platform: string) =>
    post<Record<string, unknown>>(`/api/marketing-hub/connections/${platform}/disconnect`),
  pause: () => post<Record<string, unknown>>("/api/marketing-hub/pause"),
};

export function stateLabel(state: MetricState | string | undefined): string {
  if (state === "not_connected") return "Not Connected";
  if (state === "no_data") return "No Data";
  if (state === "ok") return "OK";
  return state ? String(state) : "Unknown";
}
