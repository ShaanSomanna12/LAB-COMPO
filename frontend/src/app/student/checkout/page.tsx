'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Inter } from 'next/font/google';
import { siteConfig } from '@/config/site';
import RequisitionLetter from '@/components/RequisitionLetter';
import { isWorkingDay, getWorkingDaysCount } from '@/lib/dateValidator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ArrowLeft, Search, Plus, Minus, Trash2, X,
  Calendar, Clock, AlertCircle, Upload, CheckCircle2, ShieldCheck, User, Zap, Box, Info,
  Cpu, Radio, Building2, Wrench
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

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
  { id: 'EDL', title: 'Eng. Development LAB (InUnity)', desc: 'Core components, microcontrollers, and embedded systems.', icon: Cpu, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-indigo-500/20' },
  { id: 'ECE', title: 'Electronics & Comm.', desc: 'Communication modules, signal processing tools, and RF.', icon: Radio, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-teal-500/20' },
  { id: 'EEE', title: 'Electrical Engineering', desc: 'High-voltage testing tools, multimeters, and analyzers.', icon: Zap, color: 'from-amber-400 to-orange-500', shadow: 'shadow-orange-500/20' },
  { id: 'CIVIL', title: 'Civil Engineering', desc: 'Surveying tools, structural testing, and building models.', icon: Building2, color: 'from-stone-500 to-stone-700', shadow: 'shadow-stone-500/20' },
  { id: 'MECH', title: 'Mechanical Engineering', desc: 'Motors, actuators, robotics chassis, and physical tools.', icon: Wrench, color: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/20' }
];

export default function StudentCheckout() {
  const router = useRouter();
  
  // Steps
  const [step, setStep] = useState<'department' | 'components' | 'form'>('department');
  
  // Selections
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [studentName, setStudentName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [returnDate, setReturnDate] = useState('');
  const [mobile, setMobile] = useState('');
  const [year, setYear] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToUndertaking, setAgreedToUndertaking] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  
  const [projectType, setProjectType] = useState('Course Assignment / Lab Work');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [hackathonCollege, setHackathonCollege] = useState('');
  const [hackathonVenueStr, setHackathonVenueStr] = useState('');
  const [hackathonDate, setHackathonDate] = useState('');
  const [studentIdCardUrl, setStudentIdCardUrl] = useState('');
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [hasVerifiedProfileId, setHasVerifiedProfileId] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
      
      const { data: userData } = await supabase
        .from('users')
        .select('name, usn, department, branch, section, mobile, id_card_url')
        .eq('email', user.email)
        .maybeSingle();

      if (userData) {
        setStudentName(userData.name || '');
        setUsn(userData.usn || '');
        setDepartment(userData.department || '');
        setYear(userData.branch || '');
        setSection(userData.section || '');
        setMobile(userData.mobile || '');
        
        // Prioritize DB id_card_url, fallback to local storage
        if (userData.id_card_url) {
          setStudentIdCardUrl(userData.id_card_url);
          setHasVerifiedProfileId(true);
        } else if (userData.usn) {
          const cachedIdUrl = localStorage.getItem('id_card_' + userData.usn.toUpperCase());
          if (cachedIdUrl) {
            setStudentIdCardUrl(cachedIdUrl);
            setHasVerifiedProfileId(true);
          }
        }
      }
    };

    fetchUserDetails();
    
    // Min date calculation
    const today = new Date();
    today.setDate(today.getDate() + 1);
    while(today.getDay() === 0) {
      today.setDate(today.getDate() + 1);
    }
    const todayStr = today.toISOString().split('T')[0];
    setMinDate(todayStr);
    setDate(todayStr);

    const maxD = new Date(today);
    maxD.setDate(maxD.getDate() + 30);
    setMaxDate(maxD.toISOString().split('T')[0]);
  }, [router]);

  useEffect(() => {
    if (date) {
      const start = new Date(date);
      const currentReturn = returnDate ? new Date(returnDate) : null;
      if (!currentReturn || currentReturn <= start) {
        start.setDate(start.getDate() + 7); // Provide a 7-day default, but don't force it
        setReturnDate(start.toISOString().split('T')[0]);
      }
    }
  }, [date]);

  const loadInventory = async (deptId: string) => {
    setIsLoadingInventory(true);
    setStep('components');
    setSelectedDept(deptId);
    
    try {
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .eq('department', deptId)
        .order('name');
        
      if (error) throw error;
      
      const mappedData = data.map((item: any) => ({
        id: item.component_id,
        name: item.name,
        available: item.available_quantity,
        total: item.total_quantity,
        department: item.department,
        status: item.available_quantity > 0 ? 'Available' : 'Under Repair',
        photo_url: item.photo_url,
        desc: item.base_condition,
        location: item.lab_location,
        value_tier: item.value_tier,
      }));
      
      setInventory(mappedData);
    } catch (err: any) {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleAddToCart = (item: InventoryItem) => {
    if (item.available <= 0) return toast.error('Item out of stock');
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (existing.requestedQty >= item.available) {
          toast.error(`Only ${item.available} available`);
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, requestedQty: i.requestedQty + 1 } : i);
      }
      return [...prev, { ...item, requestedQty: 1 }];
    });
    toast.success(`Added ${item.name}`);
  };

  const handleRemoveFromCart = (id: string | number) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateQty = (id: string | number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.requestedQty + delta;
        if (newQty < 1) return i;
        if (newQty > i.available) {
          toast.error(`Only ${i.available} available`);
          return i;
        }
        return { ...i, requestedQty: newQty };
      }
      return i;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !usn || !department || !date || !time) return toast.error("Missing required fields");
    if (!hasVerifiedProfileId && !idCardFile && !studentIdCardUrl) return toast.error("Please upload your ID Card");
    if (cart.length === 0) return toast.error("Cart is empty");
    if (!agreedToTerms) return toast.error("You must agree to the Terms & Conditions");
    if (!agreedToUndertaking) return toast.error("You must agree to the undertaking");
    if (agreedToUndertaking && !signatureFile) return toast.error("Please upload your signature for the undertaking");
    
    if (projectType === 'Hackathon / Competition') {
      if (!hackathonCollege || !hackathonVenueStr || !hackathonDate) {
        return toast.error("Please fill all Hackathon details (College, Venue, Date)");
      }
    }

    if (!isWorkingDay(date)) return toast.error('Pickup date must be a working day (Mon-Sat)');

    setIsLoading(true);

    try {
      let finalIdCardUrl = studentIdCardUrl;
      
      // Upload new ID card if provided and not already verified
      if (idCardFile && !hasVerifiedProfileId) {
        const filePath = `student-ids/${usn}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from('id_cards').upload(filePath, idCardFile);
        if (uploadError) throw new Error(`Failed to upload ID Card: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage.from('id_cards').getPublicUrl(filePath);
        finalIdCardUrl = publicUrlData.publicUrl;
      }

      let finalSignatureUrl = null;
      if (signatureFile) {
        const sigPath = `signatures/${usn}-${Date.now()}.png`;
        const { error: sigUploadError } = await supabase.storage.from('id_cards').upload(sigPath, signatureFile);
        if (sigUploadError) throw new Error(`Failed to upload Signature: ${sigUploadError.message}`);
        const { data: sigUrlData } = supabase.storage.from('id_cards').getPublicUrl(sigPath);
        finalSignatureUrl = sigUrlData.publicUrl;
      }

      // Check max value limit
      let highValueCount = 0;
      cart.forEach(item => {
        if (item.value_tier === 'HIGH' || item.value_tier === 'CRITICAL') {
          highValueCount += item.requestedQty;
        }
      });
      const needsHodApproval = highValueCount > 2;
      const initialStatus = needsHodApproval ? 'PENDING_HOD' : 'PENDING_APPROVAL';

      // Insert Reservation
      const { data: resData, error: resError } = await supabase.from('reservations').insert([{
        student_name: studentName,
        usn: usn.toUpperCase(),
        department,
        branch: year,
        section,
        mobile,
        target_department: selectedDept,
        request_date: date,
        time_slot: time,
        duration: getWorkingDaysCount(date, returnDate),
        status: initialStatus,
        id_card_url: finalIdCardUrl,
        signature_url: finalSignatureUrl,
        project_title: projectTitle || projectType,
        project_description: projectPurpose,
        project_type: projectType,
        hackathon_date: projectType === 'Hackathon / Competition' ? hackathonDate : null,
        hackathon_venue: projectType === 'Hackathon / Competition' ? `${hackathonCollege} - ${hackathonVenueStr}` : null,
        is_team_project: false
      }]).select().single();

      if (resError) throw resError;

      // Insert Items
      const itemsToInsert = cart.map(item => ({
        reservation_id: resData.id,
        component_id: item.id,
        quantity: item.requestedQty
      }));
      
      const { error: itemsError } = await supabase.from('reservation_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      toast.success("Request Submitted Successfully!");
      router.push('/student/dashboard');
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Submission failed');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-none px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors";
  const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest";

  const transitionProps: any = { type: 'tween', ease: 'easeOut', duration: 0.15 };

  return (
    <div className={`${inter.className} min-h-screen selection:bg-teal-700/30 text-slate-900 bg-slate-50 relative overflow-x-hidden`}>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-12">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-slate-300 relative">
          <div className="flex items-center gap-3">
            <img src="/vvce-logo.png" alt="VVCE Logo" className="h-8 w-auto object-contain shrink-0" />
            <div>
              <h1 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">Hardware Request</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden sm:block">Select components for your project</p>
            </div>
          </div>
          <button onClick={() => step === 'department' ? router.push('/student/dashboard') : setStep(step === 'form' ? 'components' : 'department')}
            className="flex items-center justify-center w-8 h-8 bg-white border border-slate-300 rounded text-slate-500 hover:text-teal-700 hover:border-teal-700 transition-colors shadow-sm shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="hidden sm:flex items-center gap-2 mt-8">
            <div className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-[10px] ${step === 'department' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'}`}>1</div>
            <div className={`w-8 h-0.5 ${step === 'components' || step === 'form' ? 'bg-teal-700' : 'bg-slate-200'}`} />
            <div className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-[10px] ${step === 'components' ? 'bg-teal-700 text-white' : step === 'form' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-400'}`}>2</div>
            <div className={`w-8 h-0.5 ${step === 'form' ? 'bg-teal-700' : 'bg-slate-200'}`} />
            <div className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-[10px] ${step === 'form' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-400'}`}>3</div>
          </div>
        </div>

        {/* STEP 1: Select Department */}
        {step === 'department' && (
          <motion.div 
            variants={{ hidden: {opacity:0}, show: {opacity:1, transition:{staggerChildren:0.1}} }} 
            initial="hidden" animate="show" 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {DEPARTMENTS.map((dept) => {
              const Icon = dept.icon;
              return (
                <motion.button 
                  key={dept.id} 
                  onClick={() => loadInventory(dept.id)}
                  variants={{ hidden: {opacity:0, y:20}, show: {opacity:1, y:0, transition:{type:'spring', stiffness: 300, damping: 24}} }}
                  className="relative group bg-white rounded-[1.5rem] p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col h-full min-h-[240px]"
                >
                  {/* Background Blob Effect */}
                  <div className={`absolute -right-12 -top-12 w-48 h-48 bg-gradient-to-br ${dept.color} rounded-full opacity-[0.05] group-hover:opacity-[0.12] group-hover:scale-150 transition-all duration-700 blur-2xl`} />
                  
                  {/* Icon Block */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dept.color} ${dept.shadow} shadow-lg flex items-center justify-center text-white mb-5 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 z-10`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Text Content */}
                  <div className="z-10 flex-1">
                    <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">{dept.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{dept.desc}</p>
                  </div>

                  {/* Call to Action Button */}
                  <div className="mt-6 flex items-center justify-between z-10 border-t border-slate-100 pt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">
                      Enter
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 group-hover:bg-slate-900 group-hover:border-slate-900 group-hover:text-white transition-all duration-300`}>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* STEP 2: Select Components */}
        {step === 'components' && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={transitionProps} className="flex flex-col lg:flex-row gap-6 relative">
            <div className="flex-1 flex flex-col gap-4">
              
              {/* Top Bar (Flipkart Style Search + Cart) */}
              <div className="flex items-center gap-3 sticky top-0 z-20 -mt-2">
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search for components..." className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 text-xs focus:outline-none focus:border-teal-700 transition-colors text-slate-900 rounded-md shadow-sm" />
                </div>
                
                <button 
                  onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
                  aria-expanded={isMobileCartOpen}
                  aria-controls="mobile-cart-contents"
                  className="lg:hidden relative p-1.5 bg-white border border-slate-300 text-slate-600 hover:text-teal-700 transition-colors rounded-md shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-teal-700 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Mobile Cart Dropdown */}
              <AnimatePresence>
                {isMobileCartOpen && (
                  <motion.div id="mobile-cart-contents" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="lg:hidden bg-white border border-slate-300 p-4 overflow-hidden shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                      Requisition Cart
                    </h3>
                    
                    {cart.length === 0 ? (
                      <div className="py-6 text-center border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 text-xs font-mono uppercase tracking-widest">
                        Cart is empty.
                      </div>
                    ) : (
                      <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1">
                        {cart.map(item => (
                          <div key={item.id} className="p-3 border border-slate-300 bg-slate-50">
                            <p className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-tight mb-2 uppercase tracking-tight">{item.name}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center bg-white border border-slate-300">
                                <button onClick={() => handleUpdateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                <span className="text-[10px] font-bold font-mono w-6 text-center border-l border-r border-slate-300">{item.requestedQty}</span>
                                <button onClick={() => handleUpdateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                              <button onClick={() => handleRemoveFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setStep('form')} disabled={cart.length === 0}
                      className="w-full py-3 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-widest transition-colors">
                      Proceed to Form
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white border border-slate-300 relative">
                <div className="p-3 sm:p-4 min-h-[60vh] max-h-[75vh] overflow-y-auto">
                  {isLoadingInventory ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-700 rounded-full animate-spin" />
                      <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading index...</p>
                    </div>
                  ) : inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs font-mono uppercase tracking-widest">No items found.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                        <div key={item.id} className="flex flex-col border border-slate-300 bg-white hover:border-teal-700 transition-colors shadow-sm group">
                          <div className="h-20 sm:h-28 md:h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden border-b border-slate-200">
                            {item.photo_url ? (
                              <img src={item.photo_url} alt={item.name} className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                              <Box className="w-8 h-8 text-slate-300" />
                            )}
                          </div>
                          
                          <div className="p-2 sm:p-3 flex flex-col flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight line-clamp-2">{item.name}</h4>
                            <details className="mb-3 flex-1 group">
                              <summary className="text-[9px] sm:text-[10px] text-teal-700 font-bold cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1 hover:text-teal-800 uppercase tracking-widest w-fit transition-colors">
                                <span className="group-open:hidden">More Info</span>
                                <span className="hidden group-open:block">Less Info</span>
                                <svg className="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </summary>
                              <div className="mt-2 text-[10px] sm:text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 border border-slate-200">
                                <p className="font-bold text-slate-900 mb-1 pb-1 border-b border-slate-200">{item.name}</p>
                                {item.desc ? <p>{item.desc}</p> : <p className="italic text-slate-400 mt-1">No additional details</p>}
                              </div>
                            </details>
                            
                            <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-slate-200">
                              <button onClick={() => handleAddToCart(item)} disabled={item.available <= 0}
                                className="w-full py-1.5 sm:py-2 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors border border-slate-300 hover:border-teal-300">
                                <Plus className="w-3.5 h-3.5" /> {item.available > 0 ? 'Add' : 'Out of Stock'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="hidden lg:block w-80">
              <div className="bg-white border border-slate-300 p-5 sticky top-8 shadow-sm">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                  Requisition Cart
                  <span className="bg-slate-900 text-white px-2 py-0.5 text-[9px]">{cart.length}</span>
                </h3>
                
                <div>
                  {cart.length === 0 ? (
                    <div className="py-6 sm:py-8 text-center border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 text-xs font-mono uppercase tracking-widest">
                      Cart is empty.
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1">
                      {cart.map(item => (
                        <div key={item.id} className="p-3 border border-slate-300 bg-slate-50">
                          <p className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-tight mb-2 uppercase tracking-tight">{item.name}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center bg-white border border-slate-300">
                              <button onClick={() => handleUpdateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                              <span className="text-[10px] font-bold font-mono w-6 text-center border-l border-r border-slate-300">{item.requestedQty}</span>
                              <button onClick={() => handleUpdateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                            <button onClick={() => handleRemoveFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button onClick={() => setStep('form')} disabled={cart.length === 0}
                    className="w-full py-3 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-widest transition-colors mt-4 lg:mt-0">
                    Proceed to Form
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Form */}
        {step === 'form' && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={transitionProps} className="bg-white border border-slate-300">
            <div className="p-6 border-b border-slate-300 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Requisition Details</h2>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Step 3 of 3</span>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className={labelCls}>Full Name</label><input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>USN</label><input required type="text" value={usn} onChange={e => setUsn(e.target.value)} className={`${inputCls} font-mono uppercase`} /></div>
                <div>
                  <label className={labelCls}>Department</label>
                  <select required value={department} onChange={e => setDepartment(e.target.value)} className={inputCls}>
                    <option value="" disabled>Select Department</option>
                    {['CSE', 'ISE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI_ML'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Year of Engineering</label><input required type="text" value={year} onChange={e => setYear(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Section</label><input required type="text" value={section} onChange={e => setSection(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Mobile No.</label><input required type="tel" value={mobile} onChange={e => setMobile(e.target.value)} className={inputCls} /></div>
              </div>

              <hr className="border-slate-200" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Project Title</label>
                  <input required type="text" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className={inputCls} placeholder="E.g. Smart IoT Plant Monitor" />
                </div>
                <div>
                  <label className={labelCls}>Project Purpose</label>
                  <select required value={projectType} onChange={e => setProjectType(e.target.value)} className={inputCls}>
                    <option value="Course Assignment / Lab Work">Course Assignment / Lab Work</option>
                    <option value="Mini Project">Mini Project</option>
                    <option value="Major Project">Major Project</option>
                    <option value="Hackathon / Competition">Hackathon / Competition</option>
                    <option value="Research / Personal Project">Research / Personal Project</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Brief Description (Optional)</label>
                  <textarea value={projectPurpose} onChange={e => setProjectPurpose(e.target.value)} className={`${inputCls} min-h-[80px]`} placeholder="Briefly describe what you are building..." />
                </div>
              </div>

              {projectType === 'Hackathon / Competition' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className={labelCls}>College Name</label>
                    <input required type="text" value={hackathonCollege} onChange={e => setHackathonCollege(e.target.value)} className={inputCls} placeholder="E.g. IIT Madras" />
                  </div>
                  <div>
                    <label className={labelCls}>Venue / City</label>
                    <input required type="text" value={hackathonVenueStr} onChange={e => setHackathonVenueStr(e.target.value)} className={inputCls} placeholder="E.g. Chennai" />
                  </div>
                  <div>
                    <label className={labelCls}>Participation Date</label>
                    <input required type="date" value={hackathonDate} onChange={e => setHackathonDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              <hr className="border-slate-200" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Pickup Date</label>
                  <input type="date" required min={minDate} max={maxDate} value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Return Date</label>
                  <input type="date" required min={date} max={maxDate} value={returnDate} onChange={e => setReturnDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Pickup Time</label>
                  <select required value={time} onChange={e => setTime(e.target.value)} className={inputCls}>
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="11:15 AM">11:15 AM</option>
                    <option value="01:30 PM">01:30 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200">
                <label className={labelCls}>Identity Verification</label>
                {hasVerifiedProfileId ? (
                  <div className="bg-teal-50 border border-teal-200 p-4 flex flex-col sm:flex-row items-center gap-4">
                    {studentIdCardUrl ? (
                      <div className="w-24 h-16 border border-teal-200 overflow-hidden bg-white shrink-0">
                        <img src={studentIdCardUrl} alt="Verified ID" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-teal-100 flex items-center justify-center shrink-0 border border-teal-200">
                        <ShieldCheck className="w-6 h-6 text-teal-700" />
                      </div>
                    )}
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-bold text-teal-900 uppercase tracking-wide flex items-center justify-center sm:justify-start gap-1">
                        <CheckCircle2 className="w-4 h-4" /> ID Card Verified
                      </p>
                      <p className="text-xs text-teal-700 mt-1 leading-relaxed">
                        Your identity has been verified through your profile. This image will be attached to your requisition.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input type="file" id="idUpload" className="hidden" accept="image/*" onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (file.size > 50 * 1024) {
                          toast.error(`File is too large (${(file.size / 1024).toFixed(1)}KB). Maximum allowed size is 50KB.`);
                          e.target.value = '';
                          return;
                        }
                        setIdCardFile(file);
                      }
                    }} />
                    <label htmlFor="idUpload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-10 h-10 bg-white border border-slate-300 flex items-center justify-center text-slate-600 mb-3">
                        <Upload className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">Upload ID Card</p>
                      <p className="text-xs text-slate-500">Required for checkout if not verified in profile</p>
                      {idCardFile && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <p className="text-xs font-mono font-bold text-teal-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {idCardFile.name}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdCardFile(null); (document.getElementById('idUpload') as HTMLInputElement).value = ''; }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-slate-100 border border-slate-300 p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-1 rounded-sm border-slate-400 text-teal-700 focus:ring-teal-700 w-4 h-4 bg-white shrink-0" />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    I acknowledge responsibility for all requested components. I agree to return them in working condition by the specified return date or accept liability for damages.
                  </span>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required checked={agreedToUndertaking} onChange={e => setAgreedToUndertaking(e.target.checked)}
                    className="mt-1 rounded-sm border-slate-400 text-teal-700 focus:ring-teal-700 w-4 h-4 bg-white shrink-0" />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    I give my consent to the undertaking that I will replace the specific component on time, failing which I understand I may face issues in my hallticket issuing.
                  </span>
                </label>
              </div>

              <AnimatePresence>
                {agreedToUndertaking && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 border-slate-200 overflow-hidden">
                    <label className={labelCls}>Undertaking Signature</label>
                    <div className="border-2 border-dashed border-slate-300 p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                      <input type="file" id="sigUpload" className="hidden" accept="image/*" onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.size > 50 * 1024) {
                            toast.error(`File is too large (${(file.size / 1024).toFixed(1)}KB). Maximum allowed size is 50KB.`);
                            e.target.value = '';
                            return;
                          }
                          setSignatureFile(file);
                        }
                      }} />
                      <label htmlFor="sigUpload" className="cursor-pointer flex flex-col items-center w-full">
                        <div className="w-10 h-10 bg-white border border-slate-300 flex items-center justify-center text-slate-600 mb-3">
                          <Upload className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">Upload Signature</p>
                        <p className="text-xs text-slate-500">Please provide a clear image of your signature for the undertaking letter</p>
                        {signatureFile && (
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <p className="text-xs font-mono font-bold text-teal-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {signatureFile.name}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSignatureFile(null); (document.getElementById('sigUpload') as HTMLInputElement).value = ''; }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={isLoading}
                className="w-full py-4 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                {isLoading ? <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" /> : "Submit Requisition"}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
