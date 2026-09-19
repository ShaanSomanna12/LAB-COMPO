/**
 * /api/inventory/route.ts
 *
 * Security hardening applied:
 *  1. Uses SUPABASE_SERVICE_ROLE_KEY (server-only) — NOT NEXT_PUBLIC_ANON_KEY
 *  2. POST, PATCH, DELETE require a valid phoenix_token with roleId 3 or 5
 *  3. Error responses never leak internal db error strings
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/lib/supabaseServer';

// ---------------------------------------------------------------------------
// Supabase admin client — server-only, bypasses RLS for trusted server ops
// ---------------------------------------------------------------------------
const supabase = getSupabaseAdmin();

// ---------------------------------------------------------------------------
// Auth helper — confirms caller is a Lab Admin or Super Admin
// ---------------------------------------------------------------------------
async function requireAdmin(req: Request) {
  const payload = await verifySession(req);
  if (!payload) return { ok: false, error: 'Authentication required', status: 401 } as const;
  if (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN) {
    return { ok: false, error: 'Insufficient permissions', status: 403 } as const;
  }
  return { ok: true, payload } as const;
}

// ---------------------------------------------------------------------------
// GET — public read (anyone can view the component catalogue)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      data.map((item) => ({
        id:         item.component_id,
        name:       item.name,
        department: item.department,
        available:  item.available_quantity,
        total:      item.total_quantity,
        status:     item.available_quantity > 0 ? 'Available' : 'Under Repair',
        desc:       item.base_condition,
        location:   item.lab_location,
        photo_url:  item.photo_url,
        value_tier: item.value_tier,
        tracking_type: item.tracking_type || 'QUANTITY',
      }))
    );
  } catch (err) {
    console.error('[inventory GET]', err);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — add new component (Admin only)
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, department, total, desc, location, photoUrl, valueTier, trackingType } = body;

    if (!name || !department) {
      return NextResponse.json({ error: 'Name and department are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('components')
      .insert([{
        name,
        department:         department ?? 'EDL',
        total_quantity:     Number(total),
        available_quantity: Number(total),
        base_condition:     desc ?? 'New catalog item',
        lab_location:       location ?? 'Main Lab',
        photo_url:          photoUrl,
        value_tier:         valueTier ?? 'MEDIUM',
        tracking_type:      trackingType ?? 'QUANTITY',
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data[0] });
  } catch (err) {
    console.error('[inventory POST]', err);
    return NextResponse.json({ error: 'Failed to add component' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update component (Admin only)
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, total, available, desc, photoUrl, valueTier, trackingType } = body;

    if (!id) {
      return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (total     !== undefined) updates.total_quantity     = Number(total);
    if (available !== undefined) updates.available_quantity = Number(available);
    if (desc      !== undefined) updates.base_condition     = desc;
    if (photoUrl  !== undefined) updates.photo_url          = photoUrl;
    if (valueTier !== undefined) updates.value_tier         = valueTier;
    if (trackingType !== undefined) updates.tracking_type      = trackingType;

    const { data, error } = await supabase
      .from('components')
      .update(updates)
      .eq('component_id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data[0] });
  } catch (err) {
    console.error('[inventory PATCH]', err);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove component (Admin only)
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
      return NextResponse.json({ error: 'Missing component ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('components')
      .delete()
      .eq('component_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[inventory DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
  }
}
