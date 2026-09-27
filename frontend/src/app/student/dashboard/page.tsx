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

// ─── Bottom Nav Items ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Home',        icon: Home,      path: '/student/dashboard' },
  { label: 'Hardware',    icon: Microchip, path: '/student/checkout' },
  { label: 'My Orders',   icon: Clock,     path: '/student/reservations' },
  { label: 'No Dues',     icon: FileCheck, path: '/student/no-dues' },
  { label: 'Profile',     icon: User,      path: '/student/profile' },
];

// ─── 4 Quick Action Cards (ecommerce 2×2 grid) ────────────────────────────
const QUICK_ACTIONS = [
  {
    id: 'hardware',
    label: 'Hardware\nRequest',
    icon: Microchip,
    path: '/student/checkout',
    gradient: 'from-cyan-500/15 to-transparent',
    border: 'border-cyan-500/20 hover:border-cyan-400/60',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(6,182,212,0.45)]',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    badge: null,
  },
  {
    id: 'reservations',
    label: 'My\nReservations',
    icon: Clock,
    path: '/student/reservations',
    gradient: 'from-violet-500/15 to-transparent',
    border: 'border-violet-500/20 hover:border-violet-400/60',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(139,92,246,0.45)]',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    badge: 'pending',
  },
  {
    id: 'no-dues',
    label: 'No Dues\nCertificate',
    icon: FileCheck,
    path: '/student/no-dues',
    gradient: 'from-emerald-500/15 to-transparent',
    border: 'border-emerald-500/20 hover:border-emerald-400/60',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(16,185,129,0.45)]',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    badge: null,
  },
  {
    id: 'profile',
    label: 'Student\nProfile',
    icon: User,
    path: '/student/profile',
    gradient: 'from-fuchsia-500/15 to-transparent',
    border: 'border-fuchsia-500/20 hover:border-fuchsia-400/60',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(217,70,239,0.45)]',
    iconColor: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/10',
    badge: null,
  },
];

