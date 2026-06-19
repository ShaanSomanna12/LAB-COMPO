'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { siteConfig } from '@/config/site';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function StudentDashboard() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    const fetchStudentDept = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('department').eq('email', user.email).single();
        if (data?.department) {
           const res = await fetch(`/api/notices?department=${data.department}`);
           const noticesData = await res.json();
           if (Array.isArray(noticesData)) setNotices(noticesData);
        }
      }
    };
    fetchStudentDept();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-center p-4 pt-16 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      
      {/* Full Width Top Announcement Banner */}
      <div className="absolute top-0 left-0 w-full bg-cyan-950/40 border-b border-cyan-500/20 py-2.5 px-4 backdrop-blur-md z-50 text-center flex items-center justify-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
        <p className="text-xs md:text-sm font-bold text-cyan-50 uppercase tracking-widest">
          Welcome to {siteConfig.collegeName} Lab Portal
        </p>
      </div>

      {/* Base Deep Radial Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_#1e1b4b_0%,_#020617_100%)]"></div>

      {/* 3D Particle Network Background */}
      <ParticleNetwork />

      <div className="w-full max-w-5xl relative z-10 px-4 py-8 min-h-screen flex flex-col">

        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center mb-16 md:mb-24 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/30 flex items-center justify-center p-1">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className={`${spaceGrotesk.className} text-2xl font-bold tracking-widest text-white`}>{siteConfig.appName}</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => router.push('/student/reservations')}
              className="px-5 py-2.5 bg-zinc-900/50 hover:bg-emerald-500/10 border border-zinc-800 hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-400 rounded-full transition-all font-mono text-sm uppercase tracking-wider"
            >
              Reservations
            </button>
            <button
              onClick={() => router.push('/student/profile')}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900/50 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 text-zinc-300 hover:text-rose-400 rounded-full transition-all font-mono text-sm uppercase tracking-wider"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
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

          {/* Mobile Navigation Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className="absolute top-14 right-0 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 md:hidden animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex flex-col py-2">
                <button
                  onClick={() => router.push('/student/reservations')}
                  className="w-full text-left px-5 py-3 hover:bg-white/5 text-zinc-300 hover:text-emerald-400 transition-colors font-mono text-sm uppercase tracking-wider border-b border-white/5"
                >
                  Reservations
                </button>
                <button
                  onClick={() => router.push('/student/profile')}
                  className="w-full text-left flex items-center gap-2 px-5 py-3 hover:bg-white/5 text-zinc-300 hover:text-rose-400 transition-colors font-mono text-sm uppercase tracking-wider border-b border-white/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.push('/');
                  }}
                  className="w-full text-left px-5 py-3 hover:bg-white/5 text-red-400 hover:text-red-300 transition-colors font-mono text-sm uppercase tracking-wider"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

          {/* Active Notices Banner */}
          {notices.length > 0 && (
            <div className="mb-12 space-y-3 z-20 relative animate-in fade-in slide-in-from-top-8 duration-700">
              {notices.map(notice => (
                <div key={notice.id} className={`p-4 rounded-2xl border flex items-start gap-4 shadow-2xl backdrop-blur-md ${notice.type === 'alert' ? 'bg-red-500/10 border-red-500/30 text-red-100' : notice.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100'}`}>
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${notice.type === 'alert' ? 'bg-red-500/20 text-red-400' : notice.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-wide uppercase mb-1 flex items-center gap-2">
                      {notice.type === 'alert' ? 'Critical Alert' : notice.type === 'warning' ? 'Lab Warning' : 'Lab Announcement'}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/30">{notice.admin_dept} Admin</span>
                    </h4>
                    <p className="text-sm font-medium opacity-90 leading-relaxed">{notice.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Centered Hero Section */}
        <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className={`${spaceGrotesk.className} text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl mb-6`}>
            Equip. <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Reserve.</span> Build.
          </h1>
          <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Access the physical tools and specialized environments you need for your next project.
          </p>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">

          {/* Hardware Checkout Card */}
          <div
            onClick={() => router.push('/student/checkout')}
            className="group relative bg-black/40 backdrop-blur-2xl border border-cyan-500/20 hover:border-cyan-500/50 rounded-3xl p-10 cursor-pointer transition-all duration-500 hover:-translate-y-2 shadow-[0_0_50px_rgba(6,182,212,0.15)] hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.4)] flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-700"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-8 text-cyan-400 group-hover:scale-110 transition-transform duration-500 border border-cyan-500/20">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 className={`${spaceGrotesk.className} text-3xl font-bold text-white mb-4 group-hover:text-cyan-100 transition-colors`}>Hardware Dashboard</h2>
              <p className="text-zinc-400 font-medium text-base leading-relaxed mb-8 px-4 group-hover:text-zinc-300 transition-colors">
                Request microcontrollers, sensors, oscilloscopes, and physical components.
              </p>
              <div className="inline-flex items-center text-cyan-400 font-bold uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
                Proceed
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>

          {/* Lab Workspace Access Card - TEMPORARILY DISABLED 
          <div
            onClick={() => router.push('/student/lab-access')}
            className="group relative bg-black/40 backdrop-blur-2xl border border-indigo-500/20 hover:border-indigo-500/50 rounded-3xl p-10 cursor-pointer transition-all duration-500 hover:-translate-y-2 shadow-[0_0_50px_rgba(99,102,241,0.15)] hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)] flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-700"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto bg-indigo-500/10 rounded-full flex items-center justify-center mb-8 text-indigo-400 group-hover:scale-110 transition-transform duration-500 border border-indigo-500/20">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className={`${spaceGrotesk.className} text-3xl font-bold text-white mb-4 group-hover:text-indigo-100 transition-colors`}>Workspace Access</h2>
              <p className="text-zinc-400 font-medium text-base leading-relaxed mb-8 px-4 group-hover:text-zinc-300 transition-colors">
                Reserve time slots in specialized laboratories for hands-on project work.
              </p>
              <div className="inline-flex items-center text-indigo-400 font-bold uppercase tracking-wider group-hover:text-indigo-300 transition-colors">
                Reserve Space
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>
          */}

        </div>
      </div>
    </div>
  );
}
