"use client";

import { useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { pageTransition } from "@/ui/animations";
import { SmartSidebar, type SidebarGroup, type SidebarItem } from "@/ui/components/SmartSidebar";
import { FloatingActionBar, type FabAction } from "@/ui/components/FloatingActionBar";
import { Drawer } from "@/ui/components/Drawer";
import { Button } from "@/ui/components/Button";

export function DashboardShell({
  brand = "Taxotools",
  subtitle,
  navItems = [],
  navGroups = [],
  headerLeft,
  headerRight,
  fabActions = [],
  sidebarFooter,
  children,
  className,
}: {
  brand?: ReactNode;
  subtitle?: ReactNode;
  navItems?: SidebarItem[];
  navGroups?: SidebarGroup[];
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  fabActions?: FabAction[];
  sidebarFooter?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sidebar = (
    <SmartSidebar
      brand={brand}
      subtitle={subtitle}
      items={navItems}
      groups={navGroups}
      footer={sidebarFooter}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      className="h-full"
    />
  );

  return (
    <div className={cn("min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]", className)}>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--gradient-a) 16%, transparent), transparent), radial-gradient(900px 500px at 90% 0%, color-mix(in srgb, var(--gradient-b) 14%, transparent), transparent)",
        }}
      />
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <div className="sticky top-0 hidden h-screen shrink-0 md:block">{sidebar}</div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--glass-border)] bg-[var(--glass)] px-4 py-3 backdrop-blur-xl md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                Menu
              </Button>
              {headerLeft}
            </div>
            <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
          </header>

          <m.main
            className="flex-1 px-4 py-8 pb-24 md:px-10"
            variants={pageTransition}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            {children}
          </m.main>
        </div>
      </div>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <div className="h-full overflow-hidden" onClick={() => setMobileOpen(false)}>
          <SmartSidebar
            brand={brand}
            subtitle={subtitle}
            items={navItems}
            groups={navGroups}
            footer={sidebarFooter}
            collapsed={false}
          />
        </div>
      </Drawer>

      <FloatingActionBar actions={fabActions} />
    </div>
  );
}
