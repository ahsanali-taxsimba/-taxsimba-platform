"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  fetchProtectedMediaObjectUrl,
  isRelativeProtectedMediaPath,
} from "@/lib/protectedMedia";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackSrc?: string;
  width?: number;
  height?: number;
};

export default function ProtectedMediaImage({
  src,
  alt = "",
  className,
  style,
  fallbackSrc = "/images/logo/favicon.ico",
  width,
  height,
}: Props) {
  const { data: session } = useSession();
  const accessToken =
    (session?.user as { accessToken?: string } | undefined)?.accessToken ?? null;

  const [displaySrc, setDisplaySrc] = useState(fallbackSrc);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      if (!src) {
        setDisplaySrc(fallbackSrc);
        setLoading(false);
        return;
      }
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
        if (!cancelled) setDisplaySrc(objectUrl || fallbackSrc);
        else if (objectUrl) URL.revokeObjectURL(objectUrl);
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
      style={{ ...style, opacity: loading ? 0.6 : 1 }}
      width={width}
      height={height}
    />
  );
}
