import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase as anonClient } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/email';
import { verifySession, ROLES, isValidUSN } from '@/lib/auth';
import { getNextWorkingDay, getWorkingDaysCount } from '@/lib/dateValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : anonClient;

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/requests — Admins, HODs, Super Admins only
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const payload = await verifySession(request);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const isPrivileged =
    payload.roleId === ROLES.ADMIN ||
    payload.roleId === ROLES.HOD ||
    payload.roleId === ROLES.SUPER_ADMIN ||
    payload.roleId === ROLES.FACULTY;
  if (!isPrivileged) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '500', 10);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('reservations')
      .select(`
        *,
        users(name, usn, mobile, branch, id_card_url),
        components(name, department, lab_location),
        reservation_status_history(old_status, new_status, changed_at, note, changed_by, users(name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const formattedData = data.map((res: any) => ({
      id: res.reservation_id,
      studentName: res.users?.name,
      usn: res.users?.usn,
      mobile: res.users?.mobile,
      year: res.users?.branch,
      component: res.components?.name,
      department: res.components?.department || 'EDL',
      location: res.components?.lab_location || 'Main Lab',
      status: res.status,
      section: res.section,
      studentDepartment: res.student_department,
      requestDate: res.created_at ? res.created_at.split('T')[0] : null,
      createdAt: res.created_at,
      date: res.created_at ? res.created_at.split('T')[0] : null,
      duration: res.due_date && res.created_at ? getWorkingDaysCount(res.created_at, res.due_date) : 7,
      dueDate: res.due_date || null,
      isDamaged: res.is_damaged === true,
      returnedAt: res.returned_at,
      valueTier: res.components?.value_tier,
      trackingType: res.components?.tracking_type || 'QUANTITY',
      quantity: res.quantity || 1,
      collectionTime: res.collection_time || null,
      afterImgUrl: res.after_img_url || null,
      images: [res.after_img_url].filter(Boolean),
      projectType: res.project_type || 'Normal',
      projectTitle: res.project_title || null,
      projectPurpose: res.project_purpose || null,
      hackathonDate: res.hackathon_date || null,
      hackathonVenue: res.hackathon_venue || null,
      idCardUrl: res.users?.id_card_url || res.id_card_url || null,
      signatureUrl: res.signature_url || null,
      requestMode: res.request_mode || 'individual',
      teamMembers: res.team_members || [],
      extensionRequested: res.extension_requested || false,
      extensionReason: res.extension_reason || null,
      extensionDays: res.extension_days || null,
      extensionStatus: res.extension_status || null,
      history: res.reservation_status_history?.map((h: any) => ({
        oldStatus: h.old_status,
        newStatus: h.new_status,
        changedAt: h.changed_at,
        note: h.note,
        changedBy: h.users?.name || 'System',
      })) || [],
      assignedAssetId:
        res.component_instances?.[0]?.serial_number ||
        (res.assigned_serial_numbers?.length > 0 ? res.assigned_serial_numbers[0] : null),
    }));

    return NextResponse.json({
      data: formattedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    console.error('[requests GET]', err);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/requests — Status updates (Admin / HOD / SuperAdmin / Student limited)
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const payload = await verifySession(request);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, images, is_damaged, return_condition, returnCondition, quantity, collectionTime, dueDate, date, rejectionReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const canMutate =
      payload.roleId === ROLES.ADMIN ||
      payload.roleId === ROLES.HOD ||
      payload.roleId === ROLES.SUPER_ADMIN ||
      (payload.roleId === ROLES.STUDENT && ['CANCELLED', 'READY_FOR_PICKUP', 'RETURN_REQUESTED'].includes(status));

    if (!canMutate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

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
          const durationTime =
            new Date(currentReservation.due_date).getTime() -
            new Date(currentReservation.created_at).getTime();
          let newDueDate = new Date(new Date(updates.created_at).getTime() + durationTime);
          newDueDate = getNextWorkingDay(newDueDate);
          updates.due_date = newDueDate.toISOString();
        }
        noteToAppend = noteToAppend ? `${noteToAppend}. Date changed to ${date}` : `Date changed to ${date}`;
      }
    }
    if (images && images.length > 0) updates.after_img_url = images[0];
    if (is_damaged !== undefined) updates.is_damaged = is_damaged;

    const finalReturnCondition = return_condition || returnCondition;
    if (finalReturnCondition) updates.return_condition = finalReturnCondition;
    if (status === 'RETURNED') updates.returned_at = new Date().toISOString();
    if (status === 'RETURN_REQUESTED' && images?.length > 0) updates.after_img_url = images[0];

    // ── Atomic inventory release via RPC ─────────────────────────────────
    if (currentReservation) {
      const oldStatus = currentReservation.status;
      const isReleasing =
        ['RETURNED', 'REJECTED', 'CANCELLED'].includes(status) &&
        !['RETURNED', 'REJECTED', 'CANCELLED'].includes(oldStatus);

      const totalToRelease = isReleasing
        ? currentReservation.quantity || 1
        : quantityDiff > 0 && !['REJECTED', 'CANCELLED'].includes(status)
        ? quantityDiff
        : 0;

      if (totalToRelease > 0) {
        const { error: incError } = await supabase.rpc('increment_inventory', {
          p_component_id: currentReservation.component_id,
          p_qty: totalToRelease,
        });
        if (incError) {
          console.error('[requests PATCH] increment error:', incError);
          return NextResponse.json({ error: 'Failed to release inventory' }, { status: 500 });
        }
      }
    }

    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', id)
      .select('*, users(user_id, email, usn), components(name)')
      .single();

    if (error) throw error;

    if (currentReservation && (status !== currentReservation.status || noteToAppend)) {
      await supabase.from('reservation_status_history').insert([{
        reservation_id: id,
        old_status: currentReservation.status,
        new_status: status || currentReservation.status,
        changed_by: payload?.userId || null,
        note: noteToAppend || null,
      }]);
    }

    // Fire-and-forget email notification
    if (['APPROVED', 'REJECTED', 'READY_FOR_PICKUP', 'RETURNED', 'CHECKED_OUT'].includes(status) && data.users) {
      const userObj = Array.isArray(data.users) ? data.users[0] : data.users;
      const compObj = Array.isArray(data.components) ? data.components[0] : data.components;
      if (userObj?.email) {
        sendNotificationEmail(
          userObj.email,
          `Hardware Request Update: ${status}`,
          status,
          compObj?.name || 'Requested Hardware',
          userObj.usn || 'Student',
        ).catch(err => console.error('[email]', err));
      }
    }



    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    console.error('[requests PATCH]', err);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/requests — Create reservation(s)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let authUser: any = null;
  const payload = await verifySession(request);

  if (payload) {
    authUser = payload;
  } else {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
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
    const {
      usn, section, studentDepartment, items, date, time, duration,
      images, projectType, projectTitle, projectPurpose,
      hackathonDate, hackathonVenue, idCardUrl, signatureUrl,
      requestMode, teamMembers,
    } = body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!usn || !isValidUSN(usn)) {
      return NextResponse.json({ error: 'Invalid or missing USN' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart must have at least one item' }, { status: 400 });
    }
    if (items.length > 10) {
      return NextResponse.json({ error: 'Cart cannot exceed 10 items' }, { status: 400 });
    }
    if (duration !== null && duration !== undefined && (duration < 1 || duration > 30)) {
      return NextResponse.json({ error: 'Duration must be between 1 and 30 days' }, { status: 400 });
    }
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string') {
        return NextResponse.json({ error: 'Each item must have a valid name' }, { status: 400 });
      }
      if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)) {
        return NextResponse.json({ error: `Invalid quantity for ${item.name}` }, { status: 400 });
      }
    }

    const formattedUsn = usn.toUpperCase();

    // ── Fetch user ──────────────────────────────────────────────────────────
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, department')
      .eq('usn', formattedUsn)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found for this USN' }, { status: 404 });
    }

    if (body.mobile) {
      await supabase.from('users').update({ mobile: body.mobile }).eq('user_id', user.user_id);
    }

    // ── Batch-fetch all components in a single query (fix N+1) ──────────────
    const itemNames = items.map((i: any) => i.name);
    const { data: componentsRaw, error: compError } = await supabase
      .from('components')
      .select('component_id, name, available_quantity')
      .in('name', itemNames);

    if (compError) throw compError;

    const componentMap = new Map(componentsRaw?.map((c: any) => [c.name, c]) ?? []);

    // ── Pre-flight: determine approval tier ─────────────────────────────────
    let cartRequiresApproval = false;
    for (const item of items) {
      const component = componentMap.get(item.name);
      if (!component) {
        return NextResponse.json({ error: `Component not found: ${item.name}` }, { status: 404 });
      }
      const reqQty = item.quantity || 1;
      const tierUpper = (component.value_tier || 'MEDIUM').toUpperCase();
      if (tierUpper !== 'LOW' || reqQty > 3) {
        cartRequiresApproval = true;
      }
    }

    // ── Phase 1: Atomic decrement of all items ──────────────────────────────
    const successfulDecrements: Array<{ component_id: string; reqQty: number }> = [];
    try {
      for (const item of items) {
        const component = componentMap.get(item.name)!;
        const reqQty = item.quantity || 1;

        const { data: decremented, error: rpcError } = await supabase.rpc('decrement_inventory', {
          p_component_id: component.component_id,
          p_qty: reqQty,
        });

        if (rpcError) throw rpcError;
        if (!decremented) {
          throw new Error(`Insufficient stock for "${item.name}". Another user may have just booked the last unit.`);
        }
        successfulDecrements.push({ component_id: component.component_id, reqQty });
      }
    } catch (decrementErr: any) {
      // Rollback successful decrements
      for (const { component_id, reqQty } of successfulDecrements) {
        await supabase.rpc('increment_inventory', {
          p_component_id: component_id,
          p_qty: reqQty,
        });
      }
      return NextResponse.json({ error: decrementErr.message }, { status: 409 });
    }

    // ── Phase 2: Create reservations ────────────────────────────────────────
    const newReservations: any[] = [];
    const status = cartRequiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    for (const item of items) {
      const component = componentMap.get(item.name)!;
      const reqQty = item.quantity || 1;

      const collectionDate = date ? new Date(date) : new Date();
      let dueDate: Date | null = new Date(collectionDate);
      if (duration === null || duration === undefined) {
        dueDate = null;
      } else {
        dueDate.setDate(dueDate.getDate() + (duration ?? 7));
        dueDate = getNextWorkingDay(dueDate);
      }

      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{
          user_id: user.user_id,
          component_id: component.component_id,
          status,
          section: section || 'A',
          student_department: studentDepartment || user.department || 'CSE',
          project_title: projectTitle || null,
          project_purpose: projectPurpose || null,
          project_type: projectType || 'Normal',
          hackathon_date: hackathonDate || null,
          hackathon_venue: hackathonVenue || null,
          id_card_url: idCardUrl || null,
          signature_url: signatureUrl || null,
          request_mode: requestMode || 'individual',
          team_members: teamMembers || null,
          due_date: dueDate ? dueDate.toISOString() : null,
          quantity: reqQty,
          collection_time: time || null,
        }])
        .select()
        .single();

      if (resError) {
        // Since Phase 1 succeeded, a failure here is extremely rare but must be handled.
        // In a true system, we'd roll back EVERYTHING (all reservations so far + all decrements).
        // Since we are creating them iteratively without a true transaction, we try our best:
        for (const { component_id, reqQty } of successfulDecrements) {
          await supabase.rpc('increment_inventory', {
            p_component_id: component_id,
            p_qty: reqQty,
          });
        }
        if (newReservations.length > 0) {
          await supabase
            .from('reservations')
            .delete()
            .in('reservation_id', newReservations.map(r => r.reservation_id));
        }
        throw resError;
      }

      await supabase.from('reservation_status_history').insert([{
        reservation_id: reservation.reservation_id,
        old_status: null,
        new_status: status,
        changed_by: authUser?.userId || authUser?.id || null,
        note: 'Request created',
      }]);

      newReservations.push(reservation);
    }

    return NextResponse.json({ success: true, items: newReservations });
  } catch (err: any) {
    console.error('[requests POST]', err);
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/requests — Admin / SuperAdmin only
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
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
