import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role or anon key. 
// We use the anon key here as it allows standard signups.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_ACCOUNTS = [
  { dept: 'edl', usn: 'ADMIN_EDL', email: 'AdMin@edl.vvce.in', password: 'Adminedlvvce@00123' },
  { dept: 'ece', usn: 'ADMIN_ECE', email: 'AdMin@ece.vvce.in', password: 'Adminecevvce@00123' },
  { dept: 'eee', usn: 'ADMIN_EEE', email: 'AdMin@eee.vvce.in', password: 'Admineeevvce@00123' },
  { dept: 'civil', usn: 'ADMIN_CIVIL', email: 'AdMin@civil.vvce.in', password: 'Admincivilvvce@00123' },
  { dept: 'mech', usn: 'ADMIN_MECH', email: 'AdMin@mech.vvce.in', password: 'Adminmechvvce@00123' }
];

export async function GET() {
  const results = [];

  for (const account of ADMIN_ACCOUNTS) {
    try {
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
      });

      if (authError) {
        console.log(`Auth for ${account.email}:`, authError.message);
        results.push({ email: account.email, status: `Auth Error: ${authError.message}` });
        continue;
      }

      // 2. Upsert the admin profile into public.users with role_id = 3 (LabAdmin)
      const { error: dbError } = await supabase
        .from('users')
        .upsert({
          usn: account.usn,
          name: `${account.dept.toUpperCase()} Lab Admin`,
          email: account.email,
          role_id: 3,
          password_hash: account.password
        }, { onConflict: 'usn' });

      if (dbError) throw dbError;

      results.push({ email: account.email, status: 'Successfully created / updated!' });
    } catch (error: any) {
      results.push({ email: account.email, status: `Failed: ${error.message}` });
    }
  }

  return NextResponse.json({
    message: "Admin Seeding Process Complete!",
    details: "You can now log in using any of these credentials at /admin-access",
    results
  });
}
