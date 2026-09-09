// middleware.ts - WORKING VERSION
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authConfig = {
  publicRoutes: ["/", "/home"],
  authRoutes: ["/auth/signin", "/auth/forgot-password", "/auth/reset-password"],
  protectedRoutes: [
    "/overview",
    "/manage-client",
    "/manage-accountant",
    "/manage-tax",
    "/tax-return-preparation",
    "/manage-payments",
    "/home-page-settings",
    "/about-page-settings",
    "/user-profile",
  ],
  adminOnlyRoutes: [
    "/manage-client",
    "/manage-accountant",
    "/manage-tax",
    "/manage-payments",
    "/home-page-settings",
    "/about-page-settings",
  ],
  sharedRoutes: [
    "/overview",
    "/tax-return-preparation",
    "/user-profile",
  ],
};

const BASE_PATH = "/admin";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Next.js request.nextUrl.pathname includes the basePath
  const relativePath = pathname.startsWith(BASE_PATH)
    ? (pathname.substring(BASE_PATH.length) || "/")
    : pathname;

  // Skip middleware for static files, specific assets, and API routes
  if (
    pathname.includes('/_next') ||
    pathname.includes('/api/auth') ||
    pathname.includes('/api/auth') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css')
  ) {
    return NextResponse.next();
  }

  // Get the token using the custom cookie name
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "next-auth.session-token-admin",
  });


  const matchesRoute = (routes: string[], path: string) => {
    return routes.some(route => path === route || path.startsWith(route + "/"));
  };

  // 1. Redirect root "/" → "/home" (i.e. /admin → /admin/home)
  if (relativePath === "/") {
    return NextResponse.redirect(new URL(BASE_PATH + "/home", request.url));
  }

  // 2. Allow public routes
  if (matchesRoute(authConfig.publicRoutes, relativePath)) {
    return NextResponse.next();
  }

  const hasValidRole = token && (token.role === "ADMIN" || token.role === "SUPER_ADMIN" || token.role === "ACCOUNTANT");

  // Inactivity timeout check for staff - only on protected routes
  if (hasValidRole && matchesRoute(authConfig.protectedRoutes, relativePath)) {
    const lastActiveCookie = request.cookies.get("staff-last-active");
    const now = Date.now();
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

    if (lastActiveCookie && now - parseInt(lastActiveCookie.value) > TIMEOUT_MS) {
      // Session expired due to inactivity
      const signInUrl = new URL(BASE_PATH + "/auth/signin", request.url);
      signInUrl.searchParams.set("error", "Session expired due to inactivity. Please sign in again.");
      
      const response = NextResponse.redirect(signInUrl);
      // Clear tokens using standard Next.js cookie deletion
      response.cookies.delete("next-auth.session-token-admin");
      response.cookies.delete("staff-last-active");
      return response;
    }
  }

  // 2. Handle auth routes
  if (matchesRoute(authConfig.authRoutes, relativePath)) {
    if (hasValidRole) {
      // Already logged in with a valid role → go to dashboard
      // Use a relative URL to let Next.js/Browser handle the origin correctly
      const overviewUrl = new URL(BASE_PATH + "/overview", request.url);
      return NextResponse.redirect(overviewUrl);
    } else {
      // If they don't have a valid role, let them stay on the signin page
      // This prevents the infinite redirect loop if they have an invalid token
      return NextResponse.next();
    }
  }

  // 3. Handle protected routes
  if (matchesRoute(authConfig.protectedRoutes, relativePath)) {
    if (!token) {
      // Use request.url as base to preserve the public protocol and host if present
      const signInUrl = new URL(BASE_PATH + "/auth/signin", request.url);

      // Avoid passing internal Docker URLs in the callbackUrl
      const publicCallbackUrl = pathname;
      signInUrl.searchParams.set("callbackUrl", publicCallbackUrl);

      return NextResponse.redirect(signInUrl);
    }

    // Role-based access control — SUPER_ADMIN is first-class admin (S1).
    const userRole = token.role as string;

    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      return NextResponse.next();
    } else if (userRole === "ACCOUNTANT") {
      if (matchesRoute(authConfig.adminOnlyRoutes, relativePath)) {
        return NextResponse.redirect(new URL(BASE_PATH + "/overview", request.nextUrl.origin));
      } else if (matchesRoute(authConfig.sharedRoutes, relativePath)) {
        return NextResponse.next();
      } else {
        return NextResponse.redirect(new URL(BASE_PATH + "/overview", request.url));
      }
    } else {
      return NextResponse.redirect(new URL(BASE_PATH + "/auth/signin", request.url));
    }
  }


  const response = NextResponse.next();
  
  if (hasValidRole) {
    response.cookies.set("staff-last-active", Date.now().toString(), { path: "/" });
  }
  
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
