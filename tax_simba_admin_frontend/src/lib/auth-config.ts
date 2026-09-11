// src/lib/auth-config.ts
export const authConfig = {
  // Routes that don't require authentication
  publicRoutes: [
    "/",
  ],

  // Auth routes (login, signup, etc.) - authenticated users will be redirected away
  authRoutes: [
    "/auth/signin",
    "/auth/forgot-password",
    "/auth/reset-password",
  ],

  // Routes that require authentication
  protectedRoutes: [
    "/dashboard",
    "/manage-client",
    "/manage-accountant",
  ],

  // Routes that ACCOUNTANT cannot access (ADMIN + SUPER_ADMIN have full access)
  restrictedForAccountant: [
    "/manage-accountant",
    "/manage-client",
    "/manage-payments",
  ],

  // Default redirect paths
  defaultRedirects: {
    afterLogin: "/dashboard",
    afterLogout: "/auth/signin",
    unauthorized: "/auth/signin",
    forbidden: "/dashboard",
  },
};

// Helper function to check route access based on role
export const checkRouteAccess = (pathname: string, userRole?: string) => {
  const matchesRoute = (routes: string[], path: string) => {
    return routes.some(route => path.startsWith(route));
  };

  if (matchesRoute(authConfig.publicRoutes, pathname)) {
    return { allowed: true, requiresAuth: false };
  }

  if (matchesRoute(authConfig.authRoutes, pathname)) {
    return { allowed: true, requiresAuth: false, redirectIfAuth: true };
  }

  if (matchesRoute(authConfig.protectedRoutes, pathname)) {
    if (!userRole) {
      return { allowed: false, requiresAuth: true };
    }

    if (userRole === "ACCOUNTANT" && matchesRoute(authConfig.restrictedForAccountant, pathname)) {
      return { allowed: false, requiresAuth: true, insufficientRole: true };
    }

    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "ACCOUNTANT") {
      return { allowed: true, requiresAuth: true };
    }

    return { allowed: false, requiresAuth: true, insufficientRole: true };
  }

  return { allowed: true, requiresAuth: false };
};
