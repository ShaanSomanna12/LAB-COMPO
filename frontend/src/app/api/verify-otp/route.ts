import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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

        // ── FETCH OTP FROM REDIS ──
        const storedOtp = await redis.get(`otp:${formattedUSN}`);

        if (!storedOtp) {
            return NextResponse.json({ success: false, error: "OTP code has expired or was not requested." }, { status: 400 });
        }

        if (storedOtp !== cleanOtpCode) {
            return NextResponse.json({ success: false, error: "Invalid OTP code. Please check and try again." }, { status: 400 });
        }

        // Optional: Delete OTP after successful verification to prevent reuse
        await redis.del(`otp:${formattedUSN}`);

        return NextResponse.json({ success: true, message: 'OTP verified successfully.' });

    } catch (error: any) {
        console.error("VERIFY OTP ERROR:", error);
        return NextResponse.json({ success: false, error: error.message || 'OTP verification failed.' }, { status: 500 });
    }
}
