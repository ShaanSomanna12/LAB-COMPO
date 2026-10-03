import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: iotTxData, error: iotError } = await supabaseAdmin
      .from('iot_transactions')
      .select(`
        id,
        status,
        created_at,
        session_time,
        project_title,
        type,
        iot_transaction_items ( quantity, iot_components(name) )
      `)
      .eq('student_id', userId)
      .order('created_at', { ascending: false });

    if (iotError) throw iotError;

    return NextResponse.json({ data: iotTxData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
