import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";

// Client routes are only reachable when the matching service is ACTIVE on the client's record.
export function ServiceGuard({ serviceType, children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    api.get("/my-services")
      .then(({ data }) => setState((data.services || []).some(
        (s) => s.service_type === serviceType && s.status === "ACTIVE") ? "allowed" : "blocked"))
      .catch(() => setState("allowed"));
  }, [serviceType]);

  if (state === "loading") {
    return <div data-testid="service-guard-loading" className="min-h-screen flex items-center justify-center text-sm text-[#626A65]">Loading…</div>;
  }
  if (state === "blocked") return <Navigate to="/dashboard" replace />;
  return children;
}
