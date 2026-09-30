'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import { siteConfig } from '@/config/site';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, User, Microchip, Clock, ChevronRight,
  QrCode, Eye, FileCheck, X, Home, AlertTriangle, Zap, LayoutDashboard
} from 'lucide-react';
import QRCode from 'react-qr-code';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

const NAV_ITEMS = [
  { label: 'Home', icon: LayoutDashboard, path: '/student/dashboard' },
  { label: 'Hardware', icon: Microchip, path: '/student/checkout' },
  { label: 'Reservations', icon: Clock, path: '/student/reservations' },
  { label: 'No Dues', icon: FileCheck, path: '/student/no-dues' },
  { label: 'Profile', icon: User, path: '/student/profile' },
];

const QUICK_ACTIONS = [
  {
    id: 'hardware', label: 'Hardware Request', icon: Microchip,
    path: '/student/checkout', badge: null,
    desc: 'Browse and reserve lab components',
    accent: '#3b82f6', accentLight: '#eff6ff', accentBorder: '#bfdbfe',
    accentText: '#1d4ed8',
  },
  {
    id: 'reservations', label: 'My Reservations', icon: Clock,
    path: '/student/reservations', badge: 'pending',
    desc: 'Track your active and pending orders',
    accent: '#6366f1', accentLight: '#eef2ff', accentBorder: '#c7d2fe',
    accentText: '#4338ca',
  },
  {
    id: 'no-dues', label: 'No Dues Certificate', icon: FileCheck,
    path: '/student/no-dues', badge: null,
    desc: 'Download your clearance certificate',
    accent: '#0ea5e9', accentLight: '#f0f9ff', accentBorder: '#bae6fd',
    accentText: '#0369a1',
  },
  {
    id: 'profile', label: 'Student Profile', icon: User,
    path: '/student/profile', badge: null,
    desc: 'View and update your student info',
    accent: '#8b5cf6', accentLight: '#f5f3ff', accentBorder: '#ddd6fe',
    accentText: '#6d28d9',
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } },
};

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

  const METRICS = [
    { label: 'Active', value: metrics.active, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Pending', value: metrics.pending, color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
    { label: 'Borrowed', value: metrics.borrowed, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    { label: 'Due Soon', value: metrics.dueSoon, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  ];

  // QR Modal
  const QrModal = (
    <AnimatePresence>
      {showQr && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4"
          onClick={() => setShowQr(false)}>
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.88, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-[0_24px_64px_-12px_rgba(59,130,246,0.25)] border border-blue-100 flex flex-col items-center max-w-xs w-full p-8">
            <button onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
              <QrCode className="w-7 h-7 text-white" />
            </div>
            <h3 className={`${spaceGrotesk.className} text-xl font-black text-slate-900 mb-1 tracking-tight`}>Lab Digital Pass</h3>
            <p className="text-slate-400 text-xs mb-6">Scan this at the admin desk</p>
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl">
              <QRCode value={profile?.usn || 'PENDING'} size={180} level="H" fgColor="#1e3a8a" bgColor="#f8fafc" />
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100 w-full text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Student USN</p>
              <p className="font-mono text-lg font-black text-indigo-600">{profile?.usn || 'N/A'}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Lab ID Card
  const LabIdCard = ({ size }: { size: 'sm' | 'lg' }) => (
    <div
      className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
      style={{ padding: size === 'lg' ? '1.25rem' : '1rem' }}>
      {/* Gradient stripe at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
      {size === 'lg' && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 mt-1">Digital Lab ID</p>}
      <div className={`relative z-10 ${size === 'lg' ? 'flex flex-col items-center' : 'flex items-center gap-4'}`}>
        <div className={`relative bg-slate-50 rounded-xl p-2 overflow-hidden border border-slate-200 ${size === 'lg' ? 'mb-4' : 'shrink-0'}`}>
          <div className="blur-md opacity-30"><QRCode value={profile?.usn || 'PENDING'} size={size === 'lg' ? 96 : 68} level="M" fgColor="#1e3a8a" bgColor="#f8fafc" /></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setShowQr(true)}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all shadow-md active:scale-95">
              <Eye className="w-3 h-3" /> Reveal
            </button>
          </div>
        </div>
        <div className={size === 'lg' ? 'text-center' : 'flex-1 min-w-0'}>
          <div className={`flex items-center gap-1.5 mb-1 ${size === 'lg' ? 'justify-center' : ''}`}>
            <motion.span
              className="w-2 h-2 rounded-full bg-emerald-500 inline-block"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Session</span>
          </div>
          <p className={`font-bold text-slate-800 ${size === 'sm' ? 'text-sm truncate' : 'text-base'}`}>{profile?.name || 'Loading...'}</p>
          <p className="font-mono text-sm font-bold text-indigo-600">{profile?.usn || '---'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{profile?.department}{profile?.section && ` · ${profile.section}`}</p>
        </div>
        {size === 'sm' && <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><QrCode className="w-4 h-4 text-blue-400" /></div>}
      </div>
      <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <p className="text-[10px] text-slate-400 leading-tight">Tap <span className="font-semibold text-slate-600">Reveal</span> to show QR at admin desk</p>
      </div>
    </div>
  );

  return (
    <>
      {QrModal}
      <div className={`${spaceGrotesk.className} min-h-screen text-slate-800 overflow-x-hidden`}
        style={{ background: '#f8fafc' }}>

        {/* Subtle top gradient band */}
        <div className="fixed top-0 left-0 right-0 h-72 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(248,250,252,0) 100%)' }} />

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:flex fixed top-0 left-0 h-full w-60 z-50 flex-col bg-white border-r border-slate-200 shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-5 h-5 object-contain brightness-0 invert" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">{siteConfig.appName}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Student Portal</p>
            </div>
          </div>

          {/* User pill */}
          {profile && (
            <div className="mx-3 mt-3 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Online</span>
              </div>
              <p className="text-sm font-bold text-slate-800 truncate leading-tight">{profile.name}</p>
              <p className="font-mono text-xs text-indigo-600 font-semibold">{profile.usn}</p>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon; const active = pathname === item.path;
              return (
                <button key={item.path} onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left relative ${active
                    ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)]'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="px-2 py-3 border-t border-slate-100">
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </aside>

        {/* ── MOBILE TOP BAR ── */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-white/90 backdrop-blur-xl border-b border-slate-200"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.625rem' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-5 h-5 object-contain brightness-0 invert" />
            </div>
            <span className="text-sm font-black text-slate-800">{siteConfig.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            {profile && <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-indigo-600 font-bold">
              <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              {profile.usn}
            </div>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main className="relative z-10 lg:ml-60"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-5xl mx-auto px-4 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="lg:grid lg:grid-cols-3 lg:gap-8">

              {/* ── LEFT COLUMN ── */}
              <div className="lg:col-span-2">

                {/* Greeting */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-6 mb-6 lg:mt-0">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                    Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},
                    <span className="text-blue-600"> {profile?.name?.split(' ')[0] || 'Student'}</span>
                  </h1>
                  {profile && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-600 font-mono">
                        {profile.usn}
                      </span>
                      <span className="text-xs text-slate-400">{profile.department}{profile.section && ` · Section ${profile.section}`}</span>
                    </div>
                  )}
                </motion.div>

                {/* Urgent return banner */}
                <AnimatePresence>
                  {urgentReturn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="mb-4">
                      <button onClick={() => router.push('/student/reservations')}
                        className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left hover:bg-amber-100 transition-colors shadow-sm">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                            {urgentReturn.diffDays <= 0 ? 'Overdue Return' : urgentReturn.diffDays === 1 ? 'Due Tomorrow' : `Due in ${urgentReturn.diffDays} days`}
                          </p>
                          <p className="text-sm font-semibold text-slate-800 truncate">{urgentReturn.components?.name || 'Component'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Metrics */}
                <motion.div
                  variants={containerVariants} initial="hidden" animate="show"
                  className="grid grid-cols-4 gap-2 lg:gap-3 mb-6">
                  {METRICS.map(m => (
                    <motion.div key={m.label} variants={itemVariants}
                      className="rounded-2xl border flex flex-col items-center justify-center py-4 px-2 text-center shadow-sm"
                      style={{ background: m.bg, borderColor: m.border }}>
                      <span className="text-2xl font-black leading-none" style={{ color: m.color }}>{m.value}</span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-1">{m.label}</span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Mobile Lab ID */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="lg:hidden mb-5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Digital Lab ID</p>
                  <LabIdCard size="sm" />
                </motion.div>

                {/* Quick Actions */}
                <div className="mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
                  <motion.div variants={containerVariants} initial="hidden" animate="show"
                    className="grid grid-cols-2 gap-3">
                    {QUICK_ACTIONS.map(action => {
                      const Icon = action.icon;
                      const badgeCount = action.badge === 'pending' ? metrics.pending : 0;
                      return (
                        <motion.button key={action.id} variants={itemVariants}
                          whileHover={{ y: -2, boxShadow: `0 8px 24px -4px ${action.accent}33` }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => router.push(action.path)}
                          className="relative group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 lg:p-5 flex flex-col items-start text-left transition-all duration-200 shadow-sm overflow-hidden">
                          {/* Colored left edge */}
                          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-300 group-hover:top-0 group-hover:bottom-0"
                            style={{ background: action.accent }} />
                          {badgeCount > 0 && (
                            <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow z-10"
                              style={{ background: '#ef4444' }}>{badgeCount}</span>
                          )}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm transition-transform duration-300 group-hover:scale-110"
                            style={{ background: action.accentLight, border: `1.5px solid ${action.accentBorder}` }}>
                            <Icon className="w-5 h-5" style={{ color: action.accentText }} />
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{action.label}</p>
                          <p className="text-[11px] text-slate-400 leading-snug">{action.desc}</p>
                          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold transition-colors"
                            style={{ color: action.accentText }}>
                            Open <ChevronRight className="w-3 h-3" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </div>
              </div>

              {/* ── RIGHT COLUMN (desktop) ── */}
              <div className="hidden lg:flex lg:flex-col lg:gap-4">
                {profile && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    {/* Top stripe */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <div className="flex items-center justify-between mb-4 mt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Profile</p>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <span className="text-base font-black text-white">{profile.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{profile.name}</p>
                        <p className="font-mono text-xs text-indigo-600 font-semibold">{profile.usn}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[['Department', profile.department], ['Year / Sec', `${profile.branch || 'N/A'}${profile.section ? ` · ${profile.section}` : ''}`]].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
                          <p className="text-xs font-semibold text-slate-700 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => router.push('/student/profile')}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition-all">
                      View Profile <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Digital Lab ID</p>
                  <LabIdCard size="lg" />
                </motion.div>
              </div>
            </div>
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxShadow: '0 -1px 0 #e2e8f0, 0 -8px 24px rgba(0,0,0,0.05)' }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon; const active = pathname === item.path;
            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-150 relative ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {active && (
                  <motion.div layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-600"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
                <Icon className={`w-5 h-5 transition-transform duration-150 ${active ? 'scale-110' : ''}`} />
                <span className="text-[8px] font-bold uppercase tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
