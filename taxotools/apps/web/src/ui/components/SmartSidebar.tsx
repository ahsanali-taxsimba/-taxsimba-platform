"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { slideUp } from "@/ui/animations";

export type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: string | number;
};

export type SidebarGroup = {
  id: string;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
};

export function SmartSidebar({
  brand,
  subtitle,
  items = [],
  groups = [],
  footer,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  className,
}: {
  brand: ReactNode;
  subtitle?: ReactNode;
  items?: SidebarItem[];
  groups?: SidebarGroup[];
  footer?: ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false])),
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-[var(--glass-border)] bg-[var(--glass)] backdrop-blur-xl transition-[width] duration-300",
        collapsed ? "w-[72px]" : "w-72",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-2 px-3 py-5", collapsed && "px-2")}>
        <div className="min-w-0 overflow-hidden">
          <div className={cn("font-display text-xl font-semibold text-[var(--text-main)]", collapsed && "text-center text-base")}>
            {brand}
          </div>
          {!collapsed && subtitle && (
            <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">{subtitle}</div>
          )}
        </div>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 rounded-pill border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)]"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-4">
        {items.length > 0 && (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pill px-2.5 py-2 text-sm font-medium transition-colors",
                    item.active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-blue)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[13px]">
                    {item.icon ?? item.label.slice(0, 1)}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge != null && (
                    <span className="ml-auto rounded-pill bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-semibold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {groups.map((group) => {
          const open = openGroups[group.id] ?? false;
          return (
            <div
              key={group.id}
              className="rounded-[16px] border border-[var(--border-subtle)]/80 bg-[var(--bg-muted)]/40"
            >
              <button
                type="button"
                onClick={() => setOpenGroups((p) => ({ ...p, [group.id]: !open }))}
                className={cn(
                  "flex w-full items-center justify-between rounded-none bg-transparent px-2.5 py-2 text-left shadow-none",
                  collapsed && "justify-center px-2",
                )}
                title={group.label}
              >
                {!collapsed ? (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{open ? "▾" : "▸"}</span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {group.label.slice(0, 1)}
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {(open || collapsed) && (
                  <m.ul
                    variants={slideUp}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-0.5 px-1.5 pb-2"
                  >
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          title={item.label}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors",
                            item.active
                              ? "bg-[var(--bg-panel)] font-medium text-[var(--accent-blue)] shadow-sm"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]",
                            collapsed && "justify-center",
                          )}
                        >
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                            {item.icon ?? item.label.slice(0, 1)}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    ))}
                  </m.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {footer && (
        <div className={cn("shrink-0 border-t border-[var(--border-subtle)] px-3 py-3", collapsed && "px-2")}>
          {footer}
        </div>
      )}
    </aside>
  );
}
