"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Link2, Plus } from "lucide-react";

const nav = [
  { href: "/", label: "Leads", icon: Inbox, testId: "nav-leads" },
  { href: "/connections", label: "Connections", icon: Link2, testId: "nav-connections" },
];

export function AppShell({
  children,
  viewerName,
  sampleDatabase,
  onNewLead,
}: {
  children: React.ReactNode;
  viewerName?: string;
  sampleDatabase?: boolean;
  onNewLead?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-0 md:gap-6 md:px-6 md:py-6">
        <aside
          className="hidden w-60 shrink-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] md:flex"
          data-testid="app-sidebar"
        >
          <div className="mb-8">
            <p
              className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--ink)]"
              data-testid="brand-name"
            >
              LeadInbox
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">New business leads, one place</p>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--ink-soft)] hover:bg-[var(--mist)]"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-[var(--line)] pt-4">
            {onNewLead ? (
              <button
                type="button"
                onClick={onNewLead}
                data-testid="sidebar-new-lead"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#b46822]"
              >
                <Plus size={16} />
                Add lead
              </button>
            ) : null}
            <div className="text-xs text-[var(--muted)]" data-testid="viewer-chip">
              {viewerName ? `Signed in as ${viewerName}` : "Loading…"}
              {sampleDatabase ? (
                <span className="mt-1 block text-[var(--accent)]">Sample database (local)</span>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/90 px-4 py-3 backdrop-blur-md md:hidden">
            <p className="font-[family-name:var(--font-display)] text-lg font-extrabold">LeadInbox</p>
            <div className="flex gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`mobile-${item.testId}`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    pathname === item.href ? "bg-[var(--ink)] text-white" : "bg-[var(--mist)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
