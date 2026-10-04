import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reservationsToInsert } = body;

    if (!reservationsToInsert || reservationsToInsert.length === 0) {
      return NextResponse.json({ error: 'No reservations to insert' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from('reservations').insert(reservationsToInsert).select();

    if (error) {
      console.error("Supabase Admin Insert Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[student checkout POST]', err);
    return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 });
  }
}
