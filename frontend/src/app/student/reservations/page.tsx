'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/Skeleton';
import QRCode from 'react-qr-code';

interface Reservation {
  reservation_id: number;
  status: string;
  created_at: string;
  due_date: string | null;
  project_title: string | null;
  geotag_image_url: string | null;
  components: {
    name: string;
    department: string;
    lab_location: string;
  };
}

export default function MyReservations() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentUsn, setStudentUsn] = useState<string | null>(null);

  // Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedResId, setSelectedResId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnResId, setReturnResId] = useState<number | null>(null);
  const [returnCondition, setReturnCondition] = useState('WORKING');

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
            components!inner(name, department, lab_location)
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
          status: 'RETURNED',
          returnCondition
        })
      });
      if (!res.ok) throw new Error("Failed to process return.");
      toast.success("Component returned and condition logged!");
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
          status: 'BORROWED',
          geotag: {
            imageUrl,
            latitude,
            longitude
          }
        })
      });

      if (!res.ok) throw new Error("Failed to update reservation status.");

      toast.success("Component successfully collected!");

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'APPROVED': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'REJECTED': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'BORROWED': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      case 'RETURNED': return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

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
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent tracking-tight">
              MY RESERVATIONS
            </h1>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mt-1">
              Track requests and collect items
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/student/dashboard')}
              className="px-4 py-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white uppercase font-mono text-xs font-bold h-full"
            >
              ← Go Back
            </button>

            <button 
              onClick={() => setShowQRModal(true)}
              disabled={!studentUsn}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black uppercase tracking-wider rounded-xl transition duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Show Digital Pass
            </button>
          </div>
        </div>

        {/* Uploading Overlay */}
        {uploading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-emerald-400 font-mono font-bold tracking-widest uppercase">Uploading Proof & Geotag...</p>
            </div>
          </div>
        )}

        {/* Reservations List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48 rounded-2xl border border-zinc-800" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50">
            <p className="text-zinc-400 font-mono uppercase tracking-widest text-sm">No reservations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reservations.map((res, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                key={res.reservation_id} 
                className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 hover:border-emerald-500/30 rounded-2xl overflow-hidden transition-all duration-300 group"
              >
                <div className="p-5 flex flex-col h-full">

                  {/* Status Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${getStatusColor(res.status)}`}>
                      {res.status}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">#{res.reservation_id}</span>
                  </div>

                  {/* Component Info */}
                  <h3 className="text-xl font-bold text-white leading-tight mb-1">{res.components?.name}</h3>
                  <p className="text-sm text-zinc-400 font-mono uppercase">{res.components?.department} • {res.components?.lab_location}</p>

                  <div className="mt-4 text-xs text-zinc-500 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Requested on: {new Date(res.created_at).toLocaleDateString()}
                    </div>
                    {res.due_date && (
                      <div className="flex items-center gap-2 text-rose-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Due: {new Date(res.due_date).toLocaleDateString()}
                      </div>
                    )}
                    {res.project_title && (
                      <div className="flex items-center gap-2 text-cyan-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Project: {res.project_title}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="mt-auto pt-6">
                    {res.status === 'APPROVED' ? (
                      <button
                        onClick={() => handleCollectClick(res.reservation_id)}
                        className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Collect & Upload Proof
                      </button>
                    ) : res.status === 'BORROWED' ? (
                      <div className="flex flex-col gap-2">
                        {res.geotag_image_url && (
                          <a href={res.geotag_image_url} target="_blank" rel="noreferrer" className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            View Collection Proof
                          </a>
                        )}
                        <button
                          onClick={() => { setReturnResId(res.reservation_id); setReturnModalOpen(true); }}
                          className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          Return Component
                        </button>
                      </div>
                    ) : (
                      <div className="w-full py-3 bg-zinc-900/50 text-zinc-500 border border-zinc-800/50 rounded-xl font-bold text-sm text-center opacity-50 cursor-not-allowed">
                        Awaiting Action
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Return Condition Modal */}
        {returnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-4">Return Condition</h3>
              <p className="text-sm text-zinc-400 mb-4">Please report the current condition of the component.</p>
              
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900">
                  <input type="radio" name="condition" value="WORKING" checked={returnCondition === 'WORKING'} onChange={() => setReturnCondition('WORKING')} className="text-cyan-500 focus:ring-cyan-500" />
                  <span className="text-emerald-400 font-bold text-sm">Working Perfectly</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900">
                  <input type="radio" name="condition" value="DAMAGED" checked={returnCondition === 'DAMAGED'} onChange={() => setReturnCondition('DAMAGED')} className="text-cyan-500 focus:ring-cyan-500" />
                  <span className="text-rose-400 font-bold text-sm">Damaged / Not Working</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900">
                  <input type="radio" name="condition" value="MISSING_PARTS" checked={returnCondition === 'MISSING_PARTS'} onChange={() => setReturnCondition('MISSING_PARTS')} className="text-cyan-500 focus:ring-cyan-500" />
                  <span className="text-amber-400 font-bold text-sm">Missing Parts</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-2 rounded-xl text-zinc-400 hover:text-white border border-zinc-800 transition-colors">
                  Cancel
                </button>
                <button onClick={submitReturn} className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors">
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* QR Code Digital Pass Modal */}
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowQRModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col items-center text-center relative"
            >
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-black transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <h3 className="text-2xl font-black text-black mb-1 uppercase tracking-tighter">Digital Pass</h3>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-8">Scan at Admin Desk</p>
              
              <div className="bg-white p-4 border-4 border-dashed border-emerald-500/30 rounded-2xl mb-8">
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
              
              <div className="w-full bg-zinc-100 rounded-xl p-4 border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Student USN</p>
                <p className="text-xl font-mono font-black text-black">{studentUsn}</p>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
