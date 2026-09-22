"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import { useState } from "react";
import { SlideInLeft, MotionButton, MotionDrawer } from "@/motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Overview" },
  { href: "/app/sites", label: "Sites" },
  { href: "/app/toolkits", label: "Toolkits" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

export function AppChrome({
  accountName,
  email,
  signOutAction,
  children,
}: {
  accountName?: string | null;
  email: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = usePrefersReducedMotion();

  const NavLinks = (
    <nav className="mt-8 space-y-1">
      {nav.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <m.div
            key={item.href}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduce ? { duration: 0 } : { delay: 0.04 * i, duration: 0.25 }}
          >
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent-dark"
                  : "text-ink-700 hover:bg-accent-soft hover:text-accent-dark",
              )}
            >
              {item.label}
            </Link>
          </m.div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <SlideInLeft className="hidden w-60 shrink-0 border-r border-ink-100 bg-white px-4 py-6 md:block">
          <Link href="/app" className="font-display text-xl font-semibold text-ink-950">
            Taxotools
          </Link>
          <p className="mt-1 truncate text-xs text-ink-500">{accountName}</p>
          {NavLinks}
          <form action={signOutAction} className="mt-10">
            <button type="submit" className="text-left text-sm text-ink-500 hover:text-danger">
              Sign out
            </button>
          </form>
        </SlideInLeft>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-ink-100 bg-white/80 px-6 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <MotionButton
                type="button"
                variant="outline"
                className="md:hidden px-3 py-1.5"
                onClick={() => setMobileOpen(true)}
              >
                Menu
              </MotionButton>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Signed in as</p>
                <p className="text-sm font-medium text-ink-900">{email}</p>
              </div>
            </div>
            <Link
              href="/onboarding"
              className="rounded-lg border border-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
            >
              Add site
            </Link>
          </header>
          <div className="px-6 py-8 md:px-8">{children}</div>
        </div>
      </div>

      <MotionDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <Link href="/app" className="font-display text-xl font-semibold">
          Taxotools
        </Link>
        <p className="mt-1 text-xs text-ink-500">{accountName}</p>
        {NavLinks}
      </MotionDrawer>
    </div>
  );
}
