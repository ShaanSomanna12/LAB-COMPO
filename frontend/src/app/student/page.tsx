'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentAuth() {
  // Navigation & Step Tracking States
  const [isRegistering, setIsRegistering] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false); // Tracks if we are waiting for the 6-digit OTP

  // Form Fields
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Processing request...');

    const formattedUSN = usn.toUpperCase();

    try {
      if (isRegistering) {
        // =========================================================
        // REGISTRATION FLOW - STEP 1: INITIALIZE & SEND OTP
        // =========================================================
        if (!isOtpStep) {
          const collegeDomain = "@vvce.ac.in";
          if (!email.toLowerCase().endsWith(collegeDomain)) {
            setMessage(`Error: You must use a valid official ${collegeDomain} email address.`);
            return;
          }

          // Trigger Supabase sign-up (sends verification token automatically if enabled)
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password, // Student sets their master login password here
          });

          if (authError) throw authError;

          // Advance to the OTP verification input view
          setIsOtpStep(true);
          setMessage("Success: A 6-digit verification token has been dispatched to your institutional email.");
        }
        // =========================================================
        // REGISTRATION FLOW - STEP 2: VERIFY OTP & MAP PROFILE
        // =========================================================
        else {
          setMessage('Validating credentials token...');

          // Verify the OTP code provided by the student
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            email: email,
            token: otp,
            type: 'signup'
          });

          if (verifyError) throw verifyError;

          // If verification passes, insert student profile mapping into the 'users' table
          if (verifyData.user) {
            const { error: dbError } = await supabase
              .from('users')
              .insert([
                {
                  user_id: verifyData.user.id,
                  usn: formattedUSN,
                  email: email,
                  name: `Student ${formattedUSN}`,
                  role_id: 1 // Default Student clearance level
                },
              ]);

            if (dbError) throw dbError;

            setMessage("Verification complete! System access granted.");
            window.location.href = '/student/dashboard';
          }
        }

      } else {
        // =========================================================
        // STANDARD LOGIN FLOW (Password Access)
        // =========================================================
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('usn', formattedUSN)
          .single();

        if (fetchError || !userData) {
          throw new Error("USN registry sequence not recognized. Please register first.");
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw loginError;

        setMessage("Authentication approved. Connecting to terminal workspace...");
        window.location.href = '/student/dashboard';
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 select-none">

      {/* LabNexus Dynamic Branding Block */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Lab<span className="text-indigo-500">Nexus</span>
        </h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed font-medium">
          Smart component checkout. Secure workspace access.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          {isOtpStep ? 'Security Token Challenge' : isRegistering ? 'Identity Provisioning Active' : 'Secure Vault Gateway Entry'}
        </div>
      </div>

      {/* Main Terminal UI Window */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 shadow-2xl border border-zinc-800/80 sm:rounded-2xl sm:px-10 backdrop-blur-sm">

          {/* Diagnostic Display Message Area */}
          {message && (
            <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${message.startsWith('Error')
              ? 'bg-red-950/40 border border-red-900/50 text-red-400'
              : message.startsWith('Success') || message.includes('complete')
                ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-400'
                : 'bg-zinc-800/60 border border-zinc-700/50 text-zinc-300'
              }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">

            {/* PHASE A: Collect Core Credentials */}
            {!isOtpStep && (
              <>
                {isRegistering && (
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Official Institution Email
                    </label>
                    <div className="mt-1.5">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="username@vvce.ac.in"
                        className="appearance-none block w-full px-3.5 py-2.5 border border-zinc-800 rounded-xl shadow-sm placeholder-zinc-600 bg-zinc-950/80 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all duration-200"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="usn" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    University Seat Number (USN)
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="usn"
                      name="usn"
                      type="text"
                      required
                      value={usn}
                      onChange={(e) => setUsn(e.target.value)}
                      placeholder="e.g., 4VV23CS000"
                      className="appearance-none block w-full px-3.5 py-2.5 border border-zinc-800 rounded-xl shadow-sm placeholder-zinc-600 bg-zinc-950/80 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {isRegistering ? 'Create Account Access Password' : 'Security Token / Password'}
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="appearance-none block w-full px-3.5 py-2.5 border border-zinc-800 rounded-xl shadow-sm placeholder-zinc-600 bg-zinc-950/80 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all duration-200"
                    />
                  </div>
                </div>
              </>
            )}

            {/* PHASE B: Collect Verification OTP Token */}
            {isRegistering && isOtpStep && (
              <div className="animate-fade-in">
                <label htmlFor="otp" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center mb-1">
                  Enter 6-Digit Email Code
                </label>
                <p className="text-zinc-500 text-xs text-center mb-3">
                  Sent directly to tracking terminal identifier: <span className="text-zinc-300 font-mono">{email}</span>
                </p>
                <div className="mt-1.5">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="appearance-none block w-full text-center tracking-[0.75em] font-mono font-bold text-xl px-3.5 py-3 border border-zinc-800 rounded-xl placeholder-zinc-700 bg-zinc-950 text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* Core Interaction Action Trigger Button */}
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-indigo-500 transition-all duration-200"
              >
                {isOtpStep ? 'Confirm Clearance Code' : isRegistering ? 'Dispatched Access Token' : 'Authenticate Credentials'}
              </button>
            </div>

          </form>

          {/* Subsystem Redirection / Switch Controller */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setIsOtpStep(false);
                setMessage('');
              }}
              className="text-xs font-medium text-zinc-500 hover:text-indigo-400 transition-colors duration-200"
            >
              {isOtpStep
                ? "Wrong email address configured? Restart Terminal Registry"
                : isRegistering
                  ? "Already registered in LabNexus hardware matrix? Sign In"
                  : "New terminal assignment? Request Verification ID"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}