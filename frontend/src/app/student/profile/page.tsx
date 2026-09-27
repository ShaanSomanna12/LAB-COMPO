'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { Camera, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react';

export default function MyProfile() {
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile Fields
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('1st Year');
  const [section, setSection] = useState('');
  const [mobile, setMobile] = useState('');

  // OCR Verification States
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ match: boolean, detectedUsn: string | null, detectedValidity?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/student');
          return;
        }

        const { data: userData, error } = await supabase
          .from('users')
          .select('user_id, name, usn, department, branch, section, mobile')
          .eq('email', user.email)
          .maybeSingle();

        if (error) throw error;
        
        if (userData) {
          setUserId(userData.user_id);
          setName(userData.name || '');
          setUsn(userData.usn || '');
          if (userData.department) setDepartment(userData.department);
          if (userData.branch) setYear(userData.branch); // Using branch column for year
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
    
    if (!usn) {
      toast.error("Please enter your USN first to verify against the ID card.");
      return;
    }
    
    setIsScanning(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text.toUpperCase();
      
      const isMatch = text.includes(usn.toUpperCase());
      
      // Try to find year validity pattern like YYYY-YYYY (e.g. 2025-2029)
      const yearPattern = /20\d{2}-20\d{2}/g;
      const yearMatches = text.match(yearPattern);
      const detectedValidity = yearMatches ? yearMatches[0] : null;

      // Try to find any VTU USN pattern
      const usnPattern = /[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}/g;
      const matches = text.match(usnPattern);
      const detectedUsn = matches ? matches[0] : null;

      if (isMatch) {
        toast.success("ID Card Verified! USN matches.");
        setScanResult({ match: true, detectedUsn: usn.toUpperCase(), detectedValidity });
      } else {
        if (detectedUsn) {
           if (detectedUsn === usn.toUpperCase()) {
              setScanResult({ match: true, detectedUsn, detectedValidity });
           } else {
              setScanResult({ match: false, detectedUsn, detectedValidity });
              toast.error(`USN mismatch. Found ${detectedUsn}, expected ${usn.toUpperCase()}`);
           }
        } else {
          setScanResult({ match: false, detectedUsn: null, detectedValidity });
          toast.warning("Could not clearly read USN from image. Please ensure the image is clear.");
        }
      }
      
      if (detectedValidity) {
        toast.success(`Detected Validity: ${detectedValidity}`);
      }
      
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
          if (!confirm("Your ID card verification failed or didn't match. Save anyway?")) {
            setIsSaving(false);
            return;
          }
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error("No authenticated email found.");

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name,
          usn,
          department,
          branch: year,
          section,
          mobile
        })
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
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>
      
      {/* Top Header */}
      <div className="w-full max-w-3xl mx-auto mb-8 relative z-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent tracking-tight">
            MY PROFILE
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mt-1">
            Manage your personal details
          </p>
        </div>
        
        <button 
          onClick={() => router.push('/student/dashboard')}
          className="px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white uppercase font-mono text-xs font-bold"
        >
          ← Go Back
        </button>
      </div>

      <div className="w-full max-w-3xl mx-auto relative z-10 flex-grow">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            <div className="bg-gradient-to-r from-pink-950/30 to-rose-950/30 p-6 border-b border-zinc-800 flex flex-col gap-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Identity Credentials
              </h2>
              <p className="text-xs text-zinc-400">Please ensure all fields are accurately filled. This information is used for hardware checkout and lab access.</p>
            </div>

            <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-white" 
                    placeholder="Please enter your name" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">USN (University Seat Number)</label>
                  <input 
                    required 
                    type="text" 
                    value={usn} 
                    onChange={e => {
                       setUsn(e.target.value.toUpperCase());
                       setScanResult(null); // Reset scan result on USN change
                    }} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-white" 
                    placeholder="e.g. 1RV22CS001" 
                  />
                </div>
              </div>

              {/* ID Card Upload Section */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 md:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">ID Card Verification</h3>
                    <p className="text-xs text-zinc-400">Upload your student ID card to verify your USN automatically using AI scanning.</p>
                  </div>
                  {scanResult?.match && (
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </div>
                  )}
                  {scanResult && !scanResult.match && (
                    <div className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-bold border border-rose-500/20 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> MISMATCH
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-start">
                  {idCardPreview ? (
                    <div className="relative w-full md:w-32 h-24 rounded-lg overflow-hidden border border-zinc-700 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={idCardPreview} alt="ID Card Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setIdCardFile(null);
                          setIdCardPreview(null);
                          setScanResult(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full md:w-32 h-24 rounded-lg border-2 border-dashed border-zinc-700 hover:border-rose-500 hover:bg-rose-500/5 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-rose-400"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Upload ID</span>
                    </button>
                  )}
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleIdCardUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex-1 bg-zinc-950 rounded-lg p-3 border border-zinc-800 w-full text-xs font-mono">
                    {isScanning ? (
                      <div className="flex items-center gap-2 text-cyan-400">
                        <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        Scanning document...
                      </div>
                    ) : scanResult ? (
                      <div className="space-y-1">
                        <div className="text-zinc-500">Scan Status:</div>
                        {scanResult.match ? (
                          <div className="text-emerald-400">✅ USN Match Confirmed: {scanResult.detectedUsn}</div>
                        ) : (
                          <div className="text-rose-400">❌ Verification Failed. Found: {scanResult.detectedUsn || 'None'}</div>
                        )}
                        {scanResult.detectedValidity && (
                          <div className="text-cyan-400 mt-1">📅 Validity Detected: {scanResult.detectedValidity}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-zinc-500">
                        Awaiting scan. Please enter your USN and upload an image of your ID card for automatic verification.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Year</label>
                  <select 
                    required
                    value={year} 
                    onChange={e => setYear(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 appearance-none text-white"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Department</label>
                  <select 
                    required
                    value={department} 
                    onChange={e => setDepartment(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 appearance-none text-white"
                  >
                    <option value="" disabled>Select Department</option>
                    <option value="CSE">Computer Science & Engineering</option>
                    <option value="ISE">Information Science & Engineering</option>
                    <option value="ECE">Electronics & Communication</option>
                    <option value="EEE">Electrical & Electronics</option>
                    <option value="MECH">Mechanical Engineering</option>
                    <option value="CIVIL">Civil Engineering</option>
                    <option value="AI_ML">Artificial Intelligence & ML</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Section</label>
                <select 
                  required
                  value={section} 
                  onChange={e => setSection(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 appearance-none text-white"
                >
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

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Mobile Number</label>
                <input 
                  required 
                  type="tel" 
                  value={mobile} 
                  onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-white" 
                  placeholder="Enter your phone number" 
                />
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(244,63,94,0.3)] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSaving ? 'Saving Profile...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
