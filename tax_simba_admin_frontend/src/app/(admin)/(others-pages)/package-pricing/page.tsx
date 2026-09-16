"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import {
  cancelPriceSchedule,
  createPriceSchedule,
  formatGbp,
  listPackages,
  listPriceHistory,
  listPriceSchedule,
  PackageRow,
  PriceHistoryRow,
  PriceScheduleRow,
  serviceLabel,
  updatePackagePrice,
} from "@/lib/packagePricing";

type Flash = { type: "ok" | "err"; text: string } | null;

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PackagePricingPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const canView = isAdminRole(role);
  const canEdit = isSuperAdminRole(role);

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [schedule, setSchedule] = useState<PriceScheduleRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [priceInput, setPriceInput] = useState("");
  const [immediateEffective, setImmediateEffective] = useState("");
  const [scheduledPrice, setScheduledPrice] = useState("");
  const [scheduledFrom, setScheduledFrom] = useState(tomorrowIsoDate());

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId],
  );

  const grouped = useMemo(() => {
    const order = ["SELF_ASSESSMENT", "MTD_INCOME_TAX"];
    const map = new Map<string, PackageRow[]>();
    for (const p of packages) {
      const key = p.service_type || "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    for (const rows of map.values()) rows.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const keys = [
      ...order.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !order.includes(k)).sort(),
    ];
    return keys.map((k) => ({ serviceType: k, rows: map.get(k)! }));
  }, [packages]);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setFlash(null);
    try {
      const rows = await listPackages();
      setPackages(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Failed to load packages";
      setFlash({ type: "err", text: String(msg) });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = useCallback(async (packageId: string) => {
    setDetailLoading(true);
    try {
      const [h, s] = await Promise.all([
        listPriceHistory(packageId),
        listPriceSchedule(packageId),
      ]);
      setHistory(h);
      setSchedule(s.filter((row) => String(row.status).toUpperCase() === "PENDING"));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to load price history";
      setFlash({ type: "err", text: String(msg) });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) return;
    void loadPackages();
  }, [status, canView, loadPackages]);

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      setSchedule([]);
      return;
    }
    const pkg = packages.find((p) => p.id === selectedId);
    if (pkg) setPriceInput(String(pkg.price));
    setImmediateEffective("");
    setScheduledPrice("");
    setScheduledFrom(tomorrowIsoDate());
    void loadDetails(selectedId);
  }, [selectedId, packages, loadDetails]);

  const onApplyImmediate = async () => {
    if (!selected || !canEdit) return;
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price < 0) {
      setFlash({ type: "err", text: "Enter a valid non-negative price" });
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      await updatePackagePrice(
        selected.id,
        price,
        immediateEffective.trim() ? immediateEffective.trim() : null,
      );
      setFlash({
        type: "ok",
        text: immediateEffective.trim()
          ? `Scheduled ${selected.code} → ${formatGbp(price)} from ${immediateEffective.trim()}`
          : `Updated live price for ${selected.code} to ${formatGbp(price)}`,
      });
      await loadPackages();
      await loadDetails(selected.id);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Price update failed";
      setFlash({ type: "err", text: String(msg) });
    } finally {
      setSaving(false);
    }
  };

  const onSchedule = async () => {
    if (!selected || !canEdit) return;
    const price = Number(scheduledPrice);
    if (!Number.isFinite(price) || price < 0) {
      setFlash({ type: "err", text: "Enter a valid scheduled price" });
      return;
    }
    if (!scheduledFrom) {
      setFlash({ type: "err", text: "Choose a future effective date" });
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      await createPriceSchedule(selected.id, price, scheduledFrom);
      setFlash({
        type: "ok",
        text: `Scheduled ${selected.code} → ${formatGbp(price)} from ${scheduledFrom}`,
      });
      setScheduledPrice("");
      await loadDetails(selected.id);
      await loadPackages();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "Schedule failed";
      setFlash({ type: "err", text: String(msg) });
    } finally {
      setSaving(false);
    }
  };

  const onCancelSchedule = async (entryId: string) => {
    if (!selected || !canEdit) return;
    setSaving(true);
    setFlash(null);
    try {
      await cancelPriceSchedule(selected.id, entryId);
      setFlash({ type: "ok", text: "Cancelled scheduled price change" });
      await loadDetails(selected.id);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "Cancel failed";
      setFlash({ type: "err", text: String(msg) });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="p-6">
        <PageBreadcrumb pageTitle="Package Pricing" parentPage="dashboard" parentPageUrl="/overview" />
        <ComponentCard title="Access denied">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Only Admin and Super Admin can view package pricing.
          </p>
        </ComponentCard>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Package Pricing" parentPage="dashboard" parentPageUrl="/overview" />

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
        <p>
          Live SA and MTD catalogue prices from <code className="text-xs">packages.price</code>.
          Existing customers keep their frozen <code className="text-xs">agreed_price</code>. New
          checkouts use the live catalogue amount.
        </p>
        {!canEdit && (
          <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
            Read-only for Admin. Only Super Admin can change or schedule prices.
          </p>
        )}
      </div>

      {flash && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            flash.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          {loading ? (
            <ComponentCard title="Catalogue">
              <p className="text-sm text-gray-500">Loading packages…</p>
            </ComponentCard>
          ) : (
            grouped.map((group) => (
              <ComponentCard
                key={group.serviceType}
                title={serviceLabel(group.serviceType)}
                desc="Current live catalogue price"
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 dark:border-gray-800">
                        <th className="py-2 pr-3 font-medium">Package</th>
                        <th className="py-2 pr-3 font-medium">Code</th>
                        <th className="py-2 pr-3 font-medium">Live price</th>
                        <th className="py-2 font-medium">Billing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((pkg) => {
                        const active = pkg.id === selectedId;
                        return (
                          <tr
                            key={pkg.id}
                            className={`cursor-pointer border-b border-gray-50 dark:border-gray-900 ${
                              active ? "bg-brand-50/60 dark:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                            }`}
                            onClick={() => setSelectedId(pkg.id)}
                          >
                            <td className="py-3 pr-3 font-medium text-gray-800 dark:text-white/90">
                              {pkg.name}
                            </td>
                            <td className="py-3 pr-3 text-gray-600 dark:text-gray-400">{pkg.code}</td>
                            <td className="py-3 pr-3 font-semibold text-gray-900 dark:text-white">
                              {formatGbp(pkg.price)}
                            </td>
                            <td className="py-3 text-gray-600 dark:text-gray-400">
                              {pkg.billing_frequency || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ComponentCard>
            ))
          )}
        </div>

        <div className="space-y-6 xl:col-span-3">
          <ComponentCard
            title={selected ? `${selected.name} (${selected.code})` : "Select a package"}
            desc={
              selected
                ? `Live price ${formatGbp(selected.price)} · ${serviceLabel(selected.service_type)}`
                : "Choose a package from the catalogue"
            }
          >
            {!selected ? (
              <p className="text-sm text-gray-500">No package selected.</p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">
                      New price (GBP)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!canEdit || saving}
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">
                      Effective from (optional — future = schedule)
                    </span>
                    <input
                      type="date"
                      disabled={!canEdit || saving}
                      value={immediateEffective}
                      min={tomorrowIsoDate()}
                      onChange={(e) => setImmediateEffective(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
                    />
                  </label>
                </div>
                {canEdit && (
                  <Button size="sm" disabled={saving} onClick={() => void onApplyImmediate()}>
                    {immediateEffective.trim() ? "Schedule via price endpoint" : "Apply live price now"}
                  </Button>
                )}

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <h4 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                    Schedule a future price
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">
                        Scheduled price (GBP)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!canEdit || saving}
                        value={scheduledPrice}
                        onChange={(e) => setScheduledPrice(e.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">
                        Effective from
                      </span>
                      <input
                        type="date"
                        disabled={!canEdit || saving}
                        value={scheduledFrom}
                        min={tomorrowIsoDate()}
                        onChange={(e) => setScheduledFrom(e.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
                      />
                    </label>
                  </div>
                  {canEdit && (
                    <div className="mt-3">
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => void onSchedule()}>
                        Add scheduled change
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ComponentCard>

          <ComponentCard title="Pending schedule" desc="Future-dated changes not yet live">
            {detailLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : schedule.length === 0 ? (
              <p className="text-sm text-gray-500">No pending scheduled changes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 dark:border-gray-800">
                      <th className="py-2 pr-3 font-medium">Price</th>
                      <th className="py-2 pr-3 font-medium">Effective from</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      {canEdit && <th className="py-2 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-gray-900">
                        <td className="py-2 pr-3">{formatGbp(row.price)}</td>
                        <td className="py-2 pr-3">{String(row.effective_from).slice(0, 10)}</td>
                        <td className="py-2 pr-3">{row.status}</td>
                        {canEdit && (
                          <td className="py-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void onCancelSchedule(row.id)}
                              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ComponentCard>

          <ComponentCard title="Price change history" desc="Audit trail of catalogue price changes">
            {detailLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-500">No price history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 dark:border-gray-800">
                      <th className="py-2 pr-3 font-medium">When</th>
                      <th className="py-2 pr-3 font-medium">Previous</th>
                      <th className="py-2 pr-3 font-medium">New</th>
                      <th className="py-2 pr-3 font-medium">Effective</th>
                      <th className="py-2 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-gray-900">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.created_at ? String(row.created_at).replace("T", " ").slice(0, 19) : "—"}
                        </td>
                        <td className="py-2 pr-3">{formatGbp(row.previous_price)}</td>
                        <td className="py-2 pr-3">{formatGbp(row.new_price)}</td>
                        <td className="py-2 pr-3">
                          {row.effective_from ? String(row.effective_from).slice(0, 10) : "Immediate"}
                        </td>
                        <td className="py-2">
                          {row.changed_by || "—"}
                          {row.role ? ` (${row.role})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}