export default function StudentDashboard() {
  const router   = useRouter();
  const pathname = usePathname();
  const [showQr, setShowQr] = useState(false);

  const [profile, setProfile] = useState<{
    name: string; usn: string; department: string; section: string;
  } | null>(null);

  const [metrics, setMetrics] = useState({ active: 0, pending: 0, borrowed: 0, dueSoon: 0 });
  const [urgentReturn, setUrgentReturn] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('user_id, name, usn, department, section')
          .eq('email', user.email)
          .maybeSingle();

        if (!userData) return;

        setProfile({
          name:       userData.name       || '',
          usn:        userData.usn        || '',
          department: userData.department || '',
          section:    userData.section    || '',
        });

        const { data: reservations } = await supabase
          .from('reservations')
          .select('*, components(name)')
          .eq('usn', userData.usn);

        if (reservations) {
          let active = 0, pending = 0, borrowed = 0, dueSoon = 0;
          let urgent: any = null;
          const now = new Date();

          reservations.forEach(r => {
            const done = ['COMPLETED','REJECTED','CANCELLED','RETURNED'].includes(r.status);
            if (!done) active++;
            if (r.status === 'PENDING_APPROVAL' || r.status === 'PENDING_HOD') pending++;
            if (r.status === 'CHECKED_OUT' || r.status === 'READY_FOR_PICKUP') {
              if (r.status === 'CHECKED_OUT') borrowed++;
              const due = new Date(r.request_date);
              due.setDate(due.getDate() + (r.duration || 7));
              const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
              if (diff <= 2 && r.status === 'CHECKED_OUT') {
                dueSoon++;
                if (!urgent || diff < urgent.diffDays) urgent = { ...r, diffDays: diff, dueDate: due };
              }
            }
          });

          setMetrics({ active, pending, borrowed, dueSoon });
          setUrgentReturn(urgent);
        }
      } catch (err) {
        console.error('Dashboard error:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      {/* ── QR Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            onClick={() => setShowQr(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="relative bg-white p-8 rounded-3xl shadow-[0_0_60px_rgba(139,92,246,0.5)] flex flex-col items-center max-w-xs w-full"
            >
              <button onClick={() => setShowQr(false)}
                className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className={`${spaceGrotesk.className} text-2xl font-black text-black mb-1`}>DIGITAL PASS</h3>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mb-6">Scan at Admin Desk</p>
              <div className="bg-white p-3 border-4 border-dashed border-violet-400/40 rounded-2xl">
                <QRCode value={profile?.usn || 'PENDING'} size={200} level="H" fgColor="#000000" bgColor="#ffffff" />
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-200 w-full text-center">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
                <p className="font-mono text-xl font-bold text-violet-600">{profile?.usn || 'N/A'}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Wrapper ──────────────────────────────────────────────── */}
      <div className={`${spaceGrotesk.className} min-h-screen bg-[#020617] text-zinc-100 overflow-x-hidden selection:bg-cyan-500/30`}>

        {/* Ambient glow orbs */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[40vh] bg-gradient-to-b from-violet-900/20 to-transparent" />
          <div className="absolute top-[-15%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-cyan-600/8 blur-[100px]" />
          <div className="absolute bottom-[10%] left-[-15%] w-[55vw] h-[55vw] rounded-full bg-violet-600/8 blur-[100px]" />
        </div>
        <ParticleNetwork />

        {/* ── Fixed Top App Bar ────────────────────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-[#020617]/85 backdrop-blur-xl border-b border-white/5"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.625rem' }}
        >
          <div className="flex items-center gap-2.5">
            <img src={siteConfig.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-base font-bold tracking-wider text-white">{siteConfig.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {profile.usn}
              </div>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              className="p-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Scrollable Main ──────────────────────────────────────────── */}
        <main
          className="relative z-10 px-4 max-w-lg mx-auto"
          style={{
            paddingTop: 'calc(3.75rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >

          {/* ── Hero Greeting ────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="mt-5 mb-4"
          >
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <h1 className="text-[1.75rem] font-black text-white tracking-tight leading-tight">
              Hey, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                {profile?.name?.split(' ')[0] || 'Student'}
              </span> 👋
            </h1>
            {profile && (
              <p className="text-sm text-zinc-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-cyan-200 border border-white/10 text-xs">{profile.usn}</span>
                <span className="text-xs">{profile.department}{profile.section && ` · Sec ${profile.section}`}</span>
              </p>
            )}
          </motion.section>

          {/* ── Urgent Return Alert ──────────────────────────────────────── */}
          <AnimatePresence>
            {urgentReturn && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              >
                <button
                  onClick={() => router.push('/student/reservations')}
                  className="w-full flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 active:scale-[0.98] transition-transform text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                      Return {urgentReturn.diffDays <= 0 ? 'Overdue!' : urgentReturn.diffDays === 1 ? 'Due Tomorrow' : `Due in ${urgentReturn.diffDays} Days`}
                    </p>
                    <p className="text-sm font-bold text-white truncate">{urgentReturn.components?.name || 'Component'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 4-Stat Metrics (4-column, all visible at once) ───────────── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-5 grid grid-cols-4 gap-2"
          >
            {[
              { label: 'Active',   value: metrics.active,   color: 'text-white' },
              { label: 'Pending',  value: metrics.pending,  color: 'text-cyan-400' },
              { label: 'Borrowed', value: metrics.borrowed, color: 'text-violet-400' },
              { label: 'Due Soon', value: metrics.dueSoon,  color: 'text-rose-400' },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.04 }}
                className="bg-zinc-900/60 border border-white/8 rounded-2xl py-3 px-1 flex flex-col items-center justify-center text-center backdrop-blur-xl"
              >
                <span className={`text-xl font-black ${m.color} leading-none`}>{m.value}</span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide mt-1 leading-tight text-center">{m.label}</span>
              </motion.div>
            ))}
          </motion.section>

          {/* ── Quick Actions: 4 Cards in 2×2 Ecommerce Grid ─────────────── */}
          <section className="mb-5">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                const badgeCount = action.badge === 'pending' ? metrics.pending : 0;
                return (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, scale: 0.93 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.18 + i * 0.07 }}
                    onClick={() => router.push(action.path)}
                    className={`relative group bg-gradient-to-br ${action.gradient} bg-zinc-900/70 backdrop-blur-xl border ${action.border} ${action.glow} rounded-2xl p-4 flex flex-col items-start text-left transition-all duration-300 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden`}
                  >
                    {/* Hover shine */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.025] transition-colors duration-300 rounded-2xl" />

                    {/* Badge */}
                    {badgeCount > 0 && (
                      <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                        {badgeCount}
                      </span>
                    )}

                    {/* Icon */}
                    <div className={`w-11 h-11 ${action.iconBg} rounded-xl flex items-center justify-center mb-3 border border-white/8 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-5 h-5 ${action.iconColor}`} />
                    </div>

                    {/* Label */}
                    <p className="text-sm font-bold text-white leading-snug whitespace-pre-line">{action.label}</p>

                    {/* Arrow */}
                    <div className="mt-2 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <ChevronRight className={`w-3 h-3 ${action.iconColor}`} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* ── Digital Lab ID Card (slim) ───────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          >
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Digital Lab ID</p>
            <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 overflow-hidden">
              {/* Glow orb */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

              <div className="relative z-10 flex items-center gap-4">
                {/* Blurred QR */}
                <div className="relative shrink-0 bg-white rounded-xl p-2 overflow-hidden border-2 border-zinc-700">
                  <div className="blur-md opacity-50">
                    <QRCode value={profile?.usn || 'PENDING'} size={72} level="M" fgColor="#000" bgColor="#fff" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={() => setShowQr(true)}
                      className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all active:scale-95"
                    >
                      <Eye className="w-3 h-3" /> Show
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active</span>
                  </div>
                  <p className="text-base font-bold text-white truncate">{profile?.name || 'Loading...'}</p>
                  <p className="font-mono text-sm text-cyan-400 font-bold">{profile?.usn || '—'}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{profile?.department}{profile?.section && ` · ${profile.section}`}</p>
                </div>

                <div className="shrink-0 w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-violet-400" />
                </div>
              </div>

              <div className="relative z-10 mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-3 h-3 text-cyan-400" />
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Tap <span className="font-bold text-white">Show</span> and present your QR to the admin to collect or return hardware.
                </p>
              </div>
            </div>
          </motion.section>

        </main>

        {/* ── Bottom Navigation Bar ────────────────────────────────────── */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/92 backdrop-blur-2xl border-t border-white/8 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {NAV_ITEMS.map(item => {
            const Icon   = item.icon;
            const active = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 relative ${active ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300 active:text-zinc-200'}`}
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
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
