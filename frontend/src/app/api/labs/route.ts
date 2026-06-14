import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching labs:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, roomNumber, department, description, photoUrl } = body;
    const id = `LAB-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const { data, error } = await supabase
      .from('labs')
      .insert([{
        lab_id: id,
        name: name,
        room_number: roomNumber,
        department: department,
        description: description || '',
        photo_url: photoUrl || ''
      }])
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('Error creating lab:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const { error } = await supabase
      .from('labs')
      .delete()
      .eq('lab_id', id);
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting lab:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
