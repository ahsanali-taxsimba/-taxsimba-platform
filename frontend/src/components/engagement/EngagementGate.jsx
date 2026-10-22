/**
 * Client-side engagement gate — pops the Engagement Letter modal whenever
 * a purchased service is awaiting signature (replaces Client Care Letter UX).
 *
 * Mount inside AppShell for CLIENT users so it appears across onboarding,
 * payment success return, and dashboard.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import EngagementLetterModal from "@/components/engagement/EngagementLetterModal";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export function useEngagementStatus() {
  const [state, setState] = useState({ loaded: false, pending: false, engagement: null, ok: true });

  const refresh = useCallback(() => {
    return api
      .get("/engagement/me")
      .then(({ data }) => {
        setState({
          loaded: true,
          pending: Boolean(data.pending_signature),
          engagement: data.engagement,
          ok: Boolean(data.ok),
          reason: data.reason || data.message || null,
        });
        return data;
      })
      .catch(() => {
        setState((s) => ({ ...s, loaded: true }));
      });
  }, []);

  return { ...state, refresh };
}

export default function EngagementGate({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { pending, engagement, refresh, loaded, reason } = useEngagementStatus();

  useEffect(() => {
    if (user?.role !== "CLIENT") return undefined;
    refresh();
  }, [user?.role, loc.pathname, refresh]);

  useEffect(() => {
    if (loaded && pending) setOpen(true);
  }, [loaded, pending]);

  if (user?.role !== "CLIENT") return children;

  return (
    <>
      {pending && (
        <div
          data-testid="engagement-pending-banner"
          className="bg-[#FDF3E3] border-b border-[#F0D9A8] px-4 py-2.5 text-sm text-[#B77A12] text-center"
        >
          <strong>Engagement letter pending signature.</strong>{" "}
          {reason || "Please sign to continue with tax and MTD services."}{" "}
          <button
            type="button"
            className="font-semibold underline"
            data-testid="engagement-banner-open"
            onClick={() => setOpen(true)}
          >
            Review and sign
          </button>
        </div>
      )}
      {children}
      <EngagementLetterModal
        open={open && pending}
        engagement={engagement}
        required
        onClose={() => {
          // Required while pending — ignore dismiss; allow close only after refresh shows signed.
          refresh().then((data) => {
            if (data?.ok) setOpen(false);
          });
        }}
        onSigned={() => {
          refresh().then(() => setOpen(false));
        }}
      />
    </>
  );
}
