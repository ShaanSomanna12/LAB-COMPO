import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { action, ...data } = body;

    if (action === 'insert') {
      const { error } = await supabaseAdmin.from('iot_components').insert({
        name: data.name,
        description: data.description,
        total_quantity: data.total_quantity,
        available_quantity: data.available_quantity,
        lab_id: data.lab_id
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'update_stock') {
      const { error } = await supabaseAdmin.from('iot_components').update({
        total_quantity: data.total_quantity,
        available_quantity: data.available_quantity
      }).eq('id', data.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.from('iot_components').delete().eq('id', data.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'return_tx') {
      const { error } = await supabaseAdmin.from('iot_transactions').update({ status: 'returned' }).eq('id', data.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const labIdStr = searchParams.get('lab_id');
    const labId = labIdStr ? parseInt(labIdStr) : null;

    let compsQuery = supabaseAdmin.from('iot_components').select('*').order('name');
    if (labId) compsQuery = compsQuery.eq('lab_id', labId);
    const { data: components, error: compsError } = await compsQuery;
    if (compsError) throw compsError;

    let txsQuery = supabaseAdmin.from('iot_transactions').select(`
      *,
      users:student_id (user_id, name, usn, section),
      iot_transaction_items (quantity, iot_components (name))
    `).order('created_at', { ascending: false });
    if (labId) txsQuery = txsQuery.eq('lab_id', labId);
    const { data: transactions, error: txsError } = await txsQuery;
    if (txsError) throw txsError;

    return NextResponse.json({ components, transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
