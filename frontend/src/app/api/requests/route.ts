import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase as anonClient } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/email';
import { verifySession, ROLES } from '@/lib/auth';
import { getNextWorkingDay, getWorkingDaysCount } from '@/lib/dateValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Automatically upgrade to admin client (bypassing RLS) on the server if the service role key is available
const supabase = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : anonClient;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        users(name, usn, mobile),
        components(name, department, lab_location, value_tier, tracking_type),
        reservation_status_history(old_status, new_status, changed_at, note, changed_by, users(name))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Format to match what the frontend expects (combining relational data)
    const formattedData = data.map((res: any) => ({
      id: res.reservation_id,
      studentName: res.users?.name,
      usn: res.users?.usn,
      mobile: res.users?.mobile,
      component: res.components?.name,
      department: res.components?.department || 'EDL',
      location: res.components?.lab_location || 'Main Lab',
      status: res.status,
      section: res.section,
      studentDepartment: res.student_department,
      requestDate: res.created_at ? res.created_at.split('T')[0] : null,
      date: res.created_at ? res.created_at.split('T')[0] : null,
      duration: res.due_date && res.created_at ? getWorkingDaysCount(res.created_at, res.due_date) : 7,
      dueDate: res.due_date || null,
      isDamaged: res.is_damaged === true,
      returnedAt: res.returned_at,
      valueTier: res.components?.value_tier,
      trackingType: res.components?.tracking_type || 'QUANTITY',
      quantity: res.quantity || 1,
      collectionTime: res.collection_time || null,
      geotagImageUrl: res.geotag_image_url || null,
      afterImgUrl: res.after_img_url || null,
      latitude: res.latitude || null,
      longitude: res.longitude || null,
      images: [res.geotag_image_url, res.after_img_url].filter(Boolean),
      extensionRequested: res.extension_requested || false,
      extensionReason: res.extension_reason || null,
      extensionDays: res.extension_days || null,
      extensionStatus: res.extension_status || null,
      history: res.reservation_status_history?.map((h: any) => ({
        oldStatus: h.old_status,
        newStatus: h.new_status,
        changedAt: h.changed_at,
        note: h.note,
        changedBy: h.users?.name || 'System'
      })) || [],
      assignedAssetId: res.component_instances?.[0]?.serial_number || (res.assigned_serial_numbers && res.assigned_serial_numbers.length > 0 ? res.assigned_serial_numbers[0] : null)
    }));

    return NextResponse.json(formattedData);
  } catch (err: any) {
    console.error('[requests GET]', err);
    return NextResponse.json({ error: 'Failed to fetch requests', details: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // Requires Admin (roleId 3) or HOD (roleId 4) or SuperAdmin (roleId 5)
  const payload = await verifySession(request);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, status, images, geotag, is_damaged, return_condition, returnCondition, quantity, collectionTime, dueDate, date, rejectionReason } = body;

    const canMutate =
      payload.roleId === ROLES.ADMIN ||
      payload.roleId === ROLES.HOD ||
      payload.roleId === ROLES.SUPER_ADMIN ||
      (payload.roleId === ROLES.STUDENT && ['CANCELLED', 'READY_FOR_PICKUP', 'RETURN_REQUESTED'].includes(status));
      
    if (!canMutate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Fetch current state to manage inventory release and dates
    const { data: currentReservation } = await supabase
      .from('reservations')
      .select('status, component_id, quantity, created_at, due_date')
      .eq('reservation_id', id)
      .single();
    
    const updates: any = { status };
    if (dueDate !== undefined) updates.due_date = dueDate;
    
    let quantityDiff = 0;
    if (quantity !== undefined) {
      updates.quantity = quantity;
      if (currentReservation && quantity < currentReservation.quantity) {
        // Calculate how much stock to return to inventory if admin reduced the approved amount
        quantityDiff = currentReservation.quantity - quantity;
      }
    }
    if (collectionTime !== undefined) updates.collection_time = collectionTime;

    let noteToAppend = rejectionReason || '';
    if (date !== undefined && currentReservation) {
      const currentDateStr = currentReservation.created_at.split('T')[0];
      if (date !== currentDateStr) {
        updates.created_at = new Date(date).toISOString();
        if (currentReservation.due_date && currentReservation.created_at) {
          const durationTime = new Date(currentReservation.due_date).getTime() - new Date(currentReservation.created_at).getTime();
          let newDueDate = new Date(new Date(updates.created_at).getTime() + durationTime);
          newDueDate = getNextWorkingDay(newDueDate);
          updates.due_date = newDueDate.toISOString();
        }
        noteToAppend = noteToAppend ? `${noteToAppend}. Date changed to ${date}` : `Date changed to ${date}`;
      }
    }
    if (images && images.length > 0) {
       // Optional logic if you eventually add images to reservations
       updates.after_img_url = images[0]; 
    }
    if (is_damaged !== undefined) updates.is_damaged = is_damaged;
    
    // Support both snake_case and camelCase parameters from the client
    const finalReturnCondition = return_condition || returnCondition;
    if (finalReturnCondition) {
      updates.return_condition = finalReturnCondition;
    }
    
    if (status === 'RETURNED') {
       updates.returned_at = new Date().toISOString();
    }
    
    if (geotag) {
      if (status === 'RETURN_REQUESTED') {
        updates.after_img_url = geotag.imageUrl;
      } else {
        updates.geotag_image_url = geotag.imageUrl;
        updates.borrowed_at = new Date().toISOString();
      }
      updates.latitude = geotag.latitude;
      updates.longitude = geotag.longitude;
    }
    
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', id)
      .select('*, users(user_id, email, usn), components(name)')
      .single();

    if (error) throw error;

    // Insert history record if status changed or date changed
    if (currentReservation && (status !== currentReservation.status || noteToAppend)) {
      await supabase.from('reservation_status_history').insert([{
        reservation_id: id,
        old_status: currentReservation.status,
        new_status: status || currentReservation.status,
        changed_by: payload?.userId || null,
        note: noteToAppend || null
      }]);
    }

    // Trigger Email Notification for Status Changes
    if ((status === 'APPROVED' || status === 'REJECTED' || status === 'READY_FOR_PICKUP' || status === 'RETURNED' || status === 'CHECKED_OUT') && data.users) {
       const userObj = Array.isArray(data.users) ? data.users[0] : data.users;
       const compObj = Array.isArray(data.components) ? data.components[0] : data.components;
       if (userObj && userObj.email) {
         // Fire and forget (don't await to block the API response)
         sendNotificationEmail(
           userObj.email,
           `Hardware Request Update: ${status}`,
           status,
           compObj?.name || 'Requested Hardware',
           userObj.usn || 'Student'
         ).catch(err => console.error("Email error:", err));
       }
    }

     // Release inventory if status changes to a terminal/cancelled state OR if admin reduced the approved quantity
     if (currentReservation) {
        const oldStatus = currentReservation.status;
        const isReleasing = ['RETURNED', 'REJECTED', 'CANCELLED'].includes(status) && !['RETURNED', 'REJECTED', 'CANCELLED'].includes(oldStatus);
        
        let totalQuantityToRelease = 0;
        
        // 1. Full release if cancelled/rejected/returned
        if (isReleasing) {
           totalQuantityToRelease = currentReservation.quantity || 1;
        } 
        // 2. Partial release if admin reduced quantity during approval
        else if (quantityDiff > 0 && status !== 'REJECTED' && status !== 'CANCELLED') {
           totalQuantityToRelease = quantityDiff;
        }
        
        if (totalQuantityToRelease > 0) {
           const { data: comp } = await supabase
             .from('components')
             .select('available_quantity')
             .eq('component_id', currentReservation.component_id)
             .single();
             
           if (comp) {
              await supabase
                .from('components')
                .update({ available_quantity: comp.available_quantity + totalQuantityToRelease })
                .eq('component_id', currentReservation.component_id);
           }
        }
     }

    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    console.error('[requests PATCH]', err);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Any authenticated user can create a reservation
  let authUser: any = null;
  const payload = await verifySession(request);
  
  if (payload) {
    authUser = payload;
  } else {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
       const token = authHeader.substring(7);
       const { data: { user } } = await anonClient.auth.getUser(token);
       if (user) authUser = user;
    }
  }

  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { studentName, usn, section, studentDepartment, items, date, time, duration, images } = body;
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    const formattedUsn = (usn || '').toUpperCase();

    // 1. Fetch user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, department')
      .eq('usn', formattedUsn)
      .maybeSingle();

    if (userError || !user) {
       return NextResponse.json({ error: 'User not found for this USN' }, { status: 404 });
    }

    // Update user's mobile number if provided
    if (body.mobile) {
      await supabase
        .from('users')
        .update({ mobile: body.mobile })
        .eq('user_id', user.user_id);
    }

    const newReservations = [];

    // 2. Loop through requested items and create reservations
    for (const item of items) {
      // Find component ID and value_tier
      const { data: component, error: compError } = await supabase
        .from('components')
        .select('component_id, value_tier, available_quantity')
        .eq('name', item.name)
        .limit(1)
        .maybeSingle();

      if (!component) {
        console.warn('Component not found:', item.name);
        continue;
      }
      
      const reqQty = item.quantity || 1;
      if (component.available_quantity < reqQty) {
        return NextResponse.json({ error: `Not enough stock available for ${item.name}. (Available: ${component.available_quantity})` }, { status: 400 });
      }

      const tierUpper = (component.value_tier || 'MEDIUM').toUpperCase();
      let isLowTier = tierUpper === 'LOW';
      
      let status = 'PENDING_APPROVAL';
      if (isLowTier && reqQty <= 3) {
        status = 'APPROVED';
      } else if (tierUpper === 'HIGH') {
        status = 'PENDING_APPROVAL';
      }
      
      const collectionDate = date ? new Date(date) : new Date();
      let dueDate = new Date(collectionDate);
      dueDate.setDate(dueDate.getDate() + (duration || 7));
      dueDate = getNextWorkingDay(dueDate);

      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{
          user_id: user.user_id,
          component_id: component.component_id,
          status: status,
          section: section || 'A',
          student_department: studentDepartment || user.department || 'CSE',
          project_title: body.projectTitle || null,
          due_date: dueDate.toISOString(),
          quantity: item.quantity || 1,
          collection_time: time || null
        }])
        .select()
        .single();

      if (resError) throw resError;
      
      await supabase
        .from('components')
        .update({ available_quantity: component.available_quantity - reqQty })
        .eq('component_id', component.component_id);
      
      // Insert initial history record
      await supabase.from('reservation_status_history').insert([{
        reservation_id: reservation.reservation_id,
        old_status: null,
        new_status: status,
        changed_by: authUser?.userId || authUser?.id || null,
        note: 'Request created'
      }]);
        
      newReservations.push(reservation);
    }

    return NextResponse.json({ success: true, items: newReservations });
  } catch (err) {
    console.error('[requests POST]', err);
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // Requires Admin or SuperAdmin
  const payload = await verifySession(request);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (payload.roleId !== ROLES.ADMIN && payload.roleId !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('reservation_id', parseInt(id, 10));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[requests DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
}
