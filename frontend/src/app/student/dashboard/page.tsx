'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import { siteConfig } from '@/config/site';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, User, Microchip, Clock, ChevronRight,
  QrCode, Eye, FileCheck, X, Home, AlertTriangle, Zap, Sparkles
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
  { id: 'hardware', label: 'Hardware\nRequest', icon: Microchip, path: '/student/checkout', gradient: 'from-sky-400 to-cyan-500', bg: 'bg-sky-50 hover:bg-sky-100/80', border: 'border-sky-200 hover:border-sky-300', iconBg: 'bg-sky-100', iconColor: 'text-sky-600', glow: 'hover:shadow-[0_8px_32px_-4px_rgba(14,165,233,0.25)]', badge: null, desc: 'Browse and reserve lab components' },
  { id: 'reservations', label: 'My\nReservations', icon: Clock, path: '/student/reservations', gradient: 'from-violet-400 to-purple-500', bg: 'bg-violet-50 hover:bg-violet-100/80', border: 'border-violet-200 hover:border-violet-300', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', glow: 'hover:shadow-[0_8px_32px_-4px_rgba(139,92,246,0.25)]', badge: 'pending', desc: 'Track your active and pending orders' },
  { id: 'no-dues', label: 'No Dues\nCertificate', icon: FileCheck, path: '/student/no-dues', gradient: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50 hover:bg-emerald-100/80', border: 'border-emerald-200 hover:border-emerald-300', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', glow: 'hover:shadow-[0_8px_32px_-4px_rgba(16,185,129,0.25)]', badge: null, desc: 'Download your lab clearance certificate' },
  { id: 'profile', label: 'Student\nProfile', icon: User, path: '/student/profile', gradient: 'from-rose-400 to-pink-500', bg: 'bg-rose-50 hover:bg-rose-100/80', border: 'border-rose-200 hover:border-rose-300', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', glow: 'hover:shadow-[0_8px_32px_-4px_rgba(244,63,94,0.25)]', badge: null, desc: 'View and update your student info' },
];

function FloatingBlob({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{ x: [0, 30, -20, 10, 0], y: [0, -20, 30, -10, 0], scale: [1, 1.08, 0.95, 1.05, 1] }}
      transition={{ duration: 18, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

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
    { label: 'Active', value: metrics.active, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    { label: 'Pending', value: metrics.pending, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
    { label: 'Borrowed', value: metrics.borrowed, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Due Soon', value: metrics.dueSoon, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  ];

  const QrModal = (
    <AnimatePresence>
      {showQr && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-4" onClick={() => setShowQr(false)}>
          <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
            onClick={e => e.stopPropagation()} className="relative bg-white p-8 rounded-3xl shadow-2xl border border-violet-100 flex flex-col items-center max-w-xs w-full">
            <button onClick={() => setShowQr(false)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mb-3"><QrCode className="w-6 h-6 text-violet-600" /></div>
            <h3 className={`${spaceGrotesk.className} text-2xl font-black text-slate-900 mb-1`}>DIGITAL PASS</h3>
            <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest mb-6">Scan at Admin Desk</p>
            <div className="bg-white p-3 border-2 border-dashed border-violet-200 rounded-2xl"><QRCode value={profile?.usn || 'PENDING'} size={200} level="H" fgColor="#1e1b4b" bgColor="#ffffff" /></div>
            <div className="mt-6 pt-5 border-t border-slate-100 w-full text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Student USN</p>
              <p className="font-mono text-xl font-bold text-violet-600">{profile?.usn || 'N/A'}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const LabIdCard = ({ size }: { size: 'sm' | 'lg' }) => (
    <div className="relative bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl overflow-hidden shadow-sm" style={{ padding: size === 'lg' ? '1.25rem' : '1rem' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 via-transparent to-sky-50/50 pointer-events-none" />
      {size === 'lg' && <p className="relative text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Digital Lab ID</p>}
      <div className={`relative z-10 ${size === 'lg' ? 'flex flex-col items-center' : 'flex items-center gap-4'}`}>
        <div className={`relative bg-white rounded-xl p-2 overflow-hidden border-2 border-slate-100 shadow-sm ${size === 'lg' ? 'mb-4' : 'shrink-0'}`}>
          <div className="blur-md opacity-40"><QRCode value={profile?.usn || 'PENDING'} size={size === 'lg' ? 100 : 72} level="M" fgColor="#1e1b4b" bgColor="#fff" /></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setShowQr(true)} className="flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 shadow-md"><Eye className="w-3 h-3" /> Show</button>
          </div>
        </div>
        <div className={size === 'lg' ? 'text-center' : 'flex-1 min-w-0'}>
          <div className={`flex items-center gap-1.5 mb-0.5 ${size === 'lg' ? 'justify-center' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active</span>
          </div>
          <p className={`font-bold text-slate-800 ${size === 'sm' ? 'text-base truncate' : 'text-base'}`}>{profile?.name || 'Loading...'}</p>
          <p className="font-mono text-sm text-violet-600 font-bold">{profile?.usn || '---'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{profile?.department}{profile?.section && ` - ${profile.section}`}</p>
        </div>
        {size === 'sm' && <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center"><QrCode className="w-4 h-4 text-slate-400" /></div>}
      </div>
      <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><Zap className="w-3 h-3 text-violet-500" /></div>
        <p className="text-[11px] text-slate-500 leading-tight">Tap <span className="font-bold text-slate-700">Show</span> and present your QR to the admin.</p>
      </div>
    </div>
  );

  return (
    <>
      {QrModal}
      <div className={`${spaceGrotesk.className} min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/40 text-slate-800 overflow-x-hidden selection:bg-violet-200`}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <FloatingBlob className="top-[-10%] left-[-5%] w-[45vw] h-[45vw] bg-violet-200/30" delay={0} />
          <FloatingBlob className="bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-sky-200/25" delay={4} />
          <FloatingBlob className="top-[40%] left-[50%] w-[28vw] h-[28vw] bg-rose-100/20" delay={8} />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 z-50 flex-col bg-white/85 backdrop-blur-2xl border-r border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-6 h-6 object-contain brightness-0 invert" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 tracking-wide">{siteConfig.appName}</p>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Student Portal</p>
            </div>
          </div>
          {profile && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-br from-violet-50 to-sky-50/50 border border-violet-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active</span></div>
              <p className="text-sm font-bold text-slate-800 truncate">{profile.name}</p>
              <p className="font-mono text-xs text-violet-600 font-bold">{profile.usn}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{profile.department}{profile.section && ` - Sec ${profile.section}`}</p>
            </div>
          )}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon; const active = pathname === item.path;
              return (
                <button key={item.path} onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${active ? 'bg-violet-600 text-white shadow-[0_4px_14px_-2px_rgba(124,58,237,0.35)]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <Icon className="w-5 h-5 shrink-0" />{item.label}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-100">
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">
              <LogOut className="w-5 h-5" />Sign Out
            </button>
          </div>
        </aside>

        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-sm"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.625rem' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-5 h-5 object-contain brightness-0 invert" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-800">{siteConfig.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            {profile && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-xs text-violet-600 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{profile.usn}</div>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="p-2 rounded-full bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        <main className="relative z-10 lg:ml-64" style={{ paddingTop: 'calc(3.75rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-5xl mx-auto px-4 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="lg:grid lg:grid-cols-3 lg:gap-8">
              <div className="lg:col-span-2">
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-5 mb-6 lg:mt-0">
                  <div className="flex items-center gap-2 mb-1">
                    <motion.div animate={{ rotate: [0, 15, -10, 15, 0] }} transition={{ duration: 1.5, delay: 0.8, repeat: Infinity, repeatDelay: 5 }}>
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </motion.div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  </div>
                  <h1 className="text-[1.75rem] lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                    Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">{profile?.name?.split(' ')[0] || 'Student'}</span>
                  </h1>
                  {profile && <p className="text-sm text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-lg text-violet-600 text-xs font-bold">{profile.usn}</span>
                    <span className="text-xs text-slate-400">{profile.department}{profile.section && ` - Sec ${profile.section}`}</span>
                  </p>}
                </motion.section>

                <AnimatePresence>
                  {urgentReturn && (
                    <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
                      <button onClick={() => router.push('/student/reservations')} className="w-full flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 active:scale-[0.98] transition-all hover:bg-rose-100 text-left shadow-sm">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{urgentReturn.diffDays <= 0 ? 'Return Overdue!' : urgentReturn.diffDays === 1 ? 'Due Tomorrow' : `Due in ${urgentReturn.diffDays} Days`}</p>
                          <p className="text-sm font-bold text-slate-800 truncate">{urgentReturn.components?.name || 'Component'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 grid grid-cols-4 gap-2 lg:gap-3">
                  {METRICS.map((m, i) => (
                    <motion.div key={m.label}
                      initial={{ opacity: 0, y: 14, scale: 0.93 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.12 + i * 0.07, type: 'spring', stiffness: 400, damping: 24 }}
                      className={`${m.bg} border ${m.border} rounded-2xl py-3 lg:py-4 px-1 flex flex-col items-center justify-center text-center shadow-sm`}>
                      <span className={`text-xl lg:text-2xl font-black ${m.color} leading-none`}>{m.value}</span>
                      <span className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 leading-tight">{m.label}</span>
                    </motion.div>
                  ))}
                </motion.section>

                <div className="lg:hidden mb-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Digital Lab ID</p>
                  <LabIdCard size="sm" />
                </div>

                <section className="mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    {QUICK_ACTIONS.map((action, i) => {
                      const Icon = action.icon;
                      const badgeCount = action.badge === 'pending' ? metrics.pending : 0;
                      return (
                        <motion.button key={action.id}
                          initial={{ opacity: 0, scale: 0.92, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.09, type: 'spring', stiffness: 350, damping: 26 }}
                          whileHover={{ y: -3, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push(action.path)}
                          className={`relative group ${action.bg} border ${action.border} ${action.glow} rounded-2xl p-4 lg:p-5 flex flex-col items-start text-left transition-all duration-300 overflow-hidden shadow-sm`}>
                          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${action.gradient} opacity-70`} />
                          {badgeCount > 0 && <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md z-10">{badgeCount}</span>}
                          <div className={`w-11 h-11 ${action.iconBg} rounded-xl flex items-center justify-center mb-3 border border-white shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 z-10`}>
                            <Icon className={`w-5 h-5 ${action.iconColor}`} />
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-snug whitespace-pre-line z-10">{action.label}</p>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug z-10 group-hover:text-slate-500 transition-colors">{action.desc}</p>
                          <div className="mt-2 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center z-10 shadow-sm group-hover:shadow-md transition-all">
                            <ChevronRight className={`w-3 h-3 ${action.iconColor}`} />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="hidden lg:flex lg:flex-col lg:gap-5">
                {profile && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/40 via-transparent to-sky-50/40 pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Profile</p>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                        <span className="text-lg font-bold text-white">{profile.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-800 truncate leading-tight">{profile.name}</p>
                        <p className="font-mono text-xs text-violet-600 mt-1 font-bold">{profile.usn}</p>
                      </div>
                    </div>
                    <div className="relative grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Department</span>
                        <span className="text-xs text-slate-700 font-semibold truncate">{profile.department}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Year / Sec</span>
                        <span className="text-xs text-slate-700 font-semibold truncate">{profile.branch || 'N/A'}{profile.section && ` - ${profile.section}`}</span>
                      </div>
                    </div>
                    <button onClick={() => router.push('/student/profile')}
                      className="relative w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 hover:border-violet-200 rounded-xl transition-all">
                      View Full Profile <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <LabIdCard size="lg" />
                </motion.div>
              </div>
            </div>
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-slate-200 flex items-stretch shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.07)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon; const active = pathname === item.path;
            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 relative ${active ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {active && <motion.div layoutId="bottom-nav-pill" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                {active && <motion.div className="absolute inset-0 bg-violet-50/70" layoutId="bottom-nav-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon className={`w-5 h-5 transition-transform duration-200 relative z-10 ${active ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-bold uppercase tracking-wide leading-none relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
