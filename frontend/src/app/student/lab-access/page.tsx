'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LabAccessCheckout() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [section, setSection] = useState('A');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('12:30 PM - 01:30 PM');
  const [labName, setLabName] = useState('EDL Main Workspace');
  const [purpose, setPurpose] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Attempt to auto-fill user details from session
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('name, usn, department, section')
          .eq('email', session.user.email)
          .single();
        
        if (data) {
          setStudentName(data.name || '');
          setUsn(data.usn || '');
          if (data.department) setDepartment(data.department);
          if (data.section) setSection(data.section);
        }
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/lab-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          usn,
          department, // Custom field, though API does auto-infer from labName too
          section,
          labName,
          accessDate: date,
          timeSlot,
          purpose
        })
      });

      if (!res.ok) throw new Error('Failed to submit lab access request');
      
      setMessage({ text: 'Lab access request submitted successfully! Awaiting HOD approval.', type: 'success' });
      
      // Redirect back to dashboard
      setTimeout(() => router.push('/student/dashboard'), 2000);
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>
      
      <div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 border-b border-zinc-800">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">WORKSPACE ACCESS</h2>
              <p className="text-zinc-500 text-xs font-mono mt-1 uppercase tracking-widest">Lab Admission Permit Form</p>
            </div>
            <button onClick={() => router.push('/student/dashboard')} className="text-zinc-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium border ${message.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Student Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono text-indigo-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Student Details</h3>
              
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                <input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="John Doe" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">USN</label>
                <input required type="text" value={usn} onChange={e => setUsn(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="4VV25CS001" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none">
                    <option value="CSE">1. CSE</option>
                    <option value="MECH">2. Mechanical</option>
                    <option value="ECE">3. ECE</option>
                    <option value="EEE">4. EEE</option>
                    <option value="CIVIL">5. CIVIL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Section</label>
                  <select value={section} onChange={e => setSection(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none">
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
              <h3 className="text-xs font-mono text-indigo-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Workspace Details</h3>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Select Laboratory</label>
                <select required value={labName} onChange={e => setLabName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none">
                  <option value="EDL Main Workspace">EDL Main Workspace</option>
                  <option value="Computer Lab">Computer Lab</option>
                  <option value="IoT & Sensors Lab">IoT & Sensors Lab</option>
                  <option value="AI / ML Server Lab">AI / ML Server Lab</option>
                  <option value="Mechatronics Suite">Mechatronics Suite</option>
                  <option value="Fabrication Room">Fabrication Room (Soldering)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Access Date</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Time Slot</label>
                  <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none">
                    <option value="12:30 PM - 01:30 PM">12:30 PM - 01:30 PM</option>
                    <option value="04:30 PM - 06:00 PM">04:30 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Purpose / Project Description</label>
                <textarea 
                  required 
                  value={purpose} 
                  onChange={e => setPurpose(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none h-20"
                  placeholder="e.g. Assembling IoT weather station..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoading ? 'Processing Request...' : 'Submit Access Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
