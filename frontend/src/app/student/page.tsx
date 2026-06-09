'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentAuth() {
  // State to toggle between Login and Registration views
  const [isRegistering, setIsRegistering] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Processing...');

    const formattedUSN = usn.toUpperCase();

    try {
      if (isRegistering) {
        // ==========================================
        // 1. REGISTRATION FLOW
        // ==========================================
        const collegeDomain = "@vvce.ac.in";
        if (!email.toLowerCase().endsWith(collegeDomain)) {
          setMessage(`Error: You must use a valid ${collegeDomain} email address.`);
          return;
        }

        // Sign up with Supabase Auth (USN acts as the initial password)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: formattedUSN,
        });

        if (authError) throw authError;

        // Save the mapping to your existing 'users' table
        if (authData.user) {
          const { error: dbError } = await supabase
            .from('users')
            .insert([
              {
                user_id: authData.user.id,
                usn: formattedUSN,
                email: email,
                name: `Student ${formattedUSN}`,
                role_id: 1
              },
            ]);

          if (dbError) throw dbError;

          setMessage("Registration successful! Please log in using your USN.");
          setIsRegistering(false);
          setPassword('');
        }

      } else {
        // ==========================================
        // 2. LOGIN FLOW
        // ==========================================

        // Find the email linked to the provided USN
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('usn', formattedUSN)
          .single();

        if (fetchError || !userData) {
          throw new Error("USN not recognized. Have you registered yet?");
        }

        // Log in using that email and the provided password
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: password,
        });

        if (loginError) throw loginError;

        setMessage("Login successful! Accessing lab inventory...");
        window.location.href = '/student/dashboard';
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 select-none">

      {/* Modernized Header Section */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Lab<span className="text-indigo-500">Nexus</span>
        </h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed font-medium">
          The unified interface for smart hardware borrowing and secure lab workspace access.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          {isRegistering ? 'Account Provisioning Mode' : 'Gateway Verification Active'}
        </div>
      </div>

      {/* Form Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 shadow-2xl border border-zinc-800/80 sm:rounded-2xl sm:px-10 backdrop-blur-sm">

          {/* Custom Status Notification Panel */}
          {message && (
            <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium transition-all duration-350 ${message.startsWith('Error')
                ? 'bg-red-950/40 border border-red-900/50 text-red-400'
                : message.startsWith('Processing')
                  ? 'bg-zinc-800/60 border border-zinc-700/50 text-zinc-300'
                  : 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-400'
              }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">

            {/* Render Email input dynamically during Registration phase */}
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
                    placeholder="yourname@vvce.ac.in"
                    className="appearance-none block w-full px-3.5 py-2.5 border border-zinc-800 rounded-xl shadow-sm placeholder-zinc-600 bg-zinc-950/80 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* USN Input */}
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

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {isRegistering ? 'Create Master Password' : 'Security Token / Password'}
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

            {/* Action Execution Button */}
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-indigo-500 transition-all duration-200"
              >
                {isRegistering ? 'Initialize Registration' : 'Authenticate Credentials'}
              </button>
            </div>

          </form>

          {/* Tab Sub-Toggle Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setMessage('');
              }}
              className="text-xs font-medium text-zinc-500 hover:text-indigo-400 transition-colors duration-200"
            >
              {isRegistering
                ? "Already registered in system hardware? Sign In"
                : "New terminal assignment? Request Registration ID"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}