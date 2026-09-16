// src/hooks/useRequireAdmin.ts
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdminRole } from "@/lib/roles";

export function useRequireAdmin(redirectTo = "/dashboard") {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    if (!isAdminRole(session.user.role)) {
      router.push(redirectTo);
    }
  }, [session, status, router, redirectTo]);

  return {
    user: session?.user,
    isLoading: status === "loading",
    isAdmin: isAdminRole(session?.user?.role),
    isSuperAdmin: session?.user?.role === "SUPER_ADMIN",
    session,
  };
}
