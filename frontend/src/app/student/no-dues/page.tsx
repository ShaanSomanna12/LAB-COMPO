'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Space_Grotesk } from 'next/font/google';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import NoDuesCertificate from '@/components/NoDuesCertificate';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function NoDuesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasDues, setHasDues] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const [studentData, setStudentData] = useState({
    name: '',
    usn: '',
    department: 'CSE', // Default or fetch from user profile if available
    year: 'Final'
  });

  useEffect(() => {
    checkDues();
  }, []);

  const checkDues = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/student');
        return;
      }

      // Fetch user profile
      let { data: userData } = await supabase
        .from('users')
        .select('user_id, usn, name')
        .eq('email', user.email)
        .maybeSingle();

      if (!userData) {
        const { data: userDataById } = await supabase
          .from('users')
          .select('user_id, usn, name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (userDataById) {
          userData = userDataById;
        }
      }

      if (userData) {
        setStudentData(prev => ({
          ...prev,
          name: userData.name || 'Student',
          usn: userData.usn || ''
        }));

        // Check for active reservations
        const activeStatuses = [
          'PENDING_APPROVAL', 
          'PENDING_HOD', 
          'APPROVED', 
          'READY_FOR_PICKUP', 
          'CHECKED_OUT', 
          'RETURN_REQUESTED'
        ];

        const { data: activeRes, error } = await supabase
          .from('reservations')
          .select('reservation_id, status')
          .eq('user_id', userData.user_id)
          .in('status', activeStatuses);

        if (error) throw error;

        if (activeRes && activeRes.length > 0) {
          setHasDues(true);
          setPendingCount(activeRes.length);
        } else {
          setHasDues(false);
        }
      }
    } catch (err: any) {
      console.error("Error checking dues:", err.message);
      toast.error("Failed to verify dues status.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-start pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-12 px-4 font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020617] to-[#020617] pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
      <ParticleNetwork />

      <div className="w-full max-w-5xl relative z-10">
        
        {/* Header */}
        <div className="flex flex-col mb-10 gap-2 mt-8">
          <button 
            onClick={() => router.push('/student/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm font-mono tracking-wide w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className={`${spaceGrotesk.className} text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter`}>
            No Dues Certificate
          </h1>
          <p className="text-zinc-400 font-medium">Verify your lab clearance and generate your certificate.</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-cyan-400 font-mono font-bold tracking-widest uppercase animate-pulse">Verifying Records...</p>
          </div>
        ) : hasDues ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col items-center justify-center py-20 px-6 bg-black/40 backdrop-blur-xl border-2 border-rose-500/30 rounded-3xl shadow-[0_0_50px_rgba(244,63,94,0.1)] text-center"
          >
            <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 border border-rose-500/40">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className={`${spaceGrotesk.className} text-3xl font-black text-white mb-4`}>Clearance Denied</h2>
            <p className="text-zinc-300 max-w-lg mb-8 leading-relaxed">
              You currently have <strong className="text-rose-400">{pendingCount} active or pending {pendingCount === 1 ? 'request' : 'requests'}</strong> in the lab. 
              Please return all borrowed components and cancel any pending requests to generate your No Dues Certificate.
            </p>
            <button
              onClick={() => router.push('/student/reservations')}
              className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]"
            >
              View My Reservations
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
          >
            <div className="mb-8 p-5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-start gap-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/40">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-1.5">Clearance Approved</h4>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  You have successfully returned all components and have no pending dues. You can now print your No Dues Certificate below.
                </p>
              </div>
            </div>

            <div className="bg-white p-2 rounded-3xl w-full max-w-4xl mx-auto shadow-2xl relative">
              <NoDuesCertificate
                studentName={studentData.name}
                usn={studentData.usn}
                department={studentData.department}
                year={studentData.year}
                date={new Date().toLocaleDateString('en-GB')}
              />
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
