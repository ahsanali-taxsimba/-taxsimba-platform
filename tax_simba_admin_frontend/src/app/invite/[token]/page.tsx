"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { nativeApiUrl } from "@/lib/nativeApiUrl";

type InviteInfo = {
  name?: string;
  email?: string;
  role?: string;
};

function inviteErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as {
    detail?: unknown;
    message?: unknown;
    error?: { message?: unknown };
  };
  if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.error?.message === "string" && body.error.message.trim()) {
    return body.error.message;
  }
  return fallback;
}

/**
 * Staff password-setup page.
 * Public URL (with Next basePath): /admin/invite/{token}
 */
export default function StaffInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token ?? "").trim();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("This invitation link is incomplete.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(nativeApiUrl(`/api/auth/invite/${encodeURIComponent(token)}`), {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setInvite(null);
          setError(
            inviteErrorMessage(
              data,
              "This invitation is no longer valid. It may have expired or already been used.",
            ),
          );
          return;
        }
        setInvite(data as InviteInfo);
      } catch {
        if (!cancelled) {
          setError("Unable to check this invitation. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Please choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        nativeApiUrl(`/api/auth/invite/${encodeURIComponent(token)}/accept`),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          inviteErrorMessage(
            data,
            "Could not activate this account. The invitation may have expired or already been used.",
          ),
        );
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2000);
    } catch {
      setError("Could not activate this account. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F8] px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-[#E3E7E4] bg-white p-8 shadow-sm">
        <div className="text-lg font-bold text-[#006B3C]">TaxSimba</div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Set up your account</h1>
        <p className="mt-2 text-sm text-[#626A65]">
          Create a password to activate your staff access, then sign in.
        </p>

        {loading && (
          <p className="mt-6 text-sm text-[#626A65]" data-testid="invite-loading">
            Checking your invitation…
          </p>
        )}

        {!loading && done && (
          <p className="mt-6 text-sm font-semibold text-[#16A05D]" data-testid="invite-done">
            Your password is set. Taking you to sign in…
          </p>
        )}

        {!loading && !done && invite && (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} data-testid="invite-form">
            <p className="text-sm text-[#626A65]" data-testid="invite-summary">
              {invite.name}
              {invite.email ? ` · ${invite.email}` : ""}
              {invite.role ? ` · ${invite.role}` : ""}
            </p>
            <div>
              <label htmlFor="invite-password" className="block text-sm font-medium text-gray-800">
                Create a password
              </label>
              <input
                id="invite-password"
                data-testid="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:border-[#078A4B] focus:outline-none focus:ring-2 focus:ring-[#078A4B]/40"
              />
            </div>
            <div>
              <label
                htmlFor="invite-password-confirm"
                className="block text-sm font-medium text-gray-800"
              >
                Confirm password
              </label>
              <input
                id="invite-password-confirm"
                data-testid="invite-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:border-[#078A4B] focus:outline-none focus:ring-2 focus:ring-[#078A4B]/40"
              />
            </div>
            <button
              type="submit"
              data-testid="invite-submit-btn"
              disabled={submitting}
              className="w-full rounded-lg bg-[#078A4B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#006B3C] disabled:opacity-60"
            >
              {submitting ? "Activating…" : "Activate my account"}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-[#D64545]" data-testid="invite-error" role="alert">
            {error}
          </p>
        )}

        <p className="mt-8 text-sm text-[#626A65]">
          Already activated?{" "}
          <Link href="/auth/signin" className="font-semibold text-[#006B3C] underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
