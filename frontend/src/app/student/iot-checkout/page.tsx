'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Cpu, Clock, CheckCircle2, AlertTriangle, ArrowRight, Home, Trash2, Box } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Component = {
  id: string;
  name: string;
  description: string;
  available_quantity: number;
};

type CartItem = Component & { quantity: number };

const getTodayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export default function IotCheckout() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [labId, setLabId] = useState<1 | 2 | null>(null);
  const [checkoutType, setCheckoutType] = useState<'session' | 'project' | null>(null);
  
  const [sessionTime, setSessionTime] = useState<string>('');
  const [checkoutDate, setCheckoutDate] = useState<string>(getTodayLocal());
  const [teamMembers, setTeamMembers] = useState([{ name: '', usn: '' }, { name: '', usn: '' }]);
  const [teamSection, setTeamSection] = useState<string>('');

  const [components, setComponents] = useState<Component[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthorized(false);
        return;
      }
      const { data: userRecord } = await supabase
        .from('users')
        .select('department, branch')
        .eq('email', user.email)
        .maybeSingle();

      if (userRecord && userRecord.department === 'CSE' && userRecord.branch === '2nd Year') {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    };
    verifyAccess();
  }, []);

  useEffect(() => {
    const fetchComponents = async () => {
      if (!labId) return;
      const { data } = await supabase.from('iot_components').select('*').eq('lab_id', labId).order('name');
      if (data) setComponents(data);
    };
    fetchComponents();
  }, [labId]);

  const addToCart = (comp: Component) => {
    if (comp.available_quantity <= 0) {
      toast.error('Out of stock');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === comp.id);
      if (existing) {
        toast.error('Only 1 unit per component allowed in live sessions');
        return prev;
      }
      return [...prev, { ...comp, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (checkoutType === 'session' && !sessionTime) {
      toast.error('Please select a session time');
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: userRecord, error: userError } = await supabase.from('users').select('user_id').eq('email', userData.user.email).maybeSingle();
      if (userError) throw new Error(`Database error fetching user: ${userError.message}`);
      if (!userRecord) throw new Error(`User record not found for email: ${userData.user.email}`);

      const validMembers = teamMembers.filter(m => m.name.trim() || m.usn.trim());
      const teamString = validMembers.length > 0 ? validMembers.map(m => `${m.usn.toUpperCase()} - ${m.name}`).join(', ') + ` (Sec ${teamSection || 'N/A'})` : null;

      const formattedDate = new Date(checkoutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const fullSessionTime = `${formattedDate} | ${sessionTime}`;

      const loggedInUsn = userData.user.email?.split('@')[0].toUpperCase();
      let borrowerData: any = validMembers.find(m => m.usn.toUpperCase() === loggedInUsn) || validMembers[0];
      if (borrowerData) borrowerData = { ...borrowerData, section: teamSection };

      const response = await fetch('/api/iot-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: userRecord.user_id,
          labId,
          sessionTime: fullSessionTime,
          teamString,
          cart,
          borrowerData
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit checkout via API');
      }

      setStep(4);
      toast.success('Checkout successful!');
    } catch (err: any) {
      console.error('Checkout error raw:', err);
      console.error('Checkout error details:', err?.message, err?.details, err?.hint);
      toast.error(`Checkout Failed: ${err?.message || JSON.stringify(err) || 'Unknown Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredComponents = components.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-rose-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-3">Access Denied</h1>
        <p className="text-sm font-medium text-slate-600 mb-8 max-w-sm leading-relaxed">
          The IoT Lab checkout system is strictly restricted to <strong className="text-slate-800">2nd Year CSE (3rd Semester)</strong> students only.
        </p>
        <Link href="/student/dashboard" className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      <div className="max-w-md mx-auto relative pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-24 px-5">
        
        {/* Dynamic Title with Logo */}
        <div className="mb-8 text-center md:text-left flex flex-col md:flex-row items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <img src="/vvce-logo.png" alt="VVCE Logo" className="w-12 h-12 object-contain drop-shadow-sm" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-blue-950 mb-0.5">
              Quick Checkout
            </h1>
            <p className="text-blue-700/80 font-semibold text-xs">
              Borrow IoT components instantly. Please have your student ID ready.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Select Lab & Type */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              
              <Link href="/student/dashboard" className="flex items-center text-sm font-bold text-slate-400 hover:text-slate-600 mb-2">
                <ArrowRight className="w-4 h-4 mr-1 rotate-180" /> Back to Dashboard
              </Link>

              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Select Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[{id: 1, name: 'M306'}, {id: 2, name: 'M302'}].map(lab => (
                    <button key={lab.id} onClick={() => { setLabId(lab.id as 1 | 2); setCheckoutType('session'); setStep(2); }} 
                      className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-200 ${labId === lab.id ? 'bg-blue-50 border-blue-600 shadow-[0_4px_20px_-4px_rgba(37,99,235,0.2)]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${labId === lab.id ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Cpu className={`w-6 h-6 ${labId === lab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div className={`text-base font-bold ${labId === lab.id ? 'text-blue-900' : 'text-slate-700'}`}>M{lab.name.replace('M', '')}</div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Details */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              
              <button onClick={() => setStep(1)} className="flex items-center text-sm font-bold text-slate-400 hover:text-slate-600 mb-6">
                <ArrowRight className="w-4 h-4 mr-1 rotate-180" /> Back
              </button>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Select Lab Session</h2>
                  <input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} min={getTodayLocal()} max={getTodayLocal()} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-slate-50 font-medium outline-none focus:border-blue-500 cursor-not-allowed" title="Date is locked to today" />
                </div>
                <div className="space-y-3">
                  {['9:00 AM - 11:00 AM', '11:30 AM - 1:30 PM', '2:30 PM - 4:30 PM'].map(time => (
                    <label key={time} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${sessionTime === time ? 'bg-blue-50 border-blue-600' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <input type="radio" name="session" value={time} checked={sessionTime === time} onChange={(e) => setSessionTime(e.target.value)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                      <span className={`ml-3 text-sm font-medium ${sessionTime === time ? 'text-blue-900' : 'text-slate-600'}`}>{time}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Team Details (Required)</h2>
                  <div className="flex items-center gap-3">
                    <select value={teamSection} onChange={e => setTeamSection(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium cursor-pointer">
                      <option value="" disabled>Select Sec</option>
                      {['A','B','C','D','E','F','G','H','I','J','K','L'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{teamMembers.length} / 3</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {teamMembers.map((member, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <div className="flex-1 space-y-2">
                        <input type="text" placeholder={`Student ${index + 1} Name`} value={member.name} onChange={e => {
                          const newMembers = [...teamMembers];
                          newMembers[index].name = e.target.value;
                          setTeamMembers(newMembers);
                        }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium placeholder-slate-400" />
                        <input type="text" placeholder={`Student ${index + 1} USN`} value={member.usn} onChange={e => {
                          const newMembers = [...teamMembers];
                          newMembers[index].usn = e.target.value;
                          setTeamMembers(newMembers);
                        }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium placeholder-slate-400 uppercase" />
                      </div>
                      {index > 1 && (
                        <button onClick={() => setTeamMembers(teamMembers.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {teamMembers.length < 3 && (
                    <button onClick={() => setTeamMembers([...teamMembers, { name: '', usn: '' }])} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                      + Add another student
                    </button>
                  )}
                </div>
              </div>

              <button onClick={() => setStep(3)} disabled={!sessionTime || !teamSection || !teamMembers.every(m => m.name.trim() !== '' && m.usn.trim() !== '')} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-base shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center">
                Proceed to Hardware <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* STEP 3: Add Components */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setStep(2)} className="flex items-center text-sm font-bold text-slate-400 hover:text-slate-600">
                  <ArrowRight className="w-4 h-4 mr-1 rotate-180" /> Back
                </button>
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                  <ShoppingCart className="w-3 h-3" /> {cart.reduce((a,b)=>a+b.quantity, 0)} Items
                </div>
              </div>

              {/* Cart Preview */}
              {cart.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Your Hardware</h3>
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <div className="font-semibold text-sm text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 font-medium">Qty: 1 (Session Limit)</div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={handleCheckout} disabled={isSubmitting} className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center">
                    {isSubmitting ? 'Processing...' : 'Confirm Checkout'} <CheckCircle2 className="ml-2 w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Inventory Search */}
              <div className="relative">
                <div className="sticky top-0 z-20 bg-slate-50 pt-2 pb-3 -mx-5 px-5">
                  <input type="text" placeholder="Search inventory... (e.g. NodeMCU)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium" />
                </div>
                
                <div className="grid grid-cols-1 gap-3 pb-10">
                  {filteredComponents.map(comp => (
                    <div key={comp.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
                      <div className="flex-1 pr-4">
                        <div className="font-semibold text-slate-900 text-sm mb-1">{comp.name}</div>
                        <div className="text-xs text-slate-500 mb-2 line-clamp-1 leading-relaxed">{comp.description}</div>
                        <div className={`text-xs font-bold uppercase tracking-wider ${comp.available_quantity > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {comp.available_quantity > 0 ? `${comp.available_quantity} Available` : 'Out of Stock'}
                        </div>
                      </div>
                      <button onClick={() => addToCart(comp)} disabled={comp.available_quantity <= 0 || cart.some(i => i.id === comp.id)} 
                        className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center disabled:opacity-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors text-slate-400 shrink-0">
                        {cart.some(i => i.id === comp.id) ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <ShoppingCart className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                  {filteredComponents.length === 0 && (
                    <div className="text-center py-10 text-slate-400 font-medium">No components found</div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* STEP 4: Success */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Checkout Confirmed!</h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Your hardware request has been registered. Please collect your components from the lab admin.
              </p>
              <Link href="/student/dashboard" className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-semibold transition-all text-base">
                Return to Dashboard
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
