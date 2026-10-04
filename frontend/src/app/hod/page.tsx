'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { Plus_Jakarta_Sans } from 'next/font/google';
import RequisitionLetter from '@/components/RequisitionLetter';
import { getWorkingDaysCount } from '@/lib/dateValidator';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

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

const getComponentPrice = (componentName: string) => {
  const name = (componentName || '').toLowerCase();
  if (name.includes('raspberry pi')) return 3500;
  if (name.includes('arduino')) return 1500;
  if (name.includes('jetson')) return 8500;
  if (name.includes('fluke') || name.includes('multimeter')) return 12005;
  if (name.includes('oscilloscope') || name.includes('rigol')) return 35000;
  if (name.includes('lidar')) return 9500;
  if (name.includes('motor')) return 800;
  if (name.includes('sensor')) return 600;
  if (name.includes('soldering')) return 4500;
  return 1000;
};

const calculatePenalty = (dueDateStrRaw: string | undefined, requestDateStr: string, durationDays: number, componentName: string) => {
  if (!requestDateStr) return { isDelayed: false, delayDays: 0, daysLeft: 0, penalty: 0, dueDateStr: '' };

  let dueDate: Date;
  if (dueDateStrRaw) {
    dueDate = new Date(dueDateStrRaw);
  } else {
    const reqDate = new Date(requestDateStr);
    const duration = parseInt(String(durationDays), 10) || 7;
    dueDate = new Date(reqDate.getTime() + duration * 24 * 60 * 60 * 1000);
  }
  
  const currentDate = new Date();

  const dueDateStr = dueDate.toISOString().split('T')[0];
  if (currentDate.getTime() <= dueDate.getTime()) {
    const daysLeft = getWorkingDaysCount(currentDate, dueDate);
    return { isDelayed: false, delayDays: 0, daysLeft, penalty: 0, dueDateStr, weeksDelayed: 0, itemPrice: 0 };
  }

  const delayDays = getWorkingDaysCount(dueDate, currentDate);
  const price = getComponentPrice(componentName);
  const weeksDelayed = Math.ceil(delayDays / 7);
  const penaltyRate = 0.05;
  const penalty = price * penaltyRate * weeksDelayed;

  return {
    isDelayed: true,
    delayDays,
    daysLeft: 0,
    penalty,
    dueDateStr,
    weeksDelayed,
    itemPrice: price
  };
};

