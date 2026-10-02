import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession } from '@/lib/auth';

const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  // Identity comes from the signed JWT — never trust the request body for email
  const payload = await verifySession(request);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { name, usn, department, branch, section, mobile, id_card_url } = await request.json();

    // ── Input validation ──────────────────────────────────────────────────
    if (usn && !/^[1-4][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9]{2,3}$/.test(usn.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid USN format' }, { status: 400 });
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }
    if (name && (name.trim().length < 2 || name.trim().length > 100)) {
      return NextResponse.json({ error: 'Name must be 2–100 characters' }, { status: 400 });
    }

    // ── Update — scoped strictly to the authenticated user's email ────────
    const { data, error } = await supabase
      .from('users')
      .update({
        ...(name      !== undefined && { name: name.trim() }),
        ...(usn       !== undefined && { usn: usn.toUpperCase() }),
        ...(department !== undefined && { department }),
        ...(branch    !== undefined && { branch }),
        ...(section   !== undefined && { section }),
        ...(mobile    !== undefined && { mobile }),
        ...(id_card_url !== undefined && { id_card_url }),
      })
      .eq('email', payload.email!)   // use JWT email — not request body
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[profile POST]', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
