"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    // Check if user has already set a cookie preference
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setShowConsent(true);
    }

    // Listen for events to reopen the cookie settings
    const handleOpenSettings = () => setShowConsent(true);
    window.addEventListener("openCookieSettings", handleOpenSettings);

    return () => {
      window.removeEventListener("openCookieSettings", handleOpenSettings);
    };
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookie_consent", "accepted");
    // Logic to enable non-essential tracking/cookies would go here
    setShowConsent(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem("cookie_consent", "rejected");
    // Logic to ensure only essential cookies are active would go here
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="fixed-bottom bg-dark text-white p-4 shadow-lg cookie-consent-banner" style={{ zIndex: 999999 }}>
      <div className="container d-flex flex-column flex-lg-row justify-content-between align-items-center gap-3">
        <div className="mb-0 text-center text-lg-start flex-grow-1">
          <p className="mb-0 text-sm" style={{ lineHeight: "1.6" }}>
            <span className="cookie-consent-text">
              <strong>We use cookies to improve your experience on our site.</strong> By clicking "Accept All", you agree to our use of cookies. 
              Read our <Link href="/cookie-policy" className="text-decoration-underline">Cookie Policy</Link> for more information.
            </span>
          </p>
        </div>
        <div className="d-flex flex-row gap-3 flex-shrink-0 mt-3 mt-lg-0">
          <button 
            onClick={handleRejectAll} 
            className="btn btn-outline-light px-4 py-2 text-nowrap rounded-pill"
          >
            Reject All
          </button>
          <button 
            onClick={handleAcceptAll} 
            className="btn btn-success px-4 py-2 text-nowrap rounded-pill"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
