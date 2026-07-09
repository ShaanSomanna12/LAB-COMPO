'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { siteConfig } from '@/config/site';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function StudentAuth() {
  // Navigation & Step Tracking States
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Loading...');

    const formattedUSN = usn.toUpperCase();

    try {
      if (isForgotPassword) {
        // =========================================================
        // FORGOT PASSWORD FLOW
        // =========================================================
        if (!isOtpStep) {
          // STEP 1: Verify USN and send OTP
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('email, role_id')
            .eq('usn', formattedUSN)
            .maybeSingle();

          if (fetchError || !userData) {
            throw new Error("USN not found. Please register first.");
          }

          if (userData.role_id >= 3) {
            throw new Error("Admins cannot reset passwords via OTP. Please contact Super Admin.");
          }

          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

          const { error: dbError } = await supabase
            .from('users')
            .update({ otp_code: otpCode, otp_expiry: expiryTime })
            .eq('usn', formattedUSN);

          if (dbError) throw new Error("Failed to generate OTP.");

          const emailRes = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userData.email, otpCode })
          });

          if (!emailRes.ok) {
            const errData = await emailRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to send the email via Gmail.");
          }

          setIsOtpStep(true);
          setMessage("OTP sent! Please check your email for the 6-digit code.");
        } else {
          // STEP 2: Verify OTP and Reset Password via API
          if (password.length < 6) {
            throw new Error("Password must be at least 6 characters.");
          }

          const resetRes = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usn: formattedUSN, otpCode: otp, newPassword: password })
          });

          if (!resetRes.ok) {
            const errData = await resetRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to reset password.");
          }

          setMessage("Password reset successful! 🎉 Logging you in...");

          // Log them in automatically
          const { data: userData } = await supabase.from('users').select('email').eq('usn', formattedUSN).single();
          if (userData) {
            await supabase.auth.signInWithPassword({ email: userData.email, password });
            setTimeout(() => {
              window.location.href = '/student/dashboard';
            }, 500);
          } else {
            setIsForgotPassword(false);
            setIsOtpStep(false);
          }
        }
      } else if (isRegistering) {
        // =========================================================
        // REGISTRATION - STEP 1: GENERATE & SEND CUSTOM OTP
        // =========================================================
        if (!isOtpStep) {
          const collegeDomain = "@vvce.ac.in";
          if (!email.toLowerCase().endsWith(collegeDomain)) {
            setMessage(`A valid ${collegeDomain} email is required to register.`);
            return;
          }

          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

          const { error: dbError } = await supabase
            .from('users')
            .upsert({
              usn: formattedUSN,
              email: email,
              otp_code: otpCode,
              otp_expiry: expiryTime,
              name: name,
              role_id: 1
            }, { onConflict: 'usn' });

          if (dbError) {
            console.error("RAW DB ERROR:", dbError);
            throw new Error(`Supabase Error -> Code: ${dbError.code || 'None'}, Msg: ${dbError.message || 'Blank'}`);
          }

          const emailRes = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, otpCode })
          });

          if (!emailRes.ok) {
            const errData = await emailRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to send the email via Gmail.");
          }

          setIsOtpStep(true);
          setMessage("OTP sent successfully to your email.");
        } else {
          // =========================================================
          // REGISTRATION - STEP 2: VERIFY CUSTOM OTP & CREATE AUTH
          // =========================================================
          setMessage('Verifying OTP...');

          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

          if (fetchError || !userData) throw new Error("User not found. Please refresh and try again.");
          if (userData.otp_code !== otp) throw new Error("Invalid OTP code. Please try again.");
          if (new Date(userData.otp_expiry) < new Date()) throw new Error("The OTP code has expired.");

          const { error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
          });

          if (authError) throw authError;

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

        // --- ADMIN & HOD BYPASS LOGIC ---
        const ADMIN_PASSWORDS: Record<string, string> = {
          'ADMIN_EDL': 'Adminedlvvce@00123',
          'ADMIN_ECE': 'Adminecevvce@00123',
          'ADMIN_EEE': 'Admineeevvce@00123',
          'ADMIN_CIVIL': 'Admincivilvvce@00123',
          'ADMIN_MECH': 'Adminmechvvce@00123'
        };

        const HOD_PASSWORDS: Record<string, string> = {
          'HODEDL_VVCE': 'HODedl@00055',
          'HODECE_VVCE': 'HODece@00055',
          'HODEEE_VVCE': 'HODeee@00055',
          'HODCIVIL_VVCE': 'HODcivil@00055',
          'HODMECH_VVCE': 'HODmech@00055'
        };

        if (ADMIN_PASSWORDS[formattedUSN]) {
          if (password !== ADMIN_PASSWORDS[formattedUSN]) {
            throw new Error("Incorrect password. Please try again.");
          }

          // Set department context for Admin dashboard
          const dept = formattedUSN.replace('ADMIN_', '');
          localStorage.setItem('admin_dept', dept);

          document.cookie = "admin_access=true; path=/; max-age=86400";

          setMessage(" Entering Lab Admin Portal..⚡");
          setTimeout(() => {
            window.location.href = '/admin';
          }, 500);
          return;
        }

        if (HOD_PASSWORDS[formattedUSN]) {
          if (password !== HOD_PASSWORDS[formattedUSN]) {
            throw new Error("Incorrect password. Please try again.");
          }

          // Set department context for HOD dashboard
          const dept = formattedUSN.replace('HOD', '').replace('_VVCE', '');
          localStorage.setItem('hod_dept', dept);

          document.cookie = "hod_access=true; path=/; max-age=86400";
          setMessage(" Entering HOD Workspace..⚡");
          setTimeout(() => {
            window.location.href = '/hod';
          }, 500);
          return;
        }
        // --- END ADMIN & HOD BYPASS LOGIC ---

        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email, role_id, name')
          .eq('usn', formattedUSN)
          .maybeSingle();

        if (fetchError || !userData) {
          throw new Error("USN not found. Please register first.");
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw new Error("Invalid credentials. Please try again.");

        setMessage("Verification successful. Entering dashboard...");
        setTimeout(() => {
          window.location.href = '/student/dashboard';
        }, 500);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#020617] flex flex-col justify-start md:justify-center pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-12 md:py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30 overflow-x-hidden">
      
      {/* 3D Particle Network Background */}
      <ParticleNetwork />

      {/* Header Block */}
      <div className="relative sm:mx-auto sm:w-full sm:max-w-md text-center z-10 flex flex-col items-center">
        <img src={siteConfig.logoUrl} alt={`${siteConfig.collegeName} Logo`} className="w-14 h-14 md:w-16 md:h-16 mb-4 object-contain" />
        <h2 className={`${spaceGrotesk.className} text-5xl font-black tracking-tighter text-white drop-shadow-2xl`}>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">{siteConfig.appName}</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400 font-bold uppercase tracking-widest">
          {siteConfig.collegeName}
        </p>

        <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-cyan-100 backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full animate-pulse ${isOtpStep ? 'bg-indigo-500' : isRegistering ? 'bg-cyan-500' : isForgotPassword ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          {isOtpStep ? 'Verify Your Email' : isForgotPassword ? 'Reset Password' : isRegistering ? 'New Account Setup' : 'System Login'}
        </div>
      </div>

      {/* Main Card */}
      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-black/40 backdrop-blur-2xl py-8 px-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] border border-cyan-500/20 sm:rounded-3xl sm:px-10">

          {/* Dynamic Message Box */}
          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold backdrop-blur-md transition-all duration-300 border ${message.includes('Error') || message.includes('yikes') || message.includes('Admins cannot')
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : message.includes('W!') || message.includes('in!') || message.includes('successful!')
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
                  <>
                    <div>
                      <label htmlFor="name" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                        Full Name
                      </label>
                      <input
                        id="name" name="name" type="text" required
                        value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Your Full Name"
                        className="block w-full px-4 py-3.5 bg-black/50 border border-white/10 rounded-2xl text-cyan-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                        College Email
                      </label>
                      <input
                        id="email" name="email" type="email" required
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="username@vvce.ac.in"
                        className="block w-full px-4 py-3.5 bg-black/50 border border-white/10 rounded-2xl text-cyan-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all sm:text-sm"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="usn" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    USN
                  </label>
                  <input
                    id="usn" name="usn" type="text" required
                    value={usn} onChange={(e) => setUsn(e.target.value)}
                    placeholder="e.g., 4VV25CS000"
                    className="block w-full px-4 py-3.5 bg-black/50 border border-white/10 rounded-2xl text-cyan-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all sm:text-sm uppercase"
                  />
                </div>

                {!isForgotPassword && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="password" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        {isRegistering ? 'Create Password' : 'Password'}
                      </label>
                      {!isRegistering && (
                        <button
                          type="button"
                          onClick={() => { setIsForgotPassword(true); setMessage(''); }}
                          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password" name="password" type={showPassword ? "text" : "password"} required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full px-4 py-3.5 pr-12 bg-black/50 border border-white/10 rounded-2xl text-cyan-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-cyan-400 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PHASE B: Collect Verification OTP Token */}
            {(isRegistering || isForgotPassword) && isOtpStep && (
              <div className="animate-in fade-in zoom-in duration-300 space-y-5">
                <div>
                  <label htmlFor="otp" className="block text-sm font-bold text-zinc-300 text-center mb-2">
                    Enter 6-Digit OTP Code
                  </label>
                  <p className="text-zinc-500 text-xs text-center mb-5">
                    Sent to your registered email. (Check your spam folder as well!)
                  </p>
                  <input
                    id="otp" name="otp" type="text" maxLength={6} required
                    value={otp} onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="block w-full text-center tracking-[0.5em] sm:tracking-[0.75em] font-mono font-black text-3xl px-4 py-4 bg-black/60 border border-cyan-500/30 rounded-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                  />
                </div>

                {isForgotPassword && (
                  <div>
                    <label htmlFor="new_password" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 text-center">
                      Create New Password
                    </label>
                    <div className="relative">
                      <input
                        id="new_password" name="new_password" type={showPassword ? "text" : "password"} required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full px-4 py-3.5 pr-12 bg-black/50 border border-white/10 rounded-2xl text-cyan-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-cyan-400 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Glowing Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-cyan-500 transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-[0.98]"
              >
                {isOtpStep ? (isForgotPassword ? 'Reset Password' : 'Verify & Enter') : isForgotPassword ? 'Send Reset OTP' : isRegistering ? "Let's Go 🚀" : 'Log In ⚡'}
              </button>
            </div>
          </form>

          {/* Toggle between Login and Register */}
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <button
              onClick={() => {
                setIsRegistering(isForgotPassword ? false : !isRegistering);
                setIsForgotPassword(false);
                setIsOtpStep(false);
                setMessage('');
                setPassword('');
                setOtp('');
                setName('');
              }}
              className="text-sm font-medium text-cyan-200/50 hover:text-cyan-200 transition-colors duration-200"
            >
              {isOtpStep || isForgotPassword
                ? "Return to Login."
                : isRegistering
                  ? "Already have an account? Log in."
                  : "New user? Create an account."}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}