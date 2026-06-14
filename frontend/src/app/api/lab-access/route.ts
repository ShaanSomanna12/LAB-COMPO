import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const usn = searchParams.get('usn');
  
  try {
    let query = supabase.from('lab_access_requests').select('*').order('access_date', { ascending: false });
    
    if (usn) {
      // In Supabase, you don't typically use UPPER() in the query builder directly on the column for equality, 
      // but ilike provides case-insensitive matching.
      query = query.ilike('usn', usn);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching lab access:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentName, usn, labName, accessDate, timeSlot, purpose } = body;
    
    // Map labName to its department
    let department = 'EDL';
    const name = (labName || '').toLowerCase();
    if (name.includes('ece') || name.includes('electronics')) {
      department = 'ECE';
    } else if (name.includes('eee') || name.includes('electrical')) {
      department = 'EEE';
    } else if (name.includes('mech') || name.includes('mechanical')) {
      department = 'MECH';
    } else if (name.includes('edl') || name.includes('development') || name.includes('engineering') || name.includes('cse') || name.includes('computer') || name.includes('science')) {
      department = 'EDL';
    }

    const { data, error } = await supabase
      .from('lab_access_requests')
      .insert([{
        student_name: studentName,
        usn: usn,
        lab_name: labName,
        department: body.department || department,
        access_date: accessDate || new Date().toISOString().split('T')[0],
        time_slot: timeSlot,
        purpose: purpose || '',
        status: 'PENDING_HOD'
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('Error creating lab access request:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, adminRemarks, hodRemarks } = body;
    
    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (adminRemarks !== undefined) updates.admin_remarks = adminRemarks;
    if (hodRemarks !== undefined) updates.hod_remarks = hodRemarks;
    
    const { data, error } = await supabase
      .from('lab_access_requests')
      .update(updates)
      .eq('request_id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('Error updating lab access request:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
