"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import CheckInbox from "../../../components/default/CheckInbox";
import RegistrationLoginLayout from "../_authLayout/RegistrationLoginLayout";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useReVerifyEmail } from "@/hooks/reVerifyEmail";
import { safeContinuePath } from "@/lib/catalogueJourney";

// Per-token guard only (module-level boolean blocked every later user in the same
// Next.js process after the first verification — broke Stripe acceptance).
const verifiedTokens = new Set();
const INVALID_TOKEN_MESSAGE = "Invalid or expired verification token.";

function isInvalidOrExpiredMessage(message) {
  if (!message) return false;
  const m = String(message).toLowerCase();
  return (
    message === INVALID_TOKEN_MESSAGE ||
    m.includes("invalid") ||
    m.includes("expired") ||
    m.includes("not found")
  );
}

const VerifyEmail = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [formEmail, setFormEmail] = useState("");
  const [canSendAgain, setCanSendAgain] = useState(false);
  const [loginHref, setLoginHref] = useState("/login");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefer a single token query value (getAll() returns an array that stringifies poorly).
  const token = searchParams.get("token") || searchParams.getAll("token")[0] || "";

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setLoading(false);
      setMessage(INVALID_TOKEN_MESSAGE);
      return undefined;
    }

    async function verifyEmail() {
      if (verifiedTokens.has(token)) {
        // Remount after a completed attempt must not spin forever.
        if (!cancelled) {
          setLoading(false);
          setMessage((prev) => prev || INVALID_TOKEN_MESSAGE);
        }
        return;
      }
      verifiedTokens.add(token);
      try {
        const response = await axios.post(
          process.env.NEXT_PUBLIC_API_URL +
            `auth/verify-email?token=${encodeURIComponent(token)}`,
        );

        if (cancelled) return;

        if (response?.status == 200 || response?.status == 201) {
          setMessage("Your email verification is successfully completed");
          // Journey comes from server-persisted intent in the verify response — not the URL.
          const data = response?.data?.data || response?.data || {};
          const continuePath = safeContinuePath(
            data.continuePath || data.continue_path || null,
          );
          if (continuePath) {
            setLoginHref(`/login?next=${encodeURIComponent(continuePath)}`);
          }
        } else {
          const fallbackMessage =
            response?.data?.message || "Token verification failed.";
          setMessage(fallbackMessage);
        }
      } catch (error) {
        if (cancelled) return;
        const errMessage =
          error?.response?.data?.message ||
          "An error occurred during verification.";
        setMessage(errMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verifyEmail();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLogin = () => {
    router.push(loginHref);
  };

  const handleSendAgain = async () => {
    if (formEmail === "") {
      toast.error("Please enter your email");
      return;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail) === false) {
      toast.error("Please enter a valid email address");
      return;
    }

    const { type, message: reverifyMessage } = await useReVerifyEmail(formEmail);
    if (type) {
      toast.success(reverifyMessage);
      setCanSendAgain(false);
      setFormEmail("");
    } else {
      toast.error(reverifyMessage);
    }
  };

  const showSendAgain = !loading && isInvalidOrExpiredMessage(message);

  return (
    <div>
      <RegistrationLoginLayout>
        <CheckInbox
          h3Text={loading ? "Verifying your email…" : message}
          inputBox={
            canSendAgain && (
              <>
                <label className="form-label">Email</label>
                <input
                  name="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  type="email"
                  placeholder="Enter your email"
                  className="form-control"
                  required
                />
              </>
            )
          }
          button={
            loading ? (
              ""
            ) : showSendAgain ? (
              <button
                className="basic_btn yellow_btn "
                id="ifsure"
                onClick={() => {
                  canSendAgain ? handleSendAgain() : setCanSendAgain(true);
                }}
              >
                {"send again"}
              </button>
            ) : (
              <button
                className="common-btn w-100 justify-content-center text-center"
                id="ifsure"
                onClick={handleLogin}
              >
                {"Go To Login"}
              </button>
            )
          }
        />
      </RegistrationLoginLayout>
    </div>
  );
};

export default VerifyEmail;
