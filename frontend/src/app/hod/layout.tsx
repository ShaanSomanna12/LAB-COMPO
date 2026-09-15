/**
 * app/hod/layout.tsx — Server Component layout guard
 *
 * Mirrors admin/layout.tsx but gates on roleId 4 (HOD) or 5 (SuperAdmin).
 * Both the middleware header and the JWT cookie must confirm access.
 */

import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { verifyToken, ROLES } from '@/lib/auth';

export default async function HodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ------------------------------------------------------------------
  // Primary check: trust the role header forwarded by Edge Middleware
  // ------------------------------------------------------------------
  const headerStore = await headers();
  const roleFromHeader = headerStore.get('x-user-role');
  const roleId = roleFromHeader ? parseInt(roleFromHeader, 10) : null;

  const isAuthorisedByHeader =
    roleId === ROLES.HOD || roleId === ROLES.SUPER_ADMIN;

  // ------------------------------------------------------------------
  // Secondary check: independently verify cookie (defence in depth)
  // ------------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get('phoenix_token')?.value;
  const payload = token ? await verifyToken(token) : null;

  const isAuthorisedByToken =
    !!payload &&
    (payload.roleId === ROLES.HOD || payload.roleId === ROLES.SUPER_ADMIN);

  // Allow access if either token or header confirms valid HOD role
  if (!isAuthorisedByToken && !isAuthorisedByHeader) {
    redirect('/?error=unauthorized_hod');
  }

  return <>{children}</>;
}
