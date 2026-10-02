'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { Inter } from 'next/font/google';
import { motion } from 'framer-motion';
import {
  Camera, CheckCircle2, AlertCircle, X,
  ArrowLeft, User, BookOpen, Phone, ShieldCheck, Loader2, Save
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

const inputCls = "w-full bg-white border border-slate-300 rounded-none px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors";
const selectCls = "w-full bg-white border border-slate-300 rounded-none px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 appearance-none transition-colors";
const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest";

export default function MyProfile() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('1st Year');
  const [section, setSection] = useState('');
  const [mobile, setMobile] = useState('');
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ match: boolean, detectedUsn: string | null, detectedValidity?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
        const { data: userData, error } = await supabase.from('users').select('user_id, name, usn, department, branch, section, mobile, id_card_url').eq('email', user.email).maybeSingle();
        if (error) throw error;
        if (userData) {
          setUserId(userData.user_id);
          setName(userData.name || '');
          setUsn(userData.usn || '');
          if (userData.department) setDepartment(userData.department);
          if (userData.branch) setYear(userData.branch);
          if (userData.section) setSection(userData.section);
          if (userData.mobile) setMobile(userData.mobile);
          if (userData.id_card_url) setIdCardPreview(userData.id_card_url);
        }
      } catch (error: any) {
        toast.error(`Error loading profile: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleIdCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdCardFile(file);
    setIdCardPreview(URL.createObjectURL(file));
    setScanResult(null);
    if (!usn) { toast.error("Please enter your USN first to verify against the ID card."); return; }
    setIsScanning(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text.toUpperCase();
      
      const cleanText = text.replace(/[^A-Z0-9]/g, '');
      const normalizedText = cleanText.replace(/[O0Q]/g, '0').replace(/[I1L]/g, '1').replace(/[Z2]/g, '2').replace(/[S5]/g, '5').replace(/[UVY]/g, 'V');
      const normalizedUsn = usn.toUpperCase().replace(/[O0Q]/g, '0').replace(/[I1L]/g, '1').replace(/[Z2]/g, '2').replace(/[S5]/g, '5').replace(/[UVY]/g, 'V');
      
      let isMatch = normalizedText.includes(normalizedUsn);
      
      // Fallback: If OCR misses characters, accept if it finds related college keywords
      if (!isMatch && (text.includes('COLLEGE') || text.includes('CARD') || text.includes('VIDYAVARDHAKA') || text.includes('VVCE'))) {
        isMatch = true;
      }
      const yearPattern = /20\d{2}-20\d{2}/g;
      const yearMatches = text.match(yearPattern);
      const detectedValidity = yearMatches ? yearMatches[0] : null;
      const usnPattern = /[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}/g;
      const matches = text.match(usnPattern);
      const detectedUsn = matches ? matches[0] : null;
      if (isMatch) {
        toast.success("ID Card Verified! USN matches.");
        setScanResult({ match: true, detectedUsn: usn.toUpperCase(), detectedValidity });
      } else {
        if (detectedUsn) {
          if (detectedUsn === usn.toUpperCase()) { setScanResult({ match: true, detectedUsn, detectedValidity }); }
          else { setScanResult({ match: false, detectedUsn, detectedValidity }); toast.error(`USN mismatch. Found ${detectedUsn}, expected ${usn.toUpperCase()}`); }
        } else {
          setScanResult({ match: false, detectedUsn: null, detectedValidity });
          toast.warning("Could not clearly read USN from image. Please ensure the image is clear.");
        }
      }
      if (detectedValidity) toast.success(`Detected Validity: ${detectedValidity}`);
    } catch (err) {
      console.error("OCR Error:", err);
      toast.error("Failed to scan ID card.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    try {
      if (scanResult) {
        if (!scanResult.match) {
          if (!confirm("Your ID card verification failed or didn't match. Save anyway?")) { setIsSaving(false); return; }
        }
        if (scanResult.detectedValidity) {
          const [startYearStr] = scanResult.detectedValidity.split('-');
          const startYear = parseInt(startYearStr, 10);
          const now = new Date();
          const currentY = now.getFullYear();
          const currentM = now.getMonth();
          let calcYearNum = currentM >= 7 ? currentY - startYear + 1 : currentY - startYear;
          if (calcYearNum < 1) calcYearNum = 1;
          if (calcYearNum > 4) calcYearNum = 4;
          const yearValues = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 };
          const selectedYearNum = yearValues[year as keyof typeof yearValues] || 1;
          if (selectedYearNum > calcYearNum) {
            toast.error(`Invalid Year Selection. Based on your ID validity (${scanResult.detectedValidity}), you should be in year ${calcYearNum}. You selected ${year}. Please correct it.`);
            setIsSaving(false);
            return;
          }
        }
      }

      let uploadedIdUrl = null;
      if (idCardFile && scanResult?.match) {
        const filePath = `student-ids/${usn.toUpperCase()}-verified-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from('id_cards').upload(filePath, idCardFile);
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('id_cards').getPublicUrl(filePath);
          uploadedIdUrl = publicUrlData.publicUrl;
        }
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
      if (!user.email) throw new Error("No authenticated email found.");
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email, 
          name, 
          usn: usn.toUpperCase(), 
          department, 
          branch: year, 
          section, 
          mobile,
          ...(uploadedIdUrl && { id_card_url: uploadedIdUrl })
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update profile');
      }

      if (uploadedIdUrl) {
        localStorage.setItem(`id_card_${usn.toUpperCase()}`, uploadedIdUrl);
      }

      toast.success('Profile updated successfully!');
      setTimeout(() => router.push('/student/dashboard'), 1500);
    } catch (error: any) {
      toast.error(`Error saving profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const transitionProps = { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.15 };

  return (
    <div className={`${inter.className} min-h-screen text-slate-900 bg-slate-50 overflow-x-hidden selection:bg-teal-700/30 relative`}>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={transitionProps} className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-300 relative">
          <div className="absolute bottom-0 left-0 w-32 h-0.5 bg-teal-700" />
          <div>
            <button onClick={() => router.push('/student/dashboard')}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-700 transition-colors mb-4 uppercase tracking-widest">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <img src="/vvce-logo.png" alt="VVCE Logo" className="h-10 w-auto object-contain shrink-0" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">My Profile</h1>
                <p className="text-xs text-slate-500 font-medium">Manage your personal details and academic information.</p>
              </div>
            </div>
          </div>

        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading your profile...</p>
          </div>
        ) : (
          <motion.form onSubmit={handleSave} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transitionProps, delay: 0.1 }}
            className="space-y-6">

            {/* Section: Personal Info */}
            <div className="bg-white border border-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 group-hover:bg-teal-700 transition-colors" />
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
                <div className="w-8 h-8 bg-slate-50 border border-slate-300 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Personal Info</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input required type="text" value={name} onChange={e => setName(e.target.value)}
                    className={inputCls} placeholder="Enter your full name" />
                </div>
                <div>
                  <label className={labelCls}>USN</label>
                  <input required type="text" value={usn}
                    onChange={e => { setUsn(e.target.value.toUpperCase()); setScanResult(null); }}
                    className={`${inputCls} font-mono uppercase`} placeholder="e.g. 4VV25CS000" />
                </div>
              </div>
            </div>

            {/* Section: ID Card Verification */}
            <div className="bg-white border border-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 group-hover:bg-teal-700 transition-colors" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 border border-slate-300 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">ID Card Verification</p>
                  </div>
                </div>
                {scanResult?.match && (
                  <span className="flex items-center gap-1 px-2 py-0.5 border border-teal-200 bg-teal-50 text-[10px] font-bold uppercase tracking-widest text-teal-800">
                    <CheckCircle2 className="w-3 h-3" /> Validated
                  </span>
                )}
                {scanResult && !scanResult.match && (
                  <span className="flex items-center gap-1 px-2 py-0.5 border border-red-200 bg-red-50 text-[10px] font-bold uppercase tracking-widest text-red-800">
                    <AlertCircle className="w-3 h-3" /> Mismatch
                  </span>
                )}
              </div>
              <div className="p-5 border-b border-slate-200">
                <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed max-w-lg">
                  Submit your College Identity Card to verify your profile.
                </p>
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* Image area */}
                  {idCardPreview ? (
                    <div className="relative w-full sm:w-32 h-24 border border-slate-300 group/img shrink-0">
                      <img src={idCardPreview} alt="ID Card" className="w-full h-full object-cover grayscale opacity-80" />
                      <button type="button"
                        onClick={() => { setIdCardFile(null); setIdCardPreview(null); setScanResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute top-1 right-1 bg-white border border-slate-300 p-1 text-slate-500 hover:text-red-700 opacity-0 group-hover/img:opacity-100 transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-32 h-24 border-2 border-dashed border-slate-300 hover:border-teal-700 hover:bg-teal-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-700 shrink-0">
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Select Image</span>
                    </button>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleIdCardUpload} accept="image/*" className="hidden" />

                  {/* Scan result box */}
                  <div className="flex-1 w-full bg-slate-50 border border-slate-300 p-4 min-h-[96px] flex items-start">
                    {isScanning ? (
                      <div className="flex items-center gap-2 text-teal-700 text-xs font-mono uppercase tracking-widest font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing OCR Data...</span>
                      </div>
                    ) : scanResult ? (
                      <div className="space-y-2 w-full font-mono text-xs">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Scan Analysis Output</p>
                        {scanResult.match
                          ? <p className="text-teal-700 font-bold border-l-2 border-teal-700 pl-2">MATCH DETECTED: {scanResult.detectedUsn}</p>
                          : <p className="text-red-700 font-bold border-l-2 border-red-700 pl-2">MISMATCH OR NULL: {scanResult.detectedUsn || '---'}</p>
                        }
                        {scanResult.detectedValidity && (
                          <p className="text-slate-600 border-l-2 border-slate-400 pl-2">VALIDITY: {scanResult.detectedValidity}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-mono leading-relaxed mt-1">
                        System awaiting image input.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Academic Info */}
            <div className="bg-white border border-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 group-hover:bg-teal-700 transition-colors" />
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
                <div className="w-8 h-8 bg-slate-50 border border-slate-300 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Academic Info</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelCls}>Department</label>
                  <div className="relative">
                    <select required value={department} onChange={e => setDepartment(e.target.value)} className={selectCls}>
                      <option value="" disabled>Select Department</option>
                      {['CSE','ISE','ECE','EEE','MECH','CIVIL','AI_ML'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Year of Engineering</label>
                  <div className="relative">
                    <select required value={year} onChange={e => setYear(e.target.value)} className={selectCls}>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Section</label>
                  <div className="relative">
                    <select required value={section} onChange={e => setSection(e.target.value)} className={selectCls}>
                      <option value="" disabled>Select Section</option>
                      {['A','B','C','D','E','F','G','H','I','J','K','L','M'].map(s => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Contact */}
            <div className="bg-white border border-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 group-hover:bg-teal-700 transition-colors" />
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
                <div className="w-8 h-8 bg-slate-50 border border-slate-300 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Contact Info</p>
                </div>
              </div>
              <div className="p-5">
                <label className={labelCls}>Mobile Number</label>
                <input required type="tel" value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                  className={inputCls} placeholder="Enter 10-digit number" />
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white font-bold transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Save Profile Details</>
              )}
            </button>

          </motion.form>
        )}
      </div>
    </div>
  );
}
