// src/hooks/useRedirectIfAuthenticated.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./useAuth";

export function useRedirectIfAuthenticated(redirectTo = "/dashboard") {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo]);

  return auth;
}