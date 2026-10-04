import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        reservation_id,
        status,
        created_at,
        due_date,
        project_title,
        after_img_url,
        borrowed_at,
        components(name, department, lab_location),
        extension_requested,
        extension_reason,
        extension_days,
        extension_status,
        team_members,
        signature_url,
        project_type,
        project_description,
        hackathon_date,
        hackathon_venue,
        student_department,
        section,
        branch,
        mobile,
        reservation_status_history(new_status, changed_at)
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase Admin Select Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[student reservations GET]', err);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}
