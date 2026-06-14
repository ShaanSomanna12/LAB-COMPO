import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { usn, otpCode, newPassword } = await request.json();

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Server is missing SUPABASE_SERVICE_ROLE_KEY in environment variables.");
        }

        // Initialize standard client to check public.users
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const formattedUSN = usn.toUpperCase();

        // 1. Verify OTP in our public.users table
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('email, otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

        if (fetchError || !userData) {
            return NextResponse.json({ success: false, error: "USN not found." }, { status: 400 });
        }

        if (userData.otp_code !== otpCode) {
            return NextResponse.json({ success: false, error: "Invalid OTP code." }, { status: 400 });
        }

        if (new Date(userData.otp_expiry) < new Date()) {
            return NextResponse.json({ success: false, error: "OTP code has expired." }, { status: 400 });
        }

        const email = userData.email;

        // 2. Initialize Supabase Admin client
        const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 3. Find the user's Auth ID by scanning the auth.users list (paginated)
        let targetAuthId = null;
        let page = 1;
        while (true) {
            const { data: authData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                page: page,
                perPage: 1000
            });

            if (listError || !authData.users || authData.users.length === 0) {
                break;
            }

            const match = authData.users.find(u => u.email === email);
            if (match) {
                targetAuthId = match.id;
                break;
            }
            page++;
        }

        if (!targetAuthId) {
            return NextResponse.json({ success: false, error: "User account not fully registered in Auth system yet." }, { status: 400 });
        }

        // 4. Force reset the user's password using the Admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
            password: newPassword
        });

        if (updateError) {
            throw updateError;
        }

        // 5. Clear the OTP from the database for security
        await supabaseAdmin.from('users').update({ otp_code: null, otp_expiry: null }).eq('usn', formattedUSN);

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error: any) {
        console.error("RESET PASSWORD ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
