'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentAuth() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);

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
        // STEP 1: UPSERT (Create/Update)
        // =========================================================
        if (!isOtpStep) {
          const collegeDomain = "@vvce.ac.in";
          if (!email.toLowerCase().endsWith(collegeDomain)) {
            throw new Error(`Big yikes: You need a valid ${collegeDomain} email.`);
          }

          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

          console.log("Attempting upsert for USN:", formattedUSN);

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
            console.error("UPSERT ERROR:", dbError);
            throw new Error(`Database save failed: ${dbError.message}`);
          }

          console.log("Upsert successful. Sending email...");

          const emailRes = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otpCode })
          });

          if (!emailRes.ok) throw new Error("Email service failed to trigger.");

          setIsOtpStep(true);
          setMessage("W! 🚀 Check your college email for the 6-digit code.");
        }
        // =========================================================
        // STEP 2: VERIFY
        // =========================================================
        else {
          setMessage('Checking your vibe...');

          console.log("Fetching user for verification:", formattedUSN);

          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('otp_code, otp_expiry')
            .eq('usn', formattedUSN)
            .maybeSingle(); // Changed to maybeSingle to avoid 'No rows returned' crashes

          if (fetchError) {
            console.error("FETCH ERROR:", fetchError);
            throw new Error(`Lookup failed: ${fetchError.message}`);
          }

          if (!userData) throw new Error("No user found with that USN.");

          if (userData.otp_code !== otp) throw new Error("Nah, wrong code 💀");
          if (new Date(userData.otp_expiry) < new Date()) throw new Error("Code expired. ⏳");

          const { error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
          });

          if (authError) throw authError;

          await supabase.from('users').update({ otp_code: null, otp_expiry: null }).eq('usn', formattedUSN);

          setMessage("You're in! 🎉");
          window.location.href = '/student/dashboard';
        }

      } else {
        // =========================================================
        // LOGIN
        // =========================================================
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('usn', formattedUSN)
          .maybeSingle();

        if (fetchError) throw new Error(`Lookup failed: ${fetchError.message}`);
        if (!userData) throw new Error("USN not registered.");

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw new Error("Invalid credentials.");

        window.location.href = '/student/dashboard';
      }
    } catch (error: any) {
      console.error("FINAL CATCH:", error);
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
      </div>

      {/* Main Glassmorphism Card */}
      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-zinc-900/40 backdrop-blur-2xl py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 sm:rounded-3xl sm:px-10">
          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold backdrop-blur-md transition-all duration-300 border ${message.includes('L + Ratio') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {!isOtpStep && (
              <>
                {isRegistering && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">College Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="username@vvce.ac.in" className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white focus:ring-2 focus:ring-violet-500 transition-all sm:text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">USN</label>
                  <input type="text" required value={usn} onChange={(e) => setUsn(e.target.value)} placeholder="e.g., 4VV25CS000" className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white focus:ring-2 focus:ring-violet-500 transition-all sm:text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">{isRegistering ? 'Create Password' : 'Password'}</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="block w-full px-4 py-3.5 bg-black/50 border border-white/5 rounded-2xl text-white focus:ring-2 focus:ring-violet-500 transition-all sm:text-sm" />
                </div>
              </>
            )}

            {isRegistering && isOtpStep && (
              <div className="animate-in fade-in zoom-in duration-300">
                <label className="block text-sm font-bold text-zinc-300 text-center mb-2">Drop the 6-digit code here 👀</label>
                <input type="text" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" className="block w-full text-center tracking-[0.5em] font-mono font-black text-3xl px-4 py-4 bg-black/60 border border-violet-500/30 rounded-2xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 focus:outline-none transition-all" />
              </div>
            )}

            <div className="pt-2">
              <button type="submit" className="w-full flex justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-[0.98]">
                {isOtpStep ? 'Verify & Enter' : isRegistering ? "Let's Go 🚀" : 'Log In ⚡'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}