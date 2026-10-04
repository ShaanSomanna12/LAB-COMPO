'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getWorkingDaysCount } from '@/lib/dateValidator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import RequisitionLetter from '@/components/RequisitionLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import QRCode from 'react-qr-code';
import { Inter } from 'next/font/google';
import { Clock, CheckCircle2, AlertCircle, Package, ArrowLeft, Eye, Camera, QrCode, FileText, X, User, Microchip, ChevronRight } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

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
  project_description?: string | null;
  hackathon_date?: string | null;
  hackathon_venue?: string | null;
  student_department?: string | null;
  section?: string | null;
  branch?: string | null;
  mobile?: string | null;
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
  const [deptMode, setDeptMode] = useState<'HARDWARE' | 'IOT'>('HARDWARE');
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

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        await supabase.auth.signOut();
        router.push('/');
        return;
      }

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
        
        const resRoute = await fetch(`/api/student/reservations?user_id=${userData.user_id}`);
        if (!resRoute.ok) {
          const errorData = await resRoute.json();
          throw new Error(errorData.error || "Failed to fetch reservations");
        }
        const { data: resData } = await resRoute.json();
        // Fetch IoT Transactions for the student via secure backend route
        let iotTxData = null;
        try {
          const res = await fetch(`/api/student/iot-tx?user_id=${userData.user_id}`);
          if (res.ok) {
            const result = await res.json();
            iotTxData = result.data;
          } else {
            console.error("Error fetching IoT transactions via API");
          }
        } catch (err: any) {
          console.error("Error fetching IoT transactions:", err.message);
        }

        let mappedData: any[] = resData?.map((r: any) => ({
          ...r,
          extension_requested: r.extension_requested || false,
          extension_reason: r.extension_reason || null,
          extension_days: r.extension_days || null,
          extension_status: r.extension_status || null,
          assignedAssetId: r.component_instances?.[0]?.serial_number || (r.assigned_serial_numbers && r.assigned_serial_numbers.length > 0 ? r.assigned_serial_numbers[0] : null)
        })) || [];

        // Map IoT transactions to look like Reservations
        if (iotTxData && Array.isArray(iotTxData)) {
          const mappedIot = iotTxData.map(tx => {
            let itemsStr = 'Components';
            if (Array.isArray(tx.iot_transaction_items)) {
              itemsStr = tx.iot_transaction_items.map((i:any) => `${i.quantity}x ${i.iot_components?.name || 'Item'}`).join(', ');
            } else if (tx.iot_transaction_items) {
              const singleItem: any = tx.iot_transaction_items;
              itemsStr = `${singleItem.quantity}x ${singleItem.iot_components?.name || 'Item'}`;
            }

            return {
              reservation_id: tx.id,
              status: tx.status === 'borrowed' ? 'CHECKED_OUT' : (tx.status === 'returned' ? 'COMPLETED' : 'OVERDUE'),
              created_at: tx.created_at,
              borrowed_at: tx.created_at,
              project_title: tx.project_title,
              request_mode: tx.type,
              components: {
                name: `IoT Kit (${itemsStr})`,
                department: 'IOT',
                lab_location: tx.session_time || 'Session',
                value_tier: 'STANDARD'
              },
              // Default/empty fields for IoT
              extension_requested: false,
              assignedAssetId: null,
              reservation_status_history: []
            };
          });
          mappedData = [...mappedData, ...mappedIot].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        setReservations(mappedData);

        // Auto-open letter if returning from checkout
        if (typeof window !== 'undefined' && window.location.search.includes('new=true') && mappedData.length > 0) {
          const firstRes = mappedData[0];
          if (firstRes.components?.department !== 'IOT') {
            const reqItems = mappedData
              .filter(r => (r.project_title || r.created_at) === (firstRes.project_title || firstRes.created_at))
              .map(r => ({ name: r.components?.name || 'Component', quantity: 1 }))
              .reduce((acc, curr) => {
                const existing = acc.find(item => item.name === curr.name);
                if (existing) existing.quantity += curr.quantity;
                else acc.push(curr);
                return acc;
              }, [] as any[]);

            const durationDays = firstRes.due_date ? getWorkingDaysCount(firstRes.created_at, firstRes.due_date) : 1;
            
            setInspectData({
              studentName: userData.name || 'Student',
              usn: userData.usn || '',
              studentDepartment: firstRes.student_department,
              section: firstRes.section,
              year: firstRes.branch,
              mobile: firstRes.mobile,
              department: firstRes.components?.department || 'EDL',
              items: reqItems,
              requestDate: firstRes.created_at,
              duration: durationDays,
              status: firstRes.status,
              teamMembers: firstRes.team_members,
              signatureUrl: firstRes.signature_url,
              projectTitle: firstRes.project_title,
              projectType: firstRes.project_type,
              projectPurpose: firstRes.project_description,
              hackathonDate: firstRes.hackathon_date,
              hackathonVenue: firstRes.hackathon_venue
            });
            setShowInspectModal(true);
            
            // Clean up URL without refreshing
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
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
      fetchReservations();
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
    const isIotGroup = group.some(r => r.components?.department === 'IOT');
    
    if (deptMode === 'HARDWARE' && isIotGroup) return false;
    if (deptMode === 'IOT' && !isIotGroup) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchProj = group[0].project_title?.toLowerCase().includes(q) || false;
      const matchComp = group.some(r => r.components?.name?.toLowerCase().includes(q) || r.reservation_id.toLowerCase().includes(q));
      if (!matchComp && !matchProj) return false;
    }

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

    if (isApproved) return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    if (isActive) return <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    if (isPending) return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    if (isRejected) return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    if (isReturned) return <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
    return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{displayText}</span>;
  };

  return (
    <div className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-700/30 overflow-x-hidden relative`}>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-300 relative">
          <div className="flex items-center gap-3">
            <img src="/vvce-logo.png" alt="VVCE Logo" className="h-8 w-auto object-contain shrink-0" />
            <div>
              <h1 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">My Reservations</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden sm:block">Track your hardware requests</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQRModal(true)}
              className="flex items-center justify-center w-8 h-8 bg-teal-50 border border-teal-200 rounded text-teal-700 hover:bg-teal-100 transition-colors shadow-sm shrink-0"
              title="Open Digital Pass"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button onClick={() => router.push('/student/dashboard')}
              className="flex items-center justify-center w-8 h-8 bg-white border border-slate-300 rounded text-slate-500 hover:text-teal-700 hover:border-teal-700 transition-colors shadow-sm shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Instructions Box */}
        <div className="mb-6 p-2 sm:p-3 bg-white border border-slate-300 rounded flex items-start gap-2 shadow-sm max-w-3xl">
          <div className="w-6 h-6 rounded bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div>
            <h4 className="text-slate-900 font-bold text-[10px] uppercase tracking-widest mb-0.5">Collection Instructions</h4>
            <p className="text-slate-600 text-[10px] leading-relaxed">
              After receiving admin approval, proceed to the lab. Carry your physical ID and show your Digital Pass (QR icon) to collect the component. <br/>
              <strong className="text-red-600">Note: This is strictly for borrowing lab components, not purchasing. All items must be returned on time.</strong>
            </p>
          </div>
        </div>

        {/* Tab Navigation & Filters */}
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="flex gap-2 bg-white p-1 border border-slate-300 shadow-sm w-fit rounded">
            <button
              onClick={() => setActiveTab('CURRENT')}
              className={`px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 rounded-sm ${activeTab === 'CURRENT' ? 'bg-slate-100 text-teal-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
            >
              <span>Active</span>
              <span className={`px-1.5 py-0.5 rounded-sm text-[9px] ${activeTab === 'CURRENT' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {currentGroups.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 rounded-sm ${activeTab === 'COMPLETED' ? 'bg-slate-100 text-teal-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
            >
              <span>Done</span>
              <span className={`px-1.5 py-0.5 rounded-sm text-[9px] ${activeTab === 'COMPLETED' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {completedGroups.length}
              </span>
            </button>
          </div>

          <div className="flex gap-2 bg-white p-1 border border-slate-300 shadow-sm w-fit rounded">
            <button
              onClick={() => setDeptMode('HARDWARE')}
              className={`px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 rounded-sm ${deptMode === 'HARDWARE' ? 'bg-slate-100 text-teal-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
            >
              Requested Hardware
            </button>
            <button
              onClick={() => setDeptMode('IOT')}
              className={`px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 rounded-sm ${deptMode === 'IOT' ? 'bg-slate-100 text-teal-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
            >
              M306/M302 Labs
            </button>
          </div>

          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative max-w-sm">
              <input
                type="text"
                placeholder="Search components or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs text-slate-900 pl-8 pr-3 py-1.5 focus:outline-none focus:border-teal-700 shadow-sm rounded transition-colors"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="bg-white border border-slate-300 text-[10px] font-bold text-slate-600 px-2 py-1.5 focus:outline-none focus:border-teal-700 cursor-pointer shadow-sm transition-colors rounded appearance-none"
            >
              <option value="ALL">ALL TIME</option>
              <option value="WEEK">THIS WEEK</option>
              <option value="MONTH_1">PAST 1 MONTH</option>
              <option value="MONTH_3">PAST 3 MONTHS</option>
              <option value="MONTH_6">PAST 6 MONTHS</option>
              <option value="MONTH_12">PAST YEAR</option>
            </select>
          </div>
        </div>

        {/* Loading Overlay */}
        <AnimatePresence>
          {uploading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-teal-700 rounded-full animate-spin mb-4"></div>
                <p className="text-teal-700 font-mono font-bold tracking-widest uppercase">Processing Request...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reservations Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-teal-700 rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Retrieving Request Data...</p>
          </div>
        ) : displayedGroups.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-white shadow-sm">
            <Package className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-mono uppercase tracking-widest text-xs font-bold">
              No {activeTab === 'CURRENT' ? 'active' : 'completed'} requests found.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedGroups.map((group, i) => {
              const firstRes = group[0];
              
              return (
              <motion.div
                key={firstRes.reservation_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.05 }}
                className="bg-white border border-slate-300 shadow-sm hover:shadow-md hover:border-teal-500 transition-all flex flex-col relative overflow-hidden group/card rounded-xl"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 group-hover/card:bg-teal-500 transition-colors" />
                <div className="p-5 flex-1 flex flex-col z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-md">
                         <FileText className="w-3.5 h-3.5 text-slate-600" />
                       </div>
                       <span className="text-slate-900 font-bold text-sm uppercase tracking-wide">{firstRes.project_title || 'Hardware Request'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold tracking-widest bg-slate-50 px-2 py-1 border border-slate-200 uppercase">{new Date(firstRes.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  {firstRes.due_date && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-rose-700 mb-4 bg-rose-50 px-2 py-1 border border-rose-200 w-fit uppercase">
                      <AlertCircle className="w-3 h-3" /> Due {new Date(firstRes.due_date).toLocaleDateString()}
                    </div>
                  )}

                  <details className="mt-1 group/res">
                    <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[10px] font-bold text-slate-500 hover:text-teal-700 uppercase tracking-widest mb-3 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-open/res:rotate-90" />
                      View {group.length} Component{group.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="flex flex-col gap-3">
                      {group.map(res => (
                         <div key={res.reservation_id} className="bg-slate-50 p-4 border border-slate-200 flex flex-col gap-3 rounded-lg">
                            <div className="flex justify-between items-start">
                               <div>
                                  <h4 className="text-sm font-bold text-slate-900 mb-1">{res.components?.name || 'Unknown'}</h4>
                                  <div className="flex flex-wrap gap-2">
                                     <span className="text-[10px] bg-white px-2 py-0.5 border border-slate-200 text-slate-600 font-mono font-bold uppercase tracking-widest">{res.components?.department}</span>
                                     {res.assignedAssetId && (
                                       <span className="text-[10px] bg-teal-50 px-2 py-0.5 border border-teal-200 text-teal-700 font-mono font-bold uppercase tracking-widest">ID: {res.assignedAssetId}</span>
                                     )}
                                  </div>
                               </div>
                               <div>{getStatusBadge(res.status)}</div>
                            </div>
                            
                            {(res.status === 'APPROVED' || res.status === 'PENDING_APPROVAL' || res.status === 'CHECKED_OUT' || res.status === 'READY_FOR_PICKUP') && (
                              <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-slate-200">
                                 {res.status === 'APPROVED' && (
                                    <>
                                       {res.components?.value_tier === 'LOW' ? (
                                         <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 border border-emerald-200 uppercase tracking-widest">Collect at Lab</span>
                                       ) : (
                                         <button onClick={() => handleCollectClick(res.reservation_id)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-widest transition-colors">Collect</button>
                                       )}
                                       <button onClick={() => handleWithdraw(res.reservation_id)} className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 text-[10px] font-bold uppercase tracking-widest transition-colors">Withdraw</button>
                                    </>
                                 )}
                                 {res.status === 'READY_FOR_PICKUP' && (
                                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 border border-emerald-200 uppercase tracking-widest">Ready at Admin Desk</span>
                                 )}
                                 {res.status === 'PENDING_APPROVAL' && (
                                    <button onClick={() => handleWithdraw(res.reservation_id)} className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 text-[10px] font-bold uppercase tracking-widest transition-colors">Withdraw</button>
                                 )}
                                 {res.status === 'CHECKED_OUT' && (
                                    <>
                                       {res.components?.department !== 'IOT' ? (
                                         <button onClick={() => handleReturnClick(res.reservation_id)} className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white border border-teal-800 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">Return Item</button>
                                       ) : (
                                         <span className="px-4 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold uppercase tracking-widest">Return at Admin Desk</span>
                                       )}
                                       
                                       {res.components?.department !== 'IOT' && (
                                         <>
                                           {!res.extension_requested ? (
                                              <button onClick={() => openExtensionModal(res.reservation_id)} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">Extend</button>
                                           ) : (
                                              <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-1 border border-slate-300 uppercase tracking-widest">Ext. {res.extension_status || 'Pending'}</span>
                                           )}
                                         </>
                                       )}
                                    </>
                                 )}
                              </div>
                            )}
                         </div>
                      ))}
                    </div>
                  </details>
                </div>

                <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
                  {firstRes.components?.department !== 'IOT' && (
                    <button
                      onClick={() => {
                        const durationDays = firstRes.due_date ? getWorkingDaysCount(firstRes.created_at, firstRes.due_date) : 1;
                        
                        const itemsMap: Record<string, number> = {};
                        group.forEach(g => {
                           const name = g.components?.name || 'Component';
                           itemsMap[name] = (itemsMap[name] || 0) + 1;
                        });
                        const reqItems = Object.entries(itemsMap).map(([name, qty]) => ({ name, quantity: qty }));

                        setInspectData({
                          studentName: studentName,
                          usn: studentUsn || '',
                          studentDepartment: firstRes.student_department,
                          section: firstRes.section,
                          year: firstRes.branch,
                          mobile: firstRes.mobile,
                          department: firstRes.components?.department || 'EDL',
                          items: reqItems,
                          requestDate: firstRes.created_at,
                          duration: durationDays,
                          status: group.every(g => g.status === firstRes.status) ? firstRes.status : 'MIXED',
                          teamMembers: firstRes.team_members,
                          signatureUrl: firstRes.signature_url,
                          projectTitle: firstRes.project_title,
                          projectType: firstRes.project_type,
                          projectPurpose: firstRes.project_description,
                          hackathonDate: firstRes.hackathon_date,
                          hackathonVenue: firstRes.hackathon_venue
                        });
                        setShowInspectModal(true);
                      }}
                      className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Letter
                    </button>
                  )}
                </div>
              </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Requisition Inspection Modal */}
      <AnimatePresence>
        {showInspectModal && inspectData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowInspectModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="relative bg-white p-2 w-full max-w-4xl mx-auto my-8 shadow-xl border border-slate-300">
              <button onClick={() => setShowInspectModal(false)} className="absolute -top-10 right-0 text-slate-600 hover:text-slate-900 bg-white p-1.5 border border-slate-300 shadow-sm">
                <X className="w-5 h-5" />
              </button>
              <div className="max-h-[85vh] overflow-y-auto">
                <RequisitionLetter {...inspectData} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Digital Pass QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setShowQRModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="relative bg-white p-8 shadow-xl border border-slate-300 flex flex-col items-center max-w-sm w-full">
              <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-teal-800 text-white flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className={`text-2xl font-black text-slate-900 mb-1 uppercase tracking-tight`}>DIGITAL PASS</h3>
              <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-8">Scan at Admin Desk</p>
              
              <div className="bg-white p-4 border-2 border-slate-900">
                <QRCode value={studentUsn || 'PENDING'} size={240} level="H" fgColor="#000000" bgColor="#ffffff" />
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200 w-full text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">USN</p>
                <p className="font-mono text-2xl font-bold text-teal-800">{studentUsn || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewModalOpen && previewImgUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4" onClick={() => setPreviewModalOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="relative bg-white p-2 max-w-2xl w-full shadow-xl border border-slate-300">
              <button onClick={() => setPreviewModalOpen(false)} className="absolute -top-10 right-0 text-slate-600 hover:text-slate-900 bg-white p-1.5 border border-slate-300 shadow-sm">
                <X className="w-5 h-5" />
              </button>
              <img src={previewImgUrl} alt="Proof" className="w-full object-contain max-h-[80vh]" />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {returnModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-300 p-8 max-w-sm w-full shadow-xl relative">
              <h3 className={`text-xl font-black text-slate-900 mb-2 uppercase`}>Return Component</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">Report condition & confirm return.</p>

              <div className="space-y-3 mb-8">
                <label className={`flex items-center gap-4 p-4 border cursor-pointer transition-all ${returnCondition === 'WORKING' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" value="WORKING" checked={returnCondition === 'WORKING'} onChange={() => setReturnCondition('WORKING')} className="text-emerald-600 w-4 h-4" />
                  <span className="text-emerald-800 font-bold text-xs uppercase tracking-widest">Working Perfectly</span>
                </label>
                <label className={`flex items-center gap-4 p-4 border cursor-pointer transition-all ${returnCondition === 'DAMAGED' ? 'border-rose-600 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" value="DAMAGED" checked={returnCondition === 'DAMAGED'} onChange={() => setReturnCondition('DAMAGED')} className="text-rose-600 w-4 h-4" />
                  <span className="text-rose-800 font-bold text-xs uppercase tracking-widest">Damaged</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm">Cancel</button>
                <button onClick={submitReturn}  className="flex-1 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm">Submit Return</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Extension Modal */}
      <AnimatePresence>
        {extensionModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-300 p-8 max-w-sm w-full shadow-xl relative">
              <h3 className={`text-xl font-black text-slate-900 mb-2 uppercase`}>Request Extension</h3>
              <div className="p-3 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-6">
                Note: Subject to Admin approval.
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Days Required</label>
                  <select 
                    value={extensionDays} 
                    onChange={(e) => setExtensionDays(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-300 text-slate-900 p-3 focus:border-teal-700 outline-none text-sm font-bold shadow-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Proper Reason</label>
                  <textarea 
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Why do you need more time?"
                    className="w-full bg-white border border-slate-300 text-slate-900 p-3 focus:border-teal-700 outline-none resize-none h-24 text-sm shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setExtensionModalOpen(false)} className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm">Cancel</button>
                <button 
                  onClick={submitExtensionRequest} 
                  disabled={!extensionReason.trim() || isSubmittingExtension} 
                  className="flex-1 py-3 bg-slate-900 hover:bg-black text-white font-bold disabled:opacity-50 transition-colors text-[10px] uppercase tracking-widest flex justify-center items-center shadow-sm"
                >
                  {isSubmittingExtension ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
