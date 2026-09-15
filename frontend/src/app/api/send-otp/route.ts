import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { usn, type, email, name, otpCode: providedOtp } = body;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ success: false, error: "Server missing Supabase service configuration." }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const formattedUSN = usn ? usn.trim().toUpperCase() : '';
        let targetEmail = email ? email.trim() : '';
        const otpCode = providedOtp || Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        if (type === 'forgot_password') {
            if (!formattedUSN) {
                return NextResponse.json({ success: false, error: "USN is required." }, { status: 400 });
            }

            // 1. Fetch user by USN using Service Role (bypasses RLS)
            const { data: userData, error: fetchError } = await supabaseAdmin
                .from('users')
                .select('email, role_id')
                .eq('usn', formattedUSN)
                .maybeSingle();

            if (fetchError || !userData) {
                return NextResponse.json({ success: false, error: "USN not found. Please register first." }, { status: 400 });
            }

            if (userData.role_id >= 3) {
                return NextResponse.json({ success: false, error: "Admins cannot reset passwords via OTP. Contact Super Admin." }, { status: 400 });
            }

            targetEmail = userData.email;

            // 2. Save OTP to DB using Service Role
            const { error: dbError } = await supabaseAdmin
                .from('users')
                .update({ otp_code: otpCode, otp_expiry: expiryTime })
                .eq('usn', formattedUSN);

            if (dbError) {
                console.error("DB OTP Update Error:", dbError);
                return NextResponse.json({ success: false, error: "Failed to store OTP code in database." }, { status: 500 });
            }

        } else if (type === 'register') {
            if (!formattedUSN || !targetEmail) {
                return NextResponse.json({ success: false, error: "USN and Email are required for registration." }, { status: 400 });
            }

            const collegeDomain = "@vvce.ac.in";
            if (!targetEmail.toLowerCase().endsWith(collegeDomain)) {
                return NextResponse.json({ success: false, error: `A valid ${collegeDomain} email is required to register.` }, { status: 400 });
            }

            // Upsert user into public.users using Service Role
            const { error: dbError } = await supabaseAdmin
                .from('users')
                .upsert({
                    usn: formattedUSN,
                    email: targetEmail,
                    otp_code: otpCode,
                    otp_expiry: expiryTime,
                    name: name || '',
                    role_id: 1
                }, { onConflict: 'usn' });

            if (dbError) {
                console.error("DB OTP Upsert Error:", dbError);
                return NextResponse.json({ success: false, error: `Database error: ${dbError.message}` }, { status: 500 });
            }
        } else if (providedOtp && targetEmail) {
            // Legacy/fallback mode: if usn provided, store it
            if (formattedUSN) {
                await supabaseAdmin
                    .from('users')
                    .update({ otp_code: otpCode, otp_expiry: expiryTime })
                    .eq('usn', formattedUSN);
            }
        } else {
            return NextResponse.json({ success: false, error: "Invalid parameters provided for OTP generation." }, { status: 400 });
        }

        if (!targetEmail) {
            return NextResponse.json({ success: false, error: "No recipient email address found." }, { status: 400 });
        }

        // Send Email via Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"LabNexus Admin" <${process.env.GMAIL_USER}>`,
            to: targetEmail,
            subject: 'Your Lab Authentication Code',
            html: `<p>Your OTP is: <strong style="font-size: 24px;">${otpCode}</strong></p>`
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'OTP sent successfully to email.' });

    } catch (error: any) {
        console.error("SEND OTP SERVER ERROR:", error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}