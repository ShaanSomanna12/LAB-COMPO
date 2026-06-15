'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function StudentDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      {/* Base Deep Radial Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_#1e1b4b_0%,_#020617_100%)]"></div>

      {/* 3D Particle Network Background */}
      <ParticleNetwork />

      <div className="w-full max-w-5xl relative z-10 px-4 py-8 min-h-screen flex flex-col">

        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center mb-16 md:mb-24">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/30 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
            </div>
            <span className={`${spaceGrotesk.className} text-2xl font-bold tracking-widest text-white`}>LAB<span className="text-cyan-400">NEXUS</span></span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/student/reservations')}
              className="px-5 py-2.5 bg-zinc-900/50 hover:bg-emerald-500/10 border border-zinc-800 hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-400 rounded-full transition-all font-mono text-sm uppercase tracking-wider"
            >
              Reservations
            </button>
            <button
              onClick={() => router.push('/student/profile')}
              className="px-5 py-2.5 bg-zinc-900/50 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 text-zinc-300 hover:text-rose-400 rounded-full transition-all font-mono text-sm uppercase tracking-wider"
            >
              Profile
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="px-5 py-2.5 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-red-300 rounded-full transition-all font-mono text-sm uppercase tracking-wider"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Centered Hero Section */}
        <div className="text-center space-y-6 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className={`${spaceGrotesk.className} text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl`}>
            Equip. <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Reserve.</span> Build.
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Access the physical tools and specialized environments you need for your next project.
          </p>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">

          {/* Hardware Checkout Card */}
          <div
            onClick={() => router.push('/student/checkout')}
            className="group relative bg-zinc-950/60 backdrop-blur-2xl border border-zinc-800 hover:border-cyan-500/50 rounded-3xl p-10 cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.3)] flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-500"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-8 text-cyan-400 group-hover:scale-110 transition-transform duration-500 border border-cyan-500/20">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 className={`${spaceGrotesk.className} text-3xl font-bold text-white mb-4 group-hover:text-cyan-100 transition-colors`}>Hardware Checkout</h2>
              <p className="text-zinc-400 text-base leading-relaxed mb-8 px-4">
                Request microcontrollers, sensors, oscilloscopes, and physical components.
              </p>
              <div className="inline-flex items-center text-cyan-400 font-bold uppercase tracking-wider group-hover:text-cyan-300">
                Proceed
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>

          {/* Lab Workspace Access Card */}
          <div
            onClick={() => router.push('/student/lab-access')}
            className="group relative bg-zinc-950/60 backdrop-blur-2xl border border-zinc-800 hover:border-indigo-500/50 rounded-3xl p-10 cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.3)] flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-500"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto bg-indigo-500/10 rounded-full flex items-center justify-center mb-8 text-indigo-400 group-hover:scale-110 transition-transform duration-500 border border-indigo-500/20">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className={`${spaceGrotesk.className} text-3xl font-bold text-white mb-4 group-hover:text-indigo-100 transition-colors`}>Workspace Access</h2>
              <p className="text-zinc-400 text-base leading-relaxed mb-8 px-4">
                Reserve time slots in specialized laboratories for hands-on project work.
              </p>
              <div className="inline-flex items-center text-indigo-400 font-bold uppercase tracking-wider group-hover:text-indigo-300">
                Reserve Space
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
