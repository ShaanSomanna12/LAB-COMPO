'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/Skeleton';
import QRCode from 'react-qr-code';

interface Reservation {
  reservation_id: number;
  status: string;
  created_at: string;
  due_date: string | null;
  project_title: string | null;
  geotag_image_url: string | null;
  latitude?: number;
  longitude?: number;
  components: {
    name: string;
    department: string;
    lab_location: string;
    value_tier?: string;
  };
}

export default function MyReservations() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentUsn, setStudentUsn] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');

  // Modal States
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedResId, setSelectedResId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnResId, setReturnResId] = useState<number | null>(null);
  const [returnCondition, setReturnCondition] = useState('WORKING');
  // Image preview modal state
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Get user's ID and USN from public.users
      const { data: userData } = await supabase
        .from('users')
        .select('user_id, usn')
        .eq('email', user.email)
        .maybeSingle();

      if (userData) {
        setUserId(userData.user_id);
        setStudentUsn(userData.usn);
        const { data: resData, error } = await supabase
          .from('reservations')
          .select(`
            reservation_id,
            status,
            created_at,
            due_date,
            project_title,
            geotag_image_url,
            latitude,
            longitude,
            components!inner(name, department, lab_location, value_tier)
          `)
          .eq('user_id', userData.user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReservations((resData as any[]) || []);
      }
    } catch (err: any) {
      console.error("Error fetching reservations:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollectClick = (resId: number) => {
    setSelectedResId(resId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const submitReturn = async () => {
    if (!returnResId) return;
    setUploading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: returnResId,
          status: 'PENDING_RETURN',
          returnCondition
        })
      });
      if (!res.ok) throw new Error("Failed to process return.");
      toast.success("Return request submitted. Waiting for admin confirmation!");
      fetchReservations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setReturnModalOpen(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedResId) return;

    setUploading(true);

    try {
      // 1. Get Geolocation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        }
      });

      const { latitude, longitude } = position.coords;

      // 2. Upload Image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedResId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reservations-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('reservations-images')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      // 3. Update Reservation via API
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedResId,
          status: 'PENDING_COLLECTION',
          geotag: {
            imageUrl,
            latitude,
            longitude
          }
        })
      });

      if (!res.ok) throw new Error("Failed to update reservation status.");

      toast.success("Collection proof uploaded. Waiting for admin confirmation!");

      // Refresh list
      fetchReservations();

    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      setSelectedResId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-orange-300 bg-orange-400/10 border-orange-400/30';
      case 'APPROVED': return 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30';
      case 'REJECTED': return 'text-rose-300 bg-rose-400/10 border-rose-400/30';
      case 'BORROWED': return 'text-cyan-300 bg-cyan-400/10 border-cyan-400/30';
      case 'PENDING_RETURN': return 'text-amber-300 bg-amber-400/10 border-amber-400/30';
      case 'RETURNED': return 'text-zinc-300 bg-zinc-400/10 border-zinc-400/30';
      case 'PENDING_COLLECTION': return 'text-purple-300 bg-purple-400/10 border-purple-400/30';
      default: return 'text-zinc-300 bg-zinc-400/10 border-zinc-400/30';
    }
  };

  // Group Reservations
  const currentStatuses = ['PENDING', 'APPROVED', 'BORROWED', 'PENDING_ADMIN', 'Ready for Collection', 'PENDING_RETURN', 'PENDING_COLLECTION'];
  const currentReservations = reservations.filter(r => currentStatuses.includes(r.status));
  const completedReservations = reservations.filter(r => !currentStatuses.includes(r.status));

  const displayedReservations = activeTab === 'CURRENT' ? currentReservations : completedReservations;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>

      {/* Hidden file input for camera/gallery */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-full max-w-5xl mx-auto relative z-10">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent tracking-tight mb-2">
              MY RESERVATIONS
            </h1>
            <p className="text-zinc-400 text-base font-medium tracking-wide">
              Track requests, collect items, and manage returns.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm text-zinc-300 bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800/50 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                Show Digital Pass at admin desk for collection.
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-300 bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800/50 w-fit">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                Carry your physical College ID card.
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-300 bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800/50 w-fit">
                <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                Geotagged proof required upon collection.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-end">
            <button 
                onClick={() => router.push('/student/dashboard')}
                disabled={!studentUsn}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black uppercase tracking-wider rounded-xl transition duration-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50 mr-3"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Back
            </button>
            <button 
                onClick={() => setShowQRModal(true)}
                disabled={!studentUsn}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black uppercase tracking-wider rounded-xl transition duration-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QR
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-zinc-900/40 p-1.5 rounded-2xl w-fit border border-zinc-800/50 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('CURRENT')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'CURRENT' 
                ? 'bg-zinc-800 text-white shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            Current Requests ({currentReservations.length})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'COMPLETED' 
                ? 'bg-zinc-800 text-white shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            Completed ({completedReservations.length})
          </button>
        </div>

        {/* Uploading Overlay */}
        <AnimatePresence>
          {uploading && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-emerald-400 font-mono font-bold tracking-widest uppercase animate-pulse">Processing...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reservations List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-56 rounded-2xl border border-zinc-800/50 bg-zinc-900/30" />
            ))}
          </div>
        ) : displayedReservations.length === 0 ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="py-24 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/50"
          >
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <p className="text-zinc-400 font-mono uppercase tracking-widest text-sm font-semibold">
              No {activeTab === 'CURRENT' ? 'active' : 'completed'} reservations.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {displayedReservations.map((res, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  key={res.reservation_id} 
                  className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 hover:border-emerald-500/30 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.05)] relative"
                >
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-5">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border ${getStatusStyle(res.status)} shadow-sm`}>
                        {res.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono font-medium">#{res.reservation_id}</span>
                      </div>
                    </div>

                    {/* Component Info */}
                    <h3 className="text-2xl font-black text-white leading-tight mb-2 tracking-tight">{res.components?.name}</h3>
                    <div className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-400 mb-6">
                      <span className="bg-zinc-800/50 px-2 py-1 rounded-md">{res.components?.department}</span>
                      <span className="bg-zinc-800/50 px-2 py-1 rounded-md">{res.components?.lab_location}</span>
                    </div>

                    <div className="mt-auto space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Requested
                        </span>
                        <span className="text-zinc-300 font-medium">{new Date(res.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                      </div>
                      {res.due_date && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-rose-400/80 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Due Date
                          </span>
                          <span className="text-rose-400 font-medium">{new Date(res.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                        </div>
                      )}
                      {res.project_title && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-800/50 mt-2">
                          <span className="text-cyan-400/80 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Project
                          </span>
                          <span className="text-cyan-400 font-medium truncate max-w-[150px]" title={res.project_title}>{res.project_title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer (Only showing actions for CURRENT tab) */}
                  {activeTab === 'CURRENT' ? (
                    <div className="bg-zinc-950/50 p-4 border-t border-zinc-800/50">
                      {res.status === 'APPROVED' ? (
                        res.components?.value_tier === 'LOW' ? (
                          <button
                            onClick={async () => {
                              try {
                                const resFetch = await fetch('/api/requests', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: res.reservation_id,
                                    status: 'BORROWED'
                                  })
                                });
                                if (!resFetch.ok) throw new Error("Failed to update reservation status.");
                                toast.success("Component successfully collected!");
                                fetchReservations();
                              } catch (err: any) {
                                toast.error(`Error: ${err.message}`);
                              }
                            }}
                            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Direct Approval - Collect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCollectClick(res.reservation_id)}
                            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Collect & Upload Proof
                          </button>
                        )
                      ) : (res.status === 'BORROWED') ? (
                        <div className="flex flex-col gap-2">
                          {res.geotag_image_url && (
                            <button onClick={() => { setPreviewImgUrl(res.geotag_image_url); setPreviewModalOpen(true); }} className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              View Collection Proof
                            </button>
                          )}
                          {res.latitude && res.longitude && (
                            <div className="text-xs text-cyan-400 mt-1">
                              Location: {res.latitude.toFixed(5)}, {res.longitude.toFixed(5)}
                            </div>
                          )}
                          {res.status === 'BORROWED' && (
                            <button
                              onClick={() => { setReturnResId(res.reservation_id); setReturnModalOpen(true); }}
                              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
                              Return Component
                            </button>
                          )}
                        </div>
                      ) : res.status === 'PENDING_COLLECTION' ? (
                        <div className="flex flex-col gap-2">
                          <div className="w-full py-3 bg-purple-500/5 text-purple-400 border border-purple-500/20 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2 cursor-wait">
                            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Awaiting Admin Confirmation
                          </div>
                          {res.geotag_image_url && (
                            <button 
                              onClick={() => { setPreviewImgUrl(res.geotag_image_url); setPreviewModalOpen(true); }} 
                              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              View Geotag Image
                            </button>
                          )}
                          {res.latitude && res.longitude && (
                            <div className="text-[10px] text-zinc-500 font-mono text-center">
                              Coordinates: {res.latitude.toFixed(5)}, {res.longitude.toFixed(5)}
                            </div>
                          )}
                        </div>
                      ) : res.status === 'PENDING_RETURN' ? (
                        <div className="w-full py-3 bg-amber-500/5 text-amber-500/80 border border-amber-500/20 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2 cursor-wait">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Awaiting Admin Confirmation
                        </div>
                      ) : (
                        <div className="w-full py-3 bg-zinc-900/50 text-zinc-600 border border-zinc-800/30 rounded-xl font-bold text-sm text-center cursor-not-allowed">
                          Awaiting Action
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-zinc-950/50 p-4 border-t border-zinc-800/50">
                      <div className="w-full py-3 bg-zinc-900/50 text-zinc-500 border border-zinc-800/30 rounded-xl font-bold text-sm text-center cursor-default">
                        {res.status === 'RETURNED' ? 'Successfully Returned' : res.status === 'REJECTED' ? 'Request Rejected' : 'Completed'}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Return Condition Modal */}
        <AnimatePresence>
          {returnModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl"
              >
                <h3 className="text-2xl font-black text-white mb-2">Return Condition</h3>
                <p className="text-sm text-zinc-400 mb-6">Please honestly report the current condition of the component.</p>
                
                <div className="space-y-3 mb-8">
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${returnCondition === 'WORKING' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 hover:bg-zinc-900'}`}>
                    <input type="radio" name="condition" value="WORKING" checked={returnCondition === 'WORKING'} onChange={() => setReturnCondition('WORKING')} className="text-emerald-500 focus:ring-emerald-500 w-4 h-4" />
                    <span className="text-emerald-400 font-bold text-sm">Working Perfectly</span>
                  </label>
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${returnCondition === 'DAMAGED' ? 'border-rose-500 bg-rose-500/10' : 'border-zinc-800 hover:bg-zinc-900'}`}>
                    <input type="radio" name="condition" value="DAMAGED" checked={returnCondition === 'DAMAGED'} onChange={() => setReturnCondition('DAMAGED')} className="text-rose-500 focus:ring-rose-500 w-4 h-4" />
                    <span className="text-rose-400 font-bold text-sm">Damaged / Not Working</span>
                  </label>
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${returnCondition === 'MISSING_PARTS' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 hover:bg-zinc-900'}`}>
                    <input type="radio" name="condition" value="MISSING_PARTS" checked={returnCondition === 'MISSING_PARTS'} onChange={() => setReturnCondition('MISSING_PARTS')} className="text-amber-500 focus:ring-amber-500 w-4 h-4" />
                    <span className="text-amber-400 font-bold text-sm">Missing Parts</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-3 rounded-xl text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 transition-colors font-bold text-sm">
                    Cancel
                  </button>
                  <button onClick={submitReturn} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black transition-colors text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    Submit Return
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
{/* Image Preview Modal */}
<AnimatePresence>
  {previewModalOpen && previewImgUrl && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={() => setPreviewModalOpen(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 p-6 rounded-2xl max-w-xl w-full shadow-[0_0_30px_rgba(16,185,129,0.4)]"
      >
        <button
          onClick={() => setPreviewModalOpen(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img src={previewImgUrl} alt="Collection Proof" className="w-full rounded" />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
{/* Image Preview Modal */}
<AnimatePresence>
  {previewModalOpen && previewImgUrl && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={() => setPreviewModalOpen(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 p-6 rounded-2xl max-w-xl w-full shadow-[0_0_30px_rgba(16,185,129,0.4)]"
      >
        <button
          onClick={() => setPreviewModalOpen(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img src={previewImgUrl} alt="Collection Proof" className="w-full rounded" />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

        {/* QR Code Digital Pass Modal */}
        <AnimatePresence>
          {showQRModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" 
              onClick={() => setShowQRModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white p-8 rounded-[2rem] max-w-sm w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col items-center text-center relative"
              >
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                
                <h3 className="text-3xl font-black text-black mb-1 tracking-tighter">DIGITAL PASS</h3>
                <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mb-8">Show this QR to Admin</p>
                
                <div className="bg-white p-5 border-4 border-dashed border-emerald-500/30 rounded-3xl mb-8 flex justify-center items-center">
                  {studentUsn && (
                    <QRCode 
                      value={studentUsn} 
                      size={200}
                      level="H"
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  )}
                </div>
                
                <div className="w-full bg-zinc-100 rounded-2xl p-5 border border-zinc-200 shadow-inner">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
                  <p className="text-2xl font-mono font-black text-black tracking-tight">{studentUsn}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
