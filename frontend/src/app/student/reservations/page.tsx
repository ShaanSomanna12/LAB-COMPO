'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getWorkingDaysCount } from '@/lib/dateValidator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '@/config/site';
import RequisitionLetter from '@/components/RequisitionLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import QRCode from 'react-qr-code';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { Clock, CheckCircle2, AlertCircle, Package, ArrowLeft, ArrowRight, Eye, Camera, QrCode, FileText, ChevronRight, X, User, Microchip } from 'lucide-react';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

interface Reservation {
  reservation_id: string;
  status: string;
  created_at: string;
  due_date: string | null;
  project_title: string | null;
    after_img_url?: string | null;
      borrowed_at?: string | null;
  components: {
    name: string;
    department: string;
    lab_location: string;
    value_tier?: string;
  } | null;
  history?: {
    oldStatus: string | null;
    newStatus: string;
    changedAt: string;
    note: string | null;
    changedBy: string;
  }[];
  assignedAssetId?: string | null;
  extension_requested?: boolean;
  extension_reason?: string | null;
  extension_days?: number | null;
  extension_status?: string | null;
  team_members?: string[] | null;
  signature_url?: string | null;
  request_mode?: string | null;
  project_type?: string | null;
  project_purpose?: string | null;
  hackathon_date?: string | null;
  hackathon_venue?: string | null;
}

