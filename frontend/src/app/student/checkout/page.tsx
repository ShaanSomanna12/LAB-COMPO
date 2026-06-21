'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Space_Grotesk } from 'next/font/google';
import ParticleNetwork from '@/components/ui/ParticleNetwork';
import { siteConfig } from '@/config/site';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

interface InventoryItem {
  id: string | number;
  name: string;
  available: number;
  total: number;
  department: string;
  status: string;
  photo_url?: string;
  desc?: string;
  location?: string;
  value_tier?: string;
}

interface CartItem extends InventoryItem {
  requestedQty: number;
}

const DEPARTMENTS = [
  { id: 'EDL', title: 'Engineering Development LAB', desc: 'Core components, microcontrollers, and embedded systems.', color: 'from-blue-600 to-indigo-600', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'ECE', title: 'Electronics & Comm.', desc: 'Communication modules, signal processing tools, and RF.', color: 'from-purple-600 to-pink-600', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
  { id: 'EEE', title: 'Electrical Engineering', desc: 'High-voltage testing tools, multimeters, and analyzers.', color: 'from-amber-500 to-orange-600', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'CIVIL', title: 'Civil Engineering', desc: 'Surveying tools, structural testing, and building models.', color: 'from-emerald-600 to-teal-600', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'MECH', title: 'Mechanical Engineering', desc: 'Motors, actuators, robotics chassis, and physical tools.', color: 'from-red-600 to-rose-600', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
];

export default function StudentCheckout() {
  const router = useRouter();
  
  // Multi-step state
  const [step, setStep] = useState<'department' | 'components' | 'form'>('department');
  
  // Selection state
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [studentName, setStudentName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [section, setSection] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [duration, setDuration] = useState<number | ''>('');
  const [trustScore, setTrustScore] = useState(100);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [minDate, setMinDate] = useState('');
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    // Fetch user details from Supabase
    const fetchUserDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, usn, trust_score, department, section')
          .eq('email', user.email)
          .maybeSingle();
          
        if (userData) {
          if (userData.usn) setUsn(userData.usn);
          if (userData.name) setStudentName(userData.name);
          if (userData.department) setDepartment(userData.department);
          if (userData.section) setSection(userData.section);
          if (userData.trust_score !== undefined && userData.trust_score !== null) setTrustScore(userData.trust_score);
          if (userData.department) {
             const res = await fetch(`/api/notices?department=${userData.department}`);
             const noticesData = await res.json();
             if (Array.isArray(noticesData)) setNotices(noticesData);
          }
        }
      }
    };
    fetchUserDetails();

    // Fetch inventory
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        setInventory(data);
      })
      .catch(err => console.error("Failed to load inventory", err));

    setMinDate(new Date().toLocaleDateString('en-CA'));
  }, []);

  const handleDeptSelect = (deptId: string) => {
    setSelectedDept(deptId);
    setStep('components');
  };

  const toggleCartItem = (item: InventoryItem) => {
    if (item.available <= 0) return;
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, { ...item, requestedQty: 1 }];
    });
  };

  const updateCartItemQty = (id: string | number, newQty: number, item: CartItem) => {
    const isLowTier = item.value_tier === 'LOW';
    const maxQty = isLowTier ? Math.min(3, item.available) : item.available;
    
    if (newQty < 1) newQty = 1;
    if (newQty > maxQty) newQty = maxQty;

    setCart(prev => prev.map(i => i.id === id ? { ...i, requestedQty: newQty } : i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      setIsLoading(false);
      return;
    }
    
    if (!duration || duration < 1) {
      toast.error('Please specify a valid borrowing duration');
      setIsLoading(false);
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    if (!date || date < todayStr) {
      toast.error('Please select a valid future date for collection');
      setIsLoading(false);
      return;
    }

    try {
      const itemsPayload = cart.map(item => ({
        name: item.name,
        department: item.department,
        location: item.location || 'Main Lab',
        quantity: item.requestedQty
      }));

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          usn,
          studentDepartment: department,
          section,
          date,
          time,
          duration,
          items: itemsPayload
        })
      });

      if (!res.ok) throw new Error('Failed to submit checkout request');
      
      toast.success('Checkout request submitted successfully!');
      setCart([]);
      setTimeout(() => router.push('/student/dashboard'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const joinWaitlist = async (item: InventoryItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const { data: userData } = await supabase.from('users').select('user_id').eq('email', user.email).single();
      
      const { error } = await supabase.from('waitlists').insert([{
        user_id: userData?.user_id,
        component_id: item.id
      }]);
      
      if (error) throw error;
      toast.success(`Joined waitlist for ${item.name}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join waitlist');
    }
  };

  const getDeptItemCount = (deptId: string) => {
    return inventory.filter(i => i.department === deptId).length;
  };

  const getValueTierBadge = (tier?: string) => {
    switch (tier) {
      case 'LOW':
        return (
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
            Auto Approve
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1 h-1 rounded-full bg-orange-400"></span>
            Admin Approval
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1 h-1 rounded-full bg-rose-400 animate-pulse"></span>
            HOD Approval
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-zinc-100 flex flex-col p-4 md:p-8 font-sans selection:bg-cyan-500/30 pb-24 relative overflow-hidden">
      {/* Base Deep Radial Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_#1e1b4b_0%,_#020617_100%)] z-0"></div>

      {/* 3D Particle Network Background */}
      <ParticleNetwork />

      {/* Wrapper content */}
      <div className="w-full max-w-6xl mx-auto relative z-10 flex-grow flex flex-col">
        
        {/* Top Header */}
        <div className="w-full mb-8 flex justify-between items-center relative">
          <div>
            <h1 className={`${spaceGrotesk.className} text-3xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight`}>
              HARDWARE DASHBOARD
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              {step === 'department' && "Step 1: Select Department Inventory"}
              {step === 'components' && `Step 2: Catalog Selection (${selectedDept})`}
              {step === 'form' && "Step 3: Submit Requisition Form"}
            </p>
          </div>
          
          <button 
            onClick={() => {
              if (step === 'components') setStep('department');
              else if (step === 'form') setStep('components');
              else router.push('/student/dashboard');
            }}
            className="px-5 py-2.5 bg-slate-950/40 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all text-zinc-400 hover:text-white uppercase font-mono text-xs font-bold tracking-wider"
          >
            {step === 'department' ? 'Back to Dashboard' : '← Go Back'}
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full max-w-2xl mx-auto mb-12 relative">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-slate-800 -translate-y-1/2 z-0"></div>
            <div 
              className="absolute left-0 top-1/2 h-[2px] bg-gradient-to-r from-cyan-500 to-indigo-500 -translate-y-1/2 z-0 transition-all duration-500"
              style={{
                width: step === 'department' ? '0%' : step === 'components' ? '50%' : '100%'
              }}
            ></div>

            {/* Step 1 */}
            <div className="flex flex-col items-center z-10">
              <div 
                onClick={() => setStep('department')}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 cursor-pointer transition-all duration-300 ${
                  step === 'department'
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                    : 'bg-slate-950 text-zinc-400 border-slate-700 hover:border-cyan-500/50'
                }`}
              >
                1
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wider mt-2 font-bold ${step === 'department' ? 'text-cyan-400' : 'text-zinc-500'}`}>Department</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center z-10">
              <div 
                onClick={() => {
                  if (selectedDept) setStep('components');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 cursor-pointer transition-all duration-300 ${
                  step === 'components'
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                    : step === 'form'
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : 'bg-slate-950 text-zinc-400 border-slate-700 cursor-not-allowed'
                }`}
              >
                2
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wider mt-2 font-bold ${step === 'components' ? 'text-cyan-400' : step === 'form' ? 'text-indigo-400' : 'text-zinc-500'}`}>Catalog</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center z-10">
              <div 
                onClick={() => {
                  if (cart.length > 0) setStep('form');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${
                  step === 'form'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]'
                    : 'bg-slate-950 text-zinc-400 border-slate-700 cursor-not-allowed'
                }`}
              >
                3
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wider mt-2 font-bold ${step === 'form' ? 'text-cyan-400' : 'text-zinc-500'}`}>Checkout</span>
            </div>
          </div>
        </div>
        
        {/* Active Notices Banner */}
        {notices.length > 0 && (
          <div className="mb-8 space-y-3 relative z-20 animate-in fade-in slide-in-from-top-8 duration-700">
            {notices.map(notice => (
              <div key={notice.id} className={`p-4 rounded-2xl border flex items-start gap-4 shadow-2xl backdrop-blur-md ${notice.type === 'alert' ? 'bg-red-500/10 border-red-500/30 text-red-100' : notice.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100'}`}>
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${notice.type === 'alert' ? 'bg-red-500/20 text-red-400' : notice.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-wide uppercase mb-1 flex items-center gap-2">
                    {notice.type === 'alert' ? 'Critical Alert' : notice.type === 'warning' ? 'Lab Warning' : 'Lab Announcement'}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/30">{notice.admin_dept} Admin</span>
                  </h4>
                  <p className="text-sm font-medium opacity-90 leading-relaxed">{notice.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: Department Selection */}
        {step === 'department' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
            {DEPARTMENTS.map(dept => (
              <div 
                key={dept.id}
                onClick={() => handleDeptSelect(dept.id)}
                className="group relative bg-slate-950/40 backdrop-blur-xl border border-slate-850 hover:border-cyan-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-500 overflow-hidden hover:-translate-y-1.5 hover:shadow-[0_0_30px_rgba(6,182,212,0.12)] flex flex-col justify-between min-h-[220px]"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${dept.color} opacity-0 group-hover:opacity-[0.06] transition duration-500 z-0`}></div>
                
                <div className="relative z-10 flex-grow">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white bg-gradient-to-br ${dept.color} shadow-lg shadow-black/50 group-hover:scale-105 transition-transform duration-300 border border-white/5`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dept.icon} />
                    </svg>
                  </div>
                  <h3 className={`${spaceGrotesk.className} text-xl font-bold text-white tracking-tight`}>{dept.title}</h3>
                  <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">{dept.desc}</p>
                </div>

                <div className="relative z-10 pt-4 mt-4 border-t border-slate-900/60 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-900/40">
                    {getDeptItemCount(dept.id)} components present
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest group-hover:text-cyan-400 transition-colors">Select →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: Component Catalog */}
        {step === 'components' && (() => {
          const filteredInventory = inventory
            .filter(i => i.department === selectedDept)
            .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.desc && i.desc.toLowerCase().includes(searchQuery.toLowerCase())))
            .sort((a, b) => a.name.localeCompare(b.name));

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
              {/* Search Bar */}
              <div className="relative max-w-xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder={`Search ${selectedDept} components...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 backdrop-blur-xl border border-slate-800 focus:border-cyan-500/50 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredInventory.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                    <svg className="w-12 h-12 text-zinc-700 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-zinc-500 font-mono uppercase tracking-widest text-xs">No matching hardware cataloged</p>
                  </div>
                ) : (
                  filteredInventory.map(item => {
                    const inCart = cart.some(i => i.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => toggleCartItem(item)}
                        className={`relative bg-slate-950/40 border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col group backdrop-blur-md ${
                          item.available > 0 
                            ? (inCart ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] bg-slate-950/65' : 'border-slate-850 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(6,182,212,0.08)] cursor-pointer') 
                            : 'border-slate-900 opacity-50 cursor-not-allowed grayscale'
                        }`}
                      >
                        {/* Selected overlay checkmark */}
                        {inCart && (
                          <div className="absolute inset-0 bg-emerald-950/15 backdrop-blur-[0.5px] z-10 flex items-center justify-center animate-in fade-in duration-200">
                            <div className="bg-emerald-500 text-black rounded-full p-2.5 shadow-lg shadow-emerald-500/50 scale-110">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          </div>
                        )}

                        <div className="h-44 bg-slate-950 border-b border-slate-850 relative overflow-hidden flex items-center justify-center p-4">
                          <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
                          {item.photo_url ? (
                            <img src={item.photo_url} alt={item.name} className="max-w-full max-h-full object-contain group-hover:scale-102 transition-transform duration-700" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-mono">NO COMPONENT PHOTO</div>
                          )}
                          
                          <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5 z-20">
                            {item.available > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                {item.available} Available
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 items-end">
                                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                  Out of Stock
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); joinWaitlist(item); }} 
                                  className="px-2 py-0.5 bg-zinc-900/80 hover:bg-zinc-800 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold rounded uppercase tracking-wider transition z-30"
                                >
                                  Join Waitlist
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="absolute bottom-2 left-2 z-20">
                            {getValueTierBadge(item.value_tier)}
                          </div>
                        </div>
                        
                        <div className="p-4 flex flex-col flex-grow">
                          <h3 className="font-bold text-white text-base leading-tight line-clamp-1">{item.name}</h3>
                          <p className="text-zinc-500 text-[11px] line-clamp-2 mt-2 leading-relaxed flex-grow">{item.desc || 'No item specifications provided.'}</p>
                          
                          <div className="pt-3 mt-3 border-t border-slate-900 flex items-center justify-between">
                            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">{item.location}</span>
                            {item.available > 0 && (
                              <div className={`text-[10px] font-bold uppercase tracking-wider ${inCart ? 'text-emerald-400' : 'text-cyan-400 opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                {inCart ? 'Remove' : 'Select'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* STEP 3: Checkout Form */}
        {step === 'form' && cart.length > 0 && (
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Form Section (Left) */}
            <div className="lg:col-span-2 bg-slate-950/40 backdrop-blur-xl border border-slate-850 rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-gradient-to-r from-cyan-950/20 to-indigo-950/20 p-6 border-b border-slate-850">
                  <h2 className={`${spaceGrotesk.className} text-xl font-bold text-white flex items-center gap-2 tracking-wide`}>
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    REQUISITION FORM
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Student Info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-slate-900 pb-2 mb-4">Student Details</h3>
                      
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
                        <input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 transition-all text-white font-medium" placeholder="Please enter your name" />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">USN</label>
                        <input required readOnly type="text" value={usn} onChange={e => setUsn(e.target.value.toUpperCase())} className="w-full bg-slate-900/40 border border-slate-850 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none opacity-60 cursor-not-allowed text-zinc-400" placeholder="e.g. 4VV25CS001" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Department</label>
                          <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 appearance-none text-white font-medium">
                            <option value="CSE">1. CSE</option>
                            <option value="MECH">2. Mechanical</option>
                            <option value="ECE">3. ECE</option>
                            <option value="EEE">4. EEE</option>
                            <option value="CIVIL">5. CIVIL</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Section</label>
                          <select required value={section} onChange={e => setSection(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 appearance-none text-white font-medium">
                            <option value="" disabled>Select Section</option>
                            <option value="A">Section A</option>
                            <option value="B">Section B</option>
                            <option value="C">Section C</option>
                            <option value="D">Section D</option>
                            <option value="E">Section E</option>
                            <option value="F">Section F</option>
                            <option value="G">Section G</option>
                            <option value="H">Section H</option>
                            <option value="I">Section I</option>
                            <option value="J">Section J</option>
                            <option value="K">Section K</option>
                            <option value="L">Section L</option>
                            <option value="M">Section M</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Request Info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-slate-900 pb-2 mb-4">Requisition Details</h3>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Collection Date</label>
                          <input required type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 [color-scheme:dark] text-white font-medium" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Collection Time</label>
                          <select required value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 appearance-none text-white font-medium">
                            <option value="09:00">09:00 AM</option>
                            <option value="09:30">09:30 AM</option>
                            <option value="10:00">10:00 AM</option>
                            <option value="10:30">10:30 AM</option>
                            <option value="11:00">11:00 AM</option>
                            <option value="11:30">11:30 AM</option>
                            <option value="12:00">12:00 PM</option>
                            <option value="12:30">12:30 PM</option>
                            <option value="13:00">01:00 PM</option>
                            <option value="13:30">01:30 PM</option>
                            <option value="14:00">02:00 PM</option>
                            <option value="14:30">02:30 PM</option>
                            <option value="15:00">03:00 PM</option>
                            <option value="15:30">03:30 PM</option>
                            <option value="16:00">04:00 PM</option>
                            <option value="16:30">04:30 PM</option>
                            <option value="17:00">05:00 PM</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Borrow Duration (Days)</label>
                        <input required type="number" min="1" max="30" placeholder="e.g. 7" value={duration === '' ? '' : duration} onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 text-white font-medium" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-900">
                    {trustScore < 50 && (
                      <div className="mb-4 p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Checkout Blocked: Your trust score ({trustScore}) is too low (minimum required is 50). Please contact HOD.
                      </div>
                    )}
                    {trustScore >= 150 && (
                      <div className="mb-4 p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Trust Benefit: High trust score ({trustScore}) grants you auto-approval status!
                      </div>
                    )}

                    {(!usn || !studentName) && (
                      <div className="mb-4 p-4 bg-orange-950/20 border border-orange-500/30 rounded-xl flex flex-col gap-3">
                        <div className="flex items-start gap-2 text-orange-400 text-sm font-bold">
                          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Incomplete Profile!
                        </div>
                        <p className="text-zinc-400 text-xs leading-relaxed">You must fill in your Name and USN in your profile options before requesting hardware checkout permissions.</p>
                        <button 
                          type="button"
                          onClick={() => router.push('/student/profile')}
                          className="w-full py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold transition"
                        >
                          Configure Profile
                        </button>
                      </div>
                    )}
                    
                    {/* Liability Checkbox */}
                    <div className="mb-6 flex items-start gap-3 bg-slate-900/10 border border-slate-900 p-4 rounded-xl">
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          id="liability-checkbox"
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-zinc-900 cursor-pointer"
                        />
                      </div>
                      <label htmlFor="liability-checkbox" className="text-xs text-zinc-400 leading-relaxed cursor-pointer select-none">
                        I hereby agree to the <span className="text-cyan-400 font-bold">Lab Policy & Borrowing Regulations</span> and accept full liability for returning these items in working condition or paying for appropriate replacements.
                      </label>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 md:p-8 bg-slate-900/10 border-t border-slate-850">
                <button 
                  onClick={handleSubmit}
                  disabled={isLoading || trustScore < 50 || !agreedToTerms || !usn || !studentName}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(6,182,212,0.25)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm uppercase tracking-wider font-semibold"
                >
                  {isLoading ? 'Submitting Request...' : `Confirm Reservation (${cart.length} Items)`}
                </button>
              </div>
            </div>

            {/* Cart Section (Right) */}
            <div className="lg:col-span-1 bg-slate-950/40 backdrop-blur-xl border border-slate-850 rounded-2xl shadow-2xl overflow-hidden h-fit sticky top-24">
              <div className="bg-gradient-to-r from-indigo-950/20 to-purple-950/20 p-5 border-b border-slate-850">
                <h2 className={`${spaceGrotesk.className} text-lg font-bold text-white flex items-center gap-2 tracking-wide`}>
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  CHECKOUT LIST ({cart.length})
                </h2>
              </div>
              <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="bg-slate-950/65 border border-slate-850 rounded-xl p-3.5 flex flex-col gap-3 hover:border-slate-700 transition">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-850 shrink-0 flex items-center justify-center p-1">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt="Item" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">📷</div>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold text-zinc-200 truncate">{item.name}</p>
                        <div className="flex justify-between items-center mt-1.5 gap-2">
                          <span className="px-1.5 py-0.5 bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 text-[8px] font-mono font-bold rounded uppercase">
                            {item.department}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Stock: {item.available}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/40 rounded-lg p-1 border border-slate-850/80">
                      <button 
                        type="button" 
                        onClick={() => updateCartItemQty(item.id, item.requestedQty - 1, item)} 
                        className="w-8 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono text-cyan-400 font-bold px-2">{item.requestedQty}</span>
                      <button 
                        type="button" 
                        onClick={() => updateCartItemQty(item.id, item.requestedQty + 1, item)} 
                        className="w-8 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Floating Cart Widget */}
      {step === 'components' && cart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 px-4">
          <div className="bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 shadow-[0_10px_35px_rgba(6,182,212,0.25)] rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center font-black text-base border border-cyan-500/20">
                {cart.length}
              </div>
              <div>
                <p className="text-white font-bold text-xs">Items Selected</p>
                <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-wider">Ready for details</p>
              </div>
            </div>
            <button 
              onClick={() => setStep('form')}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-cyan-500/10 flex items-center gap-1 uppercase tracking-wider"
            >
              Proceed →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
