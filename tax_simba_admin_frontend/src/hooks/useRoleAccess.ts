// src/hooks/useRoleAccess.ts
import { useSession } from "next-auth/react";
import { authConfig } from "@/lib/auth-config";
import { isAdminRole, isAccountantRole } from "@/lib/roles";

export function useRoleAccess() {
  const { data: session } = useSession();
  
  const userRole = session?.user?.role;
  
  // Helper function to check if user can access a route
  const canAccessRoute = (route: string) => {
    if (!userRole) return false;
    
    // ADMIN and SUPER_ADMIN can access admin surfaces
    if (isAdminRole(userRole)) return true;
    
    // Check if route is restricted for ACCOUNTANT
    if (isAccountantRole(userRole)) {
      return !authConfig.restrictedForAccountant.some(restrictedRoute => 
        route.startsWith(restrictedRoute)
      );
    }
    
    return false;
  };
  
  return {
    canAccessManageAccountant: canAccessRoute("/manage-accountant"),
    canAccessManageClient: canAccessRoute("/manage-client"),
    canAccessDashboard: canAccessRoute("/dashboard"),
    isAdmin: isAdminRole(userRole),
    isSuperAdmin: userRole === "SUPER_ADMIN",
    isAccountant: isAccountantRole(userRole),
    userRole,
    canAccessRoute,
  };
}
