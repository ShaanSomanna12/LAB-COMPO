/**
 * app/admin/layout.tsx — Server Component layout guard
 *
 * A second layer of defence after the Edge Middleware.
 * Reads the trusted `x-user-role` header injected by middleware.ts
 * and re-verifies the phoenix_token cookie via the auth helper,
 * then renders children only when access is confirmed.
 *
 * This guard means even if middleware is misconfigured, a direct
 * server-side request cannot access admin content without a valid token.
 */

import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { verifyToken, ROLES } from '@/lib/auth';

export default async function AdminLayout({
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
    roleId === ROLES.ADMIN || roleId === ROLES.SUPER_ADMIN;

  // ------------------------------------------------------------------
  // Secondary check: independently verify cookie (defence in depth)
  // Prevents bypass if someone crafts a custom x-user-role header.
  // ------------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get('phoenix_token')?.value;
  const payload = token ? await verifyToken(token) : null;

  const isAuthorisedByToken =
    !!payload &&
    (payload.roleId === ROLES.ADMIN || payload.roleId === ROLES.SUPER_ADMIN);

  // Both checks must pass
  if (!isAuthorisedByHeader || !isAuthorisedByToken) {
    redirect('/?error=unauthorized_admin');
  }

  return <>{children}</>;
}
