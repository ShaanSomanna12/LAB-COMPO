'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '@/config/site';
import RequisitionLetter from '@/components/RequisitionLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import QRCode from 'react-qr-code';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { Clock, CheckCircle2, AlertCircle, Package, ArrowLeft, ArrowRight, Eye, Camera, MapPin, QrCode, FileText, ChevronRight, X, User, Microchip } from 'lucide-react';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

interface Reservation {
  reservation_id: string;
  status: string;
  created_at: string;
  due_date: string | null;
  project_title: string | null;
  geotag_image_url: string | null;
  after_img_url?: string | null;
  latitude?: number;
  longitude?: number;
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
}

export default function MyReservations() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentUsn, setStudentUsn] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  
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
  const [uploadedReturnProof, setUploadedReturnProof] = useState<{ imageUrl: string; latitude: number; longitude: number } | null>(null);

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
            geotag_image_url,
            after_img_url,
            latitude,
            longitude,
            borrowed_at,
            components(name, department, lab_location, value_tier),
            assigned_serial_numbers,
            reservation_status_history(new_status, changed_at)
          `)
          .eq('user_id', userData.user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const mappedData = resData?.map((r: any) => ({
          ...r,
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

  useEffect(() => {
    const resolveAddresses = async () => {
      let cachedAddrs: Record<string, string> = {};
      try {
        const stored = localStorage.getItem('geotag_address_cache');
        if (stored) cachedAddrs = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse address cache:", e);
      }

      const newAddresses = { ...addresses, ...cachedAddrs };
      let changed = false;

      const reservationsToResolve = reservations.filter(res => {
        if (!res.latitude || !res.longitude) return false;
        const cacheKey = `${res.latitude},${res.longitude}`;
        if (newAddresses[cacheKey]) return false;
        return true;
      });

      if (reservationsToResolve.length === 0) {
        const totalKeys = Object.keys(newAddresses).length;
        const currentKeys = Object.keys(addresses).length;
        if (totalKeys !== currentKeys) {
          setAddresses(newAddresses);
        }
        return;
      }

      const fetchPromises = reservationsToResolve.map(async (res) => {
        const lat = res.latitude!;
        const lon = res.longitude!;
        const cacheKey = `${lat},${lon}`;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'User-Agent': 'Phoenix-Lab-Portal/1.0' } }
          );
          if (response.ok) {
            const data = await response.json();
            let shortAddr = '';
            if (data.address) {
              const a = data.address;
              const parts = [];
              const place = a.amenity || a.building || a.office || a.shop || a.tourism || '';
              if (place) parts.push(place);
              const road = a.road || a.pedestrian || a.highway || '';
              if (road) parts.push(road);
              const area = a.suburb || a.neighbourhood || a.quarter || a.residential || a.city_district || a.village || a.subdistrict || '';
              if (area && !parts.some(p => p.toLowerCase().includes(area.toLowerCase()))) parts.push(area);
              const city = a.city || a.town || a.county || '';
              if (city && !parts.some(p => p.toLowerCase().includes(city.toLowerCase()))) parts.push(city);

              if (parts.length > 0) {
                shortAddr = parts.join(', ');
              } else {
                shortAddr = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
              }
            } else {
              shortAddr = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            }
            return { key: cacheKey, value: shortAddr };
          }
        } catch (err) {
          console.error("Geocoding error:", err);
        }
        return { key: cacheKey, value: `Location (${lat.toFixed(5)}, ${lon.toFixed(5)})` };
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(res => {
        if (res && !newAddresses[res.key]) {
          newAddresses[res.key] = res.value;
          changed = true;
        }
      });

      if (changed) {
        setAddresses(newAddresses);
        try {
          localStorage.setItem('geotag_address_cache', JSON.stringify(newAddresses));
        } catch (e) {
          console.error("Failed to save address cache:", e);
        }
      }
    };

    if (reservations.length > 0) {
      resolveAddresses();
    }
  }, [reservations]);

  const getAddress = (lat?: number, lon?: number) => {
    if (!lat || !lon) return '';
    const key = `${lat},${lon}`;
    return addresses[key] || `Resolving location... (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  };

  const handleCollectClick = (resId: string) => {
    setSelectedResId(resId);
    setUploadType('COLLECT');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReturnClick = (resId: string) => {
    setReturnResId(resId);
    setUploadedReturnProof(null);
    setUploadType(null);
    setReturnCondition('WORKING');
    setReturnModalOpen(true);
  };

  const submitReturn = async () => {
    if (!returnResId) return;
    if (!uploadedReturnProof) {
      toast.error("Please capture and upload return proof geotag image first.");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: returnResId,
          status: 'RETURN_REQUESTED',
          returnCondition,
          geotag: uploadedReturnProof
        })
      });
      if (!res.ok) throw new Error("Failed to process return.");
      toast.success("Return request submitted with geotag proof.");
      fetchReservations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setReturnModalOpen(false);
      setUploadedReturnProof(null);
      setReturnResId(null);
    }
  };

  const compressImage = (file: File, maxDimension: number = 600, quality: number = 0.70): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context could not be created'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('Failed to load image resource'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadType === 'RETURN' ? returnResId : selectedResId;
    if (!file || !targetId) return;

    setUploading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
        else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });

      const { latitude, longitude } = position.coords;
      let fileToUpload: Blob = file;
      try { fileToUpload = await compressImage(file, 600, 0.70); } catch (e) { console.warn(e); }

      const fileName = `${targetId}_${uploadType === 'RETURN' ? 'return' : 'collect'}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('reservations-images').upload(fileName, fileToUpload, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('reservations-images').getPublicUrl(fileName);
      const imageUrl = publicUrlData.publicUrl;

      if (uploadType === 'RETURN') {
        setUploadedReturnProof({ imageUrl, latitude, longitude });
        toast.success("Return proof image captured successfully!");
      } else {
        const res = await fetch('/api/requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId, status: 'READY_FOR_PICKUP', geotag: { imageUrl, latitude, longitude } })
        });
        if (!res.ok) throw new Error("Failed to update reservation status.");
        toast.success("Collection proof uploaded. Waiting for admin confirmation!");
        fetchReservations();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      if (uploadType !== 'RETURN') setSelectedResId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this request?')) return;
    
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'CANCELLED' })
      });
      if (!res.ok) throw new Error('Failed to withdraw request');
      toast.success('Request withdrawn successfully');
      fetchReservations();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }
  };

  const currentStatuses = ['PENDING_APPROVAL', 'APPROVED', 'READY_FOR_PICKUP', 'CHECKED_OUT', 'RETURN_REQUESTED'];
  
  const filteredReservations = reservations.filter(r => {
    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchComp = r.components?.name?.toLowerCase().includes(q) || false;
      const matchId = r.reservation_id.toLowerCase().includes(q);
      const matchProj = r.project_title?.toLowerCase().includes(q) || false;
      if (!matchComp && !matchId && !matchProj) return false;
    }

    // Date Filter
    if (dateFilter !== 'ALL') {
      const reqDate = new Date(r.created_at);
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

  const currentReservations = filteredReservations.filter(r => currentStatuses.includes(r.status));
  const completedReservations = filteredReservations.filter(r => !currentStatuses.includes(r.status));
  const displayedReservations = activeTab === 'CURRENT' ? currentReservations : completedReservations;

  // Render Status Badge Function
  const getStatusBadge = (status: string) => {
    let displayText = status;
    if (status === 'PENDING_APPROVAL') displayText = 'AWAITING APPROVAL';
    else if (status === 'READY_FOR_PICKUP') displayText = 'READY FOR PICKUP';
    else if (status === 'CHECKED_OUT') displayText = 'BORROWED';
    else if (status === 'RETURN_REQUESTED') displayText = 'RETURN IN PROGRESS';

    const isApproved = status === 'APPROVED' || status === 'READY_FOR_PICKUP';
    const isActive = status === 'CHECKED_OUT';
    const isPending = status === 'PENDING_APPROVAL' || status === 'RETURN_REQUESTED';
    const isRejected = status === 'REJECTED' || status === 'CANCELLED';
    const isReturned = status === 'RETURNED' || status === 'COMPLETED';

    if (isApproved) return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">{displayText}</span>;
    if (isActive) return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.2)]">{displayText}</span>;
    if (isPending) return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.2)]">{displayText}</span>;
    if (isRejected) return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{displayText}</span>;
    if (isReturned) return <span className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{displayText}</span>;
    return <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{displayText}</span>;
  };

  const renderTimeline = (res: any) => {
    // The history is in res.reservation_status_history as an array of { new_status, changed_at }
    const history = res.reservation_status_history || [];
    
    // Helper to get timestamp for a specific status
    const getTimestamp = (status: string) => {
      const entry = history.find((h: any) => h.new_status === status);
      if (entry) {
        return new Date(entry.changed_at).toLocaleString('en-US', {
          day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
        });
      }
      return null;
    };

    // Define standard timeline sequence based on tracking type / normal flow
    const steps = [
      { key: 'SUBMITTED', label: 'Request Submitted', overrideStatus: 'PENDING_APPROVAL', isVirtual: true, time: new Date(res.created_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) },
      { key: 'PENDING_APPROVAL', label: 'Awaiting Admin Approval', subLabel: 'Action required by Admin', time: getTimestamp('PENDING_APPROVAL') },
      { key: 'APPROVED', label: 'Approved', time: getTimestamp('APPROVED') },
      { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', time: getTimestamp('READY_FOR_PICKUP') },
      { key: 'CHECKED_OUT', label: 'Checked Out', time: getTimestamp('CHECKED_OUT') },
      { key: 'RETURN_REQUESTED', label: 'Return Requested', time: getTimestamp('RETURN_REQUESTED') },
      { key: 'RETURNED', label: 'Returned', time: getTimestamp('RETURNED') },
      { key: 'COMPLETED', label: 'Completed', time: getTimestamp('COMPLETED') }
    ];

    // Filter out steps that don't apply to the current request's lifecycle
    // E.g. if it jumps straight to APPROVED, hide PENDING_APPROVAL if it was never in that state (unless it's currently APPROVED)
    
    // Determine the current step index based on the actual current status
    let currentStatus = res.status;
    if (currentStatus === 'RETURNED') currentStatus = 'COMPLETED'; // Sometimes we group these
    
    const currentIndex = steps.findIndex(s => s.key === currentStatus);
    
    // Handle Rejected/Cancelled
    if (currentStatus === 'REJECTED') return (
      <div className="flex flex-col gap-1 my-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
        <span className="text-rose-400 text-sm font-bold flex items-center gap-2"><X className="w-4 h-4"/> Request Rejected</span>
        <span className="text-rose-500/70 text-xs font-mono">{getTimestamp('REJECTED')}</span>
      </div>
    );
    if (currentStatus === 'CANCELLED') return (
      <div className="flex flex-col gap-1 my-4 p-3 bg-zinc-800 border border-zinc-700 rounded-xl">
        <span className="text-zinc-400 text-sm font-bold flex items-center gap-2"><X className="w-4 h-4"/> Request Cancelled</span>
        <span className="text-zinc-500 text-xs font-mono">{getTimestamp('CANCELLED')}</span>
      </div>
    );

    // Build the vertical timeline
    // We only show steps up to the current state, plus one or two future states for context
    const visibleSteps = steps.filter((step, idx) => {
       if (idx <= (currentIndex === -1 ? 1 : currentIndex + 1)) return true;
       // Always show Checked out as a future step if we are before it
       if (step.key === 'CHECKED_OUT' && (currentIndex === -1 ? 1 : currentIndex) < steps.findIndex(s => s.key === 'CHECKED_OUT')) return true;
       return false;
    });

    return (
      <div className="flex flex-col gap-0 my-2 relative">
        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-zinc-800" />
        
        {visibleSteps.map((step, idx) => {
          const isCompleted = step.time && step.key !== currentStatus; // It has a time and we've moved past it, OR it's the virtual first step
          const isCurrent = step.key === currentStatus;
          const isFuture = !isCompleted && !isCurrent;
          
          // Special case for first virtual step
          const actuallyCompleted = isCompleted || step.isVirtual;

          return (
            <div key={step.key} className="flex items-start gap-4 py-3 relative">
              <div className="bg-black/40 relative z-10 py-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                  actuallyCompleted ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                  isCurrent ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' :
                  'border-zinc-700 bg-zinc-900 text-transparent'
                }`}>
                  {actuallyCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />}
                </div>
              </div>
              <div className="flex flex-col pt-1">
                <span className={`text-sm tracking-wide ${
                  actuallyCompleted ? 'text-zinc-300 font-medium' :
                  isCurrent ? 'text-cyan-400 font-bold' :
                  'text-zinc-600'
                }`}>
                  {step.label}
                </span>
                {step.subLabel && isCurrent && (
                  <span className="text-xs text-amber-500/80 font-mono mt-0.5">{step.subLabel}</span>
                )}
                {step.time && (
                  <span className="text-xs text-zinc-500 font-mono mt-0.5">{step.time}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getActionMessage = (res: Reservation) => {
    switch (res.status) {
      case 'PENDING_APPROVAL': return "Your request is waiting for administrator approval.";
      case 'APPROVED': return "Your request has been approved. Please follow instructions to pick up your component.";
      case 'READY_FOR_PICKUP': return "Your hardware is ready for pickup.";
      case 'CHECKED_OUT': {
        if (!res.due_date) return "Your hardware is currently borrowed.";
        const daysLeft = Math.ceil((new Date(res.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return "This hardware is overdue! Please return it as soon as possible.";
        if (daysLeft <= 3) return "Your hardware is due soon.";
        return "Your hardware is currently borrowed.";
      }
      case 'RETURN_REQUESTED': return "Your return has been submitted and is awaiting verification.";
      case 'COMPLETED':
      case 'RETURNED': return "This request has been successfully completed.";
      case 'REJECTED': return "This request was rejected.";
      case 'CANCELLED': return "This request was cancelled.";
      default: return "Awaiting action.";
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col items-center justify-start pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-12 px-4 font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
        
        {/* Dynamic Background */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020617] to-[#020617] pointer-events-none" />
        <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <ParticleNetwork />

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

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
                  {currentReservations.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('COMPLETED')}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'COMPLETED' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {activeTab === 'COMPLETED' && <motion.div layoutId="tab-bg" className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl" />}
                <span className="relative z-10">Completed</span>
                <span className={`relative z-10 px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {completedReservations.length}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-3xl border border-white/5 bg-white/5" />)}
            </div>
          ) : displayedReservations.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl bg-black/40 backdrop-blur-sm">
              <Package className="w-16 h-16 text-zinc-600 mb-6" />
              <p className="text-zinc-400 font-mono uppercase tracking-widest text-sm font-bold">
                No {activeTab === 'CURRENT' ? 'active' : 'completed'} requests found.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayedReservations.map((res, i) => (
                  <motion.div
                    key={res.reservation_id}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] group relative"
                  >
                    <div className="p-6 md:p-8 flex-1 flex flex-col z-10">
                      <div className="flex justify-between items-start mb-6">
                        {getStatusBadge(res.status)}
                        <span className="text-xs text-zinc-500 font-mono bg-white/5 px-2 py-1 rounded-md border border-white/10">#{res.reservation_id.toString().slice(0, 8)}</span>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]">
                          <Microchip className="w-6 h-6 text-zinc-300" />
                        </div>
                        <div>
                          <h3 className={`${spaceGrotesk.className} text-2xl font-bold text-white leading-tight`}>{res.components?.name || 'Unknown'}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-medium text-zinc-400 mt-1">
                            <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{res.components?.department}</span>
                            <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{res.components?.lab_location}</span>
                            {res.assignedAssetId && (
                               <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">ID: {res.assignedAssetId}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 pt-4 border-t border-white/5">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Request Date</span>
                          <span className="text-zinc-300 font-medium">{new Date(res.created_at).toLocaleDateString()}</span>
                        </div>
                        {res.due_date && (
                          <div className="flex justify-between text-sm">
                            <span className="text-rose-400/80 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Due Date</span>
                            <span className="text-rose-400 font-bold">{new Date(res.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {res.project_title && (
                          <div className="flex justify-between text-sm">
                            <span className="text-cyan-400/80 flex items-center gap-2"><FileText className="w-4 h-4" /> Project</span>
                            <span className="text-cyan-300 font-medium truncate max-w-[150px]">{res.project_title}</span>
                          </div>
                        )}

                        <div className="pt-3 mt-3 border-t border-white/5">
                          {renderTimeline(res)}
                        </div>

                        {res.latitude && res.longitude && (
                          <div className="pt-3 mt-3 border-t border-white/5">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-emerald-400/80 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                <MapPin className="w-3.5 h-3.5" /> Proof Geotag
                              </span>
                              <button onClick={() => { setPreviewImgUrl(res.status.includes('RETURN') ? (res.after_img_url || null) : res.geotag_image_url); setPreviewModalOpen(true); }} className="text-emerald-400 hover:text-emerald-300 font-bold text-xs underline">
                                View Photo
                              </button>
                            </div>
                            <p className="text-[10px] text-zinc-500 bg-white/5 p-2 rounded-lg leading-relaxed font-mono">
                              {getAddress(res.latitude, res.longitude)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 p-4 md:p-6 border-t border-white/10 flex flex-col gap-3 relative z-10">
                      <button
                        onClick={() => {
                          const diffTime = res.due_date ? Math.abs(new Date(res.due_date).getTime() - new Date(res.created_at).getTime()) : 0;
                          setInspectData({
                            studentName: studentName,
                            usn: studentUsn || '',
                            department: res.components?.department || 'EDL',
                            items: [{ name: res.components?.name || 'Component', quantity: 1 }],
                            requestDate: res.created_at,
                            duration: Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))),
                            status: res.status
                          });
                          setShowInspectModal(true);
                        }}
                        className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <Eye className="w-4 h-4" /> Inspect Letter
                      </button>

                      {activeTab === 'CURRENT' && (
                        <div className="flex flex-col gap-2">
                          <div className="w-full p-3 bg-white/5 text-zinc-300 rounded-xl text-xs font-medium text-center mb-2 border border-white/10">
                            {getActionMessage(res)}
                          </div>
                          
                          {res.status === 'APPROVED' && (
                            <>
                              {res.components?.value_tier === 'LOW' ? (
                                <div className="w-full p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-medium text-center">
                                  Show Digital Pass at the desk to complete checkout.
                                </div>
                              ) : (
                                <button onClick={() => handleCollectClick(res.reservation_id)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                  <Camera className="w-5 h-5" /> Collect & Geotag
                                </button>
                              )}
                              <button onClick={() => handleWithdraw(res.reservation_id)} className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                                Withdraw Request
                              </button>
                            </>
                          )}
                          
                          {res.status === 'READY_FOR_PICKUP' && (
                            <div className="w-full p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-medium text-center">
                              Please collect your item from the Admin desk. Show your Digital Pass.
                            </div>
                          )}

                          {res.status === 'CHECKED_OUT' && (
                            <button onClick={() => handleReturnClick(res.reservation_id)} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                              Return Component
                            </button>
                          )}

                          {res.status === 'PENDING_APPROVAL' && (
                            <button onClick={() => handleWithdraw(res.reservation_id)} className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold text-sm transition-colors flex justify-center items-center gap-2">
                              Withdraw Request
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
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
              <img src={previewImgUrl} alt="Geotag Proof" className="w-full rounded-xl object-contain max-h-[80vh]" />
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
                {uploadedReturnProof ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Proof Captured</span>
                  </div>
                ) : (
                  <button onClick={() => { setUploadType('RETURN'); if (fileInputRef.current) fileInputRef.current.click(); }} className="w-full py-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                    <Camera className="w-5 h-5" /> Take Return Photo
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors">Cancel</button>
                <button onClick={submitReturn} disabled={!uploadedReturnProof} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black disabled:opacity-50 transition-all text-sm">Submit</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
