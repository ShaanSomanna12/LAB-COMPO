import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// This grabs your secret key from the .env.local file
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        // We expect the frontend to send us the student's email and the generated code
        const { email, otpCode } = await request.json();

        // Tell Resend to send the email
        const data = await resend.emails.send({
            from: 'LabNexus <onboarding@resend.dev>', // Resend gives you this free testing address
            to: [email],
            subject: 'Your LabNexus Verification Code',
            html: `
        <h2>LabNexus Security</h2>
        <p>Your verification code is: <strong>${otpCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
      `,
        });

        return NextResponse.json({ success: true, message: "Email sent!" });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }
}