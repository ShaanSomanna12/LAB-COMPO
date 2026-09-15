/**
 * /api/auth/route.ts — Unified authentication endpoint
 *
 * Handles two distinct login flows in a single POST handler:
 *
 * FLOW 1 — System account login (Admin / HOD)
 *   Body: { department: string; password: string; roleType: 'admin' | 'hod' }
 *   • Credentials are validated against server-only environment variables.
 *   • A signed phoenix_token JWT is set as an httpOnly cookie on success.
 *   • roleId 3 (LabAdmin) or 4 (HOD) is embedded in the token.
 *
 * FLOW 2 — Student login (existing behaviour, preserved unchanged)
 *   Body: { usn: string; password: string }
 *   • Credentials are verified against bcrypt hashes in the database.
 *   • A signed phoenix_token JWT is set on success.
 *
 * Security properties:
 *   ✓ Zero plaintext credentials in source code
 *   ✓ timing-safe comparison for system account passwords
 *   ✓ httpOnly, sameSite:lax cookie — not accessible from client JS
 *   ✓ Generic error messages — no internal detail leaks to caller
 *   ✓ Detailed errors logged server-side only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUSN, generateToken, ROLES } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Supabase client (anon key — only used to query public.users for student auth)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Shared cookie configuration
// ---------------------------------------------------------------------------
const COOKIE_OPTIONS = {
  name: 'phoenix_token',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8, // 8 hours
};

// ---------------------------------------------------------------------------
// Timing-safe string comparison (prevents timing attacks on system passwords)
// ---------------------------------------------------------------------------
function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      // Still run comparison to prevent length-based timing leaks
      timingSafeEqual(aBuf, Buffer.alloc(aBuf.length));
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// System account credential registry — reads from env vars at request time
// ---------------------------------------------------------------------------
const DEPARTMENTS = ['EDL', 'ECE', 'EEE', 'MECH', 'CIVIL'] as const;
type Dept = (typeof DEPARTMENTS)[number];
type RoleType = 'admin' | 'hod';

function getSystemPassword(dept: string, roleType: RoleType): string | undefined {
  const key = roleType === 'admin'
    ? `ADMIN_${dept.toUpperCase()}_PASS`
    : `HOD_${dept.toUpperCase()}_PASS`;
  return process.env[key];
}

// ---------------------------------------------------------------------------
// POST /api/auth
// ---------------------------------------------------------------------------
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // FLOW 1: System account login — { department, password, roleType }
    // ════════════════════════════════════════════════════════════════════════
    if ('roleType' in body && 'department' in body) {
      return handleSystemLogin(body);
    }

    // ════════════════════════════════════════════════════════════════════════
    // FLOW 2: Student login — { usn, password }
    // ════════════════════════════════════════════════════════════════════════
    if ('usn' in body && 'password' in body) {
      return handleStudentLogin(body);
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  } catch (err) {
    console.error('[/api/auth POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// FLOW 1 Handler — System account (Admin / HOD)
// ---------------------------------------------------------------------------
async function handleSystemLogin(body: {
  department: string;
  password: string;
  roleType: string;
}): Promise<NextResponse> {
  const { department, password, roleType } = body;

  // Input validation
  if (
    typeof department !== 'string' ||
    typeof password   !== 'string' ||
    typeof roleType   !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const dept = department.trim().toUpperCase();
  const role = roleType.trim().toLowerCase() as RoleType;

  if (!DEPARTMENTS.includes(dept as Dept)) {
    return NextResponse.json({ error: 'Invalid department or password' }, { status: 401 });
  }

  if (role !== 'admin' && role !== 'hod') {
    return NextResponse.json({ error: 'Invalid department or password' }, { status: 401 });
  }

  // Retrieve expected password from env-var (server-only)
  const expectedPassword = getSystemPassword(dept, role);

  if (!expectedPassword) {
    // Env-var not configured — fail closed, log server-side
    console.error(
      `[/api/auth] Missing env-var for ${role.toUpperCase()}_${dept}_PASS. ` +
      `Ensure it is set in .env.local / deployment environment.`
    );
    return NextResponse.json({ error: 'Invalid department or password' }, { status: 401 });
  }

  // Timing-safe credential comparison
  const isValid = safeCompare(password, expectedPassword);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid department or password' }, { status: 401 });
  }

  // Assign roleId
  const roleId = role === 'admin' ? ROLES.ADMIN : ROLES.HOD;
  const systemUsn = `${role.toUpperCase()}_${dept}`;

  // Issue signed JWT
  const token = await generateToken({
    userId: `system-${systemUsn.toLowerCase()}`,
    usn: systemUsn,
    roleId,
    department: dept,
  });

  const response = NextResponse.json(
    {
      success: true,
      user: {
        usn: systemUsn,
        roleId,
        department: dept,
      },
    },
    { status: 200 }
  );

  response.cookies.set({ ...COOKIE_OPTIONS, value: token });
  return response;
}

// ---------------------------------------------------------------------------
// FLOW 2 Handler — Student login
// ---------------------------------------------------------------------------
async function handleStudentLogin(body: {
  usn: string;
  password: string;
}): Promise<NextResponse> {
  const { usn, password } = body;

  if (!usn || !password) {
    return NextResponse.json({ error: 'Missing USN or password' }, { status: 400 });
  }

  const isEmail = usn.includes('@');
  if (!isEmail && !isValidUSN(usn)) {
    return NextResponse.json(
      { error: 'Invalid identity format. Enter a valid USN or college email.' },
      { status: 400 }
    );
  }

  let user: { user_id: string; usn: string; password_hash: string; role_id: number } | null =
    null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, usn, password_hash, role_id')
      .eq(
        isEmail ? 'email' : 'usn',
        isEmail ? usn.toLowerCase() : usn.toUpperCase()
      )
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    user = data;

    if (!user) {
      // Auto-create user for dev/demo only — production should require
      // pre-registration. Keep behind a feature flag if needed.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const assignedRole = isEmail
        ? usn.toLowerCase().startsWith('hod')
          ? ROLES.HOD
          : ROLES.ADMIN
        : ROLES.STUDENT;

      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            usn: isEmail ? usn.toLowerCase() : usn.toUpperCase(),
            name: isEmail
              ? assignedRole === ROLES.HOD
                ? `HOD ${usn}`
                : `Admin ${usn}`
              : `Student ${usn}`,
            email: isEmail ? usn.toLowerCase() : `${usn.toLowerCase()}@college.edu`,
            password_hash: hashedPassword,
            role_id: assignedRole,
          },
        ])
        .select('user_id, usn, role_id')
        .single();

      if (insertError) throw insertError;
      user = { ...insertData, password_hash: hashedPassword };
    } else {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }
  } catch (dbErr) {
    console.error('[/api/auth student] Database error:', dbErr);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[/api/auth] Dev mode — using mock auth fallback');
      user = {
        user_id: 'mock-uuid-1234',
        usn: isEmail ? usn.toLowerCase() : usn.toUpperCase(),
        password_hash: '',
        role_id: isEmail
          ? usn.toLowerCase().startsWith('hod')
            ? ROLES.HOD
            : ROLES.ADMIN
          : ROLES.STUDENT,
      };
    } else {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }
  }

  const token = await generateToken({
    userId: user!.user_id,
    usn: user!.usn,
    roleId: user!.role_id,
  });

  const response = NextResponse.json(
    {
      success: true,
      user: { usn: user!.usn, roleId: user!.role_id },
    },
    { status: 200 }
  );

  response.cookies.set({ ...COOKIE_OPTIONS, value: token });
  return response;
}