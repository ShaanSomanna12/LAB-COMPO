import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { usn, otpCode, newPassword } = await request.json();

        if (!usn || !otpCode || !newPassword) {
            return NextResponse.json({ success: false, error: "Missing required fields: usn, otpCode, and newPassword." }, { status: 400 });
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceRoleKey || !supabaseUrl) {
            return NextResponse.json({ success: false, error: "Server missing Supabase service configuration." }, { status: 500 });
        }

        // Initialize Supabase Admin client (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const formattedUSN = usn.trim().toUpperCase();
        const cleanOtpCode = otpCode.toString().trim();

        // 1. Verify OTP in public.users table using Service Role Key
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('email, otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

        if (fetchError || !userData) {
            return NextResponse.json({ success: false, error: "USN not found." }, { status: 400 });
        }

        if (!userData.otp_code) {
            return NextResponse.json({ success: false, error: "No OTP was requested for this account. Please request a new OTP." }, { status: 400 });
        }

        if (userData.otp_code.toString().trim() !== cleanOtpCode) {
            return NextResponse.json({ success: false, error: "Invalid OTP code. Please check your email and try again." }, { status: 400 });
        }

        if (!userData.otp_expiry || new Date(userData.otp_expiry) < new Date()) {
            return NextResponse.json({ success: false, error: "OTP code has expired. Please request a new code." }, { status: 400 });
        }

        const email = userData.email;

        // 2. Find the user's Auth ID by scanning the auth.users list (paginated)
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

            const match = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (match) {
                targetAuthId = match.id;
                break;
            }
            page++;
        }

        if (!targetAuthId) {
            return NextResponse.json({ success: false, error: "User account not fully registered in Auth system yet." }, { status: 400 });
        }

        // 3. Force reset the user's password using the Admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
            password: newPassword
        });

        if (updateError) {
            throw updateError;
        }

        // 4. Clear the OTP from the database for security
        await supabaseAdmin.from('users').update({ otp_code: null, otp_expiry: null }).eq('usn', formattedUSN);

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error: any) {
        console.error("RESET PASSWORD ERROR:", error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to reset password.' }, { status: 500 });
    }
}
