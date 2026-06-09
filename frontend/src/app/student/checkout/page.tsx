'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface InventoryItem {
  id: string | number;
  name: string;
  available: number;
  total: number;
  department: string;
  status: string;
}

export default function StudentCheckout() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [section, setSection] = useState('A');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [duration, setDuration] = useState(7);
  const [selectedComponent, setSelectedComponent] = useState('');
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Attempt to auto-fill USN from login
    const savedUsn = localStorage.getItem('usn');
    if (savedUsn) setUsn(savedUsn);

    // Fetch inventory for the dropdown
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        setInventory(data);
        if (data.length > 0) {
          setSelectedComponent(data[0].name);
        }
      })
      .catch(err => console.error("Failed to load inventory", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const componentItem = inventory.find(i => i.name === selectedComponent);

    try {
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
          items: [{ 
            name: selectedComponent, 
            department: componentItem?.department || 'EDL',
            location: 'Main Lab'
          }]
        })
      });

      if (!res.ok) throw new Error('Failed to submit checkout request');
      
      setMessage({ text: 'Checkout request submitted successfully!', type: 'success' });
      // Reset some fields
      setTimeout(() => router.push('/student'), 2000);
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none z-0"></div>
      
      <div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 border-b border-zinc-800">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">COMPONENT CHECKOUT</h2>
              <p className="text-zinc-500 text-xs font-mono mt-1 uppercase tracking-widest">Hardware Requisition Form</p>
            </div>
            <button onClick={() => router.push('/student')} className="text-zinc-500 hover:text-white transition-colors">
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
              <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Student Details</h3>
              
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                <input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" placeholder="John Doe" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">USN</label>
                <input required type="text" value={usn} onChange={e => setUsn(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" placeholder="4VV25CS001" />
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
                  </select>
                </div>
              </div>
            </div>

            {/* Request Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono text-cyan-500 tracking-widest uppercase border-b border-zinc-800 pb-2 mb-4">Requisition Details</h3>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Select Component</label>
                <select required value={selectedComponent} onChange={e => setSelectedComponent(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 appearance-none">
                  {inventory.filter(i => i.status === 'Available').length === 0 && <option value="">Loading components...</option>}
                  {inventory.filter(i => i.status === 'Available').map(item => (
                    <option key={item.id} value={item.name}>{item.name} ({item.available} available)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Date of Collection</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Time of Collection</label>
                  <input required type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Duration (Days)</label>
                <input required type="number" min="1" max="30" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoading ? 'Processing Request...' : 'Submit Checkout Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
