// Force Node.js runtime — next-auth/jwt uses jose which needs code generation
// (eval/new Function), which is blocked in the default Edge Runtime.
export const runtime = 'nodejs';

import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

/**
 * P0 K.3/K.4 — Ownership SoT is ACTIVE SA/MTD entitlements on the JWT
 * (populated from GET my-services via compat login / session refresh).
 * Never trust isSubscriptionBuy as source of truth (baseline D7 / X3 / E1).
 * After ACTIVE entitlement, engagement acceptance is required before dashboard (G2).
 */
function ownershipFromToken(token) {
  const user = token?.user || {};
  const hasActiveSa = Boolean(
    token?.hasActiveSa ?? user.hasActiveSa ?? false,
  );
  const hasActiveMtd = Boolean(
    token?.hasActiveMtd ?? user.hasActiveMtd ?? false,
  );
  const hasActiveService = Boolean(
    token?.hasActiveService ?? user.hasActiveService ?? (hasActiveSa || hasActiveMtd),
  );
  let ownership = token?.ownership ?? user.ownership;
  if (!ownership) {
    if (hasActiveSa && hasActiveMtd) ownership = 'both';
    else if (hasActiveSa) ownership = 'sa';
    else if (hasActiveMtd) ownership = 'mtd';
    else ownership = 'neither';
  }
  return { hasActiveSa, hasActiveMtd, hasActiveService, ownership };
}

async function getAuthToken(req) {
  const defaultToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'next-auth.session-token-frontend',
  });
  if (defaultToken) return defaultToken;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: '__Secure-next-auth.session-token-frontend',
  });
  if (token) return token;

  return null;
}

export async function middleware(req) {
  const token = await getAuthToken(req);
  const { pathname } = req.nextUrl;

  if (pathname === '/index.html') {
    return NextResponse.redirect(new URL('/', req.url), 301);
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/frontend-api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname === '/login'
      || pathname === '/register'
      || pathname === '/forgot-password'
      || pathname === '/reset-password'
      || pathname === '/verify-email'
    ) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/dashboard')
      || pathname.startsWith('/tax-return-form')
      || pathname.startsWith('/my-tax-return')
      || pathname.startsWith('/mtd-dashboard')
      || pathname === '/planlist'
    ) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (token) {
    const { hasActiveService, hasActiveSa, hasActiveMtd, ownership } = ownershipFromToken(token);
    const hasSignedLetter =
      token?.isEngagementLetterAccepted === true ||
      token?.user?.isEngagementLetterAccepted === true;
    const hasSubmittedTaxInfo = token?.user?.isTaxInfoSubmitted === true;

    if (pathname === '/login'
      || pathname === '/register'
      || pathname === '/forgot-password'
      || pathname === '/reset-password'
      || pathname === '/verify-email'
    ) {
      if (!hasActiveService) {
        return NextResponse.redirect(new URL('/planlist', req.url));
      }
      if (!hasSignedLetter) {
        return NextResponse.redirect(new URL('/engagement-letter', req.url));
      }
      if (ownership === 'mtd' && !hasSubmittedTaxInfo) {
        return NextResponse.redirect(new URL('/engagement-letter', req.url));
      }
      if (ownership === 'mtd') {
        return NextResponse.redirect(new URL('/mtd-dashboard', req.url));
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // No ACTIVE SA/MTD → planlist only (purchase / verify path)
    if (!hasActiveService) {
      if (pathname.startsWith('/dashboard')
        || pathname.startsWith('/tax-return-form')
        || pathname.startsWith('/my-tax-return')
        || pathname.startsWith('/mtd-dashboard')
        || pathname === '/engagement-letter'
      ) {
        return NextResponse.redirect(new URL('/planlist', req.url));
      }
    }

    // Engagement acceptance still gated in middleware; persistence API is K.4.
    if (hasActiveService && !hasSignedLetter) {
      if (pathname.startsWith('/dashboard')
        || pathname.startsWith('/tax-return-form')
        || pathname.startsWith('/my-tax-return')
        || pathname.startsWith('/mtd-dashboard')
      ) {
        return NextResponse.redirect(new URL('/engagement-letter', req.url));
      }
    }

    if (hasActiveService && hasSignedLetter && ownership === 'mtd' && !hasSubmittedTaxInfo) {
      if (pathname !== '/engagement-letter') {
        return NextResponse.redirect(new URL('/engagement-letter', req.url));
      }
    }

    // MTD-only: keep on MTD dashboard
    if (hasActiveService && hasSignedLetter && ownership === 'mtd' && hasSubmittedTaxInfo) {
      if (pathname.startsWith('/dashboard')
        || pathname.startsWith('/tax-return-form')
        || pathname.startsWith('/my-tax-return')
      ) {
        return NextResponse.redirect(new URL('/mtd-dashboard', req.url));
      }
    }

    // SA-only: block MTD dashboard (both → allow either)
    if (hasActiveService && hasSignedLetter && ownership === 'sa') {
      if (pathname.startsWith('/mtd-dashboard')) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    if (pathname === '/planlist' || pathname.startsWith('/planlist/')) {
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/index.html',
    '/planlist',
    '/planlist/:path*',
    '/engagement-letter',
    '/dashboard',
    '/dashboard/:path*',
    '/mtd-dashboard',
    '/mtd-dashboard/:path*',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/tax-return-form/:path*',
    '/my-tax-return/:path*',
  ],
};
