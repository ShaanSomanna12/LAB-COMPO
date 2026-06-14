import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { email, otpCode } = await request.json();

        console.log(`Sending OTP to ${email}`);

        const { data, error } = await resend.emails.send({
            from: 'LabNexus <onboarding@resend.dev>', // Update this to your verified domain later if you have one
            to: email,
            subject: 'Your Lab Authentication Code',
            html: `<p>Your OTP is: <strong>${otpCode}</strong></p>`
        });

        if (error) {
            console.error("Resend Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error("SERVER CRASH:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}