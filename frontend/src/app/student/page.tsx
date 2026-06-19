'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { siteConfig } from '@/config/site';

export default function StudentAuth() {
  // Navigation & Step Tracking States
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
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
            .select('email')
            .eq('usn', formattedUSN)
            .maybeSingle();

          if (fetchError || !userData) {
            throw new Error("Who are you? USN not found. 🕵️‍♂️");
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
          setMessage("W! 🚀 OTP sent to your registered email.");
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
            window.location.href = '/student/dashboard';
          } else {
            setIsForgotPassword(false);
            setIsOtpStep(false);
          }
        }
      } else if (isRegistering) {
        // =========================================================
        // REGISTRATION FLOW
        // =========================================================
        if (!isOtpStep) {
          const collegeDomain = "@vvce.ac.in";
          if (!email.toLowerCase().endsWith(collegeDomain)) {
            setMessage(`Big yikes: You need a valid ${collegeDomain} email to enter. 🛑`);
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
              name: 'Please enter your name',
              role_id: 1
            }, { onConflict: 'usn' });

          if (dbError) {
            throw new Error(`Supabase Error -> Code: ${dbError.code || 'None'}, Msg: ${dbError.message || 'Blank'}`);
          }

          const emailRes = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otpCode })
          });

          if (!emailRes.ok) {
            const errData = await emailRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to send the email via Gmail.");
          }

          setIsOtpStep(true);
          setMessage("OTP sent! Please check your college email for the 6-digit code.");
        } else {
          setMessage('Verifying OTP...');

          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle();

          if (fetchError || !userData) throw new Error("User not found. Refresh and try again.");
          if (userData.otp_code !== otp) throw new Error("Nah, wrong code 💀 Try again.");
          if (new Date(userData.otp_expiry) < new Date()) throw new Error("Bruh, that code expired. ⏳");

          const { error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
          });

          if (authError) throw authError;

          await supabase.from('users').update({ otp_code: null, otp_expiry: null }).eq('usn', formattedUSN);

          setMessage("You're in! 🎉 Booting up the dashboard...");
          window.location.href = '/student/dashboard';
        }
      } else {
        // =========================================================
        // STANDARD LOGIN FLOW
        // =========================================================
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('usn', formattedUSN)
          .maybeSingle();

        if (fetchError || !userData) {
          throw new Error("Who are you? USN not found. Go register first. 🕵️‍♂️");
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw new Error("Invalid credentials. Please try again.");

        setMessage("Verification successful. Entering dashboard...");
        window.location.href = '/student/dashboard';
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
      <div className="relative sm:mx-auto sm:w-full sm:max-w-md text-center z-10 flex flex-col items-center">
        <img src={siteConfig.logoUrl} alt={`${siteConfig.collegeName} Logo`} className="w-20 h-20 mb-4 object-contain" />
        <h2 className="text-5xl font-black tracking-tighter text-white">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">{siteConfig.appName}</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400 font-medium">
          {siteConfig.collegeName}
        </p>

        <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full animate-pulse ${isOtpStep ? 'bg-fuchsia-500' : isRegistering ? 'bg-violet-500' : isForgotPassword ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          {isOtpStep ? 'Verify Your Email' : isForgotPassword ? 'Reset Password' : isRegistering ? 'New Account Setup' : 'System Login'}
        </div>
      </div>

      {/* Main Glassmorphism Card */}
      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-zinc-900/40 backdrop-blur-2xl py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 sm:rounded-3xl sm:px-10">
          
          {/* Dynamic Message Box */}
          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold backdrop-blur-md transition-all duration-300 border ${message.includes('L + Ratio') || message.includes('yikes')
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
                          className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
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
                        className="block w-full px-4 py-3.5 pr-12 bg-black/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-violet-400 transition-colors"
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
                    Drop the 6-digit code here 👀
                  </label>
                  <p className="text-zinc-500 text-xs text-center mb-5">
                    Sent to your registered email.
                  </p>
                  <input
                    id="otp" name="otp" type="text" maxLength={6} required
                    value={otp} onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="block w-full text-center tracking-[0.5em] sm:tracking-[0.75em] font-mono font-black text-3xl px-4 py-4 bg-black/60 border border-violet-500/30 rounded-2xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all shadow-[0_0_15px_rgba(139,92,246,0.1)]"
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
                        className="block w-full px-4 py-3.5 pr-12 bg-black/50 border border-white/5 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-violet-400 transition-colors"
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
                className="w-full flex justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-violet-500 transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-[0.98]"
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
              }}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {isOtpStep || isForgotPassword
                ? "Wait, take me back to login."
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