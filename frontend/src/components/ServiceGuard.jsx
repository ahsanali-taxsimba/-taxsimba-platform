import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { loadEntitlements, serviceAllowed } from "@/lib/services";

// Client routes are only reachable when the matching service is ACTIVE on the client's record.
export function ServiceGuard({ serviceType, children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    let live = true;
    loadEntitlements().then((entitlements) => {
      if (!live) return;
      setState(serviceAllowed(entitlements, serviceType) ? "allowed" : "blocked");
    });
    return () => {
      live = false;
    };
  }, [serviceType]);

  if (state === "loading") {
    return <div data-testid="service-guard-loading" className="min-h-screen flex items-center justify-center text-sm text-[#626A65]">Loading…</div>;
  }
  if (state === "blocked") return <Navigate to="/dashboard" replace />;
  return children;
}
