import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, labId, sessionTime, teamString, cart, borrowerData } = body;

    if (!studentId || !labId || !sessionTime || !cart || cart.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Update the borrower's own user record with the provided name and section
    if (borrowerData && borrowerData.section) {
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          name: borrowerData.name,
          section: borrowerData.section
        })
        .eq('user_id', studentId);
        
      if (userUpdateError) {
        console.error('Failed to update user data during checkout:', userUpdateError);
      }
    }

    // 2. Process Checkout
    const { data: txId, error: rpcError } = await supabaseAdmin.rpc('process_iot_checkout', {
      p_student_id: studentId,
      p_lab_id: labId,
      p_session_time: sessionTime,
      p_project_title: teamString,
      p_cart: cart
    });

    if (rpcError) {
      console.error('RPC Checkout Error:', rpcError);
      return NextResponse.json({ error: `Checkout failed: ${rpcError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, transactionId: txId });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
