"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { TOOLKIT_GROUPS } from "@taxotools/shared";
import {
  DashboardShell,
  Button,
  useTheme,
  type SidebarGroup,
  type SidebarItem,
} from "@/ui";

const topNav = [
  { href: "/app", label: "Command center", exact: true, icon: "⌘" },
  { href: "/app/intelligence", label: "UK Intelligence", exact: false, icon: "◎" },
  { href: "/app/sites", label: "Projects", exact: false, icon: "◫" },
  { href: "/app/toolkits", label: "Toolkits", exact: false, icon: "▦" },
];

const bottomNav = [
  { href: "/app/settings", label: "Settings", icon: "⚙" },
  { href: "/app/billing", label: "Billing", icon: "◈" },
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
  const { mode, toggleMode, department, setDepartment } = useTheme();
  const [deptOpen, setDeptOpen] = useState(false);

  const navItems: SidebarItem[] = useMemo(
    () =>
      [
        ...topNav.map((item) => ({
          id: item.href,
          label: item.label,
          href: item.href,
          icon: item.icon,
          active: item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/"),
        })),
        ...bottomNav.map((item) => ({
          id: item.href,
          label: item.label,
          href: item.href,
          icon: item.icon,
          active: pathname === item.href || pathname.startsWith(item.href + "/"),
        })),
      ],
    [pathname],
  );

  const navGroups: SidebarGroup[] = useMemo(
    () =>
      TOOLKIT_GROUPS.map((group) => ({
        id: group.id,
        label: group.name,
        defaultOpen: false,
        items: group.tools.map((tool) => ({
          id: tool.id,
          label: tool.name,
          href: toolHref(primarySiteId, tool.path),
          icon: tool.name.slice(0, 1),
          active: pathname.includes(`/tools/${tool.path}`),
        })),
      })),
    [pathname, primarySiteId],
  );

  const subtitle = (
    <>
      <span className="block truncate">{accountName}</span>
      {primarySiteDomain ? (
        <span className="mt-2 inline-block truncate rounded-pill bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-medium text-[var(--accent-blue)]">
          Active: {primarySiteDomain}
        </span>
      ) : (
        <Link href="/onboarding" className="mt-2 block text-[11px] font-medium text-[var(--link-blue)]">
          Add a site to unlock tools →
        </Link>
      )}
    </>
  );

  return (
    <DashboardShell
      brand="Taxotools"
      subtitle={subtitle}
      navItems={navItems}
      navGroups={navGroups}
      headerLeft={
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Signed in as</p>
          <p className="text-sm font-medium text-[var(--text-main)]">{email}</p>
        </div>
      }
      headerRight={
        <>
          <div className="relative hidden sm:block">
            <Button variant="ghost" size="sm" onClick={() => setDeptOpen((v) => !v)}>
              {department}
            </Button>
            {deptOpen && (
              <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-1 shadow-lg">
                {(["default", "marketing", "admin", "ops"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-[var(--accent-soft)]"
                    onClick={() => {
                      setDepartment(d);
                      setDeptOpen(false);
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={toggleMode} className="hidden sm:inline-flex">
            {mode === "light" ? "Dark" : "Light"}
          </Button>
          {primarySiteId && (
            <Link
              href={`/app/sites/${primarySiteId}`}
              className="hidden rounded-pill border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-muted)] sm:inline-flex"
            >
              Site dashboard
            </Link>
          )}
          <Link
            href="/app/intelligence"
            className="hidden rounded-pill border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-muted)] sm:inline-flex"
          >
            Intelligence
          </Link>
          <Link
            href="/onboarding"
            className="rounded-pill bg-[var(--accent-blue)] px-5 py-2 text-sm font-semibold text-[var(--text-inverse)] hover:opacity-90"
          >
            Add site
          </Link>
        </>
      }
      fabActions={[
        { id: "add-site", label: "Add site", href: "/onboarding", primary: true },
        ...(primarySiteId
          ? [
              {
                id: "crawl",
                label: "Run crawl",
                href: `/app/sites/${primarySiteId}/technical`,
              },
            ]
          : []),
        { id: "intel", label: "Intelligence", href: "/app/intelligence" },
      ]}
      sidebarFooter={
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-none bg-transparent px-0 py-0 text-left text-sm font-normal text-[var(--text-secondary)] shadow-none hover:text-[var(--danger)]"
          >
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}
