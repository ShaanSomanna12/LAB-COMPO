import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { email, otpCode } = await request.json();

        // 🚨 DEVELOPMENT BYPASS: Always log the OTP to the terminal so we don't get blocked by rate limits!
        console.log('\n=============================================');
        console.log(`🔐 OTP CODE FOR ${email}: ${otpCode}`);
        console.log('=============================================\n');

        // FORCE BYPASS: Resend is completely disabled to avoid the "Limit Exceeded" error.
        return NextResponse.json({ success: true, message: "Email bypassed completely, check console!" });

    } catch (error: any) {
        console.error("SERVER CRASH:", error);
        return NextResponse.json({ success: true, message: "Email bypassed due to server error, check console!" });
    }
}