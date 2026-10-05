"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { serviceWorkspaceFlags } from "@/lib/clientDisplayName";

/**
 * Deliberate SA ↔ MTD workspace switch for dual-service accounts.
 * Hidden for single-service / pending-only clients.
 * Prefer live account ownership (get-account-details) over stale JWT session.
 */
export default function ServiceWorkspaceSwitcher({ session, account }) {
  const pathname = usePathname();
  const merged = {
    ...(session || {}),
    ...(session?.user || {}),
    hasActiveSa:
      account?.hasActiveSa ?? session?.hasActiveSa ?? session?.user?.hasActiveSa,
    hasActiveMtd:
      account?.hasActiveMtd ?? session?.hasActiveMtd ?? session?.user?.hasActiveMtd,
    ownership: account?.ownership ?? session?.ownership ?? session?.user?.ownership,
  };
  const flags = serviceWorkspaceFlags(merged);
  if (!flags.isBoth) return null;

  const onMtd = pathname?.startsWith("/mtd-dashboard");
  const onSa = pathname?.startsWith("/dashboard");

  return (
    <div
      className="service-workspace-switcher d-flex align-items-center gap-2 flex-wrap"
      data-testid="service-workspace-switcher"
      style={{
        background: "rgba(13, 43, 30, 0.06)",
        border: "1px solid rgba(13, 43, 30, 0.12)",
        borderRadius: "10px",
        padding: "8px 12px",
        marginBottom: "16px",
      }}
    >
      <span className="small text-muted fw-semibold text-uppercase" style={{ letterSpacing: "0.04em" }}>
        Your services
      </span>
      <Link
        href="/dashboard"
        className={`btn btn-sm ${onSa ? "btn-success" : "btn-outline-secondary"}`}
        data-testid="switch-to-sa"
      >
        Self Assessment
      </Link>
      <Link
        href="/mtd-dashboard"
        className={`btn btn-sm ${onMtd ? "btn-success" : "btn-outline-secondary"}`}
        data-testid="switch-to-mtd"
      >
        Making Tax Digital
      </Link>
    </div>
  );
}
