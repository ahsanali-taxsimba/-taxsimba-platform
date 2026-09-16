// src/components/guards/RouteAccessGuard.tsx - New component for route-specific access
"use client";

import { useRoleAccess } from "@/hooks/useRoleAccess";
import { ReactNode } from "react";

interface RouteAccessGuardProps {
  children: ReactNode;
  route: string;
  fallback?: ReactNode;
}

export function RouteAccessGuard({ children, route, fallback }: RouteAccessGuardProps) {
  const { canAccessRoute, userRole } = useRoleAccess();

  if (!canAccessRoute(route)) {
    return (
      <>{fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this route.</p>
            <p className="text-sm text-gray-500 mt-2">Current role: {userRole || "None"}</p>
            <p className="text-sm text-gray-500">Route: {route}</p>
          </div>
        </div>
      )}</>
    );
  }

  return <>{children}</>;
}