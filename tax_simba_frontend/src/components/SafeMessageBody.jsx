"use client";

import React from "react";
import { sanitizeMessageHtml } from "@/utils/sanitizeMessageHtml";

/**
 * Safely render message / communication-log body content.
 * Uses allowlisted sanitization — never unrestricted HTML.
 */
export default function SafeMessageBody({
  content = "",
  className = "",
  as: Component = "div",
  emptyFallback = "",
}) {
  const raw = content == null ? "" : String(content);
  if (!raw.trim()) {
    return emptyFallback ? <Component className={className}>{emptyFallback}</Component> : null;
  }
  const safe = sanitizeMessageHtml(raw);
  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
