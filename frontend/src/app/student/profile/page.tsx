'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function MyProfile() {
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile Fields
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [year, setYear] = useState('1st Year');
  const [section, setSection] = useState('');
  const [trustScore, setTrustScore] = useState(100);

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
          .select('user_id, name, usn, department, branch, section, trust_score')
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
          if (userData.trust_score !== undefined && userData.trust_score !== null) setTrustScore(userData.trust_score);
        }
      } catch (error: any) {
        toast.error(`Error loading profile: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setIsSaving(true);
    try {
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
          section
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
            
            {/* Trust Score Card */}
            <div className="bg-gradient-to-r from-cyan-950/30 to-indigo-950/30 p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Trust Score
                </h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-md">Your trust score determines your borrowing limits. Return items on time and in good condition to increase it.</p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-black ${trustScore < 50 ? 'text-red-500' : trustScore >= 150 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {trustScore}
                </div>
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mt-1">/ 200 Max</div>
              </div>
            </div>

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
                    onChange={e => setUsn(e.target.value.toUpperCase())} 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-white" 
                    placeholder="e.g. 1RV22CS001" 
                  />
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
