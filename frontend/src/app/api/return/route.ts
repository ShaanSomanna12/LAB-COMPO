import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession, ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  const payload = await verifySession(request);
  if (!payload || (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN && payload.roleId !== ROLES.HOD)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { assetId, reservationId, condition, note } = body;

    // We can process return either by assetId (for ASSET_TRACKED) or by reservationId (for QUANTITY_TRACKED)
    if (!assetId && !reservationId) {
      return NextResponse.json({ error: 'Asset ID or Reservation ID is required' }, { status: 400 });
    }

    if (assetId) {
      // Return a specific physical asset
      
      // 1. Verify the asset is checked out
      const { data: asset, error: assetError } = await supabase
        .from('component_instances')
        .select('status, current_reservation_id, component_id')
        .eq('serial_number', assetId)
        .single();

      if (assetError || !asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      if (asset.status !== 'IN_USE' || !asset.current_reservation_id) {
        return NextResponse.json({ error: 'Asset is not currently in use or tied to a reservation' }, { status: 400 });
      }

      const activeResId = asset.current_reservation_id;

      // 3. Determine new asset status based on condition
      const isDamaged = condition && condition !== 'GOOD';
      const newAssetStatus = isDamaged ? (condition === 'MISSING' ? 'LOST' : 'MAINTENANCE') : 'AVAILABLE';

      // 4. Update asset
      await supabase
        .from('component_instances')
        .update({ status: newAssetStatus, current_reservation_id: null })
        .eq('serial_number', assetId);

      // 7. Check if all assets for this reservation are returned
      const { data: remainingAssets } = await supabase
        .from('component_instances')
        .select('serial_number')
        .eq('current_reservation_id', activeResId);

      if (!remainingAssets || remainingAssets.length === 0) {
        // All assets returned, update reservation status to RETURNED
        const { data: res } = await supabase.from('reservations').select('status, quantity, component_id').eq('reservation_id', activeResId).single();
        
        await supabase
          .from('reservations')
          .update({
            status: 'RETURNED',
            returned_at: new Date().toISOString(),
            return_condition: condition || 'GOOD'
          })
          .eq('reservation_id', activeResId);

        await supabase.from('reservation_status_history').insert([{
          reservation_id: activeResId,
          old_status: res?.status || 'CHECKED_OUT',
          new_status: 'RETURNED',
          changed_by: payload.userId,
          note: 'All assets returned'
        }]);
        
        // Restore inventory available_quantity
        if (res) {
           const { data: comp } = await supabase.from('components').select('available_quantity').eq('component_id', res.component_id).single();
           if (comp) {
             await supabase.from('components').update({ available_quantity: comp.available_quantity + res.quantity }).eq('component_id', res.component_id);
           }
        }
      }

      return NextResponse.json({ success: true, message: 'Asset returned successfully' });

    } else {
      // Process return by reservationId (Quantity-tracked items)
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('*, components(tracking_type)')
        .eq('reservation_id', reservationId)
        .single();

      if (resError || !reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      if (reservation.components?.tracking_type === 'ASSET') {
        return NextResponse.json({ error: 'This item is asset-tracked. Please scan the specific asset QR to return it.' }, { status: 400 });
      }
      
      if (reservation.status !== 'CHECKED_OUT' && reservation.status !== 'RETURN_REQUESTED') {
         return NextResponse.json({ error: 'Reservation is not checked out' }, { status: 400 });
      }

      await supabase
        .from('reservations')
        .update({
          status: 'RETURNED',
          returned_at: new Date().toISOString(),
          return_condition: condition || 'GOOD'
        })
        .eq('reservation_id', reservationId);

      await supabase.from('reservation_status_history').insert([{
        reservation_id: reservationId,
        old_status: reservation.status,
        new_status: 'RETURNED',
        changed_by: payload.userId,
        note: `Quantity returned. Condition: ${condition || 'GOOD'}`
      }]);
      
      // Restore inventory available_quantity
      const { data: comp } = await supabase.from('components').select('available_quantity').eq('component_id', reservation.component_id).single();
      if (comp) {
        await supabase.from('components').update({ available_quantity: comp.available_quantity + (reservation.quantity || 1) }).eq('component_id', reservation.component_id);
      }

      return NextResponse.json({ success: true, message: 'Reservation returned successfully' });
    }

  } catch (err) {
    console.error('[return POST]', err);
    return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
  }
}
