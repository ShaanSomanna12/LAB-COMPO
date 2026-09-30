'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { siteConfig } from '@/config/site';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, User, Microchip, Clock, ChevronRight,
  QrCode, Eye, FileCheck, X, Home, AlertTriangle, Zap
} from 'lucide-react';
import QRCode from 'react-qr-code';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

const NAV_ITEMS = [
  { label: 'Home', icon: Home, path: '/student/dashboard' },
  { label: 'Hardware', icon: Microchip, path: '/student/checkout' },
  { label: 'My Reservations', icon: Clock, path: '/student/reservations' },
  { label: 'No Dues', icon: FileCheck, path: '/student/no-dues' },
  { label: 'Profile', icon: User, path: '/student/profile' },
];

const QUICK_ACTIONS = [
  { id: 'hardware', label: 'Hardware\nRequest', icon: Microchip, path: '/student/checkout', gradient: 'from-cyan-500/10 to-transparent', border: 'border-white/5 hover:border-cyan-500/30', glow: 'hover:shadow-[0_8px_32px_-8px_rgba(6,182,212,0.25)]', iconColor: 'text-cyan-400', iconBg: 'bg-cyan-500/10', badge: null, desc: 'Browse and reserve lab components' },
  { id: 'reservations', label: 'My\nReservations', icon: Clock, path: '/student/reservations', gradient: 'from-violet-500/10 to-transparent', border: 'border-white/5 hover:border-violet-500/30', glow: 'hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.25)]', iconColor: 'text-violet-400', iconBg: 'bg-violet-500/10', badge: 'pending', desc: 'Track your active and pending orders' },
  { id: 'no-dues', label: 'No Dues\nCertificate', icon: FileCheck, path: '/student/no-dues', gradient: 'from-emerald-500/10 to-transparent', border: 'border-white/5 hover:border-emerald-500/30', glow: 'hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.25)]', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10', badge: null, desc: 'Download your lab clearance certificate' },
  { id: 'profile', label: 'Student\nProfile', icon: User, path: '/student/profile', gradient: 'from-indigo-500/10 to-transparent', border: 'border-white/5 hover:border-indigo-500/30', glow: 'hover:shadow-[0_8px_32px_-8px_rgba(99,102,241,0.25)]', iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/10', badge: null, desc: 'View and update your student info' },
];

export default function StudentDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [showQr, setShowQr] = useState(false);
  const [profile, setProfile] = useState<{ name: string; usn: string; department: string; section: string; branch: string } | null>(null);
  const [metrics, setMetrics] = useState({ active: 0, pending: 0, borrowed: 0, dueSoon: 0 });
  const [urgentReturn, setUrgentReturn] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
        const { data: userData } = await supabase.from('users').select('user_id, name, usn, department, section, branch').eq('email', user.email).maybeSingle();
        if (!userData) return;
        setProfile({ name: userData.name || '', usn: userData.usn || '', department: userData.department || '', section: userData.section || '', branch: userData.branch || '' });
        const { data: reservations } = await supabase.from('reservations').select('*, components(name)').eq('usn', userData.usn);
        if (reservations) {
          let active = 0, pending = 0, borrowed = 0, dueSoon = 0; let urgent: any = null; const now = new Date();
          reservations.forEach(r => {
            if (!['COMPLETED', 'REJECTED', 'CANCELLED', 'RETURNED'].includes(r.status)) active++;
            if (r.status === 'PENDING_APPROVAL' || r.status === 'PENDING_HOD') pending++;
            if (r.status === 'CHECKED_OUT' || r.status === 'READY_FOR_PICKUP') {
              if (r.status === 'CHECKED_OUT') borrowed++;
              const due = new Date(r.request_date); due.setDate(due.getDate() + (r.duration || 7));
              const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
              if (diff <= 2 && r.status === 'CHECKED_OUT') { dueSoon++; if (!urgent || diff < urgent.diffDays) urgent = { ...r, diffDays: diff, dueDate: due }; }
            }
          });
          setMetrics({ active, pending, borrowed, dueSoon }); setUrgentReturn(urgent);
        }
      } catch (err) { console.error('Dashboard error:', err); }
    };
    fetchData();
  }, []);

  const QrModal = (
    <AnimatePresence>
      {showQr && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4" onClick={() => setShowQr(false)}>
          <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
            onClick={e => e.stopPropagation()} className="relative bg-white p-8 rounded-3xl shadow-[0_0_60px_rgba(139,92,246,0.5)] flex flex-col items-center max-w-xs w-full">
            <button onClick={() => setShowQr(false)} className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full"><X className="w-5 h-5" /></button>
            <h3 className={`${spaceGrotesk.className} text-2xl font-black text-black mb-1`}>DIGITAL PASS</h3>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mb-6">Scan at Admin Desk</p>
            <div className="bg-white p-3 border-4 border-dashed border-violet-400/40 rounded-2xl"><QRCode value={profile?.usn || 'PENDING'} size={200} level="H" fgColor="#000000" bgColor="#ffffff" /></div>
            <div className="mt-6 pt-5 border-t border-zinc-200 w-full text-center">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
              <p className="font-mono text-xl font-bold text-violet-600">{profile?.usn || 'N/A'}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const LabIdCard = ({ size }: { size: 'sm' | 'lg' }) => (
    <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden" style={{ padding: size === 'lg' ? '1.25rem' : '1rem' }}>
      {size === 'lg' && <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Digital Lab ID</p>}
      <div className={`relative z-10 ${size === 'lg' ? 'flex flex-col items-center' : 'flex items-center gap-4'}`}>
        <div className={`relative bg-white rounded-xl p-2 overflow-hidden border-2 border-zinc-700 ${size === 'lg' ? 'mb-4' : 'shrink-0'}`}>
          <div className={`${size === 'lg' ? 'blur-md opacity-50' : 'blur-md opacity-50'}`}><QRCode value={profile?.usn || 'PENDING'} size={size === 'lg' ? 100 : 72} level="M" fgColor="#000" bgColor="#fff" /></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setShowQr(true)} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95"><Eye className="w-3 h-3" /> Show</button>
          </div>
        </div>
        <div className={size === 'lg' ? 'text-center' : 'flex-1 min-w-0'}>
          <div className={`flex items-center gap-1.5 mb-0.5 ${size === 'lg' ? 'justify-center' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active</span>
          </div>
          <p className={`font-bold text-white ${size === 'sm' ? 'text-base truncate' : 'text-base'}`}>{profile?.name || 'Loading...'}</p>
          <p className="font-mono text-sm text-cyan-400 font-bold">{profile?.usn || '—'}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">{profile?.department}{profile?.section && ` · ${profile.section}`}</p>
        </div>
        {size === 'sm' && <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><QrCode className="w-4 h-4 text-zinc-300" /></div>}
      </div>
      <div className="relative z-10 mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0"><Zap className="w-3 h-3 text-zinc-400" /></div>
        <p className="text-[11px] text-zinc-400 leading-tight">Tap <span className="font-bold text-white">Show</span> and present your QR to the admin.</p>
      </div>
    </div>
  );

  return (
    <>
      {QrModal}
      <div className={`${spaceGrotesk.className} min-h-screen bg-[#020617] text-zinc-100 overflow-x-hidden selection:bg-cyan-500/30`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[40vh] bg-gradient-to-b from-indigo-900/10 to-transparent" />
          <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/5 blur-[120px]" />
          <div className="absolute bottom-[0%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-violet-600/5 blur-[120px]" />
        </div>
        <ParticleNetwork />

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 z-50 flex-col bg-[#020617]/95 backdrop-blur-2xl border-r border-white/8">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/8">
            <img src={siteConfig.logoUrl} alt="Logo" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-sm font-black text-white tracking-wide">{siteConfig.appName}</p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Student Portal</p>
            </div>
          </div>
          {profile && (
            <div className="mx-4 mt-4 p-3 bg-white/5 border border-white/8 rounded-2xl">
              <div className="flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active</span></div>
              <p className="text-sm font-bold text-white truncate">{profile.name}</p>
              <p className="font-mono text-xs text-cyan-400 font-bold">{profile.usn}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{profile.department}{profile.section && ` · Sec ${profile.section}`}</p>
            </div>
          )}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon; const active = pathname === item.path;
              return (
                <button key={item.path} onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${active ? 'bg-white/10 text-white border border-white/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-zinc-300' : ''}`} />{item.label}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-white/8">
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
              <LogOut className="w-5 h-5" />Sign Out
            </button>
          </div>
        </aside>

        {/* ── MOBILE TOP BAR ── */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-[#020617]/85 backdrop-blur-xl border-b border-white/5"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.625rem' }}>
          <div className="flex items-center gap-2.5"><img src={siteConfig.logoUrl} alt="Logo" className="w-8 h-8 object-contain" /><span className="text-base font-bold tracking-wider text-white">{siteConfig.appName}</span></div>
          <div className="flex items-center gap-2">
            {profile && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{profile.usn}</div>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="p-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main className="relative z-10 lg:ml-64" style={{ paddingTop: 'calc(3.75rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-5xl mx-auto px-4 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="lg:grid lg:grid-cols-3 lg:gap-8">

              {/* Left column */}
              <div className="lg:col-span-2">
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mt-5 mb-6 lg:mt-0">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  <h1 className="text-[1.75rem] lg:text-4xl font-black text-white tracking-tight leading-tight">
                    Hello, {profile?.name?.split(' ')[0] || 'Student'}
                  </h1>
                  {profile && <p className="text-sm text-zinc-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-mono bg-white/5 px-2 py-0.5 rounded text-cyan-200 border border-white/10 text-xs">{profile.usn}</span><span className="text-xs">{profile.department}{profile.section && ` · Sec ${profile.section}`}</span></p>}
                </motion.section>

                <AnimatePresence>
                  {urgentReturn && (
                    <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
                      <button onClick={() => router.push('/student/reservations')} className="w-full flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 active:scale-[0.98] transition-transform text-left">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Return {urgentReturn.diffDays <= 0 ? 'Overdue!' : urgentReturn.diffDays === 1 ? 'Due Tomorrow' : `Due in ${urgentReturn.diffDays} Days`}</p>
                          <p className="text-sm font-bold text-white truncate">{urgentReturn.components?.name || 'Component'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 grid grid-cols-4 gap-2 lg:gap-3">
                  {[{ label: 'Active', value: metrics.active, color: 'text-white' }, { label: 'Pending', value: metrics.pending, color: 'text-cyan-400' }, { label: 'Borrowed', value: metrics.borrowed, color: 'text-violet-400' }, { label: 'Due Soon', value: metrics.dueSoon, color: 'text-rose-400' }].map((m, i) => (
                    <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.04 }} className="bg-zinc-900/60 border border-white/8 rounded-2xl py-3 lg:py-4 px-1 flex flex-col items-center justify-center text-center backdrop-blur-xl">
                      <span className={`text-xl lg:text-2xl font-black ${m.color} leading-none`}>{m.value}</span>
                      <span className="text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-wide mt-1 leading-tight">{m.label}</span>
                    </motion.div>
                  ))}
                </motion.section>

                {/* Mobile-only Lab ID card — above actions */}
                <div className="lg:hidden mb-5">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Digital Lab ID</p>
                  <LabIdCard size="sm" />
                </div>

                <section className="mb-6">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    {QUICK_ACTIONS.map((action, i) => {
                      const Icon = action.icon; const badgeCount = action.badge === 'pending' ? metrics.pending : 0;
                      return (
                        <motion.button key={action.id} initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.18 + i * 0.07 }} onClick={() => router.push(action.path)}
                          className={`relative group bg-zinc-900/40 hover:bg-zinc-900/60 backdrop-blur-xl border ${action.border} ${action.glow} rounded-2xl p-4 lg:p-5 flex flex-col items-start text-left transition-all duration-500 active:scale-95 overflow-hidden`}>
                          <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-colors duration-500" />
                          {badgeCount > 0 && <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-rose-500/90 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.5)] z-10">{badgeCount}</span>}
                          <div className={`w-11 h-11 ${action.iconBg} rounded-xl flex items-center justify-center mb-3 border border-white/5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 z-10`}><Icon className={`w-5 h-5 ${action.iconColor}`} /></div>
                          <p className="text-sm font-bold text-white leading-snug whitespace-pre-line z-10">{action.label}</p>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-snug z-10 group-hover:text-zinc-400 transition-colors">{action.desc}</p>
                          <div className="mt-2 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors z-10"><ChevronRight className={`w-3 h-3 text-zinc-500 group-hover:${action.iconColor} transition-colors`} /></div>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>


              </div>

              {/* Right column (desktop only) */}
              <div className="hidden lg:flex lg:flex-col lg:gap-5">

                {/* Profile Card — top */}
                {profile && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
                    {/* Subtle gradient accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-500/0 via-zinc-400/20 to-zinc-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex items-center justify-between mb-5">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Student Profile</p>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Active</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                        <span className="text-lg font-bold text-zinc-200">{profile.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-white truncate leading-tight">{profile.name}</p>
                        <p className="font-mono text-xs text-zinc-400 mt-1">{profile.usn}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Department</span>
                        <span className="text-xs text-zinc-200 font-semibold truncate">{profile.department}</span>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Year / Sec</span>
                        <span className="text-xs text-zinc-200 font-semibold truncate">
                          {profile.branch || 'N/A'}{profile.section && ` — ${profile.section}`}
                        </span>
                      </div>
                    </div>

                    <button onClick={() => router.push('/student/profile')}
                      className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all">
                      View Full Profile <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}

                {/* Digital Lab ID — bottom */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <LabIdCard size="lg" />
                </motion.div>
              </div>


            </div>
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/92 backdrop-blur-2xl border-t border-white/8 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon; const active = pathname === item.path;
            return (
              <button key={item.path} onClick={() => router.push(item.path)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 relative ${active ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300 active:text-zinc-200'}`}>
                {active && <motion.div layoutId="bottom-nav-pill" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
