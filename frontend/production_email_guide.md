# Production Email & Domain Setup Guide

This guide explains how to transition from a basic Nodemailer/Gmail setup to a professional, production-ready email architecture using your Vercel Pro `.app` domain. Following these steps guarantees your automated emails (OTPs, No Dues Certificates) will land in the student's **Inbox**, not Spam.

## 1. The Strategy
*   **Domain:** Claim your free `.app` domain (e.g., `yourcollege.app`) through Vercel Pro.
*   **DNS Manager:** Vercel automatically manages the DNS for this domain.
*   **Email Provider:** We will use **Resend** (which is already in your `package.json`). It is the industry standard for Next.js applications and handles all the complex email authentication for you.

---

## 2. Step-by-Step Implementation

### Step 1: Claim your Vercel Domain
1. Upgrade to Vercel Pro.
2. Go to **Settings > Domains** in your Vercel dashboard.
3. Search for your desired `.app` domain (e.g., `inventory.app`) and claim it. Vercel will automatically configure it to point to your Next.js application.

### Step 2: Set up Resend (The Email Provider)
1. Go to [resend.com](https://resend.com/) and create a free account (the free tier allows 3,000 emails/month, which is a great start).
2. Go to **Domains** in the Resend dashboard and click **Add Domain**.
3. Enter your new domain (e.g., `yourcollege.app`).
4. Resend will generate a list of **DNS Records** (SPF, DKIM, and DMARC). It will look like a table of `TXT`, `MX`, and `CNAME` records.

### Step 3: Make it "Legal" (Configure DNS in Vercel)
This is the magic step that stops your emails from going to spam.
1. Go back to your **Vercel Dashboard**.
2. Navigate to your project -> **Settings -> Domains**.
3. Scroll down to **DNS Records**.
4. Copy every record that Resend gave you in Step 2 and paste it into Vercel. 
5. *Wait a few minutes.* Go back to Resend and click "Verify". Once verified, you are fully authorized to send emails as `admin@yourcollege.app` and email providers (like Gmail/Outlook) will trust you 100%.

---

## 3. Updating your Next.js Code

Since you already have `resend` in your `package.json`, you don't even need Nodemailer anymore! Resend has a much cleaner Next.js SDK.

### Before: The Old Nodemailer Way (Triggers Spam)
```typescript
import nodemailer from 'nodemailer';

// Uses a personal Gmail account - Bad for production!
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mycollegeproject@gmail.com',
    pass: 'password123'
  }
});

await transporter.sendMail({
  from: 'mycollegeproject@gmail.com',
  to: studentEmail,
  subject: 'Your OTP',
  text: `Your OTP is 1234`
});
```

### After: The Professional Resend Way (Inbox Guaranteed)
First, get an API key from your Resend dashboard and add it to your Vercel Environment Variables as `RESEND_API_KEY`.

Then, update your API routes (e.g., `src/app/api/verify-otp/route.ts`):

```typescript
import { Resend } from 'resend';

// Initialize Resend with your secure API key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  // ... your existing logic ...

  try {
    const { data, error } = await resend.emails.send({
      from: 'Admin <admin@yourcollege.app>', // Look how professional this is!
      to: [studentEmail],
      subject: 'Your Login OTP',
      html: `<p>Your secure OTP is <strong>1234</strong></p>`
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
```

## Summary
By taking these steps, you decouple your hosting (Vercel) from your email sending (Resend), linked securely via DNS records. This is exactly how top tech companies configure their infrastructure.
