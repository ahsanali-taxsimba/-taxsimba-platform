"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = {
  code: string;
  name: string;
  monthlyPriceCents: number;
  sitesLimit: number;
  keywordsLimit: number;
  aiCreditsPerMonth: number;
  aeoScansPerMonth: number;
  whiteLabel: boolean;
  apiAccess: boolean;
};

export function BillingPanel({
  plans,
  currentPlanCode,
}: {
  plans: Plan[];
  currentPlanCode: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function choose(planCode: string) {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Switched to ${planCode} (${data.mode})` : data.error);
    router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => (
        <div
          key={p.code}
          className={`rounded-xl border bg-white p-5 ${
            p.code === currentPlanCode ? "border-accent" : "border-ink-100"
          }`}
        >
          <p className="font-display text-xl font-semibold">{p.name}</p>
          <p className="mt-1 text-2xl font-semibold">
            {p.monthlyPriceCents === 0 ? "Custom" : `$${(p.monthlyPriceCents / 100).toFixed(0)}`}
            {p.monthlyPriceCents > 0 && (
              <span className="text-sm font-normal text-ink-500">/mo</span>
            )}
          </p>
          <ul className="mt-4 space-y-1 text-sm text-ink-500">
            <li>{p.sitesLimit < 0 ? "Unlimited" : p.sitesLimit} sites</li>
            <li>{p.keywordsLimit < 0 ? "Unlimited" : p.keywordsLimit} keywords</li>
            <li>{p.aiCreditsPerMonth < 0 ? "Unlimited" : p.aiCreditsPerMonth} AI credits</li>
            <li>{p.aeoScansPerMonth < 0 ? "Unlimited" : p.aeoScansPerMonth} AEO scans</li>
            <li>{p.whiteLabel ? "White-label" : "Standard branding"}</li>
            <li>{p.apiAccess ? "API access" : "No API"}</li>
          </ul>
          <button
            type="button"
            disabled={p.code === currentPlanCode}
            onClick={() => choose(p.code)}
            className="mt-5 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500"
          >
            {p.code === currentPlanCode ? "Current plan" : "Select"}
          </button>
        </div>
      ))}
      {msg && <p className="md:col-span-2 xl:col-span-4 text-sm text-accent-dark">{msg}</p>}
    </div>
  );
}
