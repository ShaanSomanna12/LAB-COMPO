/**
 * /api/auth/login/route.ts — Secure server-side login for Admin & HOD accounts
 *
 * This endpoint replaces the client-side ADMIN_PASSWORDS / HOD_PASSWORDS
 * dictionaries that were previously hard-coded in page.tsx.
 *
 * Credentials for system accounts are read exclusively from environment
 * variables — they never appear in client-side JS bundles.
 *
 * Security properties:
 *  • Credentials compared server-side only
 *  • Sets httpOnly, sameSite:lax phoenix_token cookie on success
 *  • Returns only generic error messages — no internal details leak
 *  • All detail logged server-side only
 */

import { NextResponse } from 'next/server';
import { generateToken, ROLES } from '@/lib/auth';

// ---------------------------------------------------------------------------
// System account registry (env-vars only — never committed)
// Add entries to .env.local / deployment env:
//
//   ADMIN_EDL_PASS=...        HOD_EDL_PASS=...
//   ADMIN_ECE_PASS=...        HOD_ECE_PASS=...
//   ADMIN_EEE_PASS=...        HOD_EEE_PASS=...
//   ADMIN_MECH_PASS=...       HOD_MECH_PASS=...
//   ADMIN_CIVIL_PASS=...      HOD_CIVIL_PASS=...
// ---------------------------------------------------------------------------

const DEPARTMENTS = ['EDL', 'ECE', 'EEE', 'MECH', 'CIVIL'] as const;
type Dept = (typeof DEPARTMENTS)[number];

function buildRegistry() {
  const registry: Record<string, { password: string; roleId: number; department: string }> = {};

  for (const dept of DEPARTMENTS) {
    const adminPass = process.env[`ADMIN_${dept}_PASS`];
    const hodPass   = process.env[`HOD_${dept}_PASS`];

    if (adminPass) {
      registry[`ADMIN_${dept}`] = {
        password: adminPass,
        roleId: ROLES.ADMIN,
        department: dept,
      };
    }
    if (hodPass) {
      registry[`HOD${dept}_VVCE`] = {
        password: hodPass,
        roleId: ROLES.HOD,
        department: dept,
      };
    }
  }

  return registry;
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { usn: string; password: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.usn !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const usn      = body.usn.trim().toUpperCase();
    const password = body.password as string;

    if (!usn || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    // Build registry fresh per-request so rotated env-vars take effect
    // without a server restart in dev; in production the registry is
    // effectively constant between cold starts.
    const registry = buildRegistry();
    const account  = registry[usn];

    if (!account) {
      // Do NOT reveal whether the USN exists — timing-safe generic error
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Constant-time string comparison to prevent timing attacks
    // (passwords are env-var strings, not hashes, so we use timingSafeEqual)
    const { timingSafeEqual } = await import('crypto');
    const providedBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(account.password);
    const match =
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf);

    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // Issue a signed JWT
    // ------------------------------------------------------------------
    const token = await generateToken({
      userId: `system-${usn.toLowerCase()}`,
      usn,
      roleId: account.roleId,
      department: account.department,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        usn,
        roleId: account.roleId,
        department: account.department,
      },
    });

    response.cookies.set({
      name: 'phoenix_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;
  } catch (err) {
    // Log full error server-side; send nothing internal to client
    console.error('[/api/auth/login] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
