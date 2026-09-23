"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AnimatedCard,
  StaggerChildren,
  StaggerItem,
  MotionButton,
  ScaleIn,
} from "@/motion";

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
    <StaggerChildren className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => (
        <StaggerItem key={p.code}>
          <AnimatedCard
            className={`p-5 ${p.code === currentPlanCode ? "border-accent" : ""}`}
            interactive={p.code !== currentPlanCode}
          >
            <p className="font-display text-xl font-semibold">{p.name}</p>
            <p className="mt-1 text-2xl font-semibold">
              {p.monthlyPriceCents === 0 ? "Custom" : `$${(p.monthlyPriceCents / 100).toFixed(0)}`}
              {p.monthlyPriceCents > 0 && (
                <span className="text-sm font-normal text-ink-500">/mo</span>
              )}
            </p>
            <ul className="mt-4 space-y-1 text-sm text-ink-500">
              <li>{p.sitesLimit < 0 ? "Unlimited" : p.sitesLimit} sites / Auto SEO projects</li>
              <li>{p.keywordsLimit < 0 ? "Unlimited" : p.keywordsLimit} keywords</li>
              <li>
                {p.aiCreditsPerMonth < 0 ? "Unlimited" : p.aiCreditsPerMonth} AI credits
              </li>
              <li>
                {p.aeoScansPerMonth < 0 ? "Unlimited" : p.aeoScansPerMonth} AEO / LLM scans
              </li>
              <li>{p.whiteLabel ? "White-label" : "Standard branding"}</li>
              <li>{p.apiAccess ? "API access" : "No API"}</li>
            </ul>
            <MotionButton
              type="button"
              disabled={p.code === currentPlanCode}
              onClick={() => choose(p.code)}
              className="mt-5 w-full disabled:bg-ink-100 disabled:text-ink-500"
            >
              {p.code === currentPlanCode ? "Current plan" : "Select"}
            </MotionButton>
          </AnimatedCard>
        </StaggerItem>
      ))}
      {msg && (
        <ScaleIn className="md:col-span-2 xl:col-span-4">
          <p className="text-sm text-accent-dark">{msg}</p>
        </ScaleIn>
      )}
    </StaggerChildren>
  );
}
