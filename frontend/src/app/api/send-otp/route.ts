import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const { email, otpCode } = await request.json();

        console.log(`Sending OTP to ${email} via Gmail`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"LabNexus Admin" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Your Lab Authentication Code',
            html: `<p>Your OTP is: <strong style="font-size: 24px;">${otpCode}</strong></p>`
        };

        const info = await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'Email sent successfully', info });

    } catch (error: any) {
        console.error("SERVER CRASH:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}