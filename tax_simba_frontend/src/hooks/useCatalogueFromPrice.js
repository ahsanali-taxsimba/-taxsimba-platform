"use client";

import { useEffect, useState } from "react";
import axios from "axios";

/**
 * Lowest live Self Assessment catalogue price from the backend packages catalogue
 * (via compat subscription-plans). Used only for marketing copy — plan cards /
 * checkout still render each plan.price from the same source.
 */
export function useCatalogueFromPrice(category = "taxSimba") {
  const [fromPrice, setFromPrice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return undefined;

    (async () => {
      try {
        const response = await axios.get(`${apiUrl}subscription-plans?category=${category}`);
        const rows = response.data?.data;
        if (!Array.isArray(rows) || rows.length === 0) return;
        const prices = rows
          .map((p) => Number(p.price))
          .filter((n) => Number.isFinite(n) && n >= 0);
        if (!prices.length || cancelled) return;
        setFromPrice(Math.min(...prices));
      } catch {
        // Leave null — callers fall back to price-free copy.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category]);

  return fromPrice;
}

export function formatGbpWhole(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const n = Number(amount);
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}
