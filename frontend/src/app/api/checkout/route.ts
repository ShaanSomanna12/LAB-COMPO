import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession, ROLES } from '@/lib/auth';

import { getNextWorkingDay } from '@/lib/dateValidator';

export const dynamic = 'force-dynamic';
const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  const payload = await verifySession(request);
  if (!payload || (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN && payload.roleId !== ROLES.HOD)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { reservationId, assetId } = body;

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 });
    }

    // 1. Verify reservation
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*, components(tracking_type)')
      .eq('reservation_id', reservationId)
      .single();

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.status !== 'APPROVED' && reservation.status !== 'READY_FOR_PICKUP') {
      return NextResponse.json({ error: 'Reservation is not approved or ready for pickup' }, { status: 400 });
    }

    if (!reservation.geotag_image_url) {
      return NextResponse.json({ error: 'Student must upload a photo of the component before checkout can be finalized.' }, { status: 400 });
    }

    const isAssetTracked = reservation.components?.tracking_type === 'ASSET';

    if (isAssetTracked) {
      if (!assetId) {
        return NextResponse.json({ error: 'Asset ID is required for asset-tracked components' }, { status: 400 });
      }

      // 2. Verify and lock the asset
      const { data: assetUpdate, error: assetError } = await supabase
        .from('component_instances')
        .update({ status: 'IN_USE', current_reservation_id: reservationId })
        .eq('serial_number', assetId)
        .eq('component_id', reservation.component_id)
        .eq('status', 'AVAILABLE')
        .select()
        .maybeSingle();

      if (assetError || !assetUpdate) {
        // Find out why it failed
        const { data: assetCheck } = await supabase.from('component_instances').select('status, component_id').eq('serial_number', assetId).maybeSingle();
        if (!assetCheck) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        if (assetCheck.component_id !== reservation.component_id) return NextResponse.json({ error: 'Asset does not belong to the requested component' }, { status: 400 });
        if (assetCheck.status !== 'AVAILABLE') return NextResponse.json({ error: 'Asset is currently ' + assetCheck.status }, { status: 400 });
        
        return NextResponse.json({ error: 'Failed to assign asset due to race condition' }, { status: 409 });
      }

      // 3. Assign asset to reservation array explicitly if needed, but component_instances covers it
      const currentAssigned = reservation.assigned_serial_numbers || [];
      if (!currentAssigned.includes(assetId)) {
        await supabase
          .from('reservations')
          .update({ assigned_serial_numbers: [...currentAssigned, assetId] })
          .eq('reservation_id', reservationId);
      }
    }

    // Calculate new due date based on original duration from created_at to due_date
    const originalDurationDays = reservation.due_date && reservation.created_at 
      ? Math.max(1, Math.ceil((new Date(reservation.due_date).getTime() - new Date(reservation.created_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 7;
      
    const borrowedAt = new Date();
    let newDueDate = new Date(borrowedAt);
    newDueDate.setDate(newDueDate.getDate() + originalDurationDays);
    newDueDate = getNextWorkingDay(newDueDate);

    // 5. Update reservation status to CHECKED_OUT
    const { data: updatedRes, error: updateResError } = await supabase
      .from('reservations')
      .update({
        status: 'CHECKED_OUT',
        borrowed_at: borrowedAt.toISOString(),
        due_date: newDueDate.toISOString()
      })
      .eq('reservation_id', reservationId)
      .select()
      .single();

    if (updateResError) throw updateResError;

    // Log reservation status change
    await supabase.from('reservation_status_history').insert([{
      reservation_id: reservationId,
      old_status: reservation.status,
      new_status: 'CHECKED_OUT',
      changed_by: payload.userId,
      note: isAssetTracked ? `Asset ${assetId} checked out` : 'Quantity checked out'
    }]);

    return NextResponse.json({ success: true, reservation: updatedRes });

  } catch (err) {
    console.error('[checkout POST]', err);
    return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 });
  }
}
