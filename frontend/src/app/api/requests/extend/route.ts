import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession, ROLES } from '@/lib/auth';
import { getNextWorkingDay } from '@/lib/dateValidator';

export const dynamic = 'force-dynamic';
const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  // Student requesting an extension
  let authUser: any = null;
  const payload = await verifySession(request);

  if (payload) {
    authUser = payload;
  }

  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { reservationId, days, reason } = body;

    if (!reservationId || !days || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*, users!inner(user_id)')
      .eq('reservation_id', reservationId)
      .single();

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.status !== 'CHECKED_OUT') {
      return NextResponse.json({ error: 'Extensions can only be requested for checked out items' }, { status: 400 });
    }

    if (reservation.extension_requested && reservation.extension_status !== 'REJECTED') {
      return NextResponse.json({ error: 'Extension already requested' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('reservations')
      .update({
        extension_requested: true,
        extension_reason: reason,
        extension_days: parseInt(days, 10),
        extension_status: 'PENDING'
      })
      .eq('reservation_id', reservationId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, item: updated });
  } catch (err) {
    console.error('[extend POST]', err);
    return NextResponse.json({ error: 'Failed to request extension' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // Admin approving/rejecting extension
  const payload = await verifySession(request);
  if (!payload || (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN && payload.roleId !== ROLES.HOD)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { reservationId, action } = body; // action: 'APPROVE' or 'REJECT'

    if (!reservationId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('reservation_id', reservationId)
      .single();

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      let currentDueDate = new Date(reservation.due_date);
      currentDueDate.setDate(currentDueDate.getDate() + reservation.extension_days);
      currentDueDate = getNextWorkingDay(currentDueDate);

      const { data: updated, error: updateError } = await supabase
        .from('reservations')
        .update({
          extension_status: 'APPROVED',
          due_date: currentDueDate.toISOString()
        })
        .eq('reservation_id', reservationId)
        .select()
        .single();

      if (updateError) throw updateError;

      await supabase.from('reservation_status_history').insert([{
        reservation_id: reservationId,
        old_status: reservation.status,
        new_status: reservation.status,
        changed_by: payload.userId,
        note: `Extension of ${reservation.extension_days} days approved`
      }]);

      return NextResponse.json({ success: true, item: updated });
    } else if (action === 'REJECT') {
      const { data: updated, error: updateError } = await supabase
        .from('reservations')
        .update({
          extension_status: 'REJECTED'
        })
        .eq('reservation_id', reservationId)
        .select()
        .single();

      if (updateError) throw updateError;

      await supabase.from('reservation_status_history').insert([{
        reservation_id: reservationId,
        old_status: reservation.status,
        new_status: reservation.status,
        changed_by: payload.userId,
        note: `Extension request rejected`
      }]);

      return NextResponse.json({ success: true, item: updated });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[extend PATCH]', err);
    return NextResponse.json({ error: 'Failed to process extension' }, { status: 500 });
  }
}
