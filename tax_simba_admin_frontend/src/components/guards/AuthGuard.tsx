// src/components/guards/AuthGuard.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import LoadingSpinner from "./LoadingSpinner";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({
  children,
  fallback = <LoadingSpinner />,
  redirectTo = "/admin/auth/signin"
}: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading

    if (!session) {
      router.push(redirectTo);
    }
  }, [session, status, router, redirectTo]);

  if (status === "loading") {
    return <>{fallback}</>;
  }

  if (!session) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}