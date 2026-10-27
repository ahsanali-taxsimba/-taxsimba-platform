"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/marketing-hub/dashboard", label: "Dashboard" },
  { href: "/marketing-hub/content-library", label: "Content Library" },
  { href: "/marketing-hub/ai-marketing", label: "AI Marketing" },
  { href: "/marketing-hub/auto-seo", label: "Auto SEO" },
  { href: "/marketing-hub/results", label: "Results & Connections" },
];

const BRAND = {
  forest: "#031f18",
  green: "#37A267",
  mint: "#EAF6F0",
  lime: "#B3ED97",
};

export function HubShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const relative = pathname.replace(/^\/admin/, "") || pathname;

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-5 md:p-6"
        style={{ background: BRAND.mint, borderColor: BRAND.lime }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Genuine TaxSimba wordmark copied from tax_simba_frontend/public/images/logo.svg — never AI-regenerated */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admin/images/taxsimba-logo.svg"
            alt="TaxSimba"
            width={160}
            height={28}
            className="h-7 w-auto"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.green }}>
              AI Marketing Hub
            </p>
            <h1 className="text-xl font-bold md:text-2xl" style={{ color: BRAND.forest }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Targets (not guarantees): 1,000 paying MTD by 31 Dec 2026 · 5,000 paying Self Assessment by
          31 Jan 2027. Prices in drafts are proposed only until checkout is verified.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = relative === tab.href || relative.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-lg px-3 py-2 text-sm font-medium transition"
              style={
                active
                  ? { background: BRAND.forest, color: "#fff" }
                  : { background: "#fff", color: BRAND.forest, border: `1px solid ${BRAND.lime}` }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

export function StatePill({ state }: { state?: string }) {
  const label =
    state === "not_connected"
      ? "Not Connected"
      : state === "no_data"
        ? "No Data"
        : state === "ok"
          ? "OK"
          : state || "Unknown";
  const bg =
    state === "ok" ? BRAND.lime : state === "not_connected" ? "#fde68a" : "#e5e7eb";
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: bg, color: BRAND.forest }}
    >
      {label}
    </span>
  );
}

export { BRAND };
