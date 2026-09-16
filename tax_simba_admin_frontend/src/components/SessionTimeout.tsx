"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Modal } from "react-bootstrap";
import { useRouter } from "next/navigation";

export default function SessionTimeout() {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  // 30 minutes in milliseconds
  const TIMEOUT_MS = 30 * 60 * 1000;
  // Warning at 28 minutes
  const WARNING_TIME_MS = 28 * 60 * 1000;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (status === "authenticated") {
      warningRef.current = setTimeout(() => {
        setShowWarning(true);
      }, WARNING_TIME_MS);

      timeoutRef.current = setTimeout(() => {
        setShowWarning(false);
        signOut({
          callbackUrl: "/admin/auth/signin",
          redirect: true,
        });
      }, TIMEOUT_MS);
    }
  };

  const handleUserActivity = () => {
    if (!showWarning) {
      resetTimer();
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      resetTimer();

      const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
      events.forEach((event) => {
        window.addEventListener(event, handleUserActivity);
      });

      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        events.forEach((event) => {
          window.removeEventListener(event, handleUserActivity);
        });
      };
    }
  }, [status, showWarning]);

  const handleContinueSession = () => {
    setShowWarning(false);
    resetTimer();
  };

  if (status !== "authenticated") return null;

  return (
    <Modal show={showWarning} onHide={handleContinueSession} backdrop="static" keyboard={false} centered style={{ zIndex: 9999999 }}>
      <Modal.Header>
        <Modal.Title>Session Expiring Soon</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0 text-gray-700 dark:text-gray-300">
          You have been inactive for a while. For your security, you will be logged out automatically in 2 minutes. Do you want to continue your session?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <button
          className="theme-btn bg-green text-white px-4 py-2 rounded"
          onClick={handleContinueSession}
        >
          Continue Session
        </button>
      </Modal.Footer>
    </Modal>
  );
}
