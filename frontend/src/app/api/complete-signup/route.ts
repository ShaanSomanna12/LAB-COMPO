import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { usn, email, userId } = await request.json();

    if (!usn || !email || !userId) {
      return NextResponse.json({ error: 'Missing parameters: usn, email, and userId are required' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error: missing service role key' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const formattedUsn = usn.toUpperCase();

    // Update public.users row with the actual auth user_id and clear OTP
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        user_id: userId,
        otp_code: null,
        otp_expiry: null
      })
      .eq('usn', formattedUsn)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Complete Signup API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
