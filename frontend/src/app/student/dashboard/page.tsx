'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Inter } from 'next/font/google';
import { siteConfig } from '@/config/site';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, User, Microchip, Clock, ChevronRight,
  QrCode, Eye, FileCheck, X, AlertTriangle, LayoutDashboard, Database, Calendar, Package
} from 'lucide-react';
import QRCode from 'react-qr-code';

const inter = Inter({ subsets: ['latin'] });

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, path: '/student/dashboard' },
  { label: 'Hardware', icon: Database, path: '/student/checkout' },
  { label: 'Reservations', icon: Calendar, path: '/student/reservations' },
  { label: 'No Dues', icon: FileCheck, path: '/student/no-dues' },
  { label: 'Profile', icon: User, path: '/student/profile' },
];

const QUICK_ACTIONS = [
  {
    id: 'hardware', label: 'Hardware Request', icon: Microchip,
    path: '/student/checkout', badge: null,
    desc: 'Browse and reserve lab components.',
  },
  {
    id: 'reservations', label: 'My Reservations', icon: Calendar,
    path: '/student/reservations', badge: 'pending',
    desc: 'Track statuses of active and pending hardware orders.',
  },
  {
    id: 'no-dues', label: 'No Dues Certificate', icon: FileCheck,
    path: '/student/no-dues', badge: null,
    desc: 'Generate No Dues certificate for academic records.',
  },
  {
    id: 'profile', label: 'Student Profile', icon: User,
    path: '/student/profile', badge: null,
    desc: 'Update personal details and verification records.',
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemVariants: any = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'tween', ease: 'easeOut', duration: 0.2 } },
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
        if (authError || !user) {
          await supabase.auth.signOut();
          router.push('/');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('name, usn, department, branch, section')
          .eq('email', user.email)
          .single();

        if (userData) setProfile(userData);

        if (userData?.usn) {
          const { data: resData } = await supabase
            .from('reservations')
            .select('status, return_date, id, project_title, expected_return_date')
            .eq('usn', userData.usn.toUpperCase());

          if (resData) {
            let active = 0, pending = 0, borrowed = 0, dueSoon = 0;
            let urgent: any = null;
            const now = new Date();

            resData.forEach(r => {
              if (r.status === 'PENDING_APPROVAL' || r.status === 'PENDING_HOD') pending++;
              if (r.status === 'APPROVED' || r.status === 'CHECKED_OUT') {
                active++;
                if (r.status === 'CHECKED_OUT') borrowed++;
                const retDateStr = r.return_date || r.expected_return_date;
                if (retDateStr) {
                  const retDate = new Date(retDateStr);
                  const diffDays = Math.ceil((retDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays <= 2 && diffDays >= 0) dueSoon++;
                  if (diffDays <= 1 && (!urgent || new Date(urgent.date) > retDate)) {
                    urgent = { id: r.id, title: r.project_title, date: retDateStr, daysLeft: diffDays };
                  }
                }
              }
            });
            setMetrics({ active, pending, borrowed, dueSoon });
            setUrgentReturn(urgent);
          }
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };
    fetchData();
  }, [router]);

  // QR Modal
  const DigitalPassModal = () => (
    <AnimatePresence>
      {showQr && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={() => setShowQr(false)}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="relative bg-white rounded-none border-2 border-slate-900 flex flex-col items-center max-w-xs w-full p-8 shadow-2xl">
            <button onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 bg-teal-800 flex items-center justify-center mb-4 text-white">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className={`text-lg font-bold text-slate-900 mb-1 tracking-tight uppercase`}>Digital Pass</h3>
            <p className="text-slate-500 text-xs mb-6 font-medium">Use this pass for quick access</p>
            <div className="bg-white p-3 border-2 border-slate-900">
              <QRCode value={profile?.usn || 'PENDING'} size={180} level="H" fgColor="#000000" bgColor="#ffffff" />
            </div>
            <div className="mt-5 pt-5 border-t border-slate-200 w-full text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">USN</p>
              <p className="font-mono text-lg font-bold text-slate-900">{profile?.usn || 'N/A'}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );


  return (
    <>
      <div className={`${inter.className} min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden selection:bg-teal-700/30 relative`}>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
        
        {/* Mobile Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 px-2 py-3 z-50 flex items-center justify-around pb-safe">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-teal-700' : 'text-slate-400 hover:text-slate-700'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative z-10 flex w-full max-w-7xl mx-auto md:px-6">
          
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-slate-300 bg-white sticky top-0">
            <div className="p-6 mb-6 flex flex-col gap-4 border-b border-slate-200">
              <img src="/vvce-logo.png" alt="VVCE Logo" className="h-10 w-auto object-contain self-start" />
              <div>
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Lab Nexus VVCE</h2>
                <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none mt-1">STUDENT<br/>PORTAL</h1>
              </div>
            </div>
            
            <nav className="flex-1 space-y-1 px-3">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <button key={item.path} onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-xs font-bold tracking-wide uppercase rounded-sm ${
                      isActive ? 'bg-teal-50 text-teal-800 border-l-4 border-teal-700' : 'text-slate-600 border-l-4 border-transparent hover:bg-slate-50 hover:text-slate-900'
                    }`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            
            <div className="mt-auto px-3 pb-4">
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-red-700 font-bold text-xs uppercase tracking-wide transition-colors">
                <LogOut className="w-4 h-4" /> Terminate Session
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full max-w-5xl pb-24 md:pb-8 pt-6 md:pt-8 px-4 sm:px-6 md:px-10 min-h-screen">
            
            {/* Mobile Header with VVCE Logo */}
            <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-slate-300">
              <div className="flex items-center gap-3">
                <img src="/vvce-logo.png" alt="VVCE Logo" className="h-8 w-auto object-contain" />
                <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">STUDENT PORTAL</h1>
              </div>
              <button onClick={() => setShowQr(true)} className="bg-slate-100 hover:bg-slate-200 transition-colors p-2 border border-slate-200 cursor-pointer">
                <User className="w-5 h-5 text-slate-700" />
              </button>
            </div>

            {/* Desktop Header */}
            <header className="hidden md:flex justify-between items-end mb-10 pb-6 border-b-2 border-slate-300 relative">
              <div className="absolute bottom-0 left-0 w-32 h-0.5 bg-teal-700" />
              <div>
                <p className="text-teal-700 font-bold mb-1.5 text-[11px] tracking-widest uppercase flex items-center gap-1.5 cursor-pointer hover:text-teal-800 transition-colors" onClick={() => setShowQr(true)}>
                  <User className="w-3.5 h-3.5" /> Student Profile
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 capitalize">{profile?.name || 'Loading...'}</h1>
              </div>
              <div className="text-right flex flex-col items-end">
                <button onClick={() => setShowQr(true)} className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors flex items-center gap-2">
                  <QrCode className="w-3 h-3" /> Show Digital Pass
                </button>
                <p className="text-xs font-mono font-bold text-slate-600">{profile?.usn || '---'}</p>
              </div>
            </header>

            {/* Urgent Alert if Due */}
            <AnimatePresence>
              {urgentReturn && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
                  <div className="bg-red-50 border border-red-200 p-4 flex gap-4 items-start">
                    <div className="w-8 h-8 bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="font-bold text-red-900 text-xs uppercase tracking-wide">Action Required</h4>
                      <p className="text-red-700 text-xs mt-1 font-medium leading-relaxed">
                        Component(s) for task <b>{urgentReturn.title}</b> due {urgentReturn.daysLeft === 0 ? 'today' : 'tomorrow'}. Proceed with immediate return to prevent penalty.
                      </p>
                    </div>
                    <button onClick={() => router.push('/student/reservations')} className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wider transition-colors">
                      Execute
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-8">
              
              {/* Main Stats & Actions */}
              <div className="space-y-8">
                
                {/* Metrics */}
                <section>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <LayoutDashboard className="w-3 h-3" /> Dashboard Overview
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 group-hover:bg-blue-500 transition-colors" />
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-4 mt-1">Active Req.</p>
                      <p className="text-3xl font-mono font-bold text-blue-700">{metrics.active}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 group-hover:bg-amber-500 transition-colors" />
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-4 mt-1">Pending</p>
                      <p className="text-3xl font-mono font-bold text-amber-600">{metrics.pending}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                      <p className="text-emerald-800 text-[10px] font-bold uppercase tracking-widest mb-4 mt-1">In Session</p>
                      <p className="text-3xl font-mono font-bold text-emerald-700">{metrics.borrowed}</p>
                    </div>
                    <div className={`p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow ${metrics.dueSoon > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-white border border-slate-200'}`}>
                      <div className={`absolute top-0 left-0 right-0 h-1 ${metrics.dueSoon > 0 ? 'bg-rose-500' : 'bg-slate-200 group-hover:bg-slate-400'}`} />
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-4 mt-1 ${metrics.dueSoon > 0 ? 'text-rose-800' : 'text-slate-600'}`}>Critical</p>
                      <p className={`text-3xl font-mono font-bold ${metrics.dueSoon > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{metrics.dueSoon}</p>
                    </div>
                  </div>
                </section>

                {/* Actions */}
                <section>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quick Actions</h3>
                  </div>
                  
                  <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <motion.button key={action.id} variants={itemVariants} onClick={() => router.push(action.path)}
                          className="group relative flex flex-col items-start p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left overflow-hidden">
                          <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-5 group-hover:bg-teal-50 group-hover:border-teal-200 transition-colors">
                            <Icon className="w-6 h-6 text-slate-500 group-hover:text-teal-600 transition-colors" />
                          </div>
                          <h4 className="font-bold text-slate-900 mb-1.5 text-[15px]">{action.label}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{action.desc}</p>
                          
                          <div className="mt-6 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-teal-600 transition-colors">
                            Access <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                          
                          {action.badge && (
                            <div className="absolute top-5 right-5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full border border-amber-200 shadow-sm">
                              {action.badge}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </section>
                
              </div>

            </div>
          </main>
        </div>
      </div>
      
      <DigitalPassModal />
    </>
  );
}
