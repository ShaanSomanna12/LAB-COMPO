'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { Space_Grotesk } from 'next/font/google';
import { motion } from 'framer-motion';
import {
  Camera, CheckCircle2, AlertCircle, X,
  ArrowLeft, User, BookOpen, Phone, ShieldCheck, Loader2, Save
} from 'lucide-react';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";
const selectCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 appearance-none transition-all";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

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
        const { data: userData, error } = await supabase.from('users').select('user_id, name, usn, department, branch, section, mobile').eq('email', user.email).maybeSingle();
        if (error) throw error;
        if (userData) {
          setUserId(userData.user_id);
          setName(userData.name || '');
          setUsn(userData.usn || '');
          if (userData.department) setDepartment(userData.department);
          if (userData.branch) setYear(userData.branch);
          if (userData.section) setSection(userData.section);
          if (userData.mobile) setMobile(userData.mobile);
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
      const isMatch = text.includes(usn.toUpperCase());
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { await supabase.auth.signOut(); router.push('/'); return; }
      if (!user.email) throw new Error("No authenticated email found.");
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, usn, department, branch: year, section, mobile })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update profile');
      }
      toast.success('Profile updated successfully!');
      setTimeout(() => router.push('/student/dashboard'), 1500);
    } catch (error: any) {
      toast.error(`Error saving profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${spaceGrotesk.className} min-h-screen selection:bg-blue-100`} style={{ background: '#f8fafc' }}>
      {/* Top gradient band */}
      <div className="fixed top-0 left-0 right-0 h-56 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(248,250,252,0) 100%)' }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 md:py-12">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push('/student/dashboard')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">My Profile</h1>
            <p className="text-sm text-slate-400 mt-1">Manage your personal details and academic information.</p>
          </div>
          {/* Avatar bubble */}
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-2xl font-black text-white">{name ? name.charAt(0) : <User className="w-6 h-6" />}</span>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading your profile...</p>
          </div>
        ) : (
          <motion.form onSubmit={handleSave} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="space-y-5">

            {/* Section: Personal Info */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Personal Info</p>
                  <p className="text-[11px] text-slate-400">Your name and university seat number</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input required type="text" value={name} onChange={e => setName(e.target.value)}
                    className={inputCls} placeholder="Enter your full name" />
                </div>
                <div>
                  <label className={labelCls}>USN</label>
                  <input required type="text" value={usn}
                    onChange={e => { setUsn(e.target.value.toUpperCase()); setScanResult(null); }}
                    className={`${inputCls} font-mono uppercase`} placeholder="e.g. 1RV22CS001" />
                </div>
              </div>
            </div>

            {/* Section: ID Card Verification */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">ID Card Verification</p>
                    <p className="text-[11px] text-slate-400">Upload your college ID to auto-verify USN</p>
                  </div>
                </div>
                {scanResult?.match && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
                {scanResult && !scanResult.match && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[11px] font-bold text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" /> Mismatch
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Image area */}
                  {idCardPreview ? (
                    <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden border border-slate-200 group shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={idCardPreview} alt="ID Card" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={() => { setIdCardFile(null); setIdCardPreview(null); setScanResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-red-50 border border-slate-200 p-1 rounded-full text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-32 h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-blue-500 shrink-0">
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-semibold">Upload ID</span>
                    </button>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleIdCardUpload} accept="image/*" className="hidden" />

                  {/* Scan result box */}
                  <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-mono min-h-[96px] flex items-start">
                    {isScanning ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Scanning document with OCR...</span>
                      </div>
                    ) : scanResult ? (
                      <div className="space-y-1.5 w-full">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Scan Result</p>
                        {scanResult.match
                          ? <p className="text-emerald-600 font-semibold">✓ USN Match: {scanResult.detectedUsn}</p>
                          : <p className="text-red-500 font-semibold">✗ Mismatch — Found: {scanResult.detectedUsn || 'None'}</p>
                        }
                        {scanResult.detectedValidity && (
                          <p className="text-blue-600">📅 Validity: {scanResult.detectedValidity}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 leading-relaxed">
                        Upload your ID card to auto-verify your USN and detect validity period.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Academic Info */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Academic Info</p>
                  <p className="text-[11px] text-slate-400">Your year, department, and section</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Year</label>
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
                  <label className={labelCls}>Department</label>
                  <div className="relative">
                    <select required value={department} onChange={e => setDepartment(e.target.value)} className={selectCls}>
                      <option value="" disabled>Select Department</option>
                      <option value="CSE">Computer Science & Engineering</option>
                      <option value="ISE">Information Science & Engineering</option>
                      <option value="ECE">Electronics & Communication</option>
                      <option value="EEE">Electrical & Electronics</option>
                      <option value="MECH">Mechanical Engineering</option>
                      <option value="CIVIL">Civil Engineering</option>
                      <option value="AI_ML">Artificial Intelligence & ML</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Contact</p>
                  <p className="text-[11px] text-slate-400">Used for lab notifications and alerts</p>
                </div>
              </div>
              <div className="p-5">
                <label className={labelCls}>Mobile Number</label>
                <input required type="tel" value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                  className={inputCls} placeholder="Enter your 10-digit mobile number" />
              </div>
            </div>

            {/* Save Button */}
            <motion.button
              type="submit"
              disabled={isSaving}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-blue-200 hover:shadow-blue-300 text-sm">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving Profile...</>
              ) : (
                <><Save className="w-4 h-4" /> Save Profile Details</>
              )}
            </motion.button>

          </motion.form>
        )}
      </div>
    </div>
  );
}
