import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/email';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        users!inner(name, usn),
        components!inner(name, department, lab_location)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Format to match what the frontend expects (combining relational data)
    const formattedData = data.map((res: any) => ({
      id: res.reservation_id,
      studentName: res.users?.name,
      usn: res.users?.usn,
      component: res.components?.name,
      department: res.components?.department || 'EDL',
      location: res.components?.lab_location || 'Main Lab',
      status: res.status,
      section: res.section,
      studentDepartment: res.student_department,
      requestDate: res.created_at.split('T')[0],
      duration: 7, // default as we don't store duration in reservations schema yet
      isDamaged: res.is_damaged === true
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching reservations:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, images, geotag, is_damaged, return_condition } = body;
    
    const updates: any = { status };
    if (images && images.length > 0) {
       // Optional logic if you eventually add images to reservations
       updates.after_img_url = images[0]; 
    }
    if (is_damaged !== undefined) updates.is_damaged = is_damaged;
    if (return_condition) updates.return_condition = return_condition;
    
    if (status === 'RETURNED') {
       updates.returned_at = new Date().toISOString();
    }
    
    if (geotag) {
      updates.geotag_image_url = geotag.imageUrl;
      updates.latitude = geotag.latitude;
      updates.longitude = geotag.longitude;
      updates.borrowed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', id)
      .select('*, users(user_id, email, usn, trust_score), components(name)')
      .single();

    if (error) throw error;

    // Trust Score Calculation on Return
    if (status === 'RETURNED' && data.users) {
       const user = Array.isArray(data.users) ? data.users[0] : data.users;
       if (user && user.user_id && data.due_date) {
         let scoreChange = 0;
         const returnedAt = new Date();
         const dueDate = new Date(data.due_date);
         
         const isLate = returnedAt > dueDate;
         const isDamaged = updates.is_damaged === true || (updates.return_condition && updates.return_condition !== 'WORKING');
         
         if (isDamaged) {
           scoreChange -= 20;
         }
         if (isLate) {
           scoreChange -= 5;
         }
         
         if (!isDamaged && !isLate) {
           scoreChange += 2;
         }
         
         if (scoreChange !== 0) {
           let newScore = (user.trust_score !== undefined && user.trust_score !== null ? user.trust_score : 100) + scoreChange;
           if (newScore > 200) newScore = 200; // Cap score
           
           await supabase
             .from('users')
             .update({ trust_score: newScore })
             .eq('user_id', user.user_id);
         }
       }
    }

    // Trigger Email Notification for Status Changes
    if ((status === 'APPROVED' || status === 'PENDING_ADMIN' || status === 'REJECTED' || status === 'Ready for Collection' || status === 'RETURNED DAMAGED') && data.users) {
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

    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('Error updating reservation:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentName, usn, section, studentDepartment, items, date, time, duration, images } = body;
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    const formattedUsn = (usn || '').toUpperCase();

    // 1. Fetch user ID and Trust Score
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, trust_score')
      .eq('usn', formattedUsn)
      .maybeSingle();

    if (userError || !user) {
       return NextResponse.json({ error: 'User not found for this USN' }, { status: 404 });
    }

    const trustScore = user.trust_score !== undefined && user.trust_score !== null ? user.trust_score : 100;

    if (trustScore < 50) {
       return NextResponse.json({ error: 'Checkout blocked. Your trust score is too low. Please contact HOD.' }, { status: 403 });
    }

    const newReservations = [];

    // 2. Loop through requested items and create reservations
    for (const item of items) {
      // Find component ID and value_tier
      const { data: component, error: compError } = await supabase
        .from('components')
        .select('component_id, value_tier')
        .eq('name', item.name)
        .limit(1)
        .maybeSingle();

      if (!component) {
        console.warn('Component not found:', item.name);
        continue;
      }

      // Smart Approvals: if LOW tier, auto-approve
      let isLowTier = component.value_tier === 'LOW';
      
      // Trust Score Benefit: Auto-approve HIGH tier if score >= 150
      if (trustScore >= 150 && component.value_tier === 'HIGH') {
         isLowTier = true;
      }
      
      const status = isLowTier ? 'APPROVED' : 'PENDING';
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (duration || 7));

      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{
          user_id: user.user_id,
          component_id: component.component_id,
          status: status,
          section: section || 'A',
          student_department: studentDepartment || 'CSE',
          project_title: body.projectTitle || null,
          due_date: dueDate.toISOString()
        }])
        .select()
        .single();

      if (resError) throw resError;
      newReservations.push(reservation);
    }

    return NextResponse.json({ success: true, items: newReservations });
  } catch (error: any) {
    console.error('Error creating reservation:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing service role key");
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('reservation_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting reservation:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
