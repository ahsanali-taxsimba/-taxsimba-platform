/**
 * Redirects new clients to AML onboarding when CDD is not yet approved.
 * Mounts inside AppShell for CLIENT users (before engagement letter gate).
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const ALLOWED_WHILE_PENDING = [
  "/aml",
  "/profile",
  "/settings",
  "/help",
  "/service-issues",
  "/login",
];

export default function AmlGate({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [state, setState] = useState({ loaded: false, ok: true, status: null });

  useEffect(() => {
    if (user?.role !== "CLIENT") return undefined;
    let live = true;
    api
      .get("/aml/gate")
      .then(({ data }) => {
        if (!live) return;
        setState({ loaded: true, ok: Boolean(data.ok), status: data.status, reason: data.reason });
      })
      .catch(() => live && setState({ loaded: true, ok: true }));
    return () => {
      live = false;
    };
  }, [user?.role, loc.pathname]);

  useEffect(() => {
    if (user?.role !== "CLIENT" || !state.loaded || state.ok) return;
    const allowed = ALLOWED_WHILE_PENDING.some(
      (p) => loc.pathname === p || loc.pathname.startsWith(`${p}/`),
    );
    if (!allowed) nav("/aml", { replace: true });
  }, [state, loc.pathname, user?.role, nav]);

  if (user?.role !== "CLIENT") return children;

  return (
    <>
      {state.loaded && !state.ok && (
        <div
          data-testid="aml-pending-banner"
          className="bg-[#FDF3E3] border-b border-[#F0D9A8] px-4 py-2.5 text-sm text-[#8A5A10] text-center"
        >
          <strong>Identity verification required.</strong> Complete your AML/KYC check before
          activating services.{" "}
          <Link to="/aml" className="font-semibold text-[#006B3C] underline" data-testid="aml-banner-link">
            Continue verification
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
