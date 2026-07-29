'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { siteConfig } from '@/config/site';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Microchip, Clock, ChevronRight, Bell, Menu, X, ArrowRight, QrCode, Eye } from 'lucide-react';
import QRCode from 'react-qr-code';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function StudentDashboard() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [showQr, setShowQr] = useState(false);

  // Profile States
  const [profile, setProfile] = useState<{
    name: string;
    usn: string;
    department: string;
    section: string;
  } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('user_id, name, usn, department, section')
            .eq('email', user.email)
            .maybeSingle();

          if (userData) {
            const currentProfile = {
              name: userData.name || '',
              usn: userData.usn || '',
              department: userData.department || '',
              section: userData.section || ''
            };
            setProfile(currentProfile);

            if (userData.department) {
               const res = await fetch(`/api/notices?department=${userData.department}`);
               const noticesData = await res.json();
               if (Array.isArray(noticesData)) setNotices(noticesData);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleHardwareDashboardClick = () => {
    router.push('/student/checkout');
  };

  return (
    <>
      {/* Zoomed QR Code Modal */}
      <AnimatePresence>
        {showQr && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            onClick={() => setShowQr(false)} // Close if clicked outside
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
              className="relative bg-white p-8 rounded-3xl shadow-[0_0_50px_rgba(139,92,246,0.4)] flex flex-col items-center max-w-sm w-full"
            >
              <button 
                onClick={() => setShowQr(false)}
                className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-black rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`${spaceGrotesk.className} text-3xl font-black text-black mb-1`}>DIGITAL PASS</h3>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-8">Scan at Admin Desk</p>
              
              <div className="bg-white p-4 border-4 border-dashed border-violet-500/30 rounded-3xl">
                <QRCode
                  value={profile?.usn || 'PENDING'}
                  size={240}
                  level="H"
                  className="rounded-xl"
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              
              <div className="mt-8 pt-6 border-t border-zinc-200 w-full text-center">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
                <p className="font-mono text-2xl font-bold text-violet-600">{profile?.usn || 'N/A'}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-start pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-12 px-4 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative">
        
        {/* Top Banner */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute top-0 left-0 w-full bg-black/40 border-b border-white/5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 px-4 backdrop-blur-xl z-50 text-center flex items-center justify-center gap-3"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
            {siteConfig.collegeName} Secure Portal
          </p>
        </motion.div>

        {/* Dynamic Background */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020617] to-[#020617] pointer-events-none" />
        <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        
        <ParticleNetwork />

        <div className="w-full max-w-6xl relative z-10 px-4 py-8 flex flex-col min-h-[calc(100vh-8rem)]">

          {/* Navigation Bar */}
          <motion.nav 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-12 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl p-4 shadow-2xl"
          >
            <div className="flex items-center gap-4 pl-2">
              <img src={siteConfig.logoUrl} alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
              <span className={`${spaceGrotesk.className} text-xl font-bold tracking-widest text-white hidden sm:block`}>
                {siteConfig.appName}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-3 pr-2">
              <button onClick={() => router.push('/student/reservations')} className="flex items-center gap-2 px-5 py-2.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-all font-mono text-sm tracking-wide">
                <Clock className="w-4 h-4" />
                Reservations
              </button>
              <button onClick={() => router.push('/student/profile')} className="flex items-center gap-2 px-5 py-2.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-all font-mono text-sm tracking-wide">
                <User className="w-4 h-4" />
                Profile
              </button>
              <div className="w-px h-6 bg-white/10 mx-2" />
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all font-mono text-sm tracking-wide group">
                <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Logout
              </button>
            </div>

            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-zinc-300 hover:text-white">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </motion.nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-8"
              >
                <div className="flex flex-col p-2">
                  <button onClick={() => router.push('/student/reservations')} className="flex items-center gap-3 p-4 text-zinc-300 hover:bg-white/5 rounded-xl transition-colors">
                    <Clock className="w-5 h-5" /> Reservations
                  </button>
                  <button onClick={() => router.push('/student/profile')} className="flex items-center gap-3 p-4 text-zinc-300 hover:bg-white/5 rounded-xl transition-colors">
                    <User className="w-5 h-5" /> Profile
                  </button>
                  <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="flex items-center gap-3 p-4 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                    <LogOut className="w-5 h-5" /> Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Welcome Hero */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div>
              <h1 className={`${spaceGrotesk.className} text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-2`}>
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">{profile?.name?.split(' ')[0] || 'Student'}</span>.
              </h1>
              <p className="text-zinc-400 text-lg flex items-center gap-3">
                <span className="font-mono bg-white/5 px-2 py-1 rounded-md border border-white/10 text-cyan-100">{profile?.usn}</span>
                <span>{profile?.department} {profile?.section && `• Sec ${profile?.section}`}</span>
              </p>
            </div>
          </motion.div>

          {/* Notices */}
          <AnimatePresence>
            {notices.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10 grid gap-4"
              >
                {notices.map(notice => (
                  <div key={notice.id} className={`p-5 rounded-2xl border flex items-start gap-4 backdrop-blur-xl ${notice.type === 'alert' ? 'bg-red-500/10 border-red-500/30' : notice.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyan-500/10 border-cyan-500/30'}`}>
                    <Bell className={`w-6 h-6 mt-1 shrink-0 ${notice.type === 'alert' ? 'text-red-400' : notice.type === 'warning' ? 'text-amber-400' : 'text-cyan-400'}`} />
                    <div>
                      <h4 className={`font-bold text-sm tracking-wide uppercase mb-1 flex items-center gap-2 ${notice.type === 'alert' ? 'text-red-300' : notice.type === 'warning' ? 'text-amber-300' : 'text-cyan-300'}`}>
                        {notice.type === 'alert' ? 'Critical Alert' : notice.type === 'warning' ? 'Warning' : 'Announcement'}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-white/10">{notice.admin_dept}</span>
                      </h4>
                      <p className="text-sm font-medium text-zinc-300 leading-relaxed">{notice.message}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
            
            {/* Main Action: Hardware Checkout */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-5 h-full"
            >
              <div
                onClick={handleHardwareDashboardClick}
                className="group relative h-full bg-gradient-to-br from-zinc-900/80 to-black/80 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 rounded-3xl p-8 cursor-pointer transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)] overflow-hidden flex flex-col justify-between min-h-[320px]"
              >
                {/* Animated Glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-3xl opacity-0 group-hover:opacity-20 transition duration-1000 blur-lg" />
                
                <div className="relative z-10 flex-grow flex flex-col items-start justify-center">
                  <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)] mb-6">
                    <Microchip className="w-8 h-8" />
                  </div>
                  <h2 className={`${spaceGrotesk.className} text-3xl font-bold text-white mb-4 group-hover:text-cyan-200 transition-colors`}>
                    Hardware Request
                  </h2>
                  <p className="text-zinc-400 font-medium text-base leading-relaxed max-w-sm">
                    Browse the catalog, check real-time availability, and reserve lab components for your projects.
                  </p>
                </div>

                <div className="relative z-10 mt-8 flex items-center justify-between w-full border-t border-white/10 pt-6">
                  <span className="text-sm font-bold uppercase tracking-widest text-zinc-500 group-hover:text-cyan-400 transition-colors">Start Request</span>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-black text-zinc-400 transition-all duration-300">
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Secondary Action: Digital Lab ID */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-7 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[320px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
            >
              {/* Card Background Patterns */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h2 className={`${spaceGrotesk.className} text-xl font-bold text-white tracking-wide flex items-center gap-3`}>
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                    <QrCode className="w-4 h-4 text-violet-400" />
                  </div>
                  Digital Lab ID
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Identity
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 flex-grow relative z-10">
                {/* QR Code Container (Blurred default) */}
                <div className="relative p-3 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] shrink-0 border-4 border-zinc-800 overflow-hidden group">
                  <div className="blur-md scale-95 opacity-50 transition-all duration-700">
                    <QRCode
                      value={profile?.usn || 'PENDING'}
                      size={120}
                      level="M"
                      className="rounded-lg"
                    />
                  </div>
                  
                  {/* Reveal Overlay -> Opens Modal */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <button 
                      onClick={() => setShowQr(true)}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-transform active:scale-95"
                    >
                      <Eye className="w-4 h-4" />
                      Reveal QR
                    </button>
                  </div>
                </div>

                {/* Student Details */}
                <div className="flex-1 flex flex-col justify-center w-full mt-2 sm:mt-0">
                  <div className="space-y-6 text-center sm:text-left">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Authorized Student</p>
                      <h3 className={`${spaceGrotesk.className} text-2xl font-bold text-white truncate`}>
                        {profile?.name || 'Loading...'}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">USN</p>
                        <p className="font-mono text-cyan-400 font-bold truncate">
                          {profile?.usn || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Department</p>
                        <p className="font-mono text-zinc-300 font-bold truncate">
                          {profile?.department || 'N/A'} {profile?.section && `(${profile?.section})`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Highly Visible Instructional Banner */}
              <div className="mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center relative z-10 gap-4">
                <div className="flex items-start sm:items-center gap-3 bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 rounded-xl w-full">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-cyan-200">How to use your pass</p>
                    <p className="text-xs font-medium text-cyan-100/70 mt-0.5 leading-relaxed">
                      Tap <span className="font-bold text-cyan-100">Reveal QR</span> and show it to the admin desk to instantly collect or return your reserved hardware.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
        </div>
      </div>
    </>
  );
}
