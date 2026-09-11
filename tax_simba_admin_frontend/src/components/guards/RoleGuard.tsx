// src/components/guards/RoleGuard.tsx - Generic role guard
"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { data: session } = useSession();

  if (!session?.user?.role || !allowedRoles.includes(session.user.role)) {
    return (
      <>{fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">
              Current role: {session?.user?.role || "None"}
            </p>
            <p className="text-sm text-gray-500">
              Required roles: {allowedRoles.join(", ")}
            </p>
          </div>
        </div>
      )}</>
    );
  }

  return <>{children}</>;
}