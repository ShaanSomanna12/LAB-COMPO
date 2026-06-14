import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
      duration: 7 // default as we don't store duration in reservations schema yet
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
    const { id, status, images, geotag } = body;
    
    const updates: any = { status };
    if (images && images.length > 0) {
       // Optional logic if you eventually add images to reservations
       updates.after_img_url = images[0]; 
    }
    
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', id)
      .select()
      .single();

    if (error) throw error;
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

    // 1. Fetch user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('usn', formattedUsn)
      .maybeSingle();

    if (userError || !user) {
       return NextResponse.json({ error: 'User not found for this USN' }, { status: 404 });
    }

    const newReservations = [];

    // 2. Loop through requested items and create reservations
    for (const item of items) {
      // Find component ID
      const { data: component, error: compError } = await supabase
        .from('components')
        .select('component_id')
        .eq('name', item.name)
        .limit(1)
        .maybeSingle();

      if (!component) {
        console.warn('Component not found:', item.name);
        continue;
      }

      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{
          user_id: user.user_id,
          component_id: component.component_id,
          status: 'PENDING',
          section: section || 'A',
          student_department: studentDepartment || 'CSE'
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
