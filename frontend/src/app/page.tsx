'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function StudentAuth() {
  const router = useRouter();

  // Navigation & Step Tracking States
  const [isRegistering, setIsRegistering] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Hold up, cooking... 🍳');

    const formattedUSN = usn.toUpperCase();

    try {
      if (isRegistering) {
        // =========================================================
        // REGISTRATION - STEP 1: GENERATE & SEND CUSTOM OTP
        // =========================================================
        if (!isOtpStep) {

          // 🚨 TEMPORARILY DISABLED FOR GMAIL TEST 🚨
          const collegeDomain = "@vvce.ac.in";
          if (!email.toLowerCase().endsWith(collegeDomain)) {
            setMessage(`Big yikes: You need a valid ${collegeDomain} email to enter. 🛑`);
            return;
          }
          // 1. Generate a random 6-digit code and an expiry time (10 mins from now)
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

          // 2. Save the code temporarily to our Supabase 'users' table
          const { error: dbError } = await supabase
            .from('users')
            .upsert({
              usn: formattedUSN,
              email: email,
              otp_code: otpCode,
              otp_expiry: expiryTime,
              name: `Student ${formattedUSN}`,
              role_id: 1
            }, { onConflict: 'usn' });

          if (dbError) {
            console.error("RAW DB ERROR:", dbError);
            throw new Error(`Supabase Error -> Code: ${dbError.code || 'None'}, Msg: ${dbError.message || 'Blank'}`);
          }

          // 3. Call the custom Resend API we built to actually send the email!
          const emailRes = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otpCode })
          });

          if (!emailRes.ok) throw new Error("Failed to send the email. Check your Resend API key!");

          // Advance to the OTP verification view
          setIsOtpStep(true);
          setMessage(`W! 🚀 OTP sent to your email!`);
        }
        // =========================================================
        // REGISTRATION - STEP 2: VERIFY CUSTOM OTP & CREATE AUTH
        // =========================================================
        else {
          setMessage('Checking your vibe... 👀');

          // 1. Fetch the code we saved in the database for this USN
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

          if (fetchError || !userData) throw new Error("User not found. Refresh and try again.");

          // 2. Check if the code is wrong or expired
          if (userData.otp_code !== otp) throw new Error("Wrong OTP 💀 Try again.");
          if (new Date(userData.otp_expiry) < new Date()) throw new Error("Bruh, that code expired. ⏳");

          // 3. If the code is perfect, officially register them in Supabase Auth!
          const { error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
          });

          if (authError) throw authError;

          // Clear the OTP from the database for security
          await supabase.from('users').update({ otp_code: null, otp_expiry: null }).eq('usn', formattedUSN);

          setMessage("You're in! 🎉 Booting up the dashboard...");
          setTimeout(() => {
            window.location.href = '/student/dashboard';
          }, 500);
        }

      } else {
        // =========================================================
        // STANDARD LOGIN FLOW
        // =========================================================
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email, role_id, name')
          .eq('usn', formattedUSN)
          .maybeSingle();

        if (fetchError || !userData) {
          throw new Error("Who are you? USN not found. Go register first. 🕵️‍♂️");
        }

        // --- ADMIN BYPASS LOGIC ---
        // Since Supabase Auth throws errors for seeded accounts, we verify Admins locally
        const ADMIN_PASSWORDS: Record<string, string> = {
          'ADMIN_EDL': 'Adminedlvvce@00123',
          'ADMIN_ECE': 'Adminecevvce@00123',
          'ADMIN_EEE': 'Admineeevvce@00123',
          'ADMIN_CIVIL': 'Admincivilvvce@00123',
          'ADMIN_MECH': 'Adminmechvvce@00123'
        };

        if (userData.role_id >= 3 && ADMIN_PASSWORDS[formattedUSN]) {
          if (password !== ADMIN_PASSWORDS[formattedUSN]) {
            throw new Error("Wrong password. Did you forget it already? 😭");
          }
          // Set bypass cookie so middleware lets them into /admin
          document.cookie = "admin_access=true; path=/; max-age=86400";


          setMessage(" Entering Lab Admin Portal..⚡");
          setTimeout(() => {
            window.location.href = '/admin';
          }, 500);
          return;
        }
        // --- END ADMIN BYPASS LOGIC ---

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw new Error("Wrong password. Did you forget it already? 😭");

        setMessage("Vibe check passed. Entering LabNexus... ⚡");
        setTimeout(() => {
          window.location.href = '/student/dashboard';
        }, 500);
      }
    } catch (error: any) {
      setMessage(`L + Ratio: ${error.message}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-violet-500/30 overflow-hidden">

      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full mix-blend-screen filter blur-[128px] opacity-50 animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full mix-blend-screen filter blur-[128px] opacity-50 pointer-events-none" />

      {/* Header Block */}
      <div className="relative sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <h2 className="text-5xl font-black tracking-tighter text-white">
          Lab<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">Nexus</span>
        </h2>
        <p className="mt-3 text-sm text-zinc-400 font-medium">
          Ditch the paperwork. Flex your components. 🛠️
        </p>

        <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full animate-pulse ${isOtpStep ? 'bg-fuchsia-500' : isRegistering ? 'bg-violet-500' : 'bg-emerald-500'}`} />
          {isOtpStep ? 'Verify Your Email' : isRegistering ? 'New Account Setup' : 'System Login'}
        </div>
      </div>

      {/* Main Glassmorphism Card */}
      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-zinc-900/40 backdrop-blur-2xl py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 sm:rounded-3xl sm:px-10">

          {/* Dynamic Message Box */}
          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold backdrop-blur-md transition-all duration-300 border ${message.includes('L + Ratio') || message.includes('yikes')
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : message.includes('W!') || message.includes('in!')
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-zinc-300'
              }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">

            {/* PHASE A: Collect Credentials */}
            {!isOtpStep && (
              <>
                {isRegistering && (
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                      College Email
                    </label>
                    <input
                      id="email" name="email" type="email" required
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="username@vvce.ac.in"
                      className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all sm:text-sm"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="usn" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    USN
                  </label>
                  <input
                    id="usn" name="usn" type="text" required
                    value={usn} onChange={(e) => setUsn(e.target.value)}
                    placeholder="e.g., 4VV25CS000"
                    className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all sm:text-sm uppercase"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    {isRegistering ? 'Create Password' : 'Password'}
                  </label>
                  <input
                    id="password" name="password" type="password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all sm:text-sm"
                  />
                </div>
              </>
            )}

            {/* PHASE B: Collect Verification OTP Token */}
            {isRegistering && isOtpStep && (
              <div className="animate-in fade-in zoom-in duration-300">
                <label htmlFor="otp" className="block text-sm font-bold text-zinc-300 text-center mb-2">
                  Drop the 6-digit code here 👀
                </label>
                <p className="text-zinc-500 text-xs text-center mb-5">
                  Sent to <span className="text-violet-400">{email}</span>
                </p>
                <input
                  id="otp" name="otp" type="text" maxLength={6} required
                  value={otp} onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  className="block w-full text-center tracking-[0.5em] sm:tracking-[0.75em] font-mono font-black text-3xl px-4 py-4 bg-black/60 border border-violet-500/30 rounded-2xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                />
              </div>
            )}

            {/* Glowing Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-violet-500 transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-[0.98]"
              >
                {isOtpStep ? 'Verify & Enter' : isRegistering ? "Let's Go 🚀" : 'Log In ⚡'}
              </button>
            </div>
          </form>

          {/* Toggle between Login and Register */}
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setIsOtpStep(false);
                setMessage('');
              }}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {isOtpStep
                ? "Wait, I used the wrong email. Take me back."
                : isRegistering
                  ? "Already got an account? Slide in here."
                  : "New here? Set up your account."}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}