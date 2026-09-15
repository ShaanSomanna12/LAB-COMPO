/**
 * middleware.ts — Next.js Edge Middleware
 *
 * Runs in the Edge Runtime before requests matching the configured `matcher`.
 *
 * Enforces three distinct protection tiers:
 *
 *  Tier 1 — Page routes (/admin, /hod)
 *    • Verify phoenix_token JWT
 *    • Enforce roleId match (Admin=3, HOD=4, SuperAdmin=5)
 *    • Redirect unauthenticated/unauthorised requests to /?error=*
 *
 *  Tier 2 — API mutation routes (/api/inventory, /api/notices, /api/requests)
 *    • Only intercept state-changing methods: POST, PUT, PATCH, DELETE
 *    • GET requests pass through without a token (public reads)
 *    • Require a valid token with roleId in {3, 4, 5}
 *    • Return JSON 401 on failure (API callers expect JSON, not redirects)
 *
 *  Tier 3 — Forwarding
 *    • On success, forward x-user-* headers to downstream Server Components
 *      and API handlers so they don't need to re-verify the token.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, ROLES } from '@/lib/auth';

// ---------------------------------------------------------------------------
// HTTP methods that mutate state — GET/HEAD/OPTIONS pass through
// ---------------------------------------------------------------------------
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const requestMethod = request.method.toUpperCase();

  // ── Extract and verify token ────────────────────────────────────────────
  const token = request.cookies.get('phoenix_token')?.value;
  const payload = token ? await verifyToken(token) : null;

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 1: Protected page routes
  // ══════════════════════════════════════════════════════════════════════════

  // /admin — requires roleId 3 (LabAdmin) or 5 (SuperAdmin)
  if (pathname.startsWith('/admin')) {
    if (
      !payload ||
      (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN)
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/';
      loginUrl.search = '?error=unauthorized_admin';
      return NextResponse.redirect(loginUrl);
    }
  }

  // /hod — requires roleId 4 (HOD) or 5 (SuperAdmin)
  if (pathname.startsWith('/hod')) {
    if (
      !payload ||
      (payload.roleId !== ROLES.HOD && payload.roleId !== ROLES.SUPER_ADMIN)
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/';
      loginUrl.search = '?error=unauthorized_hod';
      return NextResponse.redirect(loginUrl);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2: API mutation route protection
  // ══════════════════════════════════════════════════════════════════════════
  // Only privileged mutations: inventory, notices, or admin request updates (PUT/PATCH/DELETE)
  const isPrivilegedMutation =
    (pathname.startsWith('/api/inventory') || pathname.startsWith('/api/notices')) && MUTATION_METHODS.has(requestMethod) ||
    pathname.startsWith('/api/requests') && (requestMethod === 'PATCH' || requestMethod === 'PUT' || requestMethod === 'DELETE');

  if (isPrivilegedMutation) {
    // Token must be present and roleId must be in the privileged set
    const isPrivileged =
      !!payload &&
      (
        payload.roleId === ROLES.ADMIN      ||
        payload.roleId === ROLES.HOD        ||
        payload.roleId === ROLES.SUPER_ADMIN
      );

    if (!isPrivileged) {
      return NextResponse.json(
        { error: 'Unauthorized mutation' },
        { status: 401 }
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 3: Forward authenticated user context as trusted headers
  // (downstream Server Components and API handlers can read these without
  // re-verifying the token, since they originate from the Edge)
  // ══════════════════════════════════════════════════════════════════════════
  const requestHeaders = new Headers(request.headers);

  if (payload) {
    requestHeaders.set('x-user-id',   payload.userId     ?? '');
    requestHeaders.set('x-user-role', String(payload.roleId));
    requestHeaders.set('x-user-usn',  payload.usn        ?? '');
    requestHeaders.set('x-user-dept', payload.department ?? '');
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// ---------------------------------------------------------------------------
// Matcher — intercept page routes AND API mutation routes
// API GET requests are intentionally NOT in the matcher so public catalogue
// reads and dashboard polling remain fast and unauthenticated.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    '/admin/:path*',
    '/hod/:path*',
    '/api/inventory/:path*',
    '/api/notices/:path*',
    '/api/requests/:path*',
  ],
};
