"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  fetchProtectedMediaObjectUrl,
  isRelativeProtectedMediaPath,
  resolveCompatMediaUrl,
} from "@/lib/protectedMedia";

/**
 * Renders a protected API media path via authenticated fetch + object URL.
 * Falls back to `fallbackSrc` when missing/failed. Revokes object URLs on cleanup.
 */
export default function ProtectedMediaImage({
  src,
  alt = "",
  className,
  style,
  fallbackSrc = "/images/user.png",
  width,
  height,
}) {
  const { data: session } = useSession();
  const accessToken =
    session?.accessToken ||
    session?.user?.accessToken ||
    session?.user?.token ||
    null;

  const [displaySrc, setDisplaySrc] = useState(fallbackSrc);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    async function load() {
      if (!src) {
        setDisplaySrc(fallbackSrc);
        setLoading(false);
        return;
      }

      // Absolute public / blob / data URLs — use directly.
      if (!isRelativeProtectedMediaPath(src)) {
        setDisplaySrc(src);
        setLoading(false);
        return;
      }

      if (!accessToken) {
        setDisplaySrc(fallbackSrc);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        objectUrl = await fetchProtectedMediaObjectUrl(src, accessToken);
        if (!cancelled) {
          setDisplaySrc(objectUrl || fallbackSrc);
        } else if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        if (!cancelled) setDisplaySrc(fallbackSrc);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, accessToken, fallbackSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: loading ? 0.6 : 1,
      }}
      width={width}
      height={height}
      data-protected-media={isRelativeProtectedMediaPath(src) ? "1" : "0"}
      data-resolved-compat={
        isRelativeProtectedMediaPath(src)
          ? resolveCompatMediaUrl(src)
          : undefined
      }
    />
  );
}