export default function HodDashboard() {
  const router = useRouter();
  const [activeDept, setActiveDept] = useState<string>('EDL');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [collegeName, setCollegeName] = useState(siteConfig.collegeName);
  const [loading, setLoading] = useState(true);
  
  // Interactive view switcher and graphing states
  const [viewMode, setViewMode] = useState<'requests' | 'active-loans' | 'inventory' | 'analytics' | 'section-tracking'>('requests');
  const [isLocked, setIsLocked] = useState(false);
  const [workflowTab, setWorkflowTab] = useState<'ACTION_REQUIRED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'HISTORY'>('ACTION_REQUIRED');
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState('2026-09');
  const [hoveredAnalyticsIdx, setHoveredAnalyticsIdx] = useState<number | null>(null);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');

  const [sectionTrackingTab, setSectionTrackingTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');
  const [sectionSearchQuery, setSectionSearchQuery] = useState('');
  const [showSectionFilters, setShowSectionFilters] = useState(false);
  const [studentDeptFilter, setStudentDeptFilter] = useState('CSE');
  const [sectionFilter, setSectionFilter] = useState('A');
  const [sectionStartDate, setSectionStartDate] = useState('');
  const [sectionEndDate, setSectionEndDate] = useState('');
  const [scannedUsnFilter, setScannedUsnFilter] = useState<string | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<{ usn: string, name: string } | null>(null);

  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectData, setInspectData] = useState<any>(null);
  const [expandedReqs, setExpandedReqs] = useState<{ [key: string]: boolean }>({});

  const toggleExpandReq = (id: string) => {
    setExpandedReqs(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
      console.warn('Failed to fetch requests', e);
      setRequests([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const responseData = await res.json();
      const data = responseData.data || responseData;
      setInventory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to fetch inventory', e);
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
  const completedReqs = deptRequests.filter(r => r.status === 'RETURNED' || r.status === 'COMPLETED');
  const cancelledReqs = deptRequests.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED' || r.status === 'Rejected');

  let currentTabRequests: RequestItem[] = [];
  if (viewMode === 'active-loans') {
    currentTabRequests = activeLoansReqs;
  } else if (viewMode === 'requests') {
    if (workflowTab === 'ACTION_REQUIRED') currentTabRequests = actionRequiredReqs;
    else if (workflowTab === 'IN_PROGRESS') currentTabRequests = inProgressReqs;
    else if (workflowTab === 'HISTORY') currentTabRequests = historyReqs;
    else if (workflowTab === 'COMPLETED') currentTabRequests = completedReqs;
    else if (workflowTab === 'CANCELLED') currentTabRequests = cancelledReqs;
  }

  const activeDeptPending = actionRequiredReqs.length;
  const activeDeptApproved = historyReqs.filter(r => r.status.includes('Approved') || r.status === 'APPROVED' || r.status === 'Ready for Collection' || r.status === 'Active' || r.status.includes('Renewal') || r.status === 'CHECKED_OUT').length;
  const activeDeptRejected = historyReqs.filter(r => r.status === 'Rejected' || r.status === 'REJECTED').length;


  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6 md:p-8 overflow-x-hidden relative selection:bg-rose-500/30 ${plusJakarta.className} print:bg-white print:text-black`}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/10 blur-[120px] pointer-events-none mix-blend-multiply z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-multiply z-0" />
      
      <div className="relative z-10">
      {/* ── Redesigned HOD Header ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative w-full print:hidden">
        <div className="flex items-center gap-3 shrink-0">
          <img 
            src="/vvce-logo.png" 
            alt="VVCE Logo" 
            className="h-12 sm:h-14 w-auto object-contain shrink-0 drop-shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`${plusJakarta.className} text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase`}>HOD Workspace</h1>
              {isLocked && activeDept && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">{activeDept}</span>
              )}
            </div>
            <p className="text-slate-600 font-medium mt-0.5 text-xs">{collegeName} • Head of Department Panel</p>
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Live</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-50/80 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="border-b border-slate-200/50 mb-6 sm:mb-8 print:hidden"></div>

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
                  ? 'ring-2 ring-offset-2 ring-offset-slate-50 ring-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : ''
              } ${isDeptDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <div className={`rounded-xl p-3 sm:p-4 text-left h-full flex flex-col justify-between transition-all duration-300 border ${
                isSelected
                  ? `bg-slate-900 border-slate-900 shadow-md`
                  : 'bg-white shadow-sm border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`text-lg sm:text-2xl font-black tracking-tight ${
                      isSelected ? 'text-white drop-shadow-sm' : 'text-slate-800'
                    }`}>{dept.id}</span>
                    {pendingCount > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-amber-500 text-amber-950 border border-amber-400'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                      }`}>
                        {pendingCount} new
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] sm:text-xs mt-1 line-clamp-1 ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}>{dept.title}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* View Switcher Tabs & Inbox Stats */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 sm:mb-8 print:hidden">
        <div className="flex overflow-x-auto bg-white shadow-sm p-1.5 rounded-xl border border-slate-200 gap-1.5 w-full max-w-full scrollbar-hide pb-2 xl:pb-1.5">
          <button onClick={() => { setViewMode('requests'); setSelectedReq(null); }} className={`shrink-0 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'requests' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}`}>Component Requests</button>
          <button onClick={() => { setViewMode('active-loans'); setSelectedReq(null); }} className={`shrink-0 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'active-loans' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}`}>Active Loans</button>

          <div className="w-px bg-slate-200 mx-1 shrink-0 hidden md:block"></div>
          
          <button onClick={() => setViewMode('inventory')} className={`shrink-0 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'inventory' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}`}>Live Inventory</button>
          <button onClick={() => setViewMode('analytics')} className={`shrink-0 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'analytics' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}`}>Monthly Updates</button>
          <button onClick={() => setViewMode('section-tracking')} className={`shrink-0 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'section-tracking' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'}`}>Section Tracking</button>
        </div>

        <div className="relative flex-shrink-0 self-end xl:self-auto">
          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] sm:text-[11px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10">
            {activeDeptPending}
          </span>
          <div className="text-xs sm:text-sm bg-slate-100 border border-slate-300 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-xl text-slate-700 font-medium shadow-md">
            Total Inbox: <span className="text-slate-900 font-bold ml-1">{activeDeptPending} Pending</span>
          </div>
        </div>
      </div>

      {(viewMode === 'requests' || viewMode === 'active-loans') && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8 max-w-4xl">
            <div className="bg-white shadow-sm border border-amber-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(245,158,11,0.05)]">
              <div className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Awaiting Decisions</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-600 mt-1 sm:mt-2">{activeDeptPending}</div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Pending HOD approval in {activeDept}</p>
            </div>
            <div className="bg-white shadow-sm border border-emerald-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              <div className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Approved Requests</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 mt-1 sm:mt-2">{activeDeptApproved}</div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Total approved & active loans</p>
            </div>
            <div className="bg-white shadow-sm border border-red-500/20 p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_20px_rgba(239,68,68,0.05)]">
              <div className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Rejected Requests</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-red-500 mt-1 sm:mt-2">{activeDeptRejected}</div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Requests declined or returned</p>
            </div>
          </div>

          {/* Workflow Tabs */}
          {viewMode === 'requests' && (
            <div className="flex flex-wrap gap-2 bg-slate-100/50 p-1 rounded-xl w-fit mb-6 border border-slate-200">
              <button onClick={() => { setWorkflowTab('ACTION_REQUIRED'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'ACTION_REQUIRED' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>Action Required</button>
              <button onClick={() => { setWorkflowTab('IN_PROGRESS'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'IN_PROGRESS' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>Pending Admin / Checkout</button>
              <button onClick={() => { setWorkflowTab('COMPLETED'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'COMPLETED' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>Completed</button>
              <button onClick={() => { setWorkflowTab('CANCELLED'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'CANCELLED' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>Cancelled / Rejected</button>
              <button onClick={() => { setWorkflowTab('HISTORY'); setSelectedReq(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workflowTab === 'HISTORY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>All History</button>
            </div>
          )}

          {/* Main Grid: Grouped Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {(() => {
              if (loading) {
                return <div className="col-span-full text-center py-12 text-slate-400">Loading requests...</div>;
              }

              if (currentTabRequests.length === 0) {
                return (
                  <div className="col-span-full py-20 bg-white/30 border border-slate-200 border-dashed rounded-3xl flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-100/50 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No requests found</p>
                    <p className="text-slate-600 text-xs mt-1">Check back later for new requests.</p>
                  </div>
                );
              }

              const groupedRequests = Object.values(
                currentTabRequests.reduce((acc, req) => {
                  let timeKey = req.requestDate;
                  if ((req as any).createdAt) {
                    const dateObj = new Date((req as any).createdAt);
                    timeKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}-${dateObj.getHours()}-${dateObj.getMinutes()}`;
                  }
                  const key = `${req.usn}-${timeKey}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(req);
                  return acc;
                }, {} as { [key: string]: RequestItem[] })
              );

              return groupedRequests.map(group => {
                const firstReq = group[0];
                const allPending = group.every(req => req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD');

                const renderComponentRow = (req: any) => (
                  <div key={req.id} className="bg-white/30 rounded-xl p-3 border border-slate-200 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                         <div className="font-bold text-slate-700 text-sm">{req.component}</div>
                         <div className="flex gap-2 mt-1">
                           <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Qty: {req.quantity || 1}</span>
                           {req.isDamaged && (
                             <span className="text-[10px] font-mono bg-rose-500/20 text-rose-600 border border-rose-500/30 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(244,63,94,0.3)]">⚠️ DAMAGED</span>
                           )}
                         </div>
                      </div>
                      
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        req.status === 'PENDING_APPROVAL' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]' :
                        req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                        req.status === 'APPROVED' ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]' :
                        req.status === 'READY_FOR_PICKUP' || req.status === 'Ready for Collection' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]' :
                        (req.status === 'CHECKED_OUT' || req.status === 'Active') ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                        req.status === 'RETURN_REQUESTED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                        req.status === 'REJECTED' || req.status === 'Rejected' || req.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                        req.status === 'RETURNED' && req.isDamaged ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                        'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {req.status === 'PENDING_APPROVAL' ? 'PENDING ADMIN' :
                         req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD' ? 'AWAITING YOU' :
                         req.status === 'APPROVED' ? 'PENDING CHECKOUT' :
                         req.status === 'READY_FOR_PICKUP' || req.status === 'Ready for Collection' ? 'PENDING CHECKOUT' :
                         (req.status === 'CHECKED_OUT' || req.status === 'Active') ? 'BORROWED' :
                         req.status === 'RETURNED' && req.isDamaged ? 'DAMAGED' :
                         req.status === 'Rejected' ? 'REJECTED' :
                         req.status}
                      </span>
                    </div>
                  </div>
                );

                return (
                <div key={firstReq.id + '-group'} className="bg-white/70 backdrop-blur-2xl border border-slate-200 hover:border-slate-200 rounded-2xl p-5 transition-all duration-300 flex flex-col group shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] gap-4">
                  
                  {/* Group Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100/50 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 shadow-inner">
                        <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{firstReq.studentName}</div>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-slate-500 font-mono text-xs">{firstReq.usn}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandReq(firstReq.id);
                            }}
                            className="text-[10px] text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded border border-cyan-200 transition-colors"
                          >
                            {expandedReqs[firstReq.id] ? 'Less Info' : 'More Info'}
                          </button>
                        </div>
                        
                        {expandedReqs[firstReq.id] && (
                          <div className="mt-2 pl-2 border-l-2 border-slate-200 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="text-slate-500 text-[11px]">
                              {firstReq.studentDepartment || 'EDL'} 
                              {(firstReq as any).section ? ` Sec ${(firstReq as any).section}` : ''}
                              {(firstReq as any).year ? ` (${(firstReq as any).year})` : ''}
                            </div>
                            {(firstReq as any).mobile && <div className="text-slate-500 font-mono text-[11px]">Phone: {(firstReq as any).mobile}</div>}
                            {(firstReq as any).projectType && (firstReq as any).projectType !== 'Normal' && (
                              <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded w-fit ${(firstReq as any).projectType.toLowerCase().includes('hackathon') ? 'bg-fuchsia-500/20 text-fuchsia-600' : 'bg-indigo-500/20 text-indigo-600'}`}>
                                {(firstReq as any).projectType}
                              </div>
                            )}
                            {(firstReq as any).projectType?.toLowerCase().includes('hackathon') && (firstReq as any).hackathonVenue && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                📍 {(firstReq as any).hackathonVenue} {(firstReq as any).hackathonDate && `| 📅 ${(firstReq as any).hackathonDate}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-slate-500 font-mono bg-slate-200 px-2 py-1 rounded-md border border-slate-200 mb-1 inline-block">{firstReq.requestDate}</div>
                       <div className="text-xs text-cyan-600 font-bold max-w-[150px] truncate">{(firstReq as any).projectTitle || 'Hardware Request'}</div>
                    </div>
                  </div>

                  {/* Components List */}
                  <div className="flex flex-col gap-2">
                    <>
                      {renderComponentRow(group[0])}
                      {group.length > 1 && (
                        <details className="group/details mt-1">
                          <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] text-slate-500 font-bold bg-slate-200 px-3 py-2 rounded-xl hover:bg-slate-300 transition-colors border border-slate-200 select-none mb-2">
                            <span>View {group.length - 1} more component{group.length - 1 > 1 ? 's' : ''}</span>
                            <svg className="w-4 h-4 transition-transform group-open/details:rotate-180 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </summary>
                          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {group.slice(1).map(renderComponentRow)}
                          </div>
                        </details>
                      )}
                    </>
                  </div>

                  {/* Bulk Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-3 border-t border-slate-200">
                    <button onClick={() => {
                        setInspectData({
                          studentName: firstReq.studentName,
                          usn: firstReq.usn,
                          department: firstReq.studentDepartment || 'EDL',
                          items: group.map(g => ({ name: g.component, quantity: g.quantity || 1 })),
                          requestDate: firstReq.requestDate,
                          duration: firstReq.duration,
                          status: firstReq.status,
                          section: (firstReq as any).section,
                          year: (firstReq as any).year,
                          mobile: (firstReq as any).mobile,
                          teamMembers: (firstReq as any).teamMembers,
                          projectType: (firstReq as any).projectType,
                          projectTitle: (firstReq as any).projectTitle,
                          projectPurpose: (firstReq as any).projectPurpose,
                          hackathonDate: (firstReq as any).hackathonDate,
                          hackathonVenue: (firstReq as any).hackathonVenue,
                          signatureUrl: (firstReq as any).signatureUrl
                        });
                        setShowInspectModal(true);
                      }} className="px-4 py-2 bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0" title="Inspect Bulk Letter">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Inspect Letter
                    </button>

                    {allPending && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                           group.forEach(async (req) => {
                             if (req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD') {
                               await handleAction(req.id, true);
                             }
                           });
                        }} className="px-5 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold transition">
                          Approve All
                        </button>
                        <button onClick={() => {
                           group.forEach(async (req) => {
                             if (req.status === 'PENDING_HOD' || req.status === 'Pending HOD' || req.status === 'Pending Renewal HOD') {
                               await handleAction(req.id, false);
                             }
                           });
                        }} className="px-5 py-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-bold transition">
                          Reject All
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              });
            })()}
          </div>

      {/* Inspect Modal */}
      {showInspectModal && inspectData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowInspectModal(false)}>
          <div className="relative bg-white rounded-2xl w-full max-w-4xl mx-auto shadow-2xl my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
               <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                 Print
               </button>
               <button onClick={() => setShowInspectModal(false)} className="bg-slate-100 hover:bg-slate-700 text-slate-900 p-2 rounded-lg transition-colors shadow-lg">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
            <div className="p-2 max-h-[85vh] overflow-y-auto">
              <RequisitionLetter {...inspectData} />
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {viewMode === 'section-tracking' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{activeDept} Section Tracking</h2>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200">
                  Filter: {scannedUsnFilter}
                  <button
                    onClick={() => setScannedUsnFilter(null)}
                    className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-0.5 rounded-full transition-colors ml-1 inline-flex items-center justify-center font-bold"
                    title="Clear filter and show all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 border-b border-slate-200 pb-4">
            <div className="flex gap-4">
              <button
                onClick={() => setSectionTrackingTab('CURRENT')}
                className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${sectionTrackingTab === 'CURRENT' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-600'}`}
              >
                Current Tracking
              </button>
              <button
                onClick={() => setSectionTrackingTab('COMPLETED')}
                className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${sectionTrackingTab === 'COMPLETED' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-600'}`}
              >
                Completed Tracking
              </button>
            </div>

            <div className="flex gap-3 w-full lg:w-auto">
              <input
                type="text"
                placeholder="Search Student Name or USN..."
                value={sectionSearchQuery}
                onChange={e => setSectionSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 focus:outline-none focus:border-cyan-500 w-full lg:w-64"
              />
              <button
                onClick={() => setShowSectionFilters(!showSectionFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border shrink-0 ${showSectionFilters ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
              </button>
            </div>
          </div>

          {showSectionFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-6 items-end animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Department</label>
                <select value={studentDeptFilter} onChange={e => setStudentDeptFilter(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 focus:outline-none focus:border-cyan-500 w-32">
                  <option value="CSE">CSE</option>
                  <option value="MECH">Mechanical</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="CIVIL">CIVIL</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Section</label>
                <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 focus:outline-none focus:border-cyan-500 w-32">
                  {Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                    <option key={char} value={char}>Section {char}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Date Range</label>
                <div className="flex gap-2 items-center text-slate-500 text-sm">
                  <input
                    type="date"
                    value={sectionStartDate}
                    onChange={e => setSectionStartDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={sectionEndDate}
                    onChange={e => setSectionEndDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Redesigned Section Grouping */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {(() => {
              // Group all requests in the current filter by Student (USN)
              const safeRequests = Array.isArray(requests) ? requests : [];
              const relevantRequests = safeRequests
                .filter(req => (req.department === activeDept || req.studentDepartment === activeDept) && (req.studentDepartment === studentDeptFilter || !studentDeptFilter) && (req as any).section === sectionFilter && (!scannedUsnFilter || req.usn === scannedUsnFilter))
                .filter(req => {
                  if (!sectionStartDate && !sectionEndDate) return true;
                  const reqDate = new Date(req.requestDate).getTime();
                  const start = sectionStartDate ? new Date(sectionStartDate).getTime() : 0;
                  const end = sectionEndDate ? new Date(sectionEndDate).getTime() : Infinity;
                  return reqDate >= start && reqDate <= end;
                })
                .filter(req => {
                  if (!sectionSearchQuery.trim()) return true;
                  const query = sectionSearchQuery.toLowerCase();
                  return (req.studentName || '').toLowerCase().includes(query) || (req.usn || '').toLowerCase().includes(query);
                });

              // Group by USN
              const studentsMap = relevantRequests.reduce((acc, req) => {
                if (!acc[req.usn]) {
                  acc[req.usn] = {
                    usn: req.usn,
                    name: req.studentName,
                    activeLoans: 0,
                    dueSoon: 0,
                    overdue: 0,
                    requests: []
                  };
                }
                
                acc[req.usn].requests.push(req);
                
                if (req.status === 'CHECKED_OUT' || req.status === 'Active') {
                  acc[req.usn].activeLoans++;
                  const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
                  if (penaltyInfo.isDelayed) {
                    acc[req.usn].overdue++;
                  } else {
                    acc[req.usn].dueSoon++;
                  }
                }
                return acc;
              }, {} as Record<string, any>);

              const studentsArray = Object.values(studentsMap);
              
              const displayStudents = studentsArray.filter(s => sectionTrackingTab === 'CURRENT' ? s.activeLoans > 0 : true);

              return (
                <>
                  <div className="mb-6 pb-6 border-b border-slate-200">
                    <h3 className="text-2xl font-black text-slate-900">{studentDeptFilter} – Section {sectionFilter}</h3>
                    <div className="text-sm font-bold text-slate-500 mt-1">
                      {sectionTrackingTab === 'CURRENT' ? `Students with active loans: ${displayStudents.length}` : `Students with tracking history: ${displayStudents.length}`}
                    </div>
                  </div>

                  {displayStudents.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-sm uppercase tracking-wider">
                      No students found matching this criteria.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayStudents.map((student) => (
                        <div
                          key={student.usn}
                          onClick={() => setSelectedStudentForDetails({ usn: student.usn, name: student.name })}
                          className="bg-white border border-slate-200 hover:border-cyan-500/50 rounded-xl p-5 cursor-pointer transition-all group hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-slate-900 text-base group-hover:text-cyan-600 transition-colors">{student.name}</h4>
                                <div className="text-xs text-slate-500 font-mono mt-0.5">{student.usn}</div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-cyan-500/10 group-hover:text-cyan-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-900 pt-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Active</span>
                              <span className="text-xl font-black text-cyan-600">{student.activeLoans}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Due Soon</span>
                              <span className="text-xl font-black text-amber-600">{student.dueSoon}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Overdue</span>
                              <span className="text-xl font-black text-rose-600">{student.overdue}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {selectedStudentForDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 mb-1`}>Student Details</h3>
                <p className="text-slate-500 text-xs font-mono">{selectedStudentForDetails.usn}</p>
              </div>
              <button onClick={() => setSelectedStudentForDetails(null)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer text-slate-500">✕</button>
            </div>

            {(() => {
              const safeRequests = Array.isArray(requests) ? requests : [];
              const studentReqs = safeRequests.filter(r => r.usn === selectedStudentForDetails.usn);
              const active = studentReqs.filter(r => r.status === 'CHECKED_OUT' || r.status === 'RETURN_REQUESTED' || r.status === 'Active');
              const overdueReqs = active.filter(r => calculatePenalty(r.dueDate, r.requestDate, r.duration, r.component).isDelayed);
              const completed = studentReqs.filter(r => r.status === 'RETURNED' || r.status === 'COMPLETED');
              
              return (
                <div className="space-y-6">
                  {/* Profile Summary */}
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-slate-300">
                      <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedStudentForDetails.name}</h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{studentReqs[0]?.studentDepartment} - Section {(studentReqs[0] as any)?.section}</div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8 font-mono text-sm max-w-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">TOTAL REQUESTS</span>
                      <span className="text-slate-900 font-bold">{studentReqs.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">COMPLETED</span>
                      <span className="text-slate-900 font-bold">{completed.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">ACTIVE</span>
                      <span className="text-slate-900 font-bold">{active.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">OVERDUE</span>
                      <span className="text-rose-600 font-bold">{overdueReqs.length}</span>
                    </div>
                  </div>

                  {/* Borrow History */}
                  <div>
                    <h5 className="font-bold text-slate-900 text-lg mb-4">Borrow History</h5>
                    <div className="space-y-4">
                      {studentReqs.map(req => {
                        const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
                        const isCompleted = req.status === 'COMPLETED' || req.status === 'RETURNED';
                        
                        return (
                          <div key={req.id} className="border-b border-slate-200/50 pb-4 last:border-0 last:pb-0">
                            <div className="font-bold text-blue-600 mb-1">{req.component}</div>
                            {isCompleted ? (
                              <div className="text-emerald-600 text-sm flex items-center gap-1.5">
                                Returned on time ✓
                              </div>
                            ) : (req.status === 'CHECKED_OUT' || req.status === 'Active') && penaltyInfo.isDelayed ? (
                              <div className="text-rose-600 text-sm flex items-center gap-1.5">
                                Overdue {penaltyInfo.delayDays} day{penaltyInfo.delayDays > 1 ? 's' : ''} ⚠
                              </div>
                            ) : (req.status === 'CHECKED_OUT' || req.status === 'Active') ? (
                              <div className="text-amber-600 text-sm flex items-center gap-1.5">
                                Active loan
                              </div>
                            ) : req.status === 'RETURN_REQUESTED' ? (
                              <div className="text-amber-500 text-sm flex items-center gap-1.5">
                                Return Requested
                              </div>
                            ) : req.status === 'REJECTED' || req.status === 'Rejected' || req.status === 'CANCELLED' ? (
                              <div className="text-red-500 text-sm flex items-center gap-1.5">
                                {req.status === 'REJECTED' || req.status === 'Rejected' ? 'Rejected ❌' : 'Cancelled 🚫'}
                              </div>
                            ) : (
                              <div className="text-slate-500 text-sm flex items-center gap-1.5">
                                Pending ({req.status})
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Inventory Tab Content */}
      {viewMode === 'inventory' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                  Live Inventory Status ({activeDept})
                </h2>
                <p className="text-sm text-slate-500 mt-1">Real-time stock availability and utilization</p>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search inventory..."
                  value={inventorySearchQuery}
                  onChange={(e) => setInventorySearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 px-9 py-2 rounded-xl focus:outline-none focus:border-cyan-500"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Component</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tier</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Available</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {inventory
                    .filter(i => i.department === activeDept)
                    .filter(i => 
                      i.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || 
                      (i.location && i.location.toLowerCase().includes(inventorySearchQuery.toLowerCase())) ||
                      (i.value_tier && i.value_tier.toLowerCase().includes(inventorySearchQuery.toLowerCase()))
                    )
                    .map(item => {
                    const ratio = item.available / item.total;
                    let statusColor = 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
                    if (item.available === 0) statusColor = 'text-red-600 bg-red-500/10 border-red-500/20';
                    else if (ratio < 0.3) statusColor = 'text-amber-600 bg-amber-500/10 border-amber-500/20';
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-200/20 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.value_tier === 'HIGH' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                            {item.value_tier || 'STANDARD'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-500">{item.location || 'Main Lab'}</td>
                        <td className="p-3 font-mono text-lg font-bold text-slate-900 text-right">{item.available}</td>
                        <td className="p-3 font-mono text-slate-500 text-right">{item.total}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusColor}`}>
                            {item.available === 0 ? 'Out of Stock' : ratio < 0.3 ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {inventory
                    .filter(i => i.department === activeDept)
                    .filter(i => 
                      i.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || 
                      (i.location && i.location.toLowerCase().includes(inventorySearchQuery.toLowerCase())) ||
                      (i.value_tier && i.value_tier.toLowerCase().includes(inventorySearchQuery.toLowerCase()))
                    ).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {inventory.filter(i => i.department === activeDept).length === 0 
                          ? `No inventory records found for ${activeDept}.` 
                          : 'No items match your search query.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


            {/* Analytics Tab Content */}
      {viewMode === 'analytics' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">

          {/* Controls */}
          <div className="flex justify-between items-center bg-white shadow-sm border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Monthly Updates Analytics</h3>
                <p className="text-xs text-slate-500 mt-0.5">Historical activity performance and transaction summaries for {activeDept}.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={selectedAnalyticsMonth}
                onChange={e => setSelectedAnalyticsMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
              >
                {Object.entries(monthLabels)
                  .filter(([val]) => {
                    const [y, m] = val.split('-');
                    const optionDate = new Date(parseInt(y), parseInt(m) - 1, 1);
                    const now = new Date();
                    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    return optionDate <= currentMonthDate;
                  })
                  .map(([val, label]) => {
                    const [y, m] = val.split('-');
                    const optionDate = new Date(parseInt(y), parseInt(m) - 1, 1);
                    const now = new Date();
                    const isCurrent = optionDate.getFullYear() === now.getFullYear() && optionDate.getMonth() === now.getMonth();
                    return (
                      <option key={val} value={val}>
                        {label} {isCurrent ? '(Current)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Monthly Updates</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">{analyticsStats.curr.total}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(totalChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                  }`}>
                  {totalChangeStr}
                </span>
                <span className="text-slate-500">vs previous month ({analyticsStats.prev.total})</span>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-fuchsia-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Component Reservations</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">{analyticsStats.curr.reqs}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(reqsChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                  }`}>
                  {reqsChangeStr}
                </span>
                <span className="text-slate-500">vs previous month ({analyticsStats.prev.reqs})</span>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lab Stock</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">
                {inventory.filter(i => i.department === activeDept).reduce((acc, item) => acc + item.total, 0)}
              </h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Units</span>
                <span className="text-slate-500">Total component units in inventory</span>
              </div>
            </div>
          </div>

          {/* Advanced Analytics Dashboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Left Column: Utilization & Inventory Health */}
            <div className="space-y-6">
              
              {/* Utilization / Most Borrowed */}
              <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Utilization</h3>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Most Borrowed Components</p>
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
                      return <div className="text-sm text-slate-500 py-4">No active checkouts currently.</div>;
                    }

                    return (
                      <div className="space-y-4">
                        {sortedUsage.map((u, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-700 font-medium">{u.name}</span>
                              <span className="text-slate-500">{u.used} / {u.total} borrowed</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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
              <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Action Needed</h3>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Overdue Returns</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                            <div className="text-sm text-slate-900 font-medium">{r.component}</div>
                            <div className="text-xs text-slate-500">{r.studentName} ({r.usn})</div>
                          </div>
                          <div className="text-xs font-bold text-rose-600">Overdue</div>
                        </div>
                      ))}
                      {overdueList.length > 3 && (
                        <div className="text-xs text-slate-500 text-center pt-2">+{overdueList.length - 3} more overdue items</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: Trend Graph */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 flex flex-col">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Daily Trend</h3>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Activity over {selectedMonthLabel}</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black font-mono ${analyticsStats.curr.total > analyticsStats.prev.total ? 'text-purple-400' : analyticsStats.curr.total < analyticsStats.prev.total ? 'text-rose-600' : 'text-slate-500'}`}>
                    {analyticsStats.curr.total}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">This month vs last ({analyticsStats.prev.total} → {analyticsStats.curr.total})</div>
                </div>
              </div>

              {/* Custom Line/Area Chart using SVG */}
              <div className="relative w-full h-[220px] mt-auto border border-slate-200/50 rounded-xl bg-slate-50/50 overflow-hidden group">
                {analyticsChartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No data available for {selectedMonthLabel}</div>
                ) : (
                  <svg viewBox="0 0 600 220" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGradientUpdates" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9333ea" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#9333ea" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(idx => {
                      const y = 40 + idx * 35;
                      const val = Math.round((analyticsYMax / 4) * idx);
                      return (
                        <g key={idx}>
                          <line x1="40" y1={180 - idx * 35} x2="580" y2={180 - idx * 35} stroke="rgba(0, 0, 0, 0.05)" strokeWidth="1" strokeDasharray="4,4" opacity="0.8" />
                          <text x="30" y={184 - idx * 35} textAnchor="end" className="text-[10px] font-mono fill-slate-500">{val}</text>
                        </g>
                      );
                    })}
                    
                    {/* X Axis labels (First, Middle, Last) */}
                    <text x="45" y="198" textAnchor="middle" className="text-[9px] font-mono fill-slate-500">Day 1</text>
                    <text x="310" y="198" textAnchor="middle" className="text-[9px] font-mono fill-slate-500">Day {Math.floor(analyticsChartData.length / 2)}</text>
                    <text x="575" y="198" textAnchor="middle" className="text-[9px] font-mono fill-slate-500">Day {analyticsChartData.length}</text>

                    {/* Chart Area & Line */}
                    {analyticsChartData.length > 0 && (
                      <>
                        <path d={updatesAreaPath} fill="url(#areaGradientUpdates)" />
                        <path d={updatesLinePath} fill="none" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    )}

                    {/* Interactive Hover Points */}
                    {analyticsChartData.map((d, idx) => {
                      if (hoveredAnalyticsIdx !== idx) return null;
                      const x = 45 + idx * (530 / (analyticsChartData.length - 1));
                      const y = 180 - (d.total / analyticsYMax) * 140;
                      return (
                        <g key={`hover-${idx}`}>
                          <line x1={x} y1="40" x2={x} y2="180" stroke="#9333ea" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
                          <circle cx={x} cy={y} r="4" fill="#9333ea" stroke="#ffffff" strokeWidth="2" />
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
                    className="absolute bg-white shadow-sm border border-slate-300 p-3 rounded-lg shadow-xl pointer-events-none z-10 transition-all duration-100 ease-out min-w-[140px]"
                    style={{ 
                      left: `${Math.min(Math.max(45 + hoveredAnalyticsIdx * (530 / (analyticsChartData.length - 1)) - 60, 10), 460) / 600 * 100}%`, 
                      top: '20px' 
                    }}
                  >
                    <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">
                      Day {analyticsChartData[hoveredAnalyticsIdx].day} - {selectedMonthLabel}
                    </div>
                    <div className="flex justify-between items-center text-xs mb-0.5">
                      <span className="text-slate-700">Reservations</span>
                      <span className="font-mono text-fuchsia-400 font-bold">{analyticsChartData[hoveredAnalyticsIdx].reservations}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-200 mt-1 pt-1">
                      <span className="text-slate-900 font-bold">Total Activity</span>
                      <span className="font-mono text-cyan-600">{analyticsChartData[hoveredAnalyticsIdx].total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Recent Activity Log</h3>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Detailed transaction history for {selectedMonthLabel}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <input
                    type="date"
                    value={analyticsDateFilter}
                    onChange={(e) => setAnalyticsDateFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search activity..."
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 px-9 py-2 rounded-xl focus:outline-none focus:border-cyan-500"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Student / User</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                {analyticsRecentActivity.filter(activity => {
                  const matchQuery = activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                                     activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                                     activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase());
                  const matchDate = analyticsDateFilter ? activity.date.startsWith(analyticsDateFilter) : true;
                  return matchQuery && matchDate;
                }).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No activity found matching your search.
                    </td>
                  </tr>
                ) : (
                  analyticsRecentActivity
                    .filter(activity => {
                      const matchQuery = activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                                         activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                                         activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase());
                      const matchDate = analyticsDateFilter ? activity.date.startsWith(analyticsDateFilter) : true;
                      return matchQuery && matchDate;
                    })
                    .map((activity, idx) => (
                    <tr key={idx} className="hover:bg-slate-200/20 transition-colors group">
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {activity.date.includes('T') && activity.date.split('T')[1] !== '00:00:00.000Z'
                          ? new Date(activity.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : new Date(activity.date).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'reservation' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-emerald-500/10 text-emerald-600'}`}>
                            {activity.type === 'reservation' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            )}
                          </div>
                          <span className="text-slate-900 font-medium">{activity.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{activity.student}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${activity.status === 'PENDING_APPROVAL' || activity.status === 'PENDING_HOD' || activity.status === 'Pending HOD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : activity.status === 'APPROVED' || activity.status === 'CHECKED_OUT' || activity.status === 'READY_FOR_PICKUP' || activity.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
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
    </div>
  );
}
