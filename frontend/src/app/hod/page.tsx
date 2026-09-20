'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { siteConfig } from '@/config/site';

interface RequestItem {
  id: string;
  studentName: string;
  usn: string;
  component: string;
  department: string;
  studentDepartment?: string;
  duration: number;
  requestDate: string;
  status: string;
  images?: string[];
  time?: string;
  date?: string;
  location?: string;
  returnImages?: string[];
  renewalReason?: string;
  renewalDays?: number;
  isDamaged?: boolean;
  dueDate?: string;
  valueTier?: string;
  quantity?: number;
}

export default function HodDashboard() {
  const router = useRouter();
  const [activeDept, setActiveDept] = useState<string>('EDL');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [collegeName, setCollegeName] = useState(siteConfig.collegeName);
  const [loading, setLoading] = useState(true);
  
  // Interactive view switcher and graphing states
  const [viewMode, setViewMode] = useState<'requests' | 'analytics'>('requests');
  const [isLocked, setIsLocked] = useState(false);

  const [workflowTab, setWorkflowTab] = useState<'ACTION_REQUIRED' | 'IN_PROGRESS' | 'ACTIVE' | 'HISTORY'>('ACTION_REQUIRED');
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState('2026-09');
  const [hoveredAnalyticsIdx, setHoveredAnalyticsIdx] = useState<number | null>(null);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');


  const handleLogout = () => {
    localStorage.removeItem('admin_dept');
    localStorage.removeItem('hod_dept');
    router.push('/');
  };

  const DEPT_INFO = [
    { id: 'EDL', title: 'Engineering Development LAB', color: 'from-blue-600 to-indigo-600' },
    { id: 'ECE', title: 'Electronics & Comm.', color: 'from-purple-600 to-pink-600' },
    { id: 'EEE', title: 'Electrical Engineering', color: 'from-amber-500 to-orange-600' },
    { id: 'MECH', title: 'Mechanical Engineering', color: 'from-emerald-600 to-teal-600' },
    { id: 'CIVIL', title: 'Civil Engineering', color: 'from-rose-500 to-red-600' }
  ];

  useEffect(() => {
    const storedCollege = localStorage.getItem('collegeName');
    if (storedCollege) setCollegeName(storedCollege.toUpperCase());

    // Department context read from localStorage for UI state only.
    // Auth enforcement is handled server-side (layout.tsx + middleware.ts).
    const hodDept = localStorage.getItem('hod_dept');
    if (hodDept) {
      setActiveDept(hodDept);
      setIsLocked(true);
    }

    fetchRequests(true);
    fetchInventory();

    // Real-time polling interval (every 5 seconds) to catch incoming student requests immediately
    const interval = setInterval(() => {
      fetchRequests(false);
    }, 5000);

    const handleFocus = () => {
      fetchRequests(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchRequests = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch requests', e);
      setRequests([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch inventory', e);
      setInventory([]);
    }
  };

    const monthLabels: Record<string, string> = {
    '2026-12': 'December 2026', '2026-11': 'November 2026', '2026-10': 'October 2026',
    '2026-09': 'September 2026', '2026-08': 'August 2026', '2026-07': 'July 2026',
    '2026-06': 'June 2026', '2026-05': 'May 2026', '2026-04': 'April 2026',
    '2026-03': 'March 2026', '2026-02': 'February 2026'
  };

  const getMonthlyStats = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;
    
    let prevYear = targetYear;
    let prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevMonth = prevDate.getMonth();

    const safeRequests = Array.isArray(requests) ? requests : [];
    const deptReqs = safeRequests.filter(r => r.department === activeDept || r.studentDepartment === activeDept);

    const monthReqs = deptReqs.filter(r => {
      if (!r.requestDate) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const prevMonthReqs = deptReqs.filter(r => {
      if (!r.requestDate) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    });

    return {
      curr: { reqs: monthReqs.length, total: monthReqs.length },
      prev: { reqs: prevMonthReqs.length, total: prevMonthReqs.length }
    };
  };

  const getChartDataForMonth = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dailyData = [];

    const safeRequests = Array.isArray(requests) ? requests : [];
    const deptReqs = safeRequests.filter(r => r.department === activeDept || r.studentDepartment === activeDept);

    for (let day = 1; day <= daysInMonth; day++) {
      const datePrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const reqsCount = deptReqs.filter(r => r.requestDate === datePrefix).length;

      dailyData.push({
        day,
        dateStr: datePrefix,
        reservations: reqsCount,
        total: reqsCount
      });
    }
    return dailyData;
  };

  const getRecentActivity = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const activities: any[] = [];
    const safeRequests = Array.isArray(requests) ? requests : [];

    safeRequests.forEach(r => {
      if (!r.requestDate || (r.department !== activeDept && r.studentDepartment !== activeDept)) return;
      const d = new Date(r.requestDate);
      if (d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
        activities.push({
          type: 'reservation',
          id: r.id,
          title: `Reservation: ${r.component}`,
          student: `${r.studentName} (${r.usn})`,
          date: r.requestDate,
          status: r.status,
          timestamp: new Date(r.requestDate).getTime()
        });
      }
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  };

  const getPercentageChange = (curr: number, prev: number) => {
    if (prev === 0) {
      return curr > 0 ? '+100%' : '0%';
    }
    const pct = ((curr - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const handleAction = async (id: string, approve: boolean) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    const isRenewal = req.status === 'Pending Renewal HOD';
    const newStatus = approve 
      ? (isRenewal ? 'Active' : 'APPROVED') 
      : (isRenewal ? 'Active' : 'Rejected');
    
    const payload: any = { id, status: newStatus };
    if (approve && isRenewal && req.renewalDays) {
      const currentDueDate = req.dueDate ? new Date(req.dueDate) : new Date();
      currentDueDate.setDate(currentDueDate.getDate() + req.renewalDays);
      payload.dueDate = currentDueDate.toISOString();
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, dueDate: payload.dueDate || r.dueDate } : r));
        setSelectedReq(null);
      }
    } catch (e) {
      console.error('Failed to update request', e);
    }
  };

    // Analytics Derived Data
  const analyticsStats = getMonthlyStats(selectedAnalyticsMonth);
  const analyticsChartData = getChartDataForMonth(selectedAnalyticsMonth);
  const analyticsRecentActivity = getRecentActivity(selectedAnalyticsMonth);

  const totalChangeStr = getPercentageChange(analyticsStats.curr.total, analyticsStats.prev.total);
  const reqsChangeStr = getPercentageChange(analyticsStats.curr.reqs, analyticsStats.prev.reqs);

  const analyticsYMax = Math.max(...analyticsChartData.map(d => d.total), 4);

  let updatesLinePath = '';
  let updatesAreaPath = '';

  if (analyticsChartData.length > 0) {
    const points = analyticsChartData.map((d, idx) => {
      const x = 45 + idx * (530 / (analyticsChartData.length - 1));
      const y = 180 - (d.total / analyticsYMax) * 140;
      return `${x},${y}`;
    });

    updatesLinePath = `M ${points.join(' L ')}`;
    updatesAreaPath = `M 45,180 L ${points.join(' L ')} L ${45 + (analyticsChartData.length - 1) * (530 / (analyticsChartData.length - 1))},180 Z`;
  }

  const selectedMonthLabel = monthLabels[selectedAnalyticsMonth] || selectedAnalyticsMonth;

  // Filter requests (matching either component department or student department)
  const safeRequests = Array.isArray(requests) ? requests : [];
  const deptRequests = safeRequests.filter(r => r.department === activeDept || r.studentDepartment === activeDept);
  
  // Categorize for workflow tabs
  const actionRequiredReqs = deptRequests.filter(r => r.status === 'Pending HOD' || r.status === 'PENDING_HOD' || r.status === 'Pending Renewal HOD');
  const inProgressReqs = deptRequests.filter(r => r.status === 'PENDING_APPROVAL' || r.status === 'APPROVED' || r.status === 'READY_FOR_PICKUP');
  const activeLoansReqs = deptRequests.filter(r => r.status === 'CHECKED_OUT' || r.status === 'Active');
  const historyReqs = deptRequests.filter(r => r.status === 'RETURN_REQUESTED' || r.status === 'RETURNED' || r.status === 'COMPLETED' || r.status === 'REJECTED' || r.status === 'CANCELLED' || r.status === 'Approved by HOD' || r.status === 'Rejected');

  let currentTabRequests: RequestItem[] = [];
  if (workflowTab === 'ACTION_REQUIRED') currentTabRequests = actionRequiredReqs;
  else if (workflowTab === 'IN_PROGRESS') currentTabRequests = inProgressReqs;
  else if (workflowTab === 'ACTIVE') currentTabRequests = activeLoansReqs;
  else if (workflowTab === 'HISTORY') currentTabRequests = historyReqs;

  const activeDeptPending = actionRequiredReqs.length;
  const activeDeptApproved = historyReqs.filter(r => r.status.includes('Approved') || r.status === 'APPROVED' || r.status === 'Ready for Collection' || r.status === 'Active' || r.status.includes('Renewal') || r.status === 'CHECKED_OUT').length;
  const activeDeptRejected = historyReqs.filter(r => r.status === 'Rejected' || r.status === 'REJECTED').length;


  return (
    <div className="min-h-screen bg-zinc-950 text-white p-3 sm:p-6 md:p-8 font-sans print:bg-white print:text-black">
      {/* ── Redesigned HOD Header ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 relative print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent uppercase">HOD Workspace</h1>
              {isLocked && activeDept && (
                <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full text-[11px] font-black uppercase tracking-widest">{activeDept}</span>
              )}
              <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider">Live</span>
              </div>
            </div>
            <p className="text-zinc-500 mt-0.5 text-xs">{collegeName} • Head of Department Panel</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-colors"
        >
          Logout
        </button>
      </header>
      <div className="border-b border-zinc-800/50 mb-6 sm:mb-8 print:hidden"></div>

      {/* ── Dept Selector Ribbon ── */}
      <div className="flex overflow-x-auto gap-2.5 pb-3 mb-6 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 md:grid-cols-5 sm:gap-3 print:hidden">
        {DEPT_INFO.map(dept => {
          const isSelected = activeDept === dept.id;
          const isDeptDisabled = isLocked && !isSelected;
          const pendingCount = requests.filter(r => (r.department === dept.id || r.studentDepartment === dept.id) && (r.status === 'Pending HOD' || r.status === 'PENDING_HOD' || r.status === 'Pending Renewal HOD')).length;
          return (
            <button
              key={dept.id}
              onClick={() => { if (!isDeptDisabled) { setActiveDept(dept.id); setSelectedReq(null); } }}
              disabled={isDeptDisabled}
              className={`shrink-0 w-36 sm:w-auto rounded-xl transition-all duration-300 ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-offset-zinc-950 ring-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : ''
              } ${isDeptDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <div className={`rounded-xl p-3 sm:p-4 text-left h-full flex flex-col justify-between transition-all duration-300 border ${
                isSelected
                  ? `bg-gradient-to-br ${dept.color} border-transparent`
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60'
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`text-lg sm:text-2xl font-black tracking-tight ${
                      isSelected ? 'text-white drop-shadow-sm' : 'text-zinc-200'
                    }`}>{dept.id}</span>
                    {pendingCount > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-black/25 text-white border border-white/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {pendingCount} new
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] sm:text-xs mt-1 line-clamp-1 ${
                    isSelected ? 'text-white/70' : 'text-zinc-500'
                  }`}>{dept.title}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* View Switcher Tabs & Inbox Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6 sm:mb-8 print:hidden">
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 flex-row gap-1 w-full sm:max-w-md">
          <button 
            onClick={() => setViewMode('requests')} 
            className={`flex-1 text-center py-1.5 rounded text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${viewMode === 'requests' ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' : 'text-zinc-400 hover:text-white border border-transparent hover:bg-zinc-800/50'}`}
          >
            Component Requests
          </button>
          <button 
            onClick={() => setViewMode('analytics')} 
            className={`flex-1 text-center py-1.5 rounded text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${viewMode === 'analytics' ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' : 'text-zinc-400 hover:text-white border border-transparent hover:bg-zinc-800/50'}`}
          >
            Monthly Updates
          </button>
        </div>

        <div className="relative flex-shrink-0 self-end sm:self-auto">
          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] sm:text-[11px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10">
            {activeDeptPending}
          </span>
          <div className="text-xs sm:text-sm bg-zinc-800/80 border border-zinc-700/80 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-xl text-zinc-300 font-medium shadow-md">
            Total Inbox: <span className="text-white font-bold ml-1">{activeDeptPending} Pending</span>
          </div>
        </div>
      </div>

      {viewMode === 'requests' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8 max-w-4xl">
            <div className="bg-zinc-900 border border-amber-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(245,158,11,0.05)]">
              <div className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Awaiting Decisions</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mt-1 sm:mt-2">{activeDeptPending}</div>
              <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">Pending HOD approval in {activeDept}</p>
            </div>
            <div className="bg-zinc-900 border border-emerald-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              <div className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Approved Requests</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mt-1 sm:mt-2">{activeDeptApproved}</div>
              <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">Total approved & active loans</p>
            </div>
            <div className="bg-zinc-900 border border-red-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(239,68,68,0.05)]">
              <div className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Rejected Requests</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-red-500 mt-1 sm:mt-2">{activeDeptRejected}</div>
              <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">Requests declined or returned</p>
            </div>
          </div>

          {/* Workflow Tabs */}
          <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-xl w-fit mb-6 border border-zinc-800">
            <button onClick={() => { setWorkflowTab('ACTION_REQUIRED'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'ACTION_REQUIRED' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>Action Required</button>
            <button onClick={() => { setWorkflowTab('IN_PROGRESS'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'IN_PROGRESS' ? 'bg-cyan-500 text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>Pending Admin / Checkout</button>
            <button onClick={() => { setWorkflowTab('ACTIVE'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'ACTIVE' ? 'bg-emerald-500 text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>Active Loans</button>
            <button onClick={() => { setWorkflowTab('HISTORY'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'HISTORY' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>History</button>
          </div>

          {/* Main Grid: Left side list, right side active preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            
            {/* List */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${workflowTab === 'ACTION_REQUIRED' ? 'bg-amber-500' : workflowTab === 'ACTIVE' ? 'bg-emerald-500' : workflowTab === 'IN_PROGRESS' ? 'bg-cyan-500' : 'bg-zinc-500'}`}></span>
                  {workflowTab === 'ACTION_REQUIRED' ? 'Action Required' : workflowTab === 'IN_PROGRESS' ? 'Pending Admin / Checkout' : workflowTab === 'ACTIVE' ? 'Actively Borrowed' : 'History'} ({currentTabRequests.length})
                </h2>

                {loading ? (
                  <div className="text-center py-12 text-zinc-600">Loading requests...</div>
                ) : currentTabRequests.length === 0 ? (
                  <div className="text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                    <p className="text-zinc-500 font-medium text-sm">No requests found here.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {currentTabRequests.map(req => (
                      <button
                        key={req.id}
                        onClick={() => setSelectedReq(req)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${selectedReq?.id === req.id ? 'bg-zinc-800 border-zinc-700 shadow-lg scale-[1.01]' : 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-zinc-500 font-mono font-bold">{req.id}</span>
                          <span className="text-xs text-zinc-400">{req.requestDate}</span>
                        </div>
                        <h3 className="font-bold text-white mb-1 line-clamp-1">{req.component}</h3>
                        <div className="flex justify-between items-end mt-4">
                          <div>
                            <p className="text-sm font-semibold text-zinc-300">{req.studentName}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{req.usn}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : req.status === 'PENDING_APPROVAL' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : req.status === 'APPROVED' || req.status === 'READY_FOR_PICKUP' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : req.status === 'CHECKED_OUT' || req.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                            {req.status === 'PENDING_HOD' || req.status === 'Pending HOD' ? 'AWAITING YOU' : req.status === 'PENDING_APPROVAL' ? 'AWAITING ADMIN' : req.status === 'CHECKED_OUT' || req.status === 'Active' ? 'BORROWED' : req.status === 'APPROVED' || req.status === 'READY_FOR_PICKUP' ? 'PENDING CHECKOUT' : req.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Requisition Digital Preview Panel */}
            <div className="lg:col-span-7">
              {selectedReq ? (
                <div className="space-y-6">
                  
                  {/* Geotag Images Uploaded */}
                  {selectedReq.images && selectedReq.images.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-zinc-400 mb-4 tracking-wider uppercase">Geotag Images Provided by Student</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedReq.images.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={img} 
                              alt={`Geotag ${idx + 1}`} 
                              className="w-full h-44 object-cover rounded-xl border border-zinc-700 shadow-md group-hover:brightness-110 transition-all cursor-zoom-in"
                              onClick={() => window.open(img)}
                            />
                            <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-zinc-300 border border-zinc-800 font-mono">
                              Image {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The Requisition Letter Mock Document */}
                  <div className="bg-white text-black p-4 sm:p-8 shadow-2xl rounded-2xl border border-zinc-300 relative min-h-[450px] sm:min-h-[600px] flex flex-col font-serif overflow-hidden">
                    
                    {/* Digital Preview Ribbon watermark */}
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 -rotate-12 border-2 sm:border-4 border-dashed border-emerald-500/20 px-4 py-2 sm:px-8 sm:py-3 text-base sm:text-2xl font-black text-emerald-500/15 uppercase tracking-widest font-sans select-none pointer-events-none">
                      Digital Document Preview
                    </div>

                    <div className="text-center mb-6 border-b border-black pb-4">
                      <h1 className="text-2xl font-black uppercase mb-1 font-sans tracking-wide">{collegeName}</h1>
                      <p className="text-sm font-bold font-sans tracking-wide text-zinc-600">Laboratory Hardware Requisition Form</p>
                    </div>

                    <div className="mb-4 text-right text-sm">
                      <p>Date: {selectedReq.requestDate}</p>
                    </div>

                    <div className="mb-4 leading-relaxed text-sm">
                      <p className="font-bold mb-0">To,</p>
                      <p className="mb-0">The Head of Department ({selectedReq.department}),</p>
                      <p className="mb-0">{collegeName}.</p>
                    </div>
                    <div className="mb-4 text-sm leading-relaxed text-justify">
                      <p className="mb-2"><strong>Subject:</strong> {selectedReq.status === 'Pending Renewal HOD' ? 'Request for Extension of Laboratory Hardware Borrowing Period' : `Requisition for borrowing Laboratory Hardware (${selectedReq.component})`}</p>
                      <p className="mb-2 font-bold">Respected Sir/Madam,</p>
                      <p className="mb-0">
                        {selectedReq.status === 'Pending Renewal HOD' ? (
                          <span>I, <strong>{selectedReq.studentName}</strong>, bearing University Serial Number (USN) <strong>{selectedReq.usn}</strong>, currently have the following component allocated to me. I request an extension of the borrowing period for academic project integration.</span>
                        ) : (
                          <span>I, <strong>{selectedReq.studentName}</strong>, bearing University Serial Number (USN) <strong>{selectedReq.usn}</strong>, humbly request the allocation of the following laboratory hardware for academic project integration.</span>
                        )}
                      </p>
                    </div>

                    <div className="overflow-x-auto w-full mb-4">
                      <table className="w-full text-left border-collapse border border-zinc-400 text-sm min-w-[500px]">
                      <tbody>
                        <tr className="border border-zinc-400">
                          <th className="p-2 border border-zinc-400 bg-zinc-100 w-1/3">Component Requested</th>
                          <td className="p-2 font-bold">{selectedReq.component}</td>
                        </tr>
                        <tr className="border border-zinc-400">
                          <th className="p-2 border border-zinc-400 bg-zinc-100">Lab Location</th>
                          <td className="p-2">{selectedReq.location || 'Main Lab'} ({selectedReq.department})</td>
                        </tr>
                        <tr className="border border-zinc-400">
                          <th className="p-2 border border-zinc-400 bg-zinc-100">Original Date</th>
                          <td className="p-2">{selectedReq.date || 'TBD'}</td>
                        </tr>
                        <tr className="border border-zinc-400">
                          <th className="p-2 border border-zinc-400 bg-zinc-100">Original Duration</th>
                          <td className="p-2">{selectedReq.duration} Days</td>
                        </tr>
                        {selectedReq.status === 'Pending Renewal HOD' && (selectedReq as any).renewalDays && (
                          <tr className="border border-zinc-400 bg-purple-50">
                            <th className="p-2 border border-zinc-400 bg-purple-100/50 w-1/3 font-bold text-purple-900">Extension Days</th>
                            <td className="p-2 font-black text-purple-700">+{ (selectedReq as any).renewalDays } Days</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>

                    {selectedReq.status === 'Pending Renewal HOD' && (selectedReq as any).renewalReason && (
                      <div className="mb-4 text-xs leading-relaxed p-3 bg-purple-50/50 border border-purple-200/50 rounded-lg text-left text-zinc-800">
                        <strong>Reason for Extension:</strong> "{ (selectedReq as any).renewalReason }"
                      </div>
                    )}

                    <div className="mb-6 italic text-xs text-justify leading-relaxed text-zinc-655 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      "I acknowledge that I will make sure the borrowed items will be used properly and safely, keep the items in good condition, and return the items to the lab in time exactly after the stated duration. I take responsibility for the cost of repair or replacement if any damage happens."
                    </div>

                    {/* Signature status block */}
                    <div className="mt-auto flex justify-between items-end text-xs mb-4">
                      <div className="text-center">
                        <div className="font-bold underline text-emerald-700">✓ Digital Signature</div>
                        <p className="font-bold">{selectedReq.studentName}</p>
                        <p className="text-[10px] text-zinc-500">Student Signee</p>
                      </div>
                      <div className="text-center">
                        <div className="h-6 w-24 mx-auto border-b border-black mb-1 flex items-center justify-center text-[10px] text-zinc-400 font-sans italic">
                          Pending Collection
                        </div>
                        <p className="font-bold">Lab Admin Office</p>
                      </div>
                      <div className="text-center">
                        <div className="h-6 w-24 mx-auto border-b border-black mb-1 flex items-center justify-center text-[10px] text-zinc-400 font-sans italic font-bold">
                          {selectedReq.status === 'Pending HOD' ? 'Awaiting Signature' : '✓ Digitally Approved'}
                        </div>
                        <p className="font-bold">HOD Office ({selectedReq.department})</p>
                      </div>
                    </div>
                  </div>

                  {/* Approval controls */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAction(selectedReq.id, false)}
                      className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition duration-300 shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:scale-95"
                    >
                      ✕ Decline Requisition
                    </button>
                    <button
                      onClick={() => handleAction(selectedReq.id, true)}
                      className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-black rounded-xl transition duration-300 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 text-center flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve Requisition
                    </button>
                  </div>

                </div>
              ) : (
                <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl p-12 text-center h-full flex flex-col justify-center items-center py-32">
                  <svg className="w-16 h-16 text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h3 className="text-xl font-bold text-zinc-400">Select a Student Request</h3>
                  <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                    Choose a requisition from the pending queue on the left to review geotag images, student details, and sign off digitally.
                  </p>
                </div>
              )}
            </div>

          </div>
        </>
      )}

            {/* Analytics Tab Content */}
      {viewMode === 'analytics' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">

          {/* Controls */}
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">Monthly Updates Analytics</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Historical activity performance and transaction summaries for {activeDept}.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={selectedAnalyticsMonth}
                onChange={e => setSelectedAnalyticsMonth(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
              >
                <option value="2026-12">December 2026</option>
                <option value="2026-11">November 2026</option>
                <option value="2026-10">October 2026</option>
                <option value="2026-09">September 2026 (Current)</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-07">July 2026</option>
                <option value="2026-06">June 2026</option>
                <option value="2026-05">May 2026</option>
                <option value="2026-04">April 2026</option>
                <option value="2026-03">March 2026</option>
                <option value="2026-02">February 2026</option>
              </select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Monthly Updates</p>
              <h2 className="text-4xl font-extrabold mt-3 text-white tracking-tight">{analyticsStats.curr.total}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(totalChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {totalChangeStr}
                </span>
                <span className="text-zinc-500">vs previous month ({analyticsStats.prev.total})</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-fuchsia-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Component Reservations</p>
              <h2 className="text-4xl font-extrabold mt-3 text-white tracking-tight">{analyticsStats.curr.reqs}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(reqsChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {reqsChangeStr}
                </span>
                <span className="text-zinc-500">vs previous month ({analyticsStats.prev.reqs})</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-rose-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">High-Value Items</p>
              <h2 className="text-4xl font-extrabold mt-3 text-white tracking-tight">
                {inventory.filter(i => i.department === activeDept && i.value_tier === 'HIGH').length}
              </h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">HOD Approval</span>
                <span className="text-zinc-500">requires dual sign-off</span>
              </div>
            </div>
          </div>

          {/* Advanced Analytics Dashboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Left Column: Utilization & Inventory Health */}
            <div className="space-y-6">
              
              {/* Utilization / Most Borrowed */}
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">Utilization</h3>
                    <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Most Borrowed Components</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                </div>
                  {(() => {
                    // Only count components that are ACTUALLY checked out (physically with student)
                    const activeStatuses = ['CHECKED_OUT'];
                    const safeReqs = Array.isArray(requests) ? requests : [];
                    const deptInv = inventory.filter(i => i.department === activeDept && i.total > 0);
                    const checkoutReqs = safeReqs.filter(r => (r.department === activeDept || r.studentDepartment === activeDept) && activeStatuses.includes(r.status));
                    
                    const compUsage: Record<string, { used: number, total: number }> = {};
                    deptInv.forEach(i => {
                      compUsage[i.name] = { used: 0, total: i.total };
                    });
                    
                    checkoutReqs.forEach(r => {
                      if (r.component && compUsage[r.component]) {
                        compUsage[r.component].used += (r.quantity || 1);
                      }
                    });

                    const sortedUsage = Object.entries(compUsage)
                      .map(([name, data]) => ({ name, ...data, ratio: data.used / data.total }))
                      .sort((a, b) => b.ratio - a.ratio)
                      .slice(0, 3);
                    
                    if (sortedUsage.length === 0) {
                      return <div className="text-sm text-zinc-500 py-4">No active checkouts currently.</div>;
                    }

                    return (
                      <div className="space-y-4">
                        {sortedUsage.map((u, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-zinc-300 font-medium">{u.name}</span>
                              <span className="text-zinc-400">{u.used} / {u.total} borrowed</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${u.ratio > 0.8 ? 'bg-rose-500' : u.ratio > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${Math.min(u.ratio * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
              </div>

              {/* Overdue Returns (Admin/HOD combined) */}
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">Action Needed</h3>
                    <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Overdue Returns</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                {(() => {
                  const safeReqs = Array.isArray(requests) ? requests : [];
                  const overdueList = safeReqs.filter(r => {
                    if (r.status !== 'CHECKED_OUT' || (r.department !== activeDept && r.studentDepartment !== activeDept)) return false;
                    const reqDate = new Date(r.requestDate);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - reqDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays > (r.duration || 7);
                  });

                  if (overdueList.length === 0) {
                    return <div className="text-sm text-emerald-500 font-medium py-4 flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> All checked out items are within their time limits.</div>;
                  }

                  return (
                    <div className="space-y-3">
                      {overdueList.slice(0, 3).map((r, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                          <div>
                            <div className="text-sm text-white font-medium">{r.component}</div>
                            <div className="text-xs text-zinc-500">{r.studentName} ({r.usn})</div>
                          </div>
                          <div className="text-xs font-bold text-rose-400">Overdue</div>
                        </div>
                      ))}
                      {overdueList.length > 3 && (
                        <div className="text-xs text-zinc-500 text-center pt-2">+{overdueList.length - 3} more overdue items</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: Trend Graph */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 flex flex-col">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-white">Daily Trend</h3>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Activity over {selectedMonthLabel}</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black font-mono ${analyticsStats.curr.total > analyticsStats.prev.total ? 'text-purple-400' : analyticsStats.curr.total < analyticsStats.prev.total ? 'text-rose-400' : 'text-zinc-400'}`}>
                    {analyticsStats.curr.total}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">This month vs last ({analyticsStats.prev.total} → {analyticsStats.curr.total})</div>
                </div>
              </div>

              {/* Custom Line/Area Chart using SVG */}
              <div className="relative w-full h-[220px] mt-auto border border-zinc-800/50 rounded-xl bg-zinc-950/50 overflow-hidden group">
                {analyticsChartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">No data available for {selectedMonthLabel}</div>
                ) : (
                  <svg viewBox="0 0 600 220" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGradientUpdates" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = 40 + idx * 35;
                      const val = Math.round((analyticsYMax / 4) * idx);
                      return (
                        <g key={idx}>
                          <line x1="40" y1={180 - idx * 35} x2="580" y2={180 - idx * 35} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4,4" opacity="0.3" />
                          <text x="30" y={184 - idx * 35} textAnchor="end" className="text-[10px] font-mono fill-zinc-500">{val}</text>
                        </g>
                      );
                    })}
                    
                    {/* X Axis labels (First, Middle, Last) */}
                    <text x="45" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day 1</text>
                    <text x="310" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day {Math.floor(analyticsChartData.length / 2)}</text>
                    <text x="575" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day {analyticsChartData.length}</text>

                    {/* Chart Area & Line */}
                    {analyticsChartData.length > 0 && (
                      <>
                        <path d={updatesAreaPath} fill="url(#areaGradientUpdates)" />
                        <path d={updatesLinePath} fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    )}

                    {/* Interactive Hover Points */}
                    {analyticsChartData.map((d, idx) => {
                      if (hoveredAnalyticsIdx !== idx) return null;
                      const x = 45 + idx * (530 / (analyticsChartData.length - 1));
                      const y = 180 - (d.total / analyticsYMax) * 140;
                      return (
                        <g key={`hover-${idx}`}>
                          <line x1={x} y1="40" x2={x} y2="180" stroke="#c084fc" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
                          <circle cx={x} cy={y} r="4" fill="#c084fc" stroke="#18181b" strokeWidth="2" />
                        </g>
                      );
                    })}

                    {/* Invisible Hover Catchers */}
                    {analyticsChartData.map((_, idx) => {
                      const step = 530 / (analyticsChartData.length - 1);
                      const x = 45 + idx * step;
                      return (
                        <rect
                          key={`catcher-${idx}`}
                          x={Math.max(0, x - step / 2)}
                          y="0"
                          width={step}
                          height="220"
                          fill="transparent"
                          onMouseEnter={() => setHoveredAnalyticsIdx(idx)}
                          onMouseLeave={() => setHoveredAnalyticsIdx(null)}
                        />
                      );
                    })}
                  </svg>
                )}
                
                {/* Tooltip HTML Overlay */}
                {hoveredAnalyticsIdx !== null && analyticsChartData[hoveredAnalyticsIdx] && (
                  <div 
                    className="absolute bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl pointer-events-none z-10 transition-all duration-100 ease-out min-w-[140px]"
                    style={{ 
                      left: `${Math.min(Math.max(45 + hoveredAnalyticsIdx * (530 / (analyticsChartData.length - 1)) - 60, 10), 460) / 600 * 100}%`, 
                      top: '20px' 
                    }}
                  >
                    <div className="text-[10px] text-zinc-400 font-semibold mb-1 uppercase tracking-wider">
                      Day {analyticsChartData[hoveredAnalyticsIdx].day} - {selectedMonthLabel}
                    </div>
                    <div className="flex justify-between items-center text-xs mb-0.5">
                      <span className="text-zinc-300">Reservations</span>
                      <span className="font-mono text-fuchsia-400 font-bold">{analyticsChartData[hoveredAnalyticsIdx].reservations}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-zinc-800 mt-1 pt-1">
                      <span className="text-white font-bold">Total Activity</span>
                      <span className="font-mono text-cyan-400">{analyticsChartData[hoveredAnalyticsIdx].total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-bold text-lg text-white">Recent Activity Log</h3>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Detailed transaction history for {selectedMonthLabel}</p>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search activity..."
                  value={analyticsSearchQuery}
                  onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-sm text-white px-9 py-2 rounded-xl focus:outline-none focus:border-cyan-500"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider bg-zinc-950/50">
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Student / User</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-sm">
                {analyticsRecentActivity.filter(activity => 
                  activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                  activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                  activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500">
                      No activity found matching your search.
                    </td>
                  </tr>
                ) : (
                  analyticsRecentActivity
                    .filter(activity => 
                      activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                      activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                      activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase())
                    )
                    .map((activity, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/20 transition-colors group">
                      <td className="py-3 px-4 text-zinc-400 font-mono text-xs whitespace-nowrap">
                        {new Date(activity.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'reservation' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {activity.type === 'reservation' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            )}
                          </div>
                          <span className="text-white font-medium">{activity.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{activity.student}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${activity.status === 'PENDING_APPROVAL' || activity.status === 'PENDING_HOD' || activity.status === 'Pending HOD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : activity.status === 'APPROVED' || activity.status === 'CHECKED_OUT' || activity.status === 'READY_FOR_PICKUP' || activity.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                          {activity.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
