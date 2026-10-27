/**
 * Marketing Hub API client — native `/api/marketing-hub/*` routes.
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
  attribution: () => get<Record<string, unknown>>("/api/marketing-hub/attribution"),
  audit: () => get<{ items: unknown[] }>("/api/marketing-hub/audit"),
  connections: () =>
    get<{ items: Array<Record<string, unknown>>; oauthNote: string }>("/api/marketing-hub/connections"),
  beginConnect: (platform: string, mockUiPreview?: boolean) =>
    post<Record<string, unknown>>("/api/marketing-hub/connections/begin", {
      platform,
      mockUiPreview,
    }),
  disconnect: (platform: string) =>
    post<Record<string, unknown>>(`/api/marketing-hub/connections/${platform}/disconnect`),
  pause: (paused = true) => post<Record<string, unknown>>("/api/marketing-hub/pause", { paused }),
  assets: () =>
    get<{ items: Array<Record<string, unknown>>; summary: Record<string, unknown> }>(
      "/api/marketing-hub/assets",
    ),
  assetsLibrary: (opts?: { q?: string; category?: string; uploadedOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.uploadedOnly !== false) params.set("library", "true");
    const qs = params.toString();
    return get<{ items: Array<Record<string, unknown>>; summary: Record<string, unknown> }>(
      `/api/marketing-hub/assets${qs ? `?${qs}` : ""}`,
    );
  },
  setAssetPublication: (id: string, status: string) =>
    post<{ asset: Record<string, unknown> }>(
      `/api/marketing-hub/assets/${id}/publication-status`,
      { status },
    ),
  approveAsset: (id: string, approve = true) =>
    post<{ asset: Record<string, unknown> }>(`/api/marketing-hub/assets/${id}/approve`, { approve }),
  uploadAsset: async (id: string, file: File, notes?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (notes) form.append("notes", notes);
    const { getSession } = await import("next-auth/react");
    const session = await getSession();
    const raw = session?.user?.accessToken as string | undefined;
    const auth = raw ? (raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`) : "";
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/compat\/?$/, "");
    const res = await fetch(`${base}/api/marketing-hub/assets/${id}/upload`, {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.detail || "Upload failed"), {
        response: { data, status: res.status },
      });
    }
    return data as { asset: Record<string, unknown> };
  },
};

export function stateLabel(state: MetricState | string | undefined): string {
  if (state === "not_connected") return "Not Connected";
  if (state === "no_data") return "No Data";
  if (state === "ok") return "OK";
  return state ? String(state) : "Unknown";
}
