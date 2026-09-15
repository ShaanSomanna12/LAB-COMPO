/**
 * /api/notices/route.ts
 *
 * Security hardening:
 *  • GET remains public (students need to see notices)
 *  • POST and DELETE require a valid phoenix_token with roleId 3 (Admin) or 5 (SuperAdmin)
 *  • Error responses never expose internal db details
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifySession, ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Auth helper for admin-only mutations
async function requireAdmin(request: Request) {
  const payload = await verifySession(request);
  if (!payload) {
    return { ok: false, error: 'Authentication required', status: 401 } as const;
  }
  if (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN) {
    return { ok: false, error: 'Insufficient permissions', status: 403 } as const;
  }
  return { ok: true, payload } as const;
}

// ---------------------------------------------------------------------------
// GET — public: fetch active notices filtered by department
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    let query = supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (department) {
      query = query.eq('admin_dept', department);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('[notices GET]', err);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Admin only: create a new notice
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { admin_dept, message, type } = body;

    if (!admin_dept || !message) {
      return NextResponse.json(
        { error: 'Department and message are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('notices')
      .insert([{ admin_dept, message, type: type ?? 'info', is_active: true }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, notice: data });
  } catch (err) {
    console.error('[notices POST]', err);
    return NextResponse.json({ error: 'Failed to create notice' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Admin only: soft-delete (deactivate) a notice
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notices')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notices DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete notice' }, { status: 500 });
  }
}
