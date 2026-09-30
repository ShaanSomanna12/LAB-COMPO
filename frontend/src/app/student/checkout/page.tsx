'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Space_Grotesk } from 'next/font/google';
import { siteConfig } from '@/config/site';
import RequisitionLetter from '@/components/RequisitionLetter';
import { isWorkingDay, getWorkingDaysCount } from '@/lib/dateValidator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ArrowLeft, Search, Plus, Minus, Trash2, 
  Calendar, Clock, AlertCircle, Upload, CheckCircle2, ShieldCheck, User, Zap
} from 'lucide-react';

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
  { id: 'EDL', title: 'Engineering Development LAB (InUnity)', desc: 'Core components, microcontrollers, and embedded systems.', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'ECE', title: 'Electronics & Comm.', desc: 'Communication modules, signal processing tools, and RF.', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'EEE', title: 'Electrical Engineering', desc: 'High-voltage testing tools, multimeters, and analyzers.', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { id: 'CIVIL', title: 'Civil Engineering', desc: 'Surveying tools, structural testing, and building models.', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'MECH', title: 'Mechanical Engineering', desc: 'Motors, actuators, robotics chassis, and physical tools.', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' }
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
  const [minDate, setMinDate] = useState('');
  
  const [projectType, setProjectType] = useState('Course Assignment / Lab Work');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [studentIdCardUrl, setStudentIdCardUrl] = useState('');
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [hasVerifiedProfileId, setHasVerifiedProfileId] = useState(false);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
      
      const { data: userData } = await supabase
        .from('users')
        .select('name, usn, department, branch, section, mobile')
        .eq('email', user.email)
        .maybeSingle();

      if (userData) {
        setStudentName(userData.name || '');
        setUsn(userData.usn || '');
        setDepartment(userData.department || '');
        setYear(userData.branch || '');
        setSection(userData.section || '');
        setMobile(userData.mobile || '');
        
        // Check if ID card was verified and saved in local storage by profile page
        if (userData.usn) {
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
  }, [router]);

  useEffect(() => {
    if (date) {
      const start = new Date(date);
      start.setDate(start.getDate() + 7);
      setReturnDate(start.toISOString().split('T')[0]);
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
      setInventory(data || []);
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
          toast.error(Only  available);
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, requestedQty: i.requestedQty + 1 } : i);
      }
      return [...prev, { ...item, requestedQty: 1 }];
    });
    toast.success(Added );
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
          toast.error(Only  available);
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
    
    if (!isWorkingDay(date)) return toast.error('Pickup date must be a working day (Mon-Sat)');

    setIsLoading(true);

    try {
      let finalIdCardUrl = studentIdCardUrl;
      
      // Upload new ID card if provided and not already verified
      if (idCardFile && !hasVerifiedProfileId) {
        const filePath = student-ids/-.png;
        const { error: uploadError } = await supabase.storage.from('id_cards').upload(filePath, idCardFile);
        if (uploadError) throw new Error("Failed to upload ID Card");
        const { data: publicUrlData } = supabase.storage.from('id_cards').getPublicUrl(filePath);
        finalIdCardUrl = publicUrlData.publicUrl;
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
        project_title: projectTitle || projectType,
        project_description: projectPurpose,
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

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div className={${spaceGrotesk.className} min-h-screen selection:bg-blue-100 bg-[#f8fafc] text-slate-800}>
      <div className="fixed top-0 left-0 right-0 h-56 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(248,250,252,0) 100%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 md:py-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => step === 'department' ? router.push('/student/dashboard') : setStep(step === 'form' ? 'components' : 'department')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" /> {step === 'department' ? 'Back to Dashboard' : 'Go Back'}
            </button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Hardware Requisition</h1>
            <p className="text-sm text-slate-500 mt-1">Request components for your lab or project</p>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <div className={w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm }>1</div>
            <div className={w-8 h-1 rounded-full } />
            <div className={w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm }>2</div>
            <div className={w-8 h-1 rounded-full } />
            <div className={w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm }>3</div>
          </div>
        </div>

        {/* STEP 1: Select Department */}
        {step === 'department' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEPARTMENTS.map((dept) => (
              <button key={dept.id} onClick={() => loadInventory(dept.id)}
                className="group relative text-left p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 transition-all duration-300" style={{ background: dept.color }} />
                <h3 className="text-lg font-bold text-slate-800 mb-1">{dept.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{dept.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold transition-colors" style={{ color: dept.color }}>
                  Browse Components <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {/* STEP 2: Select Components */}
        {step === 'components' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-100 flex gap-3 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search inventory..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all text-slate-800" />
                  </div>
                </div>
                
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                  {isLoadingInventory ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm text-slate-400">Loading inventory...</p>
                    </div>
                  ) : inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">No items found matching your search.</div>
                  ) : (
                    inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                      <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {item.photo_url ? <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" /> : <Microchip className="w-5 h-5 text-slate-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Available: <span className={item.available > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{item.available}</span> / {item.total}</p>
                        </div>
                        <button onClick={() => handleAddToCart(item)} disabled={item.available <= 0}
                          className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center transition-colors shrink-0">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-80">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sticky top-24">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                  Your Cart
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{cart.length} items</span>
                </h3>
                
                {cart.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm">
                    Cart is empty. Add components from the left.
                  </div>
                ) : (
                  <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-2">{item.name}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                            <button onClick={() => handleUpdateQty(item.id, -1)} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-bold w-4 text-center">{item.requestedQty}</span>
                            <button onClick={() => handleUpdateQty(item.id, 1)} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus className="w-3 h-3" /></button>
                          </div>
                          <button onClick={() => handleRemoveFromCart(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button onClick={() => setStep('form')} disabled={cart.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm shadow-sm">
                  Proceed to Details
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Form */}
        {step === 'form' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className={labelCls}>Full Name</label><input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>USN</label><input required type="text" value={usn} onChange={e => setUsn(e.target.value)} className={${inputCls} font-mono uppercase} /></div>
                <div>
                  <label className={labelCls}>Department</label>
                  <select required value={department} onChange={e => setDepartment(e.target.value)} className={inputCls}>
                    <option value="" disabled>Select Department</option>
                    {['CSE', 'ISE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI_ML'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Year / Branch</label><input required type="text" value={year} onChange={e => setYear(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Section</label><input required type="text" value={section} onChange={e => setSection(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Mobile No.</label><input required type="tel" value={mobile} onChange={e => setMobile(e.target.value)} className={inputCls} /></div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Project Title</label>
                  <input required type="text" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className={inputCls} placeholder="E.g. Smart IoT Plant Monitor" />
                </div>
                <div>
                  <label className={labelCls}>Project Purpose</label>
                  <select required value={projectType} onChange={e => setProjectType(e.target.value)} className={inputCls}>
                    <option value="Course Assignment / Lab Work">Course Assignment / Lab Work</option>
                    <option value="Final Year Project">Final Year Project</option>
                    <option value="Hackathon / Competition">Hackathon / Competition</option>
                    <option value="Personal Project">Personal Project</option>
                  </select>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelCls}>Pickup Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} className={${inputCls} pl-10} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Pickup Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="time" value={time} onChange={e => setTime(e.target.value)} className={${inputCls} pl-10} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Return Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="date" disabled value={returnDate} className={${inputCls} pl-10 bg-slate-50 text-slate-500} />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ID Card Verification Status */}
              <div>
                <label className={labelCls}>Identity Verification</label>
                {hasVerifiedProfileId ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">ID Card Verified</p>
                      <p className="text-xs text-emerald-600 mt-0.5">We'll use the ID card uploaded in your profile.</p>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input type="file" id="idUpload" className="hidden" accept="image/*" onChange={e => {
                      if (e.target.files && e.target.files[0]) setIdCardFile(e.target.files[0]);
                    }} />
                    <label htmlFor="idUpload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1">Upload ID Card</p>
                      <p className="text-xs text-slate-500">Required for checkout if not verified in profile</p>
                      {idCardFile && <p className="text-xs font-semibold text-blue-600 mt-3 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {idCardFile.name}</p>}
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-1 rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-white" />
                  <span className="text-xs text-blue-900 font-medium leading-relaxed">
                    I agree to return all components in working condition by the specified return date. I understand that I am responsible for any damage or loss of the components.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 flex justify-center items-center gap-2">
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Submit Requisition"}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Microchip icon component
function Microchip({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
      <path d="M9 9h6v6H9z"></path>
      <path d="M9 1v3"></path>
      <path d="M15 1v3"></path>
      <path d="M9 20v3"></path>
      <path d="M15 20v3"></path>
      <path d="M20 9h3"></path>
      <path d="M20 14h3"></path>
      <path d="M1 9h3"></path>
      <path d="M1 14h3"></path>
    </svg>
  );
}
