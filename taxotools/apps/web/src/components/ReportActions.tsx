"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportActions({
  workspaceId,
  siteId,
}: {
  workspaceId: string;
  siteId: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report",
        workspaceId,
        siteId,
        title: "SEO + AEO Audit",
        whiteLabel: false,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Report ${data.report.id} queued` : data.error);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={create}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
      >
        Generate report
      </button>
      {msg && <p className="mt-2 text-sm text-accent-dark">{msg}</p>}
    </div>
  );
}
