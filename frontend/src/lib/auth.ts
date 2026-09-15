/**
 * auth.ts — Server-only auth utilities
 *
 * Uses `jose` for Edge-compatible JWT operations so this module is safe
 * to import inside Next.js Middleware (which runs in the Edge Runtime).
 * The legacy `jsonwebtoken` import has been removed from this file.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Secret — must be at least 32 bytes for HS256
// ---------------------------------------------------------------------------
const JWT_SECRET_RAW =
  process.env.JWT_SECRET ?? 'super-secret-key-for-phoenix-lab-must-be-32ch';

/** Encoded secret suitable for `jose` */
const getSecret = () => new TextEncoder().encode(JWT_SECRET_RAW);

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------
export interface JwtPayload extends JWTPayload {
  userId: string;
  roleId: number;
  usn: string;
  email?: string;
  department?: string;
}

// ---------------------------------------------------------------------------
// USN validation
// ---------------------------------------------------------------------------
export const USN_REGEX = /^[1-4][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9]{2,3}$/;

export function isValidUSN(usn: string): boolean {
  return USN_REGEX.test(usn.toUpperCase());
}

// ---------------------------------------------------------------------------
// Token generation  (server components / API routes only — NOT Edge)
// jose's SignJWT works in both Node and Edge runtimes
// ---------------------------------------------------------------------------
export async function generateToken(payload: Omit<JwtPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

// ---------------------------------------------------------------------------
// Token verification — Edge-compatible (used in middleware & API guards)
// ---------------------------------------------------------------------------
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// verifySession — extracts + validates phoenix_token from any request object
//
// Works with:
//   • NextRequest  (middleware, edge)
//   • standard Request  (API route handlers)
// ---------------------------------------------------------------------------
export async function verifySession(
  req: NextRequest | Request
): Promise<JwtPayload | null> {
  // Next.js API routes expose req.cookies; NextRequest has .cookies as well.
  let token: string | undefined;

  if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
    // NextRequest path (middleware + app router API routes)
    token = (req as NextRequest).cookies.get('phoenix_token')?.value;
  } else {
    // Fallback: parse Cookie header manually (standard Request)
    const cookieHeader = req.headers.get('cookie') ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)phoenix_token=([^;]+)/);
    token = match?.[1];
  }

  if (!token) return null;
  return verifyToken(token);
}

// ---------------------------------------------------------------------------
// Role constants (single source of truth)
// ---------------------------------------------------------------------------
export const ROLES = {
  STUDENT: 1,
  FACULTY: 2,
  ADMIN: 3,
  HOD: 4,
  SUPER_ADMIN: 5,
} as const;
