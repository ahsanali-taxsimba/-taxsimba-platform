import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Configurable customer-facing wording. The map is fetched once per page load and shared by
// every component, so adopting a content key never adds a request per render. The hard-coded
// string passed to `t()` stays the fallback: a missing key, a blank value or an unreachable
// backend leaves the screen exactly as it is today.
let cached = null;
let inflight = null;

export function loadContent() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .get("/content")
      .then(({ data }) => {
        const map = data && typeof data === "object" ? data : {};
        cached = map;
        return map;
      })
      .catch(() => ({}))
      .then((map) => {
        inflight = null;
        return map;
      });
  }
  return inflight;
}

export function resetContentCache() {
  cached = null;
  inflight = null;
}

export function pick(map, key, fallback) {
  const value = map ? map[key] : undefined;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function useContent() {
  const [map, setMap] = useState(cached || {});

  useEffect(() => {
    let live = true;
    loadContent().then((next) => live && setMap(next));
    return () => {
      live = false;
    };
  }, []);

  return (key, fallback) => pick(map, key, fallback);
}
