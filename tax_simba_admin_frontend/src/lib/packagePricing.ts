/**
 * Package pricing API client.
 *
 * Calls the existing native `/api/packages*` Super Admin pricing endpoints
 * (not CMS / global-fee). Admin FE's NEXT_PUBLIC_API_URL points at `/api/compat/`,
 * so paths must be rewritten to the native `/api/packages*` mount — axios would
 * otherwise concatenate into `/api/compat/api/packages`.
 */
import { clientAxios } from "@/lib/axios-client";
import { nativeApiUrl } from "@/lib/nativeApiUrl";

export type PackageRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  rank: number;
  service_type: string;
  billing_frequency?: string;
  is_active?: boolean;
  effective_from?: string | null;
};

export type PriceHistoryRow = {
  id: string;
  package_id: string;
  code?: string;
  previous_price: number;
  new_price: number;
  effective_from?: string | null;
  changed_by?: string;
  role?: string;
  created_at?: string;
};

export type PriceScheduleRow = {
  id: string;
  package_id: string;
  price: number;
  previous_price?: number;
  effective_from: string;
  status: string;
  created_by?: string;
  created_at?: string;
};

const SERVICE_LABELS: Record<string, string> = {
  SELF_ASSESSMENT: "Self Assessment",
  MTD_INCOME_TAX: "MTD for Income Tax",
};

export function serviceLabel(serviceType: string): string {
  return SERVICE_LABELS[serviceType] ?? serviceType;
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

async function nativeGet<T>(path: string): Promise<T> {
  const res = await clientAxios.get<T>(path, true);
  return res.data;
}

async function nativePatch<T>(path: string, body: unknown): Promise<T> {
  const res = await clientAxios.patch<T>(path, body, true);
  return res.data;
}

async function nativePost<T>(path: string, body: unknown): Promise<T> {
  const res = await clientAxios.post<T>(path, body, true);
  return res.data;
}

async function nativeDelete<T>(path: string): Promise<T> {
  const res = await clientAxios.delete<T>(path, true);
  return res.data;
}

export async function listPackages(): Promise<PackageRow[]> {
  const rows = await nativeGet<PackageRow[]>(nativeApiUrl("/api/packages"));
  return Array.isArray(rows) ? rows : [];
}

export async function updatePackagePrice(
  packageId: string,
  price: number,
  effectiveFrom?: string | null,
): Promise<{ ok: boolean }> {
  const body: { price: number; effective_from?: string | null } = { price };
  if (effectiveFrom) body.effective_from = effectiveFrom;
  return nativePatch(nativeApiUrl(`/api/packages/${packageId}/price`), body);
}

export async function listPriceHistory(packageId: string): Promise<PriceHistoryRow[]> {
  const rows = await nativeGet<PriceHistoryRow[]>(
    nativeApiUrl(`/api/packages/${packageId}/price-history`),
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listPriceSchedule(packageId: string): Promise<PriceScheduleRow[]> {
  const rows = await nativeGet<PriceScheduleRow[]>(
    nativeApiUrl(`/api/packages/${packageId}/price-schedule`),
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createPriceSchedule(
  packageId: string,
  price: number,
  effectiveFrom: string,
): Promise<PriceScheduleRow> {
  return nativePost(nativeApiUrl(`/api/packages/${packageId}/price-schedule`), {
    price,
    effective_from: effectiveFrom,
  });
}

export async function cancelPriceSchedule(
  packageId: string,
  entryId: string,
): Promise<{ ok: boolean }> {
  return nativeDelete(nativeApiUrl(`/api/packages/${packageId}/price-schedule/${entryId}`));
}
