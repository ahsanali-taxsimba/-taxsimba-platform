// src/hooks/useAuth.ts
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdminRole, isAccountantRole } from "@/lib/roles";

export function useAuth(redirectTo?: string) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    
    if (!session && redirectTo) {
      router.push(redirectTo);
    }
  }, [session, status, router, redirectTo]);

  return {
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: !!session,
    isAdmin: isAdminRole(session?.user?.role),
    isSuperAdmin: session?.user?.role === "SUPER_ADMIN",
    isAccountant: isAccountantRole(session?.user?.role),
    session,
  };
}
