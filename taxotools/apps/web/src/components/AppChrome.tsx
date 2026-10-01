"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { TOOLKIT_GROUPS } from "@taxotools/shared";
import { SlideInLeft, MotionButton, MotionDrawer } from "@/motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const topNav = [
  { href: "/app", label: "Command center", exact: true },
  { href: "/app/intelligence", label: "UK Intelligence", exact: false },
  { href: "/app/sites", label: "Projects", exact: false },
  { href: "/app/toolkits", label: "Toolkits", exact: false },
];

const bottomNav = [
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

function toolHref(primarySiteId: string | null | undefined, path: string) {
  if (primarySiteId) return `/app/sites/${primarySiteId}/tools/${path}`;
  return "/onboarding";
}

export function AppChrome({
  accountName,
  email,
  primarySiteId,
  primarySiteDomain,
  signOutAction,
  children,
}: {
  accountName?: string | null;
  email: string;
  primarySiteId?: string | null;
  primarySiteDomain?: string | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Collapse by default so the sidebar feels calmer; expand on demand.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOOLKIT_GROUPS.map((g) => [g.id, false])),
  );
  const reduce = usePrefersReducedMotion();

  const toolCount = useMemo(
    () => TOOLKIT_GROUPS.reduce((n, g) => n + g.tools.length, 0),
    [],
  );

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const NavBody = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-1">
        <Link href="/app" className="font-display text-xl font-semibold text-apple-text">
          Taxotools
        </Link>
        <p className="mt-1 truncate text-xs text-apple-muted">{accountName}</p>
        {primarySiteDomain && (
          <p className="mt-2 truncate rounded-pill bg-accent-soft px-3 py-1 text-[11px] font-medium text-accent-dark">
            Active: {primarySiteDomain}
          </p>
        )}
        {!primarySiteId && (
          <Link
            href="/onboarding"
            className="content-link mt-2 block text-[11px] font-medium"
            onClick={() => setMobileOpen(false)}
          >
            Add a site to unlock tools →
          </Link>
        )}
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-4">
        <div className="space-y-0.5">
          {topNav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block rounded-pill px-2.5 py-1.5 text-sm font-medium",
                  active
                    ? "bg-accent-soft text-accent-dark"
                    : "text-ink-700 hover:bg-apple-bg hover:text-apple-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div>
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-apple-muted">
            Auto SEO modules · {toolCount}
          </p>
          <div className="space-y-2">
            {TOOLKIT_GROUPS.map((group) => {
              const open = openGroups[group.id] ?? true;
              return (
                <div key={group.id} className="rounded-xl border border-apple-border/80 bg-apple-bg/60">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between rounded-none bg-transparent px-2.5 py-2 text-left text-sm font-semibold text-apple-text shadow-none"
                  >
                    <span className="text-xs font-semibold text-ink-800">{group.name}</span>
                    <span className="text-[10px] text-apple-muted">
                      {group.tools.length} {open ? "▾" : "▸"}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <m.ul
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-0.5 overflow-hidden px-1.5 pb-2"
                      >
                        {group.tools.map((tool) => {
                          const href = toolHref(primarySiteId, tool.path);
                          const active = pathname.includes(`/tools/${tool.path}`);
                          return (
                            <li key={tool.id}>
                              <Link
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "block rounded-md px-2 py-1 text-[12px] leading-snug",
                                  active
                                    ? "bg-white font-medium text-accent-dark shadow-sm"
                                    : "text-ink-600 hover:bg-white hover:text-ink-900",
                                )}
                                title={
                                  primarySiteId
                                    ? tool.name
                                    : "Add a site first to open this tool"
                                }
                              >
                                {tool.name}
                              </Link>
                            </li>
                          );
                        })}
                      </m.ul>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-0.5 border-t border-apple-border pt-3">
          {bottomNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block rounded-pill px-2.5 py-1.5 text-sm font-medium",
                  active
                    ? "bg-accent-soft text-accent-dark"
                    : "text-ink-700 hover:bg-apple-bg hover:text-apple-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <form action={signOutAction} className="shrink-0 border-t border-apple-border pt-3">
        <button
          type="submit"
          className="rounded-none bg-transparent px-0 py-0 text-left text-sm font-normal text-apple-muted shadow-none hover:text-danger"
        >
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-apple-bg text-apple-text">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <SlideInLeft className="hidden h-screen w-72 shrink-0 border-r border-apple-border bg-apple-panel px-3 py-5 md:sticky md:top-0 md:block">
          {NavBody}
        </SlideInLeft>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-apple-border bg-apple-panel/90 px-6 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <MotionButton
                type="button"
                variant="outline"
                className="md:hidden px-3 py-1.5 text-sm"
                onClick={() => setMobileOpen(true)}
              >
                Menu
              </MotionButton>
              <div>
                <p className="text-xs uppercase tracking-wide text-apple-muted">Signed in as</p>
                <p className="text-sm font-medium text-apple-text">{email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {primarySiteId && (
                <Link
                  href={`/app/sites/${primarySiteId}`}
                  className="hidden rounded-pill border border-apple-border px-4 py-2 text-sm text-apple-text hover:bg-apple-bg sm:inline-flex"
                >
                  Site dashboard
                </Link>
              )}
              <Link
                href="/app/intelligence"
                className="hidden rounded-pill border border-apple-border px-4 py-2 text-sm text-apple-text hover:bg-apple-bg sm:inline-flex"
              >
                Intelligence
              </Link>
              <Link
                href="/onboarding"
                className="rounded-pill bg-accent px-5 py-2 text-sm font-semibold text-apple-inverse hover:bg-accent-dark"
              >
                Add site
              </Link>
            </div>
          </header>
          <div className="bg-apple-bg px-6 py-10 md:px-10">{children}</div>
        </div>
      </div>

      <MotionDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <div className="flex h-full flex-col overflow-hidden">{NavBody}</div>
      </MotionDrawer>
    </div>
  );
}
