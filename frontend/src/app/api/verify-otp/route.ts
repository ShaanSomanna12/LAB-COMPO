import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { usn, otpCode } = await request.json();

        if (!usn || !otpCode) {
            return NextResponse.json({ success: false, error: "Missing required fields: usn and otpCode." }, { status: 400 });
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceRoleKey || !supabaseUrl) {
            return NextResponse.json({ success: false, error: "Server missing Supabase service configuration." }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const formattedUSN = usn.trim().toUpperCase();
        const cleanOtpCode = otpCode.toString().trim();

        const { data: userData, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

        if (fetchError || !userData) {
            return NextResponse.json({ success: false, error: "USN not found. Please try again." }, { status: 400 });
        }

        if (!userData.otp_code) {
            return NextResponse.json({ success: false, error: "No OTP was requested for this account." }, { status: 400 });
        }

        if (userData.otp_code.toString().trim() !== cleanOtpCode) {
            return NextResponse.json({ success: false, error: "Invalid OTP code. Please check your email and try again." }, { status: 400 });
        }

        if (!userData.otp_expiry || new Date(userData.otp_expiry) < new Date()) {
            return NextResponse.json({ success: false, error: "OTP code has expired. Please request a new code." }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'OTP verified successfully.' });

    } catch (error: any) {
        console.error("VERIFY OTP ERROR:", error);
        return NextResponse.json({ success: false, error: error.message || 'OTP verification failed.' }, { status: 500 });
    }
}
