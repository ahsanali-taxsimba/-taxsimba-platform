// src/components/guards/AdminGuard.tsx
"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";
import { isAdminRole } from "@/lib/roles";

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { data: session } = useSession();

  if (!session?.user?.role || !isAdminRole(session.user.role)) {
    return (
      <>{fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have admin permissions to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">Current role: {session?.user?.role || "None"}</p>
          </div>
        </div>
      )}</>
    );
  }

  return <>{children}</>;
}
