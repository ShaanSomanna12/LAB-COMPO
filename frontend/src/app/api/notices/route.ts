import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Fetch active notices, optionally filtered by department
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    let query = supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (department) {
      query = query.eq('admin_dept', department);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching notices:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Create a new notice
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { admin_dept, message, type } = body;

    if (!admin_dept || !message) {
      return NextResponse.json({ error: 'Department and message are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notices')
      .insert([{
        admin_dept,
        message,
        type: type || 'info',
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, notice: data });
  } catch (error: any) {
    console.error('Error creating notice:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Deactivate or update a notice
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 });
    }

    // Instead of actually deleting, we'll soft delete by setting is_active = false
    const { error } = await supabase
      .from('notices')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting notice:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
