"use client";
import Link from "next/link";
import { addSecondServiceLabel, addSecondServicePath } from "@/lib/catalogueJourney";

/**
 * C-004 — visible CTA for SA-only / MTD-only clients to buy the other service
 * on the same account. Hidden when both are ACTIVE or neither is paid.
 */
export default function AddSecondServiceBanner({ session, account }) {
  const source = {
    hasActiveSa: account?.hasActiveSa ?? session?.hasActiveSa ?? session?.user?.hasActiveSa,
    hasActiveMtd: account?.hasActiveMtd ?? session?.hasActiveMtd ?? session?.user?.hasActiveMtd,
  };
  const href = addSecondServicePath(source);
  const label = addSecondServiceLabel(source);
  if (!href || !label) return null;

  const isAddMtd = href.includes("category=mtd");

  return (
    <div
      className="add-second-service-banner mb-3"
      data-testid="add-second-service-banner"
      style={{
        background: "rgba(55, 162, 103, 0.08)",
        border: "1px solid rgba(55, 162, 103, 0.28)",
        borderRadius: "10px",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div className="fw-semibold" style={{ color: "#0d2b1e" }}>
          {isAddMtd
            ? "Need Making Tax Digital as well?"
            : "Need Self Assessment as well?"}
        </div>
        <div className="small text-muted mb-0">
          Keep your current service. Add the other on this same account after checkout.
        </div>
      </div>
      <Link
        href={href}
        className="btn btn-sm btn-success"
        data-testid="add-second-service-cta"
        style={{ backgroundColor: "#14ab71", border: "none", whiteSpace: "nowrap" }}
      >
        {label}
      </Link>
    </div>
  );
}
