"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Logout } from "../app/lib/api";
import { Modal, Button } from "react-bootstrap";

export default function SessionTimeout() {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const lastActivity = useRef(Date.now());
  const isLoggingOut = useRef(false);

  const handleLogout = async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    setShowWarning(false);

    // 1. Clear storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }

    // 2. Clear cookies
    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    } catch (e) {
      console.error("Failed to clear cookies:", e);
    }

    // 3. Call backend logout API & next-auth signOut
    try {
      await Logout(session);
    } catch (e) {
      console.error("Backend logout failed, falling back to NextAuth signOut:", e);
      await signOut({ callbackUrl: "/login" });
    }
  };

  const handleContinueSession = () => {
    lastActivity.current = Date.now();
    setShowWarning(false);
  };

  useEffect(() => {
    if (status !== "authenticated") {
      setShowWarning(false);
      return;
    }

    // Initialize activity tracking
    lastActivity.current = Date.now();
    isLoggingOut.current = false;

    const handleUserActivity = () => {
      lastActivity.current = Date.now();
      setShowWarning(false);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;

      if (elapsed >= 1800000) { // 30 minutes
        clearInterval(interval);
        handleLogout();
      } else if (elapsed >= 1680000) { // 28 minutes
        setShowWarning(true);
        const remaining = Math.ceil((1800000 - elapsed) / 1000);
        setCountdown(remaining > 0 ? remaining : 0);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <Modal show={showWarning} onHide={handleContinueSession} backdrop="static" keyboard={false} centered style={{ zIndex: 9999999 }}>
      <Modal.Header>
        <Modal.Title>Session Expiring Soon</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">
          You have been inactive for a while. For your security, you will be logged out automatically in {countdown} seconds. Do you want to continue your session?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" className="theme-btn bg-green border-0" onClick={handleContinueSession}>
          Continue Session
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
