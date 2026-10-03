'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Cpu, Clock, AlertCircle, Search, ShieldBan, Package, LogOut, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const COLORS = ['#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function AdminIotDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'defaulters' | 'inventory'>('overview');
  const [labFilter, setLabFilter] = useState<'all' | 1 | 2>('all');
  const [adminLabId, setAdminLabId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newComp, setNewComp] = useState({ name: '', description: '', total_quantity: 0 });
  const [sectionFilter, setSectionFilter] = useState<'current' | 'completed'>('current');
  const [selectedSectionTracker, setSelectedSectionTracker] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const init = async () => {
      let resolvedLabId = null;
      try {
        const res = await fetch('/api/auth', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.department) {
            if (data.department === 'IOT306') resolvedLabId = 1;
            if (data.department === 'IOT302') resolvedLabId = 2;
          }
        }
      } catch (err) {}
      
      if (resolvedLabId) {
        setAdminLabId(resolvedLabId);
        setLabFilter(resolvedLabId as 1 | 2);
      }
      fetchData(resolvedLabId);
    };
    init();
  }, []);

  const fetchData = async (labId: number | null) => {
    setIsLoading(true);
    
    try {
      const targetLab = labId || (labFilter === 'all' ? '' : labFilter);
      const res = await fetch(`/api/iot-admin${targetLab ? `?lab_id=${targetLab}` : ''}`);
      const data = await res.json();
      
      if (data.components) setComponents(data.components);
      if (data.transactions) setTransactions(data.transactions);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
    
    setIsLoading(false);
  };

  // Derive stats dynamically from the filtered transactions!
  const filteredTxs = transactions.filter(t => labFilter === 'all' || t.lab_id === labFilter);
  
  const compUsage: Record<string, number> = {};
  const secUsage: Record<string, number> = {};
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - 7 * 24 * 60 * 60 * 1000;

  let totalComponentsUsed = 0;
  let todayComponentsUsed = 0;
  let weekComponentsUsed = 0;

  filteredTxs.forEach(tx => {
    const txTime = new Date(tx.created_at).getTime();
    tx.iot_transaction_items?.forEach((item: any) => {
      const name = item.iot_components?.name;
      if (name) compUsage[name] = (compUsage[name] || 0) + item.quantity;
      
      totalComponentsUsed += item.quantity;
      if (txTime >= startOfDay) todayComponentsUsed += item.quantity;
      if (txTime >= startOfWeek) weekComponentsUsed += item.quantity;
    });
    const sec = tx.users?.section || 'Unknown';
    secUsage[sec] = (secUsage[sec] || 0) + 1;
  });

  const todayTxs = filteredTxs.filter(t => new Date(t.created_at).getTime() >= startOfDay);
  const weekTxs = filteredTxs.filter(t => new Date(t.created_at).getTime() >= startOfWeek);

  const dailyActivityMap: Record<string, number> = {};
  filteredTxs.forEach(tx => {
    const d = new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyActivityMap[d] = (dailyActivityMap[d] || 0) + 1;
  });
  const dailyStats = Object.keys(dailyActivityMap).map(d => ({ date: d, checkouts: dailyActivityMap[d] })).slice(-7);

  const activeSessions = filteredTxs.filter(t => t.type === 'session' && t.status === 'borrowed');
  const sessionGroups = activeSessions.reduce((acc: any, tx: any) => {
    const time = tx.session_time || 'Unknown Session';
    if (!acc[time]) acc[time] = [];
    acc[time].push(tx);
    return acc;
  }, {});

  const sectionStats = Object.keys(secUsage).map(key => ({ name: `Section ${key}`, value: secUsage[key] }));

  const markReturned = async (txId: string) => {
    // Ideally this should restore component quantities. Assuming a simple update for UI here.
    const res = await fetch('/api/iot-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'return_tx', id: txId })
    });
    const { error } = await res.json();
    if (error) {
      toast.error(error);
    } else {
      toast.success('Items marked as returned');
      fetchData(adminLabId);
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComp.name || newComp.total_quantity <= 0) {
      toast.error('Invalid component data');
      return;
    }

    const targetLab = adminLabId || (labFilter === 'all' ? 1 : labFilter);

    const res = await fetch('/api/iot-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'insert',
        name: newComp.name,
        description: newComp.description,
        total_quantity: newComp.total_quantity,
        available_quantity: newComp.total_quantity,
        lab_id: targetLab
      })
    });
    
    const { error } = await res.json();

    if (error) {
      toast.error(error || 'Failed to add component');
    } else {
      toast.success('Component added successfully!');
      setShowAddModal(false);
      setNewComp({ name: '', description: '', total_quantity: 0 });
      fetchData(adminLabId);
    }
  };

  const updateStock = async (compId: string, newTotal: number) => {
    // Also adjust available_quantity proportionally
    const comp = components.find(c => c.id === compId);
    if (!comp) return;
    
    const diff = newTotal - comp.total_quantity;
    const newAvailable = comp.available_quantity + diff;
    
    if (newAvailable < 0) {
      toast.error("Cannot reduce stock: items are currently checked out.");
      return;
    }

    const res = await fetch('/api/iot-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_stock',
        id: compId,
        total_quantity: newTotal,
        available_quantity: newAvailable
      })
    });
    const { error } = await res.json();

    if (error) {
      toast.error(error || 'Failed to update stock');
    } else {
      toast.success('Stock updated');
      fetchData(adminLabId);
    }
  };

  const deleteComponent = async (compId: string) => {
    if (!confirm('Are you sure you want to delete this component? This cannot be undone.')) return;
    const res = await fetch('/api/iot-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: compId })
    });
    const { error } = await res.json();
    if (error) {
      toast.error('Cannot delete: component is linked to existing transactions.');
    } else {
      toast.success('Component deleted');
      fetchData(adminLabId);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-teal-700"><div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-teal-600/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 p-6 rounded-3xl border border-slate-300 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <img src="/vvce-logo.png" alt="VVCE Logo" className="w-14 h-14 object-contain drop-shadow-sm" />
            <div>
              <h1 className="text-3xl font-black tracking-tight text-blue-950">
                IoT Lab Admin Dashboard
              </h1>
              <p className="text-blue-700/80 font-semibold text-sm mt-0.5">Real-time inventory and checkout monitoring</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {!adminLabId && (
              <select value={labFilter} onChange={e => setLabFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border border-slate-300 text-slate-700 outline-none">
                <option value="all">All Labs (M306 & M302)</option>
                <option value="1">Lab M306</option>
                <option value="2">Lab M302</option>
              </select>
            )}
            {adminLabId && (
              <div className="px-4 py-2 bg-teal-50 border border-teal-200 rounded-xl text-sm font-bold text-teal-700 uppercase tracking-wide">
                M30{adminLabId === 1 ? '6' : '2'} Admin
              </div>
            )}
            <button onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              localStorage.clear();
              window.location.href = '/';
            }} className="px-4 py-2 bg-white hover:bg-slate-50 rounded-xl text-sm font-bold border border-slate-300 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-white rounded-2xl w-fit border border-slate-200">
          {[
            { id: 'overview', label: 'Analytics & Overview', icon: Users },
            { id: 'sessions', label: 'Live Checkouts', icon: Clock },
            { id: 'sections', label: 'Section Tracking', icon: Users },
            { id: 'inventory', label: 'Inventory', icon: Package }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-teal-600/20 text-teal-700 shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-teal-200 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-teal-50 rounded-lg text-teal-600"><Clock className="w-5 h-5" /></div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full animate-pulse border border-teal-100">Today</span>
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-3xl font-black text-slate-800">{todayTxs.length}</div>
                  <div className="text-sm font-semibold text-slate-500 mb-1">{todayComponentsUsed} items used</div>
                </div>
                <div className="text-xs font-semibold text-slate-500 mt-2 uppercase tracking-wider">Today's Checkouts</div>
              </div>
              
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">7 Days</span>
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-3xl font-black text-slate-800">{weekTxs.length}</div>
                  <div className="text-sm font-semibold text-slate-500 mb-1">{weekComponentsUsed} items used</div>
                </div>
                <div className="text-xs font-semibold text-slate-500 mt-2 uppercase tracking-wider">This Week's Checkouts</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-fuchsia-200 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-fuchsia-50 rounded-lg text-fuchsia-600"><Cpu className="w-5 h-5" /></div>
                </div>
                <div className="text-3xl font-black text-slate-800">{totalComponentsUsed}</div>
                <div className="text-xs font-semibold text-slate-500 mt-2 uppercase tracking-wider">Total Components Used (All Time)</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-300 rounded-3xl p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Daily Checkout Activity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyStats}>
                      <defs>
                        <linearGradient id="colorCheckouts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="checkouts" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCheckouts)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white border border-slate-300 rounded-3xl p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Section-wise Checkout Volume</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectionStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {sectionStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {sectionStats.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Live Sessions Tab */}
        {activeTab === 'sessions' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {Object.keys(sessionGroups).length === 0 && (
              <div className="bg-white border border-slate-300 rounded-3xl p-12 text-center text-slate-500 font-medium">
                No active session checkouts currently.
              </div>
            )}
            {Object.keys(sessionGroups).map(sessionTime => (
              <div key={sessionTime} className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 bg-teal-50 border-b border-teal-100 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600"/> Session: {sessionTime}</h3>
                  <span className="text-xs font-bold bg-teal-100 text-teal-700 px-2 py-1 rounded-full border border-teal-200">{sessionGroups[sessionTime].length} checkouts</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <th className="p-4">Section / Team</th>
                        <th className="p-4">Student Info</th>
                        <th className="p-4">Components Borrowed</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-600">
                      {sessionGroups[sessionTime].map((tx: any) => (
                        <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-4 align-top">
                            <span className="px-2 py-1 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded uppercase tracking-wider">Sec {tx.users?.section || 'Unknown'}</span>
                          </td>
                          <td className="p-4 align-top">
                            <div className="font-bold text-slate-900">{tx.users?.name}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{tx.users?.usn}</div>
                            
                            {tx.project_title && (
                              <div className="mt-3">
                                <button onClick={() => toggleRow(tx.id)} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors">
                                  {expandedRows.has(tx.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  {expandedRows.has(tx.id) ? 'Hide Team' : 'View Team'}
                                </button>
                                <AnimatePresence>
                                  {expandedRows.has(tx.id) && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                      <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-medium text-slate-600 leading-relaxed">
                                        <div className="font-bold text-slate-700 mb-1">Team Members:</div>
                                        {tx.project_title}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex flex-wrap gap-1">
                              {tx.iot_transaction_items?.map((item:any, i:number) => (
                                <div key={i} className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">
                                  {item.quantity}x {item.iot_components?.name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <button onClick={() => markReturned(tx.id)} className="px-3 py-1.5 bg-white border border-slate-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-bold transition-all shadow-sm">
                              Mark Returned
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Section Tracking Tab */}
        {activeTab === 'sections' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-300 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500"/> Section Tracking</h3>
                <p className="text-xs text-slate-500 mt-1">Track components borrowed by section.</p>
              </div>
              <div className="flex items-center gap-3">
                <select value={selectedSectionTracker} onChange={e => setSelectedSectionTracker(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer">
                  <option value="all">All Sections</option>
                  {['A','B','C','D','E','F','G','H','I','J','K','L'].map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
                <div className="flex bg-white rounded-xl border border-slate-300 p-1">
                  <button onClick={() => setSectionFilter('current')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${sectionFilter === 'current' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Current</button>
                  <button onClick={() => setSectionFilter('completed')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${sectionFilter === 'completed' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Completed</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-300 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <th className="p-4 w-12">#</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Team & Section</th>
                    <th className="p-4">Items Borrowed</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredTxs.filter(t => {
                    const matchesStatus = sectionFilter === 'current' ? ['active', 'borrowed', 'overdue'].includes(t.status) : t.status === 'returned';
                    const matchesSection = selectedSectionTracker === 'all' || (t.users?.section && t.users.section.toUpperCase() === selectedSectionTracker);
                    return matchesStatus && matchesSection;
                  }).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No {sectionFilter} checkouts found for this section.</td></tr>
                  )}
                  {filteredTxs.filter(t => {
                    const matchesStatus = sectionFilter === 'current' ? ['active', 'borrowed', 'overdue'].includes(t.status) : t.status === 'returned';
                    const matchesSection = selectedSectionTracker === 'all' || (t.users?.section && t.users.section.toUpperCase() === selectedSectionTracker);
                    return matchesStatus && matchesSection;
                  }).map((tx, index) => (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                      <td className="p-4 align-top text-xs font-medium text-slate-400">
                        {index + 1}
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-bold text-slate-900">{tx.users?.name}</div>
                        <div className="text-xs text-slate-500 font-semibold">{tx.users?.usn}</div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex gap-2 items-center">
                          <span className="px-2 py-1 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded uppercase tracking-wider block w-max">Sec {tx.users?.section?.toUpperCase() || 'Unknown'}</span>
                          <span className={`px-2 py-1 border font-bold text-[9px] rounded uppercase tracking-wider block w-max ${tx.status === 'overdue' ? 'bg-red-50 text-red-600 border-red-200' : tx.status === 'returned' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{tx.status}</span>
                        </div>
                        {tx.project_title && (
                          <div className="mt-3">
                            <button onClick={() => toggleRow(`sec_${tx.id}`)} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors">
                              {expandedRows.has(`sec_${tx.id}`) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {expandedRows.has(`sec_${tx.id}`) ? 'Hide Team' : 'View Team'}
                            </button>
                            <AnimatePresence>
                              {expandedRows.has(`sec_${tx.id}`) && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-medium text-slate-600 leading-relaxed">
                                    <div className="font-bold text-slate-700 mb-1">Team Members:</div>
                                    {tx.project_title}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        {tx.iot_transaction_items?.map((item:any, i:number) => (
                          <div key={i} className="text-xs font-medium text-slate-600">• {item.quantity}x {item.iot_components?.name}</div>
                        ))}
                      </td>
                      <td className="p-4 align-top">
                        <div className="text-xs font-bold text-slate-700">{new Date(tx.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-blue-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {tx.session_time || 'No Session Data'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-300 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-300 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Component Catalog</h3>
                <p className="text-xs text-slate-500 mt-1">Manage lab inventory levels.</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-teal-600 text-black font-bold rounded-xl text-sm hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                + Add Component
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50">
              {components.map(comp => (
                <div key={comp.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-800">{comp.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{comp.description}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${comp.available_quantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        {comp.available_quantity > 0 ? 'In Stock' : 'Out'}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-xs text-slate-500 font-medium">Available</div>
                      <div className="font-mono text-xl text-teal-700 font-black">{comp.available_quantity} <span className="text-sm text-slate-400 font-medium">/ {comp.total_quantity}</span></div>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full transition-all duration-500" 
                        style={{width: `${(comp.available_quantity / comp.total_quantity) * 100}%`}} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => updateStock(comp.id, comp.total_quantity + 1)} className="flex-1 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors">
                      +1 Stock
                    </button>
                    <button onClick={() => updateStock(comp.id, comp.total_quantity - 1)} disabled={comp.total_quantity <= 0} className="flex-1 py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                      -1 Stock
                    </button>
                    <button onClick={() => deleteComponent(comp.id)} className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg transition-colors flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
      
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Add New IoT Component</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><LogOut className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddInventory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Component Name</label>
                <input type="text" required value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors" placeholder="e.g. NodeMCU ESP8266" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description (Optional)</label>
                <input type="text" value={newComp.description} onChange={e => setNewComp({...newComp, description: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors" placeholder="Microcontroller board" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Total Quantity</label>
                <input type="number" min="1" required value={newComp.total_quantity || ''} onChange={e => setNewComp({...newComp, total_quantity: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors" placeholder="0" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-black bg-teal-500 hover:bg-teal-400 transition-colors">Save Component</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
