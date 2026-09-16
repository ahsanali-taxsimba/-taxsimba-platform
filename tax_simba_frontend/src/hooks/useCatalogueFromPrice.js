"use client";

import { useEffect, useState } from "react";
import axios from "axios";

/**
 * Lowest live catalogue price (+ billing interval) from the backend packages
 * catalogue (via compat subscription-plans). Used only for marketing copy —
 * plan cards / checkout still render each plan.price from the same source.
 *
 * Returns { fromPrice, interval } so callers can show truthful copy such as
 * “Plans from £119/year” without hardcoding the amount or interval.
 */
export function useCatalogueFromPrice(category = "taxSimba") {
  const [fromPrice, setFromPrice] = useState(null);
  const [interval, setInterval] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return undefined;

    (async () => {
      try {
        const response = await axios.get(`${apiUrl}subscription-plans?category=${category}`);
        const rows = response.data?.data;
        if (!Array.isArray(rows) || rows.length === 0) return;
        let lowest = null;
        let lowestInterval = null;
        for (const plan of rows) {
          const n = Number(plan.price);
          if (!Number.isFinite(n) || n < 0) continue;
          if (lowest == null || n < lowest) {
            lowest = n;
            lowestInterval = plan.interval || null;
          }
        }
        if (lowest == null || cancelled) return;
        setFromPrice(lowest);
        setInterval(lowestInterval);
      } catch {
        // Leave null — callers fall back to price-free copy.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category]);

  return { fromPrice, interval };
}

export function formatGbpWhole(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const n = Number(amount);
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/** Customer-readable interval suffix from API interval, e.g. "/year" or "/month". */
export function formatIntervalSuffix(interval) {
  if (!interval || typeof interval !== "string") return "";
  const key = interval.toLowerCase();
  if (key === "year" || key === "yearly" || key === "annual") return "/year";
  if (key === "month" || key === "monthly") return "/month";
  return `/${key}`;
}
