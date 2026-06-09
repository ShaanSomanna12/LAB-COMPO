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
      .select('*');

    if (error) throw error;

    return NextResponse.json(data);
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
          location: location || 'Main Lab',
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