export default function MyReservations() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentUsn, setStudentUsn] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
    
  const [inspectData, setInspectData] = useState<any>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'WEEK' | 'MONTH_1' | 'MONTH_3' | 'MONTH_6' | 'MONTH_12'>('ALL');

  // Modal States
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnResId, setReturnResId] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState('WORKING');
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'COLLECT' | 'RETURN' | null>(null);
  
  // Extension Modal States
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionResId, setExtensionResId] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(1);
  const [extensionReason, setExtensionReason] = useState<string>('');
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  // Ref for the hidden file input
  
  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/student');
        return;
      }

      // Fix: Query 'name' instead of 'full_name'
      let { data: userData, error: userError } = await supabase
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
        setUserId(userData.user_id);
        setStudentUsn(userData.usn);
        setStudentName(userData.name || 'Student');
        
        // Fix: Use components(...) instead of components!inner(...) to avoid query failure if relation missing
        const { data: resData, error } = await supabase
          .from('reservations')
          .select(`
            reservation_id,
            status,
            created_at,
            due_date,
            project_title,
                        after_img_url,
                                    borrowed_at,
            components(name, department, lab_location, value_tier),
            assigned_serial_numbers,
            extension_requested,
            extension_reason,
            extension_days,
            extension_status,
            team_members,
            signature_url,
            request_mode,
            project_type,
            project_purpose,
            hackathon_date,
            hackathon_venue,
            reservation_status_history(new_status, changed_at)
          `)
          .eq('user_id', userData.user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const mappedData = resData?.map((r: any) => ({
          ...r,
          extension_requested: r.extension_requested || false,
          extension_reason: r.extension_reason || null,
          extension_days: r.extension_days || null,
          extension_status: r.extension_status || null,
          assignedAssetId: r.component_instances?.[0]?.serial_number || (r.assigned_serial_numbers && r.assigned_serial_numbers.length > 0 ? r.assigned_serial_numbers[0] : null)
        }));
        
        setReservations(mappedData || []);
      }
    } catch (err: any) {
      console.error("Error fetching reservations:", err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  
  
  const handleCollectClick = async (resId: string) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id: resId, status: 'READY_FOR_PICKUP' })
      });
      if (!res.ok) throw new Error("Failed to update reservation status.");
      toast.success("Ready for pickup. Waiting for admin confirmation!");
      fetchReservations();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleReturnClick = (resId: string) => {
    setReturnResId(resId);
    
    setUploadType(null);
    setReturnCondition('WORKING');
    setReturnModalOpen(true);
  };

  const openExtensionModal = (resId: string) => {
    setExtensionResId(resId);
    setExtensionDays(1);
    setExtensionReason('');
    setExtensionModalOpen(true);
  };

  const submitExtensionRequest = async () => {
    if (!extensionResId || !extensionReason.trim()) {
      toast.error('Please provide a valid reason.');
      return;
    }
    
    setIsSubmittingExtension(true);
    try {
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/requests/extend', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reservationId: extensionResId,
          days: extensionDays,
          reason: extensionReason
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit extension');
      
      toast.success('Extension request submitted successfully!');
      setExtensionModalOpen(false);
      fetchReservations(); // Refresh the list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  const submitReturn = async () => {
    if (!returnResId) return;
    
    setUploading(true);
    try {
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: returnResId,
          status: 'RETURN_REQUESTED',
          returnCondition,
          
        })
      });
      if (!res.ok) throw new Error("Failed to process return.");
      toast.success("Return request submitted.");
      fetchReservations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setReturnModalOpen(false);
      
      setReturnResId(null);
    }
  };

  
  
  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this request?')) return;
    
    try {
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, status: 'CANCELLED' })
      });
      if (!res.ok) throw new Error('Failed to withdraw request');
      toast.success('Request withdrawn successfully');
      fetchReservations();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }
  };

  const currentStatuses = ['PENDING_APPROVAL', 'PENDING_HOD', 'APPROVED', 'READY_FOR_PICKUP', 'CHECKED_OUT', 'RETURN_REQUESTED'];
  
  const groupedReservations = useMemo(() => {
    const groups: { [key: string]: Reservation[] } = {};
    reservations.forEach(r => {
      const timeMs = new Date(r.created_at).getTime();
      const roundedTime = Math.floor(timeMs / 5000) * 5000;
      const key = `${roundedTime}_${r.project_title || 'none'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.values(groups).sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime());
  }, [reservations]);

  const filteredGroups = groupedReservations.filter(group => {
    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchProj = group[0].project_title?.toLowerCase().includes(q) || false;
      const matchComp = group.some(r => r.components?.name?.toLowerCase().includes(q) || r.reservation_id.toLowerCase().includes(q));
      if (!matchComp && !matchProj) return false;
    }

    // Date Filter
    if (dateFilter !== 'ALL') {
      const reqDate = new Date(group[0].created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - reqDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (dateFilter === 'WEEK' && diffDays > 7) return false;
      if (dateFilter === 'MONTH_1' && diffDays > 30) return false;
      if (dateFilter === 'MONTH_3' && diffDays > 90) return false;
      if (dateFilter === 'MONTH_6' && diffDays > 180) return false;
      if (dateFilter === 'MONTH_12' && diffDays > 365) return false;
    }
    return true;
  });

  const currentGroups = filteredGroups.filter(group => group.some(r => currentStatuses.includes(r.status)));
  const completedGroups = filteredGroups.filter(group => group.every(r => !currentStatuses.includes(r.status)));
  const displayedGroups = activeTab === 'CURRENT' ? currentGroups : completedGroups;

  // Render Status Badge Function
  const getStatusBadge = (status: string) => {
    let displayText = status;
    if (status === 'PENDING_APPROVAL') displayText = 'AWAITING APPROVAL';
    else if (status === 'PENDING_HOD') displayText = 'AWAITING HOD APPROVAL';
    else if (status === 'READY_FOR_PICKUP') displayText = 'READY FOR PICKUP';
    else if (status === 'CHECKED_OUT') displayText = 'BORROWED';
    else if (status === 'RETURN_REQUESTED') displayText = 'RETURN IN PROGRESS';

    const isApproved = status === 'APPROVED' || status === 'READY_FOR_PICKUP';
    const isActive = status === 'CHECKED_OUT';
    const isPending = status === 'PENDING_APPROVAL' || status === 'PENDING_HOD' || status === 'RETURN_REQUESTED';
    const isRejected = status === 'REJECTED' || status === 'CANCELLED';
    const isReturned = status === 'RETURNED' || status === 'COMPLETED';

    if (isApproved) return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">{displayText}</span>;
    if (isActive) return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.2)]">{displayText}</span>;
    if (isPending) return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.2)]">{displayText}</span>;
    if (isRejected) return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    if (isReturned) return <span className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    return <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
  };



  return (
    <>
      <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-start pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-12 px-4 font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
        
        {/* Dynamic Background */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020617] to-[#020617] pointer-events-none" />
        <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <ParticleNetwork />

        
        <div className="w-full max-w-5xl relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-6 mt-8">
            <div>
              <button 
                onClick={() => router.push('/student/dashboard')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm font-mono tracking-wide"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
              <h1 className={`${spaceGrotesk.className} text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter mb-3`}>
                My Reservations
              </h1>
              <p className="text-zinc-400 font-medium">Track your hardware requests, proofs, and timelines.</p>
            </div>

            <button
              onClick={() => setShowQRModal(true)}
              className="group flex items-center justify-center gap-3 px-6 py-3.5 bg-zinc-900/80 backdrop-blur-xl border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center border border-violet-500/30 group-hover:scale-110 transition-transform">
                <QrCode className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-violet-300">Open Digital ID</span>
                <span className="text-sm font-black text-white">Digital Pass</span>
              </div>
            </button>
          </div>

          {/* Instructions Box */}
          <div className="mb-8 p-5 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl flex items-start gap-4 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0 border border-cyan-500/40">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-cyan-400 font-bold uppercase tracking-widest text-xs mb-1.5">Collection Instructions</h4>
              <p className="text-zinc-300 text-sm leading-relaxed">
                After receiving admin approval, please proceed to the lab. Ensure you carry your physical ID card and be ready to show your Digital Pass ID. Finally, collect the component from the lab admin.
              </p>
            </div>
          </div>

          {/* Tab Navigation & Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="flex gap-3 bg-black/40 p-2 rounded-2xl w-fit border border-white/5 backdrop-blur-xl shadow-2xl">
              <button
                onClick={() => setActiveTab('CURRENT')}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'CURRENT' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {activeTab === 'CURRENT' && <motion.div layoutId="tab-bg" className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl" />}
                <span className="relative z-10">Active & Pending</span>
                <span className={`relative z-10 px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'CURRENT' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {currentGroups.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('COMPLETED')}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'COMPLETED' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {activeTab === 'COMPLETED' && <motion.div layoutId="tab-bg" className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl" />}
                <span className="relative z-10">Completed</span>
                <span className={`relative z-10 px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {completedGroups.length}
                </span>
              </button>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by component, project, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-full bg-black/40 border border-white/5 text-sm text-white px-10 py-3 rounded-2xl focus:outline-none focus:border-cyan-500/50 backdrop-blur-xl transition-all"
                />
                <svg className="w-4 h-4 absolute left-4 top-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as any)}
                className="bg-black/40 border border-white/5 text-sm text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-cyan-500/50 cursor-pointer appearance-none backdrop-blur-xl transition-all min-w-[160px]"
              >
                <option value="ALL" className="bg-zinc-900 text-white">All Time</option>
                <option value="WEEK" className="bg-zinc-900 text-white">This Week</option>
                <option value="MONTH_1" className="bg-zinc-900 text-white">Past 1 Month</option>
                <option value="MONTH_3" className="bg-zinc-900 text-white">Past 3 Months</option>
                <option value="MONTH_6" className="bg-zinc-900 text-white">Past 6 Months</option>
                <option value="MONTH_12" className="bg-zinc-900 text-white">Past 12 Months</option>
              </select>
            </div>
          </div>

          {/* Loading Overlay */}
          <AnimatePresence>
            {uploading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-cyan-400 font-mono font-bold tracking-widest uppercase animate-pulse">Processing...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reservations Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-3xl border border-white/5 bg-white/5" />)}
            </div>
          ) : displayedGroups.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl bg-black/40 backdrop-blur-sm">
              <Package className="w-16 h-16 text-zinc-600 mb-6" />
              <p className="text-zinc-400 font-mono uppercase tracking-widest text-sm font-bold">
                No {activeTab === 'CURRENT' ? 'active' : 'completed'} requests found.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayedGroups.map((group, i) => {
                  const firstRes = group[0];
                  
                  return (
                  <motion.div
                    key={firstRes.reservation_id}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] group relative"
                  >
                    <div className="p-4 md:p-5 flex-1 flex flex-col z-10">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                           <FileText className="w-5 h-5 text-cyan-400" />
                           <span className="text-white font-bold">{firstRes.project_title || 'Hardware Request'}</span>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono bg-white/5 px-2 py-1 rounded-md border border-white/10">{new Date(firstRes.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      {firstRes.due_date && (
                        <div className="flex items-center gap-2 text-sm text-rose-400 font-medium mb-3 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 w-fit">
                          <AlertCircle className="w-4 h-4" /> Due {new Date(firstRes.due_date).toLocaleDateString()}
                        </div>
                      )}

                      <div className="flex flex-col gap-3 mt-2">
                        {group.map(res => (
                           <div key={res.reservation_id} className="bg-white/5 p-3.5 rounded-2xl border border-white/10 flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className="text-sm font-bold text-zinc-200">{res.components?.name || 'Unknown'}</h4>
                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                       <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-zinc-400 border border-white/10 font-mono">{res.components?.department}</span>
                                       {res.assignedAssetId && (
                                         <span className="text-[10px] bg-cyan-500/10 px-2 py-0.5 rounded-md text-cyan-400 border border-cyan-500/30 font-mono">ID: {res.assignedAssetId}</span>
                                       )}
                                    </div>
                                 </div>
                                 <div>{getStatusBadge(res.status)}</div>
                              </div>
                              
                              {(res.status === 'APPROVED' || res.status === 'PENDING_APPROVAL' || res.status === 'CHECKED_OUT' || res.status === 'READY_FOR_PICKUP') && (
                                <div className="flex flex-wrap gap-2 mt-1 pt-3 border-t border-white/5">
                                   {res.status === 'APPROVED' && (
                                      <>
                                         {res.components?.value_tier === 'LOW' ? (
                                           <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">Collect</span>
                                         ) : (
                                           <button onClick={() => handleCollectClick(res.reservation_id)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg text-xs font-bold transition-all border border-emerald-500/30">Collect</button>
                                         )}
                                         <button onClick={() => handleWithdraw(res.reservation_id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all border border-rose-500/30">Withdraw</button>
                                      </>
                                   )}
                                   {res.status === 'READY_FOR_PICKUP' && (
                                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">Ready at Admin Desk</span>
                                   )}
                                   {res.status === 'PENDING_APPROVAL' && (
                                      <button onClick={() => handleWithdraw(res.reservation_id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all border border-rose-500/30">Withdraw</button>
                                   )}
                                   {res.status === 'CHECKED_OUT' && (
                                      <>
                                         <button onClick={() => handleReturnClick(res.reservation_id)} className="px-3 py-1.5 bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-black rounded-lg text-xs font-bold transition-all border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">Return Item</button>
                                         {!res.extension_requested ? (
                                            <button onClick={() => openExtensionModal(res.reservation_id)} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-all border border-blue-500/20">Extend</button>
                                         ) : (
                                            <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">Ext. {res.extension_status || 'Pending'}</span>
                                         )}
                                      </>
                                   )}
                                </div>
                              )}
                           </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/5 p-3 md:p-4 border-t border-white/10 flex flex-col gap-2 relative z-10">
                      <button
                        onClick={() => {
                          const durationDays = firstRes.due_date ? getWorkingDaysCount(firstRes.created_at, firstRes.due_date) : 1;
                          
                          // Aggregate quantities for same component names, or just map them
                          const itemsMap: Record<string, number> = {};
                          group.forEach(g => {
                             const name = g.components?.name || 'Component';
                             itemsMap[name] = (itemsMap[name] || 0) + 1;
                          });
                          const reqItems = Object.entries(itemsMap).map(([name, qty]) => ({ name, quantity: qty }));

                          setInspectData({
                            studentName: studentName,
                            usn: studentUsn || '',
                            department: firstRes.components?.department || 'EDL',
                            items: reqItems,
                            requestDate: firstRes.created_at,
                            duration: durationDays,
                            status: group.every(g => g.status === firstRes.status) ? firstRes.status : 'MIXED',
                            teamMembers: firstRes.team_members,
                            signatureUrl: firstRes.signature_url,
                            projectTitle: firstRes.project_title,
                            projectType: firstRes.project_type,
                            projectPurpose: firstRes.project_purpose,
                            hackathonDate: firstRes.hackathon_date,
                            hackathonVenue: firstRes.hackathon_venue
                          });
                          setShowInspectModal(true);
                        }}
                        className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                      >
                        <Eye className="w-4 h-4" /> Inspect Letter
                      </button>
                    </div>
                  </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Requisition Inspection Modal */}
      <AnimatePresence>
        {showInspectModal && inspectData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto" onClick={() => setShowInspectModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="relative bg-white p-2 rounded-3xl w-full max-w-4xl mx-auto my-8 shadow-2xl">
              <button onClick={() => setShowInspectModal(false)} className="absolute -top-12 right-0 text-white hover:text-zinc-300 bg-white/10 p-2 rounded-full backdrop-blur-md">
                <X className="w-6 h-6" />
              </button>
              <div className="max-h-[85vh] overflow-y-auto rounded-2xl scrollbar-hide">
                <RequisitionLetter {...inspectData} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Digital Pass QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4" onClick={() => setShowQRModal(false)}>
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} onClick={(e) => e.stopPropagation()} className="relative bg-white p-8 rounded-3xl shadow-[0_0_50px_rgba(139,92,246,0.4)] flex flex-col items-center max-w-sm w-full">
              <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-black rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className={`${spaceGrotesk.className} text-3xl font-black text-black mb-1`}>DIGITAL PASS</h3>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-8">Scan at Admin Desk</p>
              
              <div className="bg-white p-4 border-4 border-dashed border-violet-500/30 rounded-3xl">
                <QRCode value={studentUsn || 'PENDING'} size={240} level="H" className="rounded-xl" fgColor="#000000" bgColor="#ffffff" />
              </div>
              
              <div className="mt-8 pt-6 border-t border-zinc-200 w-full text-center">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
                <p className="font-mono text-2xl font-bold text-violet-600">{studentUsn || 'N/A'}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewModalOpen && previewImgUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setPreviewModalOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="relative bg-zinc-900 p-2 rounded-2xl max-w-2xl w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] border border-white/10">
              <button onClick={() => setPreviewModalOpen(false)} className="absolute -top-12 right-0 text-white hover:text-zinc-300 bg-white/10 p-2 rounded-full backdrop-blur-md">
                <X className="w-6 h-6" />
              </button>
              <img src={previewImgUrl} alt="Proof" className="w-full rounded-xl object-contain max-h-[80vh]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {returnModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-950 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative">
              <h3 className={`${spaceGrotesk.className} text-2xl font-black text-white mb-2`}>Return Component</h3>
              <p className="text-sm text-zinc-400 mb-6">Report condition & capture proof.</p>

              <div className="space-y-3 mb-6">
                <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${returnCondition === 'WORKING' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                  <input type="radio" value="WORKING" checked={returnCondition === 'WORKING'} onChange={() => setReturnCondition('WORKING')} className="text-emerald-500 w-4 h-4" />
                  <span className="text-emerald-400 font-bold text-sm">Working Perfectly</span>
                </label>
                <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${returnCondition === 'DAMAGED' ? 'border-rose-500 bg-rose-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                  <input type="radio" value="DAMAGED" checked={returnCondition === 'DAMAGED'} onChange={() => setReturnCondition('DAMAGED')} className="text-rose-500 w-4 h-4" />
                  <span className="text-rose-400 font-bold text-sm">Damaged</span>
                </label>
              </div>

              <div className="mb-8">
                
              </div>

              <div className="flex gap-3">
                <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors">Cancel</button>
                <button onClick={submitReturn}  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black disabled:opacity-50 transition-all text-sm">Submit</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extension Modal */}
      <AnimatePresence>
        {extensionModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-950 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative">
              <h3 className={`${spaceGrotesk.className} text-2xl font-black text-white mb-2`}>Request Extension</h3>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold mb-6">
                Note: Submitting this request does not guarantee an extension. It is subject to Admin approval.
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Days Required</label>
                  <select 
                    value={extensionDays} 
                    onChange={(e) => setExtensionDays(parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl focus:border-blue-500/50 outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Proper Reason</label>
                  <textarea 
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Why do you need more time?"
                    className="w-full bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl focus:border-blue-500/50 outline-none resize-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setExtensionModalOpen(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors">Cancel</button>
                <button 
                  onClick={submitExtensionRequest} 
                  disabled={!extensionReason.trim() || isSubmittingExtension} 
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black disabled:opacity-50 transition-all text-sm flex justify-center items-center gap-2"
                >
                  {isSubmittingExtension ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
