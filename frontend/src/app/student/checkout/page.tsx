'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
}

const DEPARTMENTS = [
  { id: 'EDL', title: 'Engineering Dev. Lab', color: 'from-blue-600 to-indigo-600', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'ECE', title: 'Electronics & Comm.', color: 'from-purple-600 to-pink-600', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
  { id: 'EEE', title: 'Electrical Engineering', color: 'from-amber-500 to-orange-600', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'CIVIL', title: 'Civil Engineering', color: 'from-emerald-600 to-teal-600', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'MECH', title: 'Mechanical Engineering', color: 'from-red-600 to-rose-600', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
];

export default function StudentCheckout() {
  const router = useRouter();
  
  // Multi-step state
  const [step, setStep] = useState<'department' | 'components' | 'form'>('department');
  
  // Selection state
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [cart, setCart] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [studentName, setStudentName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [section, setSection] = useState('A');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [duration, setDuration] = useState(7);
  const [trustScore, setTrustScore] = useState(100);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch user details from Supabase
    const fetchUserDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, usn, trust_score')
          .eq('email', user.email)
          .maybeSingle();
          
        if (userData) {
          setUsn(userData.usn);
          setStudentName(userData.name);
          if (userData.trust_score !== undefined && userData.trust_score !== null) setTrustScore(userData.trust_score);
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
      return [...prev, item];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      setIsLoading(false);
      return;
    }

    try {
      const itemsPayload = cart.map(item => ({
        name: item.name,
        department: item.department,
        location: item.location || 'Main Lab'
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

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col p-4 md:p-8 font-sans selection:bg-cyan-500/30 pb-24">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>
      
      {/* Top Header */}
      <div className="w-full max-w-6xl mx-auto mb-8 relative z-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
            HARDWARE CHECKOUT
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mt-1">
            {step === 'department' && "Step 1: Select Department"}
            {step === 'components' && `Step 2: Catalog (${selectedDept})`}
            {step === 'form' && "Step 3: Requisition Details"}
          </p>
        </div>
        
        <button 
          onClick={() => {
            if (step === 'components') setStep('department');
            else if (step === 'form') setStep('components');
            else router.push('/student/dashboard');
          }}
          className="px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white uppercase font-mono text-xs font-bold"
        >
          {step === 'department' ? 'Back to Dashboard' : '← Go Back'}
        </button>
      </div>

      <div className="w-full max-w-6xl mx-auto relative z-10 flex-grow">
        
        {/* STEP 1: Department Selection */}
        {step === 'department' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
            {DEPARTMENTS.map(dept => (
              <div 
                key={dept.id}
                onClick={() => handleDeptSelect(dept.id)}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 hover:border-cyan-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${dept.color} opacity-0 group-hover:opacity-10 transition duration-500 z-0`}></div>
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white bg-gradient-to-br ${dept.color} shadow-lg shadow-black/50 group-hover:scale-110 transition-transform duration-300`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dept.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{dept.title}</h3>
                  <p className="text-zinc-500 font-mono text-xs mt-2 uppercase tracking-wider">{dept.id} Department Inventory</p>
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
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
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
                  className="w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 focus:border-cyan-500/50 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredInventory.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50">
                    <svg className="w-12 h-12 text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-zinc-400 font-mono uppercase tracking-widest text-sm">No components match your search</p>
                  </div>
                ) : (
                  filteredInventory.map(item => {
                    const inCart = cart.some(i => i.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => toggleCartItem(item)}
                        className={`relative bg-zinc-950/80 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col group ${
                          item.available > 0 
                            ? (inCart ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-zinc-800 hover:border-cyan-500/50 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)] cursor-pointer') 
                            : 'border-zinc-900 opacity-60 cursor-not-allowed grayscale'
                        }`}
                      >
                        <div className="h-40 bg-zinc-900 border-b border-zinc-800 relative overflow-hidden">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt={item.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-700" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">No Image</div>
                          )}
                          
                          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                            {item.available > 0 ? (
                              <span className="px-2 py-1 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold rounded shadow uppercase tracking-wider">
                                {item.available} in stock
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 items-end">
                                <span className="px-2 py-1 bg-rose-500/90 backdrop-blur-sm text-white text-[10px] font-bold rounded shadow uppercase tracking-wider">
                                  Out of stock
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); joinWaitlist(item); }} className="px-2 py-1 bg-zinc-800/90 hover:bg-zinc-700 backdrop-blur-sm text-cyan-400 border border-cyan-500/30 text-[10px] font-bold rounded shadow uppercase tracking-wider transition">
                                  Join Waitlist
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-4 flex flex-col flex-grow relative">
                          {inCart && (
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-1 shadow-lg shadow-emerald-500/50">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                          <h3 className="font-bold text-white text-lg leading-tight mb-1 pr-6">{item.name}</h3>
                          <p className="text-zinc-500 text-xs line-clamp-2 mt-2">{item.desc || 'No description provided'}</p>
                          
                          <div className="mt-auto pt-4 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">{item.location}</span>
                            {item.available > 0 && (
                              <div className={`text-xs font-bold uppercase ${inCart ? 'text-emerald-400' : 'text-cyan-400 opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                {inCart ? 'Remove' : 'Add to Cart'}
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
          <div className="w-full max-w-3xl mx-auto bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-cyan-950/50 to-indigo-950/50 p-6 border-b border-zinc-800 flex flex-col gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                {cart.length} Item{cart.length > 1 ? 's' : ''} in Cart
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="flex-shrink-0 bg-black/40 border border-zinc-800 rounded-lg p-2 flex items-center gap-3 pr-4">
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-900">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt="Item" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs">📷</div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-200 line-clamp-1 max-w-[120px]">{item.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase">{item.department}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Student Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Student Details</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                    <input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-white" placeholder="Please enter your name" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">USN</label>
                    <input required readOnly type="text" value={usn} onChange={e => setUsn(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all opacity-70 cursor-not-allowed" placeholder="e.g. 4VV25CS001" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Department</label>
                      <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 appearance-none">
                        <option value="CSE">1. CSE</option>
                        <option value="MECH">2. Mechanical</option>
                        <option value="ECE">3. ECE</option>
                        <option value="EEE">4. EEE</option>
                        <option value="CIVIL">5. CIVIL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Section</label>
                      <select value={section} onChange={e => setSection(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 appearance-none">
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
                  <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Requisition Details</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Date of Collection</label>
                      <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Time of Collection</label>
                      <select required value={time} onChange={e => setTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 appearance-none text-white">
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
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Duration (Days)</label>
                    <input required type="number" min="1" max="30" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                {trustScore < 50 && (
                  <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-red-400 text-sm font-bold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Checkout blocked. Your trust score ({trustScore}) is below 50. Please contact your HOD.
                  </div>
                )}
                {trustScore >= 150 && (
                  <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-bold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Trust Score ({trustScore}): High-value items will be auto-approved!
                  </div>
                )}
                
                {/* Liability Checkbox */}
                <div className="mb-6 flex items-start gap-3 bg-zinc-950/50 border border-zinc-800/80 p-4 rounded-xl">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      id="liability-checkbox"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-zinc-900"
                    />
                  </div>
                  <label htmlFor="liability-checkbox" className="text-sm text-zinc-400 leading-relaxed cursor-pointer select-none">
                    I agree to the <span className="text-cyan-400 font-bold">Lab Terms & Conditions</span> and accept full financial responsibility for any damages or loss of the requested equipment during my borrowing period.
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || trustScore < 50 || !agreedToTerms}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLoading ? 'Processing Request...' : `Confirm Reservation (${cart.length} Items)`}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Floating Cart Widget */}
      {step === 'components' && cart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 px-4">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-cyan-500/50 shadow-[0_10px_40px_rgba(6,182,212,0.3)] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center font-bold text-lg border border-cyan-500/30">
                {cart.length}
              </div>
              <div>
                <p className="text-white font-bold text-sm">Items Selected</p>
                <p className="text-zinc-400 text-xs font-mono uppercase">Ready to checkout</p>
              </div>
            </div>
            <button 
              onClick={() => setStep('form')}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-cyan-500/20"
            >
              Proceed →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
