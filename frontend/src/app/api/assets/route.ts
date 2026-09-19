import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession, ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = getSupabaseAdmin();

async function requireAdmin(req: Request) {
  const payload = await verifySession(req);
  if (!payload) return { ok: false, error: 'Authentication required', status: 401 } as const;
  if (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN && payload.roleId !== ROLES.HOD) {
    return { ok: false, error: 'Insufficient permissions', status: 403 } as const;
  }
  return { ok: true, payload } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('componentId');
    const assetId = searchParams.get('assetId');

    let query = supabase.from('assets').select('*, components(name, department, tracking_type)');

    if (componentId) {
      query = query.eq('component_id', componentId);
    }
    if (assetId) {
      query = query.eq('asset_id', assetId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('[assets GET]', err);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { assetId, componentId, status, condition } = body;

    if (!assetId || !componentId) {
      return NextResponse.json({ error: 'Asset ID and Component ID are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('assets')
      .insert([{
        asset_id: assetId,
        component_id: componentId,
        status: status || 'AVAILABLE',
        condition: condition || 'GOOD'
      }])
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Asset ID already exists' }, { status: 400 });
      }
      throw error;
    }

    // Log creation
    await supabase.from('asset_history').insert([{
      asset_id: assetId,
      event_type: 'CREATED',
      note: 'Asset registered',
      changed_by: auth.payload.userId
    }]);

    return NextResponse.json({ success: true, item: data[0] });
  } catch (err) {
    console.error('[assets POST]', err);
    return NextResponse.json({ error: 'Failed to add asset' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { assetId, status, condition, note } = body;

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (condition) updates.condition = condition;

    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('asset_id', assetId)
      .select();

    if (error) throw error;

    if (status || condition) {
      await supabase.from('asset_history').insert([{
        asset_id: assetId,
        event_type: 'STATUS_CHANGE',
        note: note || `Updated status to ${status || 'unchanged'}, condition to ${condition || 'unchanged'}`,
        changed_by: auth.payload.userId
      }]);
    }

    return NextResponse.json({ success: true, item: data[0] });
  } catch (err) {
    console.error('[assets PATCH]', err);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('asset_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[assets DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
