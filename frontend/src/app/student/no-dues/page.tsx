'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Inter } from 'next/font/google';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import NoDuesCertificate from '@/components/NoDuesCertificate';

const inter = Inter({ subsets: ['latin'] });

export default function NoDuesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasDues, setHasDues] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const [studentData, setStudentData] = useState({
    name: '',
    usn: '',
    department: 'CSE', // Default or fetch from user profile if available
    semester: ''
  });

  useEffect(() => {
    checkDues();
  }, []);

  const checkDues = async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        await supabase.auth.signOut();
        router.push('/');
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
    <div className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-700/30 overflow-x-hidden relative`}>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      
      <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 pb-6 border-b-2 border-slate-300 relative">
          <div className="absolute bottom-0 left-0 w-32 h-0.5 bg-teal-700" />
          <div>
            <button 
              onClick={() => router.push('/student/dashboard')}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-700 transition-colors mb-4 uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <img src="/vvce-logo.png" alt="VVCE Logo" className="h-10 w-auto object-contain shrink-0" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">No Dues Certificate</h1>
                <p className="text-xs text-slate-500 font-medium">Verify your lab clearance and generate your certificate.</p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center bg-white border border-slate-300 rounded-xl shadow-sm">
            <div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-mono font-bold tracking-widest uppercase text-xs">Verifying Records...</p>
          </div>
        ) : hasDues ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col items-center justify-center py-24 px-6 bg-white border-2 border-dashed border-rose-300 rounded-xl shadow-sm text-center"
          >
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-200">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">Clearance Denied</h2>
            <p className="text-slate-600 max-w-lg mb-8 leading-relaxed text-sm">
              You currently have <strong className="text-rose-600">{pendingCount} active or pending {pendingCount === 1 ? 'request' : 'requests'}</strong> in the lab. 
              Please return all borrowed components and cancel any pending requests to generate your No Dues Certificate.
            </p>
            <button
              onClick={() => router.push('/student/reservations')}
              className="px-6 py-3 bg-slate-900 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-widest shadow-sm"
            >
              View My Reservations
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
          >
            <div className="mb-8 p-6 bg-white border border-slate-300 rounded-xl flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center shrink-0 border border-teal-200">
                <CheckCircle className="w-6 h-6 text-teal-700" />
              </div>
              <div className="flex-1">
                <h4 className="text-teal-800 font-bold uppercase tracking-widest text-sm mb-2">Clearance Approved</h4>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  You have successfully returned all components and have no pending dues. You can now print your No Dues Certificate below.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 print:hidden">
                  <label htmlFor="semester-select" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Select Semester:</label>
                  <select 
                    id="semester-select"
                    value={studentData.semester}
                    onChange={(e) => setStudentData({...studentData, semester: e.target.value})}
                    className="bg-slate-50 border border-slate-300 text-slate-700 rounded px-4 py-2 text-sm font-bold focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors uppercase"
                  >
                    <option value="" disabled>Select Semester</option>
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(sem => (
                      <option key={sem} value={sem}>{sem} Semester</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {studentData.semester ? (
              <div className="bg-white p-2 rounded-xl w-full max-w-4xl mx-auto shadow-sm border border-slate-300 relative">
                <NoDuesCertificate
                  studentName={studentData.name}
                  usn={studentData.usn}
                  department={studentData.department}
                  semester={studentData.semester}
                  date={new Date().toLocaleDateString('en-GB')}
                />
              </div>
            ) : (
              <div className="bg-white p-12 rounded-xl w-full max-w-4xl mx-auto shadow-sm border border-slate-300 border-dashed flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                  <CheckCircle className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2 uppercase tracking-wide">Almost There</h3>
                <p className="text-slate-500 text-sm max-w-md">Please select your current semester from the dropdown above to generate your No Dues Certificate.</p>
              </div>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}
