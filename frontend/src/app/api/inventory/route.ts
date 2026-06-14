import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize your Supabase connection directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. The GET function: Fetches real inventory for your dashboard
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data.map(item => ({
      id: item.component_id,
      name: item.name,
      department: item.department,
      available: item.available_quantity,
      total: item.total_quantity,
      status: item.available_quantity > 0 ? 'Available' : 'Under Repair', // Infer status or map
      desc: item.base_condition,
      location: item.lab_location,
      photo_url: item.photo_url
    })));
  } catch (error: any) {
    console.error("Error fetching data:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. The POST function: Saves a new item to your real database
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, department, total, desc, location, photoUrl } = body;

    const { data, error } = await supabase
      .from('components')
      .insert([
        {
          name: name,
          department: department || 'EDL',
          total_quantity: Number(total),
          available_quantity: Number(total), // Usually starts equal to total
          base_condition: desc || 'New catalog item',
          lab_location: location || 'Main Lab',
          photo_url: photoUrl // Saves the image link
        }
      ])
      .select();

    if (error) throw error;

    // Success! Return the newly created item
    return NextResponse.json({ success: true, item: data[0] });

  } catch (error: any) {
    console.error("Error adding to Supabase:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 4. The PATCH function: Updates an existing item (e.g. stock quantities, repair status)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, total, available, status, photoUrl } = body;

    // Build the updates object based on what was provided
    const updates: any = {};
    if (total !== undefined) updates.total_quantity = Number(total);
    if (available !== undefined) updates.available_quantity = Number(available);
    // If we map status to base condition or another column, do it here
    if (status !== undefined) updates.base_condition = status; 
    if (photoUrl !== undefined) updates.photo_url = photoUrl;

    const { data, error } = await supabase
      .from('components')
      .update(updates)
      .eq('component_id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data[0] });

  } catch (error: any) {
    console.error("Error updating component:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 5. The DELETE function: Removes an item from inventory
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing component ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('components')
      .delete()
      .eq('component_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error deleting component:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
