'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Optionally fetch user profile to display their name
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch user from public users table to get the name
        const { data } = await supabase
          .from('users')
          .select('name')
          .eq('email', session.user.email)
          .single();
        if (data?.name) {
          setUserName(data.name.split(' ')[0]); // Just first name if possible
        } else {
          setUserName('Student');
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>
      
      <div className="w-full max-w-4xl relative z-10 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
            WELCOME TO LABNEXUS{userName ? `, ${userName.toUpperCase()}` : ''}
          </h1>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
            Select your required operation below
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          
          {/* Card 1: Hardware Checkout */}
          <div 
            onClick={() => router.push('/student/checkout')}
            className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 hover:border-cyan-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] overflow-hidden"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500 z-0"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 transition-transform duration-300 border border-cyan-500/20">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Hardware Components</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-grow">
                Request and check out microcontrollers, sensors, oscilloscopes, and other physical hardware components for your projects.
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-bold uppercase tracking-wider group-hover:translate-x-2 transition-transform duration-300">
                Proceed to Checkout
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Lab Workspace Access */}
          <div 
            onClick={() => router.push('/student/lab-access')}
            className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 hover:border-indigo-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] overflow-hidden"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500 z-0"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform duration-300 border border-indigo-500/20">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Lab Workspace Access</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-grow">
                Reserve time slots in specialized laboratories (e.g., EDL, IoT, AI Labs) for hands-on project work and equipment use.
              </p>
              <div className="flex items-center text-indigo-400 text-sm font-bold uppercase tracking-wider group-hover:translate-x-2 transition-transform duration-300">
                Request Access
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-12 text-center">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="text-zinc-500 hover:text-red-400 text-sm font-medium transition-colors duration-200 uppercase tracking-widest border border-transparent hover:border-red-500/30 px-4 py-2 rounded-lg"
          >
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}
