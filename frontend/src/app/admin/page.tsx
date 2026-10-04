'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import ImageCropper from './ImageCropper';
import { siteConfig } from '@/config/site';
import QRManagerModal from '@/components/QRManagerModal';
import QRScannerModal from '@/components/QRScannerModal';
import OrderQRModal from '@/components/OrderQRModal';
import RequisitionLetter from '@/components/RequisitionLetter';
import { toast } from 'sonner';
import { Plus_Jakarta_Sans } from 'next/font/google';
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });
import { isWorkingDay, getWorkingDaysCount } from '@/lib/dateValidator';

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false }
);


type RequestStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PENDING_HOD' | 'APPROVED' | 'READY_FOR_PICKUP' | 'CHECKED_OUT' | 'RETURN_REQUESTED' | 'RETURNED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

interface RequestItem {
  id: string;
  studentName: string;
  usn: string;
  mobile?: string;
  component: string;
  department: string;
  duration: number;
  requestDate: string;
  status: RequestStatus;
  dueDate?: string;
  section?: string;
  year?: string;
  studentDepartment?: string;
  returnedAt?: string;
  valueTier?: string;
  quantity?: number;
  collectionTime?: string;
  projectType?: string;
  idCardUrl?: string | null;
  teamMembers?: any[];
  afterImgUrl?: string | null;
      trackingType?: 'QUANTITY' | 'ASSET';
  isDamaged?: boolean;
  extensionRequested?: boolean;
  extensionReason?: string | null;
  extensionDays?: number | null;
  extensionStatus?: string | null;
  projectTitle?: string | null;
  projectPurpose?: string | null;
  hackathonDate?: string | null;
  hackathonVenue?: string | null;
  signatureUrl?: string | null;
  createdAt?: string;
  history?: {
    oldStatus: string | null;
    newStatus: string;
    changedAt: string;
    note: string | null;
    changedBy: string;
  }[];
}

interface InventoryItem {
  id: string | number;
  name: string;
  available: number;
  total: number;
  department: string;
  status: 'Available' | 'Under Repair' | string;
  desc: string;
  location: string;
  photo_url?: string;
  value_tier?: string;
  tracking_type?: 'QUANTITY' | 'ASSET';
}

// Note: defaultInventory and mockRequests removed — data is fetched live from API

const getComponentPrice = (componentName: string) => {
  const name = componentName.toLowerCase();
  if (name.includes('raspberry pi')) return 3500;
  if (name.includes('arduino')) return 1500;
  if (name.includes('jetson')) return 8500;
  if (name.includes('fluke') || name.includes('multimeter')) return 12005;
  if (name.includes('oscilloscope') || name.includes('rigol')) return 35000;
  if (name.includes('lidar')) return 9500;
  if (name.includes('motor')) return 800;
  if (name.includes('sensor')) return 600;
  if (name.includes('soldering')) return 4500;
  return 1000; // default Rs. 1000
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
  
  const currentDate = new Date(); // Always use the real current date

  const dueDateStr = dueDate.toISOString().split('T')[0];
  if (currentDate.getTime() <= dueDate.getTime()) {
    // Not delayed, calculate how many valid working days are left
    const daysLeft = getWorkingDaysCount(currentDate, dueDate);
    return { isDelayed: false, delayDays: 0, daysLeft, penalty: 0, dueDateStr, weeksDelayed: 0, itemPrice: 0 };
  }

  // Delayed, calculate penalty using only working days
  const delayDays = getWorkingDaysCount(dueDate, currentDate);

  const price = getComponentPrice(componentName);
  const weeksDelayed = Math.ceil(delayDays / 7);
  const penaltyRate = 0.05; // 5%
  const penalty = price * penaltyRate * weeksDelayed;

  return {
    isDelayed: true,
    delayDays,
    daysLeft: 0,
    weeksDelayed,
    penalty,
    dueDateStr,
    itemPrice: price
  };
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'inventory' | 'analytics' | 'section-tracking' | 'completed' | 'damaged'>('dashboard');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [collegeName, setCollegeName] = useState(siteConfig.collegeName);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectData, setInspectData] = useState<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState('2026-09');
  const [hoveredAnalyticsIdx, setHoveredAnalyticsIdx] = useState<number | null>(null);
  const [newDevice, setNewDevice] = useState<any>({
    name: '',
    department: 'EDL',
    total: '',
    desc: '',
    location: 'Main Lab',
    photoUrl: '',
    valueTier: 'MEDIUM',
    trackingType: 'QUANTITY'
  });
  const [adminDept, setAdminDept] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('A');
  const [studentDeptFilter, setStudentDeptFilter] = useState<string>('CSE');
  const [sectionSearchQuery, setSectionSearchQuery] = useState<string>('');
  const [sectionStartDate, setSectionStartDate] = useState<string>('');
  const [sectionEndDate, setSectionEndDate] = useState<string>('');
  const [showSectionFilters, setShowSectionFilters] = useState<boolean>(false);
  
  const [expandedReqs, setExpandedReqs] = useState<Record<string, boolean>>({});
  const toggleExpandReq = (id: string) => setExpandedReqs(prev => ({...prev, [id]: !prev[id]}));
  const [sectionTrackingTab, setSectionTrackingTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');
  const [workflowTab, setWorkflowTab] = useState<'PENDING' | 'ACTIVE' | 'COMPLETED'>('PENDING');
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');

  // Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedUsnFilter, setScannedUsnFilter] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | number | null>(null);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [inventoryTierFilter, setInventoryTierFilter] = useState('ALL');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');

  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'COLLECT' | 'RETURN' | null>(null);
  const [previewLatitude, setPreviewLatitude] = useState<number | null>(null);
  const [previewLongitude, setPreviewLongitude] = useState<number | null>(null);
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  
  // Modal states replacing native browser dialogs (alert/confirm/prompt)
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; confirmText?: string; onConfirm: () => void } | null>(null);
  const [returnConditionModal, setReturnConditionModal] = useState<{ reservationId: string; assetId?: string; penaltyNote?: string } | null>(null);
  const [approveModal, setApproveModal] = useState<{ id: string; component: string; requestedQty: number; valueTier: string; collectionTime: string; collectionDate: string } | null>(null);
  const [approveQty, setApproveQty] = useState(1);
  const [approveTime, setApproveTime] = useState('');
  const [approveDate, setApproveDate] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrComponentId, setQrComponentId] = useState<string | number>('');
  const [qrComponentName, setQrComponentName] = useState('');
  const [showCheckoutScanner, setShowCheckoutScanner] = useState(false);
  const [checkoutScanExpected, setCheckoutScanExpected] = useState('');
  const [checkoutScanReqId, setCheckoutScanReqId] = useState('');
  const [stockEditModal, setStockEditModal] = useState<{ id: string | number; name: string; currentTotal: number } | null>(null);
  const [stockEditValue, setStockEditValue] = useState('');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<{ usn: string, name: string } | null>(null);
  
  const [showOrderQrModal, setShowOrderQrModal] = useState(false);
  const [orderQrData, setOrderQrData] = useState<{ id: string; student: string; usn: string; component: string; quantity: number } | null>(null);

  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionData, setExtensionData] = useState<any>(null);
  const [isProcessingExtension, setIsProcessingExtension] = useState(false);

  useEffect(() => {
    const resolveAddress = async () => {
      if (!previewLatitude || !previewLongitude) {
        setPreviewAddress(null);
        return;
      }
      setPreviewAddress('Resolving location...');
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${previewLatitude}&lon=${previewLongitude}`,
          {
            headers: {
              'User-Agent': 'Phoenix-Lab-Portal/1.0'
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          let shortAddr = '';
          if (data.address) {
            const a = data.address;
            const parts = [];

            // 1. Specific places or features
            const place = a.amenity || a.building || a.office || a.shop || a.tourism || '';
            if (place) parts.push(place);

            // 2. Road/Street
            const road = a.road || a.pedestrian || a.highway || '';
            if (road) parts.push(road);

            // 3. Suburb/Neighbourhood/Area
            const area = a.suburb || a.neighbourhood || a.quarter || a.residential || a.city_district || a.village || a.subdistrict || '';
            if (area && !parts.some(p => p.toLowerCase().includes(area.toLowerCase()))) {
              parts.push(area);
            }

            // 4. City/Town/District
            const city = a.city || a.town || a.county || '';
            if (city && !parts.some(p => p.toLowerCase().includes(city.toLowerCase()))) {
              parts.push(city);
            }

            if (parts.length > 0) {
              shortAddr = parts.join(', ');
            } else {
              shortAddr = data.display_name || `${previewLatitude.toFixed(5)}, ${previewLongitude.toFixed(5)}`;
            }
          } else {
            shortAddr = data.display_name || `${previewLatitude.toFixed(5)}, ${previewLongitude.toFixed(5)}`;
          }
          setPreviewAddress(shortAddr);
        } else {
          setPreviewAddress(`Location (${previewLatitude.toFixed(5)}, ${previewLongitude.toFixed(5)})`);
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        setPreviewAddress(`Location (${previewLatitude.toFixed(5)}, ${previewLongitude.toFixed(5)})`);
      }
    };
    resolveAddress();
  }, [previewLatitude, previewLongitude]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageToCrop(event.target.result as string);
          setShowCropper(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const DEPT_INFO = [
    { id: 'EDL', title: 'Engineering Development LAB', desc: 'Manage EDL requests & stock.', color: 'from-blue-600 to-indigo-600' },
    { id: 'ECE', title: 'Electronics & Comm.', desc: 'Manage ECE requests & stock.', color: 'from-purple-600 to-pink-600' },
    { id: 'EEE', title: 'Electrical Engineering', desc: 'Manage EEE requests & stock.', color: 'from-amber-500 to-orange-600' },
    { id: 'MECH', title: 'Mechanical Engineering', desc: 'Manage MECH requests & stock.', color: 'from-emerald-600 to-teal-600' },
    { id: 'CIVIL', title: 'Civil Engineering', desc: 'Manage CIVIL requests & stock.', color: 'from-rose-500 to-red-600' }
  ];

  const fetchRequestsData = async () => {
    try {
      const res = await fetch('/api/requests');
      const responseData = await res.json();
      const data = responseData.data || responseData; // Handle both paginated and legacy arrays
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch requests:', err);
    }
  };

  useEffect(() => {
    const storedCollege = localStorage.getItem('collegeName');
    if (storedCollege) setCollegeName(storedCollege.toUpperCase());

    // ── Department resolution: JWT is the authoritative source ──────────────
    // GET /api/auth reads the phoenix_token cookie (httpOnly, set at login)
    // and returns the department embedded in the signed JWT.
    // This prevents a stale localStorage value from a previous session
    // incorrectly pre-selecting the wrong department.
    const resolveDept = async () => {
      try {
        const res = await fetch('/api/auth', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.department) {
            // JWT is authoritative — sync localStorage and apply dept
            localStorage.setItem('admin_dept', data.department);
            if (data.department.startsWith('IOT')) {
              window.location.href = '/admin/iot-dashboard';
              return;
            }
            setAdminDept(data.department);
            setIsLocked(true);
            return;
          }
        }
      } catch {
        // Network error — fall through to localStorage fallback
      }

      // Fallback: use localStorage only if JWT fetch fails
      const storedAdminDept = localStorage.getItem('admin_dept');
      if (storedAdminDept) {
        if (storedAdminDept.startsWith('IOT')) {
          window.location.href = '/admin/iot-dashboard';
          return;
        }
        setAdminDept(storedAdminDept);
        setIsLocked(true);
      }
    };

    resolveDept();

    // Fetch unified data from API
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        const invData = data.data || data;
        setInventory(Array.isArray(invData) ? invData : []);
      })
      .catch(err => {
        console.warn('Failed to fetch inventory:', err);
        setInventory([]);
      });

    fetchRequestsData();

    // Auto-poll requests every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchRequestsData();
    }, 5000);

    const handleFocus = () => {
      fetchRequestsData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const getMonthlyStats = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const safeRequests = Array.isArray(requests) ? requests : [];

    const monthReqs = safeRequests.filter(r => {
      if (!r.requestDate || (r.department !== adminDept && r.studentDepartment !== adminDept) || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const prevMonthReqs = safeRequests.filter(r => {
      if (!r.requestDate || (r.department !== adminDept && r.studentDepartment !== adminDept) || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    });

    return {
      curr: {
        reqs: monthReqs.length,
        total: monthReqs.length
      },
      prev: {
        reqs: prevMonthReqs.length,
        total: prevMonthReqs.length
      }
    };
  };

  const getChartDataForMonth = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dailyData = [];

    const safeRequests = Array.isArray(requests) ? requests : [];

    for (let day = 1; day <= daysInMonth; day++) {
      const datePrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const reqsCount = safeRequests.filter(r => r.requestDate === datePrefix && (r.department === adminDept || r.studentDepartment === adminDept) && (!scannedUsnFilter || r.usn === scannedUsnFilter)).length;

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
      if (!r.requestDate || (r.department !== adminDept && r.studentDepartment !== adminDept) || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return;
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

  const monthLabels: { [key: string]: string } = {
    '2026-12': 'December 2026',
    '2026-11': 'November 2026',
    '2026-10': 'October 2026',
    '2026-09': 'September 2026',
    '2026-08': 'August 2026',
    '2026-07': 'July 2026',
    '2026-06': 'June 2026',
    '2026-05': 'May 2026',
    '2026-04': 'April 2026',
    '2026-03': 'March 2026',
    '2026-02': 'February 2026'
  };
  const selectedMonthLabel = monthLabels[selectedAnalyticsMonth] || selectedAnalyticsMonth;

  const updateRequestStatus = async (id: string, status: string, quantity?: number, collectionTime?: string, date?: string) => {
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, quantity, collectionTime, date })
    });
  };

  const handleApprove = (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    setApproveModal({
      id: req.id,
      component: req.component,
      requestedQty: req.quantity || 1,
      valueTier: req.valueTier || 'MEDIUM',
      collectionTime: req.collectionTime || '',
      collectionDate: req.requestDate || ''
    });
    setApproveQty(req.quantity || 1);
    setApproveTime(req.collectionTime || '');
    setApproveDate(req.requestDate || '');
  };

  const handleApproveDateChange = (val: string) => {
    const { isValid, reason } = isWorkingDay(val);
    if (!isValid) {
      toast.error(reason);
      setApproveDate('');
    } else {
      setApproveDate(val);
    }
  };

  const confirmApprove = async () => {
    if (!approveModal) return;
    const req = requests.find(r => r.id === approveModal.id);
    if (!req) return;
    const newStatus = (req.valueTier || '').toUpperCase() === 'HIGH' ? 'PENDING_HOD' : 'APPROVED';
    await updateRequestStatus(approveModal.id, newStatus, approveQty, approveTime, approveDate);
    setRequests(reqs => reqs.map(r => r.id === approveModal.id ? { ...r, status: newStatus as RequestStatus, quantity: approveQty, collectionTime: approveTime, requestDate: approveDate } : r));
    setApproveModal(null);
  };

  const handleReject = async (id: string) => {
    await updateRequestStatus(id, 'REJECTED');
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const handleCheckout = (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    
    if (req.trackingType === 'ASSET') {
      setCheckoutScanReqId(id);
      setCheckoutScanExpected(req.component);
      setPreviewType('COLLECT');
      setShowCheckoutScanner(true);
      return;
    }

    setConfirmModal({
      title: 'Confirm Component Checkout',
      body: 'Mark this component as checked out and collected by the student?',
      confirmText: 'Mark Collected',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationId: id })
          });
          if (res.ok) {
            setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: 'CHECKED_OUT' } : r));
          } else {
             const err = await res.json();
             toast.error(err.error || 'Checkout failed');
          }
        } catch (e) {
          toast.error('Network error during checkout');
        }
        setConfirmModal(null);
      }
    });
  };

  const handleScanSuccess = async (scannedValue: string) => {
    setShowCheckoutScanner(false);
    
    if (scannedValue === 'SKIPPED') {
      toast.error('Scan skipped.');
      setCheckoutScanReqId('');
      setPreviewType(null);
      return;
    }
    
    let targetReservationId = checkoutScanReqId || scannedValue;
    let endpoint = '';
    let body = {};
    let isReturn = false;

    // Find the request locally to determine action if it's a global scan
    const req = requests.find(r => r.id === targetReservationId);
    
    if (!req) {
      toast.error(`No reservation found for ID: ${targetReservationId.substring(0, 8)}`);
      setCheckoutScanReqId('');
      setPreviewType(null);
      return;
    }

    if (previewType === 'RETURN' || req.status === 'CHECKED_OUT' || req.status === 'RETURN_REQUESTED') {
      const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
      const penaltyNote = penaltyInfo.isDelayed
        ? `Late by ${penaltyInfo.delayDays} day(s). Outstanding penalty: ₹${penaltyInfo.penalty.toFixed(2)} (${penaltyInfo.weeksDelayed} wk × 5% of ₹${penaltyInfo.itemPrice}).`
        : 'Returned on time — no penalty applies.';
      setReturnConditionModal({
        reservationId: targetReservationId,
        assetId: targetReservationId !== scannedValue ? scannedValue : undefined,
        penaltyNote
      });
      setCheckoutScanReqId('');
      setPreviewType(null);
      return;
    } else if (previewType === 'COLLECT' || req.status === 'APPROVED' || req.status === 'READY_FOR_PICKUP') {
      isReturn = false;
      endpoint = '/api/checkout';
      body = { reservationId: targetReservationId };
    } else {
      toast.error(`Cannot process scan. Order status is: ${req.status}`);
      setCheckoutScanReqId('');
      setPreviewType(null);
      return;
    }
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (res.ok) {
        setRequests(reqs => reqs.map(r => r.id === targetReservationId ? { ...r, status: 'CHECKED_OUT' } : r));
        toast.success(`Checkout successful! Component handed over.`);
      } else {
        toast.error(data.error || `Failed to process checkout.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Network error during checkout`);
    }
    setCheckoutScanReqId('');
    setPreviewType(null);
  };

  const submitReturn = async (reservationId: string, condition: 'GOOD' | 'DAMAGED', assetId?: string) => {
    try {
      const body: any = { reservationId, condition };
      if (assetId) body.assetId = assetId;
      
      const res = await fetch('/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (res.ok) {
        setRequests(reqs => reqs.filter(r => r.id !== reservationId));
        toast.success(`Return marked as ${condition.toLowerCase()} successfully`);
      } else {
        toast.error(data.error || 'Failed to process return.');
      }
    } catch (err) {
      toast.error('Network error during return');
    }
    setReturnConditionModal(null);
  };

  const processExtension = async (reservationId: string, action: 'APPROVE' | 'REJECT') => {
    setIsProcessingExtension(true);
    try {
      const res = await fetch('/api/requests/extend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action.toLowerCase()} extension`);
      
      toast.success(`Extension ${action.toLowerCase()}d successfully`);
      setShowExtensionModal(false);
      setExtensionData(null);
      fetchRequestsData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessingExtension(false);
    }
  };

  const handleReturn = (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    
    if (req.trackingType === 'ASSET') {
      // Use scanner modal for return
      setCheckoutScanReqId(id);
      setCheckoutScanExpected(req.component);
      setPreviewType('RETURN');
      setShowCheckoutScanner(true);
      return;
    }
    
    const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
    const penaltyNote = penaltyInfo.isDelayed
      ? `Late by ${penaltyInfo.delayDays} day(s). Outstanding penalty: ₹${penaltyInfo.penalty.toFixed(2)} (${penaltyInfo.weeksDelayed} wk × 5% of ₹${penaltyInfo.itemPrice}).`
      : 'Returned on time — no penalty applies.';
      
    setReturnConditionModal({
      reservationId: id,
      penaltyNote
    });
  };

  const toggleRepairStatus = async (id: string | number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newStatus = item.status === 'Available' ? 'Under Repair' : 'Available';
    const newAvailable = newStatus === 'Under Repair' ? Math.max(0, item.available - 1) : Math.min(item.total, item.available + 1);

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          available: newAvailable
        })
      });

      if (res.ok) {
        setInventory(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, available: newAvailable } : i));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStock = (id: string | number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    setStockEditModal({ id, name: item.name, currentTotal: item.total });
    setStockEditValue(String(item.total));
  };

  const confirmUpdateStock = async () => {
    if (!stockEditModal) return;
    const newTotal = parseInt(stockEditValue, 10);
    if (isNaN(newTotal) || newTotal < 0) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stockEditModal.id, total: newTotal, available: newTotal })
      });
      if (res.ok) {
        setInventory(prev => prev.map(i => i.id === stockEditModal.id ? { ...i, total: newTotal, available: newTotal } : i));
      }
    } catch (err) {
      console.error(err);
    }
    setStockEditModal(null);
  };

  const handleTierChange = async (id: string | number, newTier: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    // Optimistic UI update
    setInventory(prev => prev.map(i => i.id === id ? { ...i, value_tier: newTier } : i));

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          valueTier: newTier
        })
      });

      if (!res.ok) {
        // Revert on failure
        setInventory(prev => prev.map(i => i.id === id ? { ...i, value_tier: item.value_tier } : i));
        alert("Failed to update tier.");
      }
    } catch (err) {
      console.error(err);
      setInventory(prev => prev.map(i => i.id === id ? { ...i, value_tier: item.value_tier } : i));
    }
  };

  const handleAddDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDevice.name.trim()) return;

    try {
      setIsUploading(true);
      let finalPhotoUrl = newDevice.photoUrl;

      // Upload base64 image to Supabase Storage if present
      if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
        const base64Data = finalPhotoUrl.split(',')[1];
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const fileExt = finalPhotoUrl.substring("data:image/".length, finalPhotoUrl.indexOf(";base64"));
        const fileName = `component-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('inventory-images')
          .upload(fileName, ab, {
            contentType: `image/${fileExt}`,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw new Error("Failed to upload image: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage.from('inventory-images').getPublicUrl(fileName);
        finalPhotoUrl = publicUrl;
      }

      const isEditing = editingDeviceId !== null;
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = isEditing ? {
        id: editingDeviceId,
        desc: newDevice.desc,
        photoUrl: finalPhotoUrl,
        total: newDevice.total,
        location: newDevice.location,
        valueTier: newDevice.valueTier,
        trackingType: newDevice.trackingType
      } : {
        ...newDevice,
        photoUrl: finalPhotoUrl,
        department: adminDept || 'EDL'
      };

      const res = await fetch('/api/inventory', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success || res.ok) {
        if (isEditing) {
          setInventory(prev => prev.map(i => i.id === editingDeviceId ? { ...i, ...payload, photo_url: finalPhotoUrl } : i));
        } else {
          setInventory(prev => [...prev, data.item]);
        }
        setShowAddModal(false);
        setEditingDeviceId(null);
        setNewDevice({
          name: '',
          department: adminDept || 'EDL',
          total: '',
          desc: '',
          location: 'Main Lab',
          photoUrl: '',
          valueTier: 'MEDIUM',
          trackingType: 'QUANTITY'
        });
      } else {
        alert(data.error || 'Error saving component');
      }
    } catch (err: any) {
      alert(err.message || 'Error adding component');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDevice = (id: string | number) => {
    setConfirmModal({
      title: 'Remove from Inventory',
      body: 'Permanently remove this component from the catalog? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
          if (res.ok) setInventory(prev => prev.filter(item => item.id !== id));
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6 md:p-8 overflow-x-hidden relative selection:bg-rose-500/30 ${plusJakarta.className}`}>
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100 pointer-events-none z-0" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/10 blur-[120px] pointer-events-none mix-blend-multiply z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none mix-blend-multiply z-0" />
      
      <div className="relative z-10">
      
      {/* ── Redesigned Header ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative w-full">
        
        {/* Left Side: Title */}
        <div className="flex items-center gap-3 shrink-0">
          <img 
            src="/vvce-logo.png" 
            alt="VVCE Logo" 
            className="h-12 sm:h-14 w-auto object-contain shrink-0 drop-shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`${plusJakarta.className} text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase`}>Lab Admin Portal</h1>
              {adminDept && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">{adminDept}</span>
              )}
            </div>
            <p className="text-slate-600 font-medium mt-0.5 text-xs">{collegeName} • Administrative Control Panel</p>
          </div>
        </div>

        {/* Right Side: Buttons */}
        <div className="flex justify-end items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Live</span>
          </div>
          {adminDept && !isLocked && (
            <button onClick={() => setAdminDept(null)} className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-slate-100/80 hover:bg-slate-700 border border-slate-300/50 rounded-xl text-xs font-medium transition-colors text-slate-600">
              ← Departments
            </button>
          )}
          <button onClick={() => {
            localStorage.removeItem('admin_dept');
            localStorage.removeItem('hod_dept');
            router.push('/');
          }} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-colors">
            Logout
          </button>
        </div>
      </header>
      <div className="border-b border-slate-200/50 mb-6 sm:mb-8"></div>

      {/* ── Main Navigation Tabs with icons ── */}
      {adminDept && (
        <div className="flex overflow-x-auto gap-1.5 pb-3 mb-6 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:bg-white/70 sm:backdrop-blur-xl sm:border sm:border-slate-200 sm:rounded-2xl sm:p-1.5 sm:shadow-2xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'dashboard'
                ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Command Center
          </button>
          <button
            onClick={() => {
              setActiveTab('requests');
              setWorkflowTab('PENDING');
              setSubStatusFilter('ALL');
              setDateFilter('ALL');
            }}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'requests'
                ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Requests
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'inventory'
                ? 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'analytics'
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('section-tracking')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'section-tracking'
                ? 'bg-pink-500/15 text-pink-400 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Sections
          </button>
          <button
            onClick={() => {
              setActiveTab('completed');
              setWorkflowTab('COMPLETED');
              setSubStatusFilter('ALL');
              setDateFilter('ALL');
            }}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'completed'
                ? 'bg-blue-500/15 text-blue-600 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Completed
          </button>
          <button
            onClick={() => {
              setActiveTab('damaged');
              setSubStatusFilter('ALL');
              setDateFilter('ALL');
            }}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border ${
              activeTab === 'damaged'
                ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.12)]'
                : 'text-slate-500 border-transparent hover:bg-slate-100/60 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Damaged
          </button>
        </div>
      )}

      {/* Landing State */}
      {!adminDept && (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto mt-6 sm:mt-12">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-3xl text-slate-900 font-bold mb-1 sm:mb-2">{collegeName}</h2>
            <p className="text-xs sm:text-lg text-slate-500">Please select your administrative department to manage requests and inventory.</p>
          </div>
          {DEPT_INFO.map(dept => (
            <div
              key={dept.id}
              onClick={() => setAdminDept(dept.id)}
              className="group cursor-pointer rounded-2xl p-[1px] bg-gradient-to-r transition-all duration-300 hover:scale-[1.02] w-full"
            >
              <div className={`w-full bg-white/70 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 hover:bg-gradient-to-r ${dept.color} transition-all duration-300 flex flex-col md:flex-row items-center gap-3 md:gap-8 border border-slate-200 hover:border-slate-300 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] opacity-90 hover:opacity-100 text-center md:text-left`}>
                <div className="flex-1">
                  <h2 className={`${plusJakarta.className} text-2xl sm:text-4xl font-black mb-1 flex items-center justify-center md:justify-start gap-3 tracking-tight drop-shadow-md`}>
                    <span className={`bg-gradient-to-r ${dept.color} bg-clip-text text-transparent brightness-110`}>{dept.id}</span>
                    <span className="text-slate-900 text-lg sm:text-2xl font-bold text-slate-600">HQ</span>
                  </h2>
                  <p className="text-slate-500 group-hover:text-slate-900/70 text-xs sm:text-sm mt-1">{dept.desc}</p>
                </div>
                <div className="mr-4 text-slate-600 group-hover:text-slate-900/80 transition-colors hidden md:block">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Command Center View */}
      {adminDept && activeTab === 'dashboard' && (
        <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Quick Metrics */}
          <div>
            <h2 className={`${plusJakarta.className} text-xl font-black text-slate-900 mb-4 flex items-center gap-2`}>
              LAB OPERATIONS
            </h2>
            {(() => {
              const deptReqs = requests.filter(r => r.department === adminDept || r.studentDepartment === adminDept);
              const pendingCount = deptReqs.filter(r => r.status === 'PENDING_APPROVAL').length;
              const readyCount = deptReqs.filter(r => r.status === 'APPROVED' || r.status === 'READY_FOR_PICKUP').length;
              const activeCount = deptReqs.filter(r => r.status === 'CHECKED_OUT').length;
              const overdueCount = deptReqs.filter(r => r.status === 'CHECKED_OUT' && calculatePenalty(r.dueDate, r.requestDate, r.duration, r.component).isDelayed).length;
              const damagedCount = 0; // Not fully tracked yet
              const deptInv = inventory.filter(i => i.department === adminDept);
              const lowStockCount = deptInv.filter(i => i.total > 0 && i.available <= 1).length;
              
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Pending */}
                  <div className="group relative bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 hover:border-amber-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-amber-700 mb-1 transition-transform group-hover:scale-105">{pendingCount}</span>
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Pending</span>
                  </div>
                  {/* Ready */}
                  <div className="group relative bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 hover:border-emerald-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-emerald-700 mb-1 transition-transform group-hover:scale-105">{readyCount}</span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Ready</span>
                  </div>
                  {/* Active Loans */}
                  <div className="group relative bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-200 hover:border-indigo-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-indigo-700 mb-1 transition-transform group-hover:scale-105">{activeCount}</span>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Active Loans</span>
                  </div>
                  {/* Overdue */}
                  <div className="group relative bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-200 hover:border-rose-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-rose-700 mb-1 transition-transform group-hover:scale-105">{overdueCount}</span>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Overdue</span>
                  </div>
                  {/* Damaged */}
                  <div className="group relative bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-200 hover:border-orange-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-orange-700 mb-1 transition-transform group-hover:scale-105">{damagedCount}</span>
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Damaged</span>
                  </div>
                  {/* Low Stock */}
                  <div className="group relative bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200 hover:border-slate-300 p-5 rounded-2xl flex flex-col items-center text-center transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5">
                    <span className="text-3xl font-black text-slate-700 mb-1 transition-transform group-hover:scale-105">{lowStockCount}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Low Stock</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Priority Queue */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`${plusJakarta.className} text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight`}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <svg className="w-5 h-5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                Priority Queue
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const deptReqs = requests.filter(r => r.department === adminDept || r.studentDepartment === adminDept);
                const overdueReqs = deptReqs.filter(r => r.status === 'CHECKED_OUT' && calculatePenalty(r.dueDate, r.requestDate, r.duration, r.component).isDelayed);
                const pendingReqs = deptReqs.filter(r => r.status === 'PENDING_APPROVAL');
                const readyReqs = deptReqs.filter(r => r.status === 'APPROVED' || r.status === 'READY_FOR_PICKUP');
                const returnReqs = deptReqs.filter(r => r.status === 'RETURN_REQUESTED');

                return (
                  <>
                    <button 
                      onClick={() => { setActiveTab('requests'); setWorkflowTab('ACTIVE'); setSubStatusFilter('OVERDUE'); }}
                      className="group bg-white/80 backdrop-blur-xl border border-slate-200 hover:border-slate-300 p-5 rounded-2xl text-left flex items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100/50 flex items-center justify-center shrink-0 border border-slate-300/50 group-hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 transition-colors`}>{overdueReqs.length} Overdue</h3>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 mb-2">Critical returns past due date</p>
                        <span className="inline-block px-2 py-1 bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest rounded-md border border-rose-500/20">Action Required</span>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => { setActiveTab('requests'); setWorkflowTab('ACTIVE'); setSubStatusFilter('RETURNING'); }}
                      className="group bg-white/80 backdrop-blur-xl border border-slate-200 hover:border-slate-300 p-5 rounded-2xl text-left flex items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100/50 flex items-center justify-center shrink-0 border border-slate-300/50 group-hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 transition-colors`}>{returnReqs.length} Returns</h3>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 mb-2">Pending condition inspection</p>
                        <span className="inline-block px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-md border border-slate-200">High Priority</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setActiveTab('requests'); setWorkflowTab('PENDING'); setSubStatusFilter('AWAITING_APPROVAL'); }}
                      className="group bg-white/80 backdrop-blur-xl border border-slate-200 hover:border-slate-300 p-5 rounded-2xl text-left flex items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100/50 flex items-center justify-center shrink-0 border border-slate-300/50 group-hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 transition-colors`}>{pendingReqs.length} Approvals</h3>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 mb-2">New requests awaiting review</p>
                        <span className="inline-block px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-md border border-slate-200">Medium Priority</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setActiveTab('requests'); setWorkflowTab('PENDING'); setSubStatusFilter('AWAITING_CHECKOUT'); }}
                      className="group bg-white/80 backdrop-blur-xl border border-slate-200 hover:border-slate-300 p-5 rounded-2xl text-left flex items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100/50 flex items-center justify-center shrink-0 border border-slate-300/50 group-hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 transition-colors`}>{readyReqs.length} Checkout</h3>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 mb-2">Ready for student collection</p>
                        <span className="inline-block px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-md border border-slate-200">Medium Priority</span>
                      </div>
                    </button>
                    
                    <div className="md:col-span-2 mt-2">
                      <button 
                        onClick={() => { setActiveTab('requests'); setWorkflowTab('PENDING'); setSubStatusFilter('ALL'); setDateFilter('ALL'); }}
                        className="w-full bg-white/80 backdrop-blur-xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 font-bold text-sm uppercase tracking-widest py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        Review All Tasks
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {adminDept && (activeTab === 'requests' || activeTab === 'completed' || activeTab === 'damaged') && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{adminDept} {activeTab === 'completed' ? 'Completed' : activeTab === 'damaged' ? 'Damaged' : 'Pending & Active'} Requests</h2>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200">
                  Filter: {scannedUsnFilter}
                  <button
                    onClick={() => setScannedUsnFilter(null)}
                    className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-0.5 rounded-full transition-colors ml-1 inline-flex items-center justify-center font-bold"
                    title="Clear filter and show all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCheckoutScanReqId(''); 
                  setPreviewType(null); 
                  setCheckoutScanExpected(''); 
                  setShowCheckoutScanner(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                Scan Order Label
              </button>
              <button
                onClick={() => setShowScannerModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                Scan Student Pass
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 mb-6 border-b border-slate-200 pb-4">
            {activeTab !== 'completed' && (
              <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl">
                <button
                  onClick={() => { setWorkflowTab('PENDING'); setSubStatusFilter('ALL'); setDateFilter('ALL'); }}
                  className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${workflowTab === 'PENDING' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                >
                  Pending Action
                </button>
                <button
                  onClick={() => { setWorkflowTab('ACTIVE'); setSubStatusFilter('ALL'); setDateFilter('ALL'); }}
                  className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${workflowTab === 'ACTIVE' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                >
                  Active (Borrowed)
                </button>
                <button
                  onClick={() => { setWorkflowTab('COMPLETED'); setSubStatusFilter('ALL'); setDateFilter('ALL'); }}
                  className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${workflowTab === 'COMPLETED' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                >
                  Completed
                </button>
              </div>
            )}

            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by USN, Name, or Component..."
                  value={requestSearchQuery}
                  onChange={(e) => setRequestSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 text-sm text-slate-900 px-10 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2 items-center">
              {(activeTab !== 'completed' ? workflowTab : 'COMPLETED') === 'PENDING' && (
                <>
                  <button onClick={() => setSubStatusFilter(s => s === 'AWAITING_APPROVAL' ? 'ALL' : 'AWAITING_APPROVAL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'AWAITING_APPROVAL' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Awaiting Approval</button>
                  <button onClick={() => setSubStatusFilter(s => s === 'AWAITING_CHECKOUT' ? 'ALL' : 'AWAITING_CHECKOUT')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'AWAITING_CHECKOUT' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Awaiting Checkout</button>
                </>
              )}
              {(activeTab !== 'completed' ? workflowTab : 'COMPLETED') === 'ACTIVE' && (
                <>
                  <button onClick={() => setSubStatusFilter(s => s === 'OVERDUE' ? 'ALL' : 'OVERDUE')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'OVERDUE' ? 'bg-rose-500/20 text-rose-600 border-rose-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Overdue Items</button>
                  <button onClick={() => setSubStatusFilter(s => s === 'ON_TIME' ? 'ALL' : 'ON_TIME')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'ON_TIME' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>On Time</button>
                  <button onClick={() => setSubStatusFilter(s => s === 'RETURNING' ? 'ALL' : 'RETURNING')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'RETURNING' ? 'bg-cyan-500/20 text-cyan-600 border-cyan-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Pending Return</button>
                </>
              )}
              {(activeTab !== 'completed' ? workflowTab : 'COMPLETED') === 'COMPLETED' && (
                <>
                  <button onClick={() => setSubStatusFilter(s => s === 'RETURNED' ? 'ALL' : 'RETURNED')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'RETURNED' ? 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Returned</button>
                  <button onClick={() => setSubStatusFilter(s => s === 'REJECTED' ? 'ALL' : 'REJECTED')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'REJECTED' ? 'bg-rose-500/20 text-rose-600 border-rose-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Rejected</button>
                  <button onClick={() => setSubStatusFilter(s => s === 'CANCELLED' ? 'ALL' : 'CANCELLED')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subStatusFilter === 'CANCELLED' ? 'bg-orange-500/20 text-orange-600 border-orange-500/30' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Cancelled</button>
                </>
              )}
            
              <div className="hidden sm:block w-px h-5 bg-slate-100 mx-2"></div>
            
              <button onClick={() => setDateFilter(d => d === 'TODAY' ? 'ALL' : 'TODAY')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${dateFilter === 'TODAY' ? 'bg-slate-700 text-slate-900 border-slate-600' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>Today</button>
              <button onClick={() => setDateFilter(d => d === 'WEEK' ? 'ALL' : 'WEEK')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${dateFilter === 'WEEK' ? 'bg-slate-700 text-slate-900 border-slate-600' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>This Week</button>
              <button onClick={() => setDateFilter(d => d === 'MONTH' ? 'ALL' : 'MONTH')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${dateFilter === 'MONTH' ? 'bg-slate-700 text-slate-900 border-slate-600' : 'bg-slate-100/50 text-slate-500 border-slate-300/50 hover:bg-slate-100 hover:text-slate-700'}`}>This Month</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {(() => {
              const pendingActionStatuses = ['PENDING_APPROVAL', 'PENDING_HOD', 'APPROVED', 'READY_FOR_PICKUP', 'PENDING', 'Pending HOD', 'Pending Renewal HOD', 'Approved by HOD', 'Ready for Collection', 'PENDING_COLLECTION'];
              const activeStatuses = ['CHECKED_OUT', 'RETURN_REQUESTED', 'Active', 'BORROWED', 'PENDING_RETURN'];
              
              let filteredRequests = requests
                .filter(r => !adminDept || (r.department === adminDept || r.studentDepartment === adminDept))
                .filter(r => !scannedUsnFilter || r.usn === scannedUsnFilter)
                .filter(req => {
                  if (activeTab === 'damaged') return req.isDamaged === true;
                  if (activeTab === 'completed') return !pendingActionStatuses.includes(req.status) && !activeStatuses.includes(req.status);
                  if (workflowTab === 'PENDING') return pendingActionStatuses.includes(req.status);
                  if (workflowTab === 'ACTIVE') return activeStatuses.includes(req.status);
                  return !pendingActionStatuses.includes(req.status) && !activeStatuses.includes(req.status);
                })
                .filter(req => {
                  if (subStatusFilter !== 'ALL') {
                    if (subStatusFilter === 'AWAITING_APPROVAL' && req.status !== 'PENDING_APPROVAL') return false;
                    if (subStatusFilter === 'AWAITING_CHECKOUT' && req.status !== 'APPROVED' && req.status !== 'READY_FOR_PICKUP') return false;
                    
                    if (subStatusFilter === 'OVERDUE') {
                      const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
                      if (!penaltyInfo.isDelayed) return false;
                    }
                    if (subStatusFilter === 'ON_TIME') {
                      const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
                      if (penaltyInfo.isDelayed) return false;
                    }
                    if (subStatusFilter === 'RETURNING' && req.status !== 'RETURN_REQUESTED') return false;
                    
                    if (subStatusFilter === 'RETURNED' && req.status !== 'RETURNED') return false;
                    if (subStatusFilter === 'REJECTED' && req.status !== 'REJECTED') return false;
                    if (subStatusFilter === 'CANCELLED' && req.status !== 'CANCELLED') return false;
                  }

                  if (dateFilter !== 'ALL') {
                    const reqDate = new Date(req.requestDate);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - reqDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (dateFilter === 'TODAY' && diffDays > 1) return false;
                    if (dateFilter === 'WEEK' && diffDays > 7) return false;
                    if (dateFilter === 'MONTH' && diffDays > 30) return false;
                  }

                  if (requestSearchQuery) {
                    const q = requestSearchQuery.toLowerCase();
                    return (
                      req.studentName.toLowerCase().includes(q) ||
                      req.usn.toLowerCase().includes(q) ||
                      req.component.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

              filteredRequests.sort((a, b) => {
                if (workflowTab === 'ACTIVE' && activeTab !== 'completed') {
                  const penaltyA = calculatePenalty(a.dueDate, a.requestDate, a.duration, a.component);
                  const penaltyB = calculatePenalty(b.dueDate, b.requestDate, b.duration, b.component);
                  
                  const scoreA = penaltyA.isDelayed ? -penaltyA.delayDays : penaltyA.daysLeft;
                  const scoreB = penaltyB.isDelayed ? -penaltyB.delayDays : penaltyB.daysLeft;
                  
                  if (scoreA !== scoreB) {
                    return scoreA - scoreB;
                  }
                }

                const dateA = new Date(a.requestDate).getTime();
                const dateB = new Date(b.requestDate).getTime();
                return dateB - dateA; // Always sort Newest First
              });

              if (filteredRequests.length === 0) {
                return (
                  <div className="col-span-1 lg:col-span-2 xl:col-span-3 py-20 bg-white/30 border border-slate-200 border-dashed rounded-3xl flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-100/50 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No requests found</p>
                    <p className="text-slate-600 text-xs mt-1">Try adjusting your filters or search query.</p>
                  </div>
                );
              }

              const groupedRequests = Object.values(
                filteredRequests.reduce((acc, req) => {
                  let timeKey = req.requestDate;
                  if (req.createdAt) {
                    const dateObj = new Date(req.createdAt);
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
                const allPending = group.every(req => req.status === 'PENDING_APPROVAL');

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
                              {firstReq.section ? ` Sec ${firstReq.section}` : ''}
                              {firstReq.year ? ` (${firstReq.year})` : ''}
                            </div>
                            {firstReq.mobile && <div className="text-slate-500 font-mono text-[11px]">Phone: {firstReq.mobile}</div>}
                            {firstReq.projectType && firstReq.projectType !== 'Normal' && (
                              <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded w-fit ${firstReq.projectType.toLowerCase().includes('hackathon') ? 'bg-fuchsia-500/20 text-fuchsia-600' : 'bg-indigo-500/20 text-indigo-600'}`}>
                                {firstReq.projectType}
                              </div>
                            )}
                            {firstReq.projectType?.toLowerCase().includes('hackathon') && firstReq.hackathonVenue && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                📍 {firstReq.hackathonVenue} {firstReq.hackathonDate && `| 📅 ${firstReq.hackathonDate}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-slate-500 font-mono bg-slate-200 px-2 py-1 rounded-md border border-slate-200 mb-1 inline-block">{firstReq.requestDate}</div>
                       <div className="text-xs text-cyan-600 font-bold max-w-[150px] truncate">{firstReq.projectTitle || 'Hardware Request'}</div>
                    </div>
                  </div>

                  {/* Components List */}
                  <div className="flex flex-col gap-2">
                    {(() => {
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
                              req.status === 'PENDING_HOD' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                              req.status === 'APPROVED' ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]' :
                              req.status === 'READY_FOR_PICKUP' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]' :
                              (req.status === 'CHECKED_OUT') ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                              req.status === 'RETURN_REQUESTED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                              req.status === 'REJECTED' || req.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                              req.status === 'RETURNED' && req.isDamaged ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                              'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {req.status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' :
                               req.status === 'PENDING_HOD' ? 'AWAITING HOD' :
                               req.status === 'APPROVED' ? 'PENDING CHECKOUT' :
                               req.status === 'READY_FOR_PICKUP' ? 'PENDING CHECKOUT' :
                               (req.status === 'CHECKED_OUT') ? 'COLLECTED' :
                               req.status === 'RETURNED' && req.isDamaged ? 'DAMAGED' :
                               req.status}
                            </span>
                          </div>

                          {/* Individual Component Actions */}
                          {req.status !== 'PENDING_APPROVAL' && (
                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-2 mt-1">
                              {(req.status === 'APPROVED' || req.status === 'READY_FOR_PICKUP' || req.status === 'CHECKED_OUT') && req.valueTier !== 'LOW' && (
                                <button 
                                  onClick={() => {
                                    setOrderQrData({
                                      id: req.id, student: req.studentName, usn: req.usn, component: req.component, quantity: req.quantity || 1
                                    });
                                    setShowOrderQrModal(true);
                                  }} 
                                  className="w-full sm:w-auto px-3 py-1.5 bg-indigo-500/20 text-indigo-600 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5"
                                >
                                  Print Label
                                </button>
                              )}
                              {req.status === 'APPROVED' && (
                                <button onClick={() => handleCheckout(req.id)} className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-[10px] font-black transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">Confirm Handover</button>
                              )}
                              {req.status === 'READY_FOR_PICKUP' && (
                                <button onClick={() => handleCheckout(req.id)} className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-[10px] font-black transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">Confirm Handover</button>
                              )}
                              {req.status === 'CHECKED_OUT' && (
                                <button onClick={() => handleReturn(req.id)} className="px-4 py-1.5 bg-slate-100 text-slate-900 hover:bg-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition">Mark Returned</button>
                              )}
                              {req.status === 'RETURN_REQUESTED' && (
                                <>
                                  {req.afterImgUrl && (
                                    <button onClick={() => { setPreviewImgUrl(req.afterImgUrl || null); setPreviewType('RETURN'); setPreviewModalOpen(true); }} className="px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-[10px] font-bold transition">View Proof</button>
                                  )}
                                  <button onClick={() => handleReturn(req.id)} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-[10px] font-black transition-colors shadow-[0_0_10px_rgba(245,158,11,0.3)]">Accept Return</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );

                      return (
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
                      );
                    })()}
                  </div>

                  {/* Bulk Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-3 border-t border-slate-200">
                    {firstReq.studentDepartment !== 'IOT' && (
                      <button onClick={() => {
                          setInspectData({
                            studentName: firstReq.studentName,
                            usn: firstReq.usn,
                            department: firstReq.studentDepartment || 'EDL',
                            items: group.map(g => ({ name: g.component, quantity: g.quantity || 1 })),
                            requestDate: firstReq.requestDate,
                            duration: firstReq.duration,
                            status: firstReq.status,
                            section: firstReq.section,
                            year: firstReq.year,
                            mobile: firstReq.mobile,
                            teamMembers: firstReq.teamMembers,
                            projectType: firstReq.projectType,
                            projectTitle: firstReq.projectTitle,
                            projectPurpose: firstReq.projectPurpose,
                            hackathonDate: firstReq.hackathonDate,
                            hackathonVenue: firstReq.hackathonVenue,
                            signatureUrl: firstReq.signatureUrl
                          });
                          setShowInspectModal(true);
                        }} className="px-4 py-2 bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0" title="Inspect Bulk Letter">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Inspect Letter
                      </button>
                    )}
                    {firstReq.idCardUrl && (
                      <button onClick={() => {
                        setPreviewImgUrl(firstReq.idCardUrl!);
                        setPreviewType(null);
                        setPreviewModalOpen(true);
                      }} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0" title="View ID Card">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                        ID Card
                      </button>
                    )}

                    {allPending && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                           group.forEach(async (req) => {
                             if (req.status === 'PENDING_APPROVAL') {
                               const newStatus = (req.valueTier || '').toUpperCase() === 'HIGH' ? 'PENDING_HOD' : 'APPROVED';
                               await updateRequestStatus(req.id, newStatus, req.quantity, req.collectionTime, req.requestDate);
                               setRequests(reqs => reqs.map(r => r.id === req.id ? { ...r, status: newStatus as RequestStatus } : r));
                             }
                           });
                           toast.success('Bulk approval successful');
                        }} className="px-5 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold transition">
                          Approve All
                        </button>
                        <button onClick={() => {
                           group.forEach(async (req) => {
                             if (req.status === 'PENDING_APPROVAL') {
                               await updateRequestStatus(req.id, 'REJECTED');
                               setRequests(reqs => reqs.map(r => r.id === req.id ? { ...r, status: 'REJECTED' as RequestStatus } : r));
                             }
                           });
                           toast.success('Bulk rejection successful');
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
        </div>
      )}



      {adminDept && activeTab === 'inventory' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4 mb-6">
            <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col justify-between hover:border-amber-500/30 transition-colors">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Out of Stock</div>
              <div className="text-xl sm:text-2xl font-black mt-2 text-amber-600">{inventory.filter(item => item.department === adminDept && item.available === 0).length}</div>
            </div>
            <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col justify-between hover:border-slate-600 transition-colors">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Total Items</div>
              <div className="text-xl sm:text-2xl font-black mt-2 text-slate-800">{inventory.filter(item => item.department === adminDept).length}</div>
            </div>
            <button
              onClick={() => {
                setActiveTab('requests');
                setWorkflowTab('PENDING');
              }}
              className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group text-left"
              title="Click to view active loans"
            >
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                Active Loans
                <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </div>
              <div className="text-xl sm:text-2xl font-black mt-2 text-indigo-600">
                {requests.filter(req => (req.department === adminDept || req.studentDepartment === adminDept) && ['CHECKED_OUT', 'RETURN_REQUESTED'].includes(req.status)).reduce((sum, req) => sum + (req.quantity || 1), 0)}
              </div>
            </button>
            <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col justify-between hover:border-rose-500/30 transition-colors">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Under Repair</div>
              <div className="text-xl sm:text-2xl font-black mt-2 text-rose-600">{inventory.filter(item => item.department === adminDept && item.status === 'Under Repair').length}</div>
            </div>
            <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Sync Status</div>
              <div className="text-xs sm:text-sm font-bold mt-2 text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </div>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{adminDept} Inventory Catalog</h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={inventorySearchQuery}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                    className="block w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors shadow-sm"
                  />
                </div>
                <select
                  value={inventoryTierFilter}
                  onChange={e => setInventoryTierFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-xs text-slate-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 transition-colors shadow-sm whitespace-nowrap"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="HIGH">High Value</option>
                  <option value="MEDIUM">Medium Value</option>
                  <option value="LOW">Low Value</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingDeviceId(null);
                setNewDevice({
                  name: '',
                  department: adminDept || 'EDL',
                  total: '',
                  desc: '',
                  location: 'Main Lab',
                  photoUrl: '',
                  valueTier: 'MEDIUM',
                  trackingType: 'QUANTITY'
                });
                setShowAddModal(true);
              }}
              className="px-5 py-2 bg-slate-50 hover:bg-white text-slate-900 font-bold rounded-lg text-xs font-mono tracking-widest uppercase transition-all shadow-[0_0_10px_rgba(255,255,255,0.1)] cursor-pointer whitespace-nowrap"
            >
              + ADD NEW DEVICE
            </button>
          </div>

          {inventory.filter(item => item.department === adminDept && (inventoryTierFilter === 'ALL' || item.value_tier === inventoryTierFilter) && (inventorySearchQuery === '' || item.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || (item.desc && item.desc.toLowerCase().includes(inventorySearchQuery.toLowerCase())))).length === 0 ? (
            <div className="text-center py-16 bg-white/30 border border-slate-850 border-dashed rounded-xl">
              <p className="text-slate-500 text-sm font-mono uppercase tracking-wider">No cataloged hardware found matching filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.filter(item => item.department === adminDept && (inventoryTierFilter === 'ALL' || item.value_tier === inventoryTierFilter) && (inventorySearchQuery === '' || item.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || (item.desc && item.desc.toLowerCase().includes(inventorySearchQuery.toLowerCase())))).map((item, index) => (


                <div

                  key={item.id || index}
                  className="bg-white/80 border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between min-h-[350px] group hover:border-slate-300 transition-all duration-300 relative"
                >
                  {/* Photo Header */}
                  <div className="relative w-full h-36 bg-white overflow-hidden border-b border-slate-850 flex items-center justify-center">
                    <Image
                      src={item.photo_url || 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=600&auto=format&fit=crop'}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-contain group-hover:scale-102 transition-transform duration-500 opacity-90"
                    />
                    {item.status === 'Under Repair' && (
                      <div className="absolute inset-0 bg-rose-950/45 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="px-2.5 py-0.5 bg-rose-600 text-slate-900 rounded text-[8px] font-mono font-bold tracking-wider uppercase">
                          ● UNDER REPAIR
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-base text-slate-800 group-hover:text-slate-900 truncate">{item.name}</h3>
                        <button
                          onClick={() => {
                            setEditingDeviceId(item.id);
                            setNewDevice({
                              name: item.name,
                              department: item.department,
                              total: item.total,
                              desc: item.desc,
                              location: item.location,
                              photoUrl: item.photo_url || '',
                              valueTier: item.value_tier || 'MEDIUM',
                              trackingType: item.tracking_type || 'QUANTITY'
                            });
                            setShowAddModal(true);
                          }}
                          className="p-1 bg-white border border-slate-850 rounded hover:text-cyan-600 hover:border-cyan-900 transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit Component"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {(item.value_tier === 'HIGH' || item.value_tier === 'MEDIUM') && (
                          <button
                            onClick={() => {
                              setQrComponentId(item.id);
                              setQrComponentName(item.name);
                              setShowQrModal(true);
                            }}
                            className="p-1 bg-white border border-slate-850 rounded hover:text-indigo-600 hover:border-indigo-900 transition-colors opacity-0 group-hover:opacity-100"
                            title="Manage Serial QRs"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDevice(item.id)}
                          className="p-1 bg-white border border-slate-850 rounded hover:text-rose-600 hover:border-rose-905 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Component"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex justify-end items-center mt-1">
                        <select
                          value={item.value_tier || 'MEDIUM'}
                          onChange={(e) => handleTierChange(item.id, e.target.value)}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider cursor-pointer appearance-none outline-none ${item.value_tier === 'LOW' ? 'text-green-400 bg-green-500/10' : item.value_tier === 'HIGH' ? 'text-rose-600 bg-rose-500/10' : 'text-amber-600 bg-amber-500/10'}`}
                        >
                          <option value="LOW" className="bg-white text-green-400">LOW (Auto)</option>
                          <option value="MEDIUM" className="bg-white text-amber-600">MEDIUM (Admin)</option>
                          <option value="HIGH" className="bg-white text-rose-600">HIGH (Admin + HOD)</option>
                        </select>
                      </div>
                      <div className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        {item.desc || 'No item specifications provided.'}
                      </div>
                    </div>

                    <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-200/40">
                      <div>
                        <div className="text-2xl font-black font-mono text-slate-700">
                          {item.available}
                          <span className="text-[10px] font-normal text-slate-500 font-sans ml-1">/ {item.total} Qty</span>
                        </div>
                        <div className="text-[7px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">Available Stock</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStock(item.id)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-850 rounded text-[9px] font-mono font-bold tracking-wide uppercase text-slate-600 transition-all cursor-pointer"
                        >
                          Adj. Qty
                        </button>
                        <button
                          onClick={() => toggleRepairStatus(item.id)}
                          className={`px-2.5 py-1 border rounded text-[9px] font-mono font-bold tracking-wide uppercase transition-all cursor-pointer ${item.status === 'Available'
                            ? 'bg-white hover:bg-rose-950/20 border-slate-850 hover:border-rose-900/60 hover:text-rose-600'
                            : 'bg-rose-950/15 border-rose-900/30 text-rose-600 hover:bg-white hover:border-slate-850 hover:text-slate-600'
                            }`}
                        >
                          {item.status === 'Available' ? 'Repair' : 'Fixed'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. ANALYTICS MONTHLY UPDATES DASHBOARD */}
      {adminDept && activeTab === 'analytics' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">

          {/* Controls */}
          <div className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Monthly Updates Analytics</h3>
                <p className="text-xs text-slate-500 mt-0.5">Historical activity performance and transaction summaries.</p>
              </div>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200 h-fit">
                  Filter: {scannedUsnFilter}
                  <button
                    onClick={() => setScannedUsnFilter(null)}
                    className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-0.5 rounded-full transition-colors ml-1 inline-flex items-center justify-center font-bold"
                    title="Clear filter and show all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <select
                value={selectedAnalyticsMonth}
                onChange={e => setSelectedAnalyticsMonth(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
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
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Monthly Updates</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">{analyticsStats.curr.total}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(totalChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {totalChangeStr}
                </span>
                <span className="text-slate-500">vs previous month ({analyticsStats.prev.total})</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-fuchsia-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Component Reservations</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">{analyticsStats.curr.reqs}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(reqsChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {reqsChangeStr}
                </span>
                <span className="text-slate-500">vs previous month ({analyticsStats.prev.reqs})</span>
              </div>
            </div>



            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lab Stock</p>
              <h2 className="text-4xl font-extrabold mt-3 text-slate-900 tracking-tight">
                {inventory.filter(i => i.department === adminDept).reduce((acc, item) => acc + item.total, 0)}
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
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Utilization</h3>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Most Borrowed Components</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                </div>
                  {(() => {
                    // Only count components that are ACTUALLY checked out (physically with student)
                    const activeStatuses = ['CHECKED_OUT'];
                    const safeReqs = Array.isArray(requests) ? requests : [];
                    const deptInv = inventory.filter(i => i.department === adminDept && i.total > 0);

                    // Count checked-out quantity per component name from real requests
                    const checkedOutMap: Record<string, number> = {};
                    safeReqs.forEach(r => {
                      if (
                        activeStatuses.includes(r.status) &&
                        (r.department === adminDept || r.studentDepartment === adminDept) &&
                        r.component
                      ) {
                        checkedOutMap[r.component] = (checkedOutMap[r.component] || 0) + (r.quantity || 1);
                      }
                    });

                    const utilization = deptInv.map(i => ({
                      name: i.name,
                      percent: i.total > 0 ? Math.min(100, Math.round(((checkedOutMap[i.name] || 0) / i.total) * 100)) : 0
                    })).filter(i => i.percent > 0).sort((a, b) => b.percent - a.percent).slice(0, 3);

                    if (utilization.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <div className="text-slate-600 text-xs font-mono uppercase tracking-widest">No active checkouts</div>
                          <div className="text-slate-700 text-[10px] mt-1">Items will appear here once checked out</div>
                        </div>
                      );
                    }

                    return utilization.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-sm font-bold text-slate-600 mb-1.5">
                          <span>{item.name}</span>
                          <span className="text-indigo-600 font-mono">{item.percent}%</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-slate-200">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" style={{ width: `${item.percent}%` }}></div>
                        </div>
                      </div>
                    ));
                  })()}

              </div>

              {/* Inventory Health */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Inventory Health</h3>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Overall Stock Distribution</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                {(() => {
                  const deptInv = inventory.filter(i => i.department === adminDept);
                  const totalStock = deptInv.reduce((acc, i) => acc + i.total, 0);
                  const availableStock = deptInv.reduce((acc, i) => acc + i.available, 0);
                  const borrowedStock = deptInv.reduce((acc, i) => acc + (i.total - i.available), 0);
                  const repairItems = deptInv.filter(i => i.status === 'Under Repair').length;
                  const damagedReqs = Array.isArray(requests) ? requests.filter(r => r.isDamaged && (r.department === adminDept || r.studentDepartment === adminDept)).length : 0;

                  const availPct = totalStock > 0 ? Math.round((availableStock / totalStock) * 100) : 0;
                  const borrowPct = totalStock > 0 ? Math.round((borrowedStock / totalStock) * 100) : 0;
                  const repairPct = deptInv.length > 0 ? Math.round((repairItems / deptInv.length) * 100) : 0;
                  const damagePct = (Array.isArray(requests) ? requests.filter(r => r.department === adminDept || r.studentDepartment === adminDept).length : 0) > 0
                    ? Math.round((damagedReqs / requests.filter(r => r.department === adminDept || r.studentDepartment === adminDept).length) * 100)
                    : 0;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-sm font-bold text-slate-600">Available</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-emerald-600">{availPct}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                          <span className="text-sm font-bold text-slate-600">Borrowed</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-cyan-600">{borrowPct}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                          <span className="text-sm font-bold text-slate-600">Under Repair</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-amber-600">{repairPct}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                          <span className="text-sm font-bold text-slate-600">Damaged</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-rose-600">{damagePct}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: Performance & Demand */}
            <div className="space-y-6">
              
              {/* Today's Performance */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Today's Performance</h3>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const deptReqs = Array.isArray(requests)
                    ? requests.filter(r => (r.department === adminDept || r.studentDepartment === adminDept))
                    : [];
                    
                  // Count requests created today
                  const receivedToday = deptReqs.filter(r => new Date(r.requestDate) >= today).length;
                  
                  // Count actions today using history
                  let approvedToday = 0;
                  let checkedOutToday = 0;
                  let returnedToday = 0;
                  
                  deptReqs.forEach(r => {
                    if (r.history) {
                      r.history.forEach((h: any) => {
                        const actionDate = new Date(h.changedAt);
                        if (actionDate >= today) {
                          if (h.newStatus === 'APPROVED') approvedToday++;
                          if (h.newStatus === 'CHECKED_OUT') checkedOutToday++;
                          if (h.newStatus === 'RETURNED' || h.newStatus === 'COMPLETED') returnedToday++;
                        }
                      });
                    }
                  });

                  return (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Received</span>
                          <span className="text-2xl font-black font-mono text-slate-700">{receivedToday}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Approved</span>
                          <span className="text-2xl font-black font-mono text-emerald-500">{approvedToday}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Checked Out</span>
                          <span className="text-2xl font-black font-mono text-indigo-500">{checkedOutToday}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Returned</span>
                          <span className="text-2xl font-black font-mono text-amber-500">{returnedToday}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Return Performance & Demand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Return Performance */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col">
                  <h3 className="font-bold text-slate-900 mb-1">Return Performance</h3>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-4">Student Compliance</p>
                  
                  <div className="flex-1 flex flex-col justify-center gap-4">
                    {(() => {
                      const returnedReqs = Array.isArray(requests)
                        ? requests.filter(r => (r.department === adminDept || r.studentDepartment === adminDept) && r.status === 'RETURNED' && r.returnedAt && r.requestDate && r.duration)
                        : [];
                      const onTimeCount = returnedReqs.filter(r => {
                        const dueMs = new Date(r.requestDate).getTime() + (r.duration || 7) * 86400000;
                        return new Date(r.returnedAt!).getTime() <= dueMs;
                      }).length;
                      const overdueCount = returnedReqs.length - onTimeCount;
                      const onTimePct = returnedReqs.length > 0 ? Math.round((onTimeCount / returnedReqs.length) * 100) : 0;
                      const overduePct = returnedReqs.length > 0 ? Math.round((overdueCount / returnedReqs.length) * 100) : 0;
                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-emerald-600">On-time</span>
                              <span className="font-mono text-emerald-600">{onTimePct}%</span>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5 border border-slate-200">
                              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${onTimePct}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-rose-600">Overdue</span>
                              <span className="font-mono text-rose-600">{overduePct}%</span>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5 border border-slate-200">
                              <div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${overduePct}%` }}></div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Demand */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-purple-500/5 blur-xl pointer-events-none"></div>
                  <h3 className="font-bold text-slate-900 mb-1">Demand Spike</h3>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-4">M-o-M Growth</p>
                  
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-3xl font-black font-mono ${analyticsStats.curr.total > analyticsStats.prev.total ? 'text-purple-400' : analyticsStats.curr.total < analyticsStats.prev.total ? 'text-rose-600' : 'text-slate-500'}`}>
                        {totalChangeStr}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">This month vs last ({analyticsStats.prev.total} → {analyticsStats.curr.total})</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Graph and Feed Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Graph Component */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Daily Updates Traffic</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Activity graph for {selectedMonthLabel}</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-slate-600">Total Updates</span>
                  </div>
                </div>
              </div>

              {/* SVG interactive graph */}
              <div className="relative w-full h-[250px] bg-white/45 rounded-xl border border-slate-850 p-4">
                <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="gradient-updates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 1, 2, 3, 4].map(idx => {
                    const val = Math.round((analyticsYMax / 4) * idx);
                    const y = 180 - (idx / 4) * 140;
                    return (
                      <g key={idx}>
                        {idx > 0 && (
                          <line x1="45" y1={y} x2="575" y2={y} stroke="rgba(0, 0, 0, 0.05)" strokeDasharray="3,3" />
                        )}
                        <text x="35" y={y + 4} textAnchor="end" className="text-[10px] font-mono fill-zinc-500">{val}</text>
                      </g>
                    );
                  })}

                  {/* X-axis indicators */}
                  <line x1="45" y1="180" x2="575" y2="180" stroke="rgba(0, 0, 0, 0.1)" strokeWidth={1} />
                  <text x="45" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day 1</text>
                  <text x="310" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day 15</text>
                  <text x="575" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day {analyticsChartData.length}</text>

                  {/* Chart path & area */}
                  {analyticsChartData.length > 0 && (
                    <>
                      <path d={updatesAreaPath} fill="url(#gradient-updates)" />
                      <path d={updatesLinePath} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(14,165,233,0.3)]" />
                    </>
                  )}

                  {/* Highlight dots on hover */}
                  {analyticsChartData.map((d, idx) => {
                    if (hoveredAnalyticsIdx !== idx) return null;
                    const x = 45 + idx * (530 / (analyticsChartData.length - 1));
                    const y = 180 - (d.total / analyticsYMax) * 140;
                    return (
                      <g key={idx}>
                        <line x1={x} y1="40" x2={x} y2="180" stroke="rgba(0, 0, 0, 0.15)" strokeDasharray="2,2" />
                        <circle cx={x} cy={y} r={6} fill="#0ea5e9" stroke="#ffffff" strokeWidth={2} />
                      </g>
                    );
                  })}

                  {/* Mouse interaction zones */}
                  {analyticsChartData.map((_, idx) => {
                    const step = 530 / (analyticsChartData.length - 1);
                    const x = 45 + idx * step - step / 2;
                    return (
                      <rect
                        key={idx}
                        x={x}
                        y="30"
                        width={step}
                        height="150"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAnalyticsIdx(idx)}
                        onMouseLeave={() => setHoveredAnalyticsIdx(null)}
                      />
                    );
                  })}
                </svg>

                {/* HTML Tooltip overlay */}
                {hoveredAnalyticsIdx !== null && analyticsChartData[hoveredAnalyticsIdx] && (
                  <div
                    className="absolute bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xl backdrop-blur-md pointer-events-none transition-all duration-150 z-20 text-xs flex flex-col gap-1"
                    style={{
                      left: `${Math.min(Math.max(45 + hoveredAnalyticsIdx * (530 / (analyticsChartData.length - 1)) - 60, 10), 460) / 600 * 100}%`,
                      top: '10px'
                    }}
                  >
                    <div className="font-bold text-slate-600 border-b border-slate-850 pb-1 mb-1">
                      Day {analyticsChartData[hoveredAnalyticsIdx].day} - {selectedMonthLabel}
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-500">Reservations:</span>
                      <span className="font-mono text-fuchsia-600 font-bold">{analyticsChartData[hoveredAnalyticsIdx].reservations}</span>
                    </div>
                    <div className="flex justify-between gap-6 border-t border-slate-900 pt-1 font-bold">
                      <span className="text-slate-600">Total Updates:</span>
                      <span className="font-mono text-cyan-600">{analyticsChartData[hoveredAnalyticsIdx].total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col h-[354px]">
              <div className="mb-4 flex flex-col gap-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Recent Activity</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Latest updates in {selectedMonthLabel}</p>
                </div>
                <input
                  type="text"
                  placeholder="Search activity..."
                  value={analyticsSearchQuery}
                  onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {analyticsRecentActivity.filter(activity => 
                  activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                  activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                  activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 border border-slate-850 border-dashed rounded-xl">
                    <svg className="w-8 h-8 text-slate-650 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-slate-500 text-xs">No updates found.</span>
                  </div>
                ) : (
                  analyticsRecentActivity
                    .filter(activity => 
                      activity.title.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || 
                      activity.student.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                      activity.status.toLowerCase().includes(analyticsSearchQuery.toLowerCase())
                    )
                    .map((activity, idx) => (
                    <div key={idx} className="bg-white/40 border border-slate-850 p-3 rounded-xl flex flex-col gap-1.5 hover:border-slate-805 transition">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-slate-900 text-xs leading-tight">{activity.title}</span>
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border uppercase shrink-0 ${activity.status.includes('Approved') || activity.status === 'READY_FOR_PICKUP' || activity.status === 'APPROVED' || activity.status === 'CHECKED_OUT'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : activity.status.includes('Reject') || activity.status.includes('DENIED')
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-slate-100 text-slate-500 border-slate-750'
                          }`}>
                          {activity.status === 'Approved by HOD' ? 'Approved' : activity.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>{activity.student}</span>
                        <span className="font-mono">{activity.date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal Redesign */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">

            {/* Corner decors */}
            <div className="absolute top-3 left-3 text-slate-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute top-3 right-3 text-slate-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 left-3 text-slate-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 right-3 text-slate-700 font-mono text-[9px] select-none">+</div>

            <div className="flex justify-between items-center border-b border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-1 uppercase font-mono">{editingDeviceId ? 'EDIT COMPONENT' : 'REGISTER NEW HARDWARE'}</h3>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{editingDeviceId ? 'Save updates to this device' : 'Add to inventory catalog'}</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Component Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Logic Analyzer 16-Ch"
                    value={newDevice.name}
                    onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                    disabled={!!editingDeviceId}
                    className={`w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 transition-colors ${editingDeviceId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      readOnly
                      value={adminDept || 'EDL'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 font-mono focus:outline-none cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Stock Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newDevice.total}
                      onChange={e => setNewDevice({ ...newDevice, total: e.target.value === '' ? '' : parseInt(e.target.value) || '' })}
                      className="w-full bg-white border border-slate-200 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Lab Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IoT Lab room 304"
                      value={newDevice.location}
                      onChange={e => setNewDevice({ ...newDevice, location: e.target.value })}
                      className="w-full bg-white border border-slate-200 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider text-emerald-600">Value Tier (Approval)</label>
                    <select
                      value={newDevice.valueTier}
                      onChange={e => setNewDevice({ ...newDevice, valueTier: e.target.value })}
                      className="w-full bg-white border border-emerald-500/30 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono appearance-none"
                    >
                      <option value="LOW">LOW (Auto-Approve)</option>
                      <option value="MEDIUM">MEDIUM (Admin)</option>
                      <option value="HIGH">HIGH (Admin + HOD)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider text-purple-400">Tracking Type</label>
                    <select
                      value={newDevice.trackingType}
                      onChange={e => setNewDevice({ ...newDevice, trackingType: e.target.value })}
                      className="w-full bg-white border border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono appearance-none"
                    >
                      <option value="QUANTITY">QUANTITY TRACKING</option>
                      <option value="ASSET">ASSET (QR) TRACKING</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Specifications (Description)</label>
                  <textarea
                    placeholder="e.g. 100MHz bandwidth, 1 GSa/s sample rate..."
                    value={newDevice.desc}
                    onChange={e => setNewDevice({ ...newDevice, desc: e.target.value })}
                    className="w-full bg-white border border-slate-200 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all leading-relaxed"
                    rows={3}
                  />
                </div>
              </div>

              {/* Right Form Image Selector */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-mono text-slate-500 mb-2.5 uppercase tracking-wider">Configure Component Image</label>

                  <div className="animate-in fade-in duration-200">
                    <label className="border-2 border-dashed border-slate-200 hover:border-cyan-500/60 bg-white/60 rounded-xl h-52 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group hover:shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                      <svg className="w-12 h-12 text-slate-500 group-hover:text-cyan-600 transition-colors mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-mono text-slate-600 group-hover:text-slate-900 font-semibold">Select Local Image File</span>
                      <span className="text-[10px] font-mono text-slate-600 mt-1 uppercase">PNG, JPG, JPEG</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Selection Preview Box - Highly Visual */}
                <div className="border border-slate-850 rounded-xl p-3 bg-white/40 flex items-center gap-4">
                  <div className="w-24 h-16 rounded-lg bg-white border border-slate-850 overflow-hidden shrink-0 shadow-inner">
                    {newDevice.photoUrl ? (
                      <img src={newDevice.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-700 font-mono">NO IMAGE</div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">SELECTED PREVIEW</div>
                    <div className="text-xs font-mono font-semibold text-cyan-600 uppercase truncate mt-0.5">
                      {newDevice.photoUrl ? '✓ CUSTOM CROPPED FILE' : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className={`w-full py-3.5 px-4 bg-slate-50 hover:bg-white text-slate-900 font-bold rounded-xl text-xs font-mono tracking-widest uppercase transition-all duration-300 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-[0.98] cursor-pointer'} mt-2`}
                >
                  {isUploading ? 'Uploading Image...' : editingDeviceId ? '[+] Save Updates' : '[+] Register Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminDept && activeTab === 'section-tracking' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{adminDept} Section Tracking</h2>
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
              const relevantRequests = requests
                .filter(req => (req.department === adminDept || req.studentDepartment === adminDept) && (req.studentDepartment === studentDeptFilter || !studentDeptFilter) && req.section === sectionFilter && (!scannedUsnFilter || req.usn === scannedUsnFilter))
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
                
                if (req.status === 'CHECKED_OUT') {
                  acc[req.usn].activeLoans++;
                  const penaltyInfo = calculatePenalty(req.dueDate, req.requestDate, req.duration, req.component);
                  if (penaltyInfo.isDelayed) {
                    acc[req.usn].overdue++;
                  } else {
                    // Check if due soon (e.g. 1 day left) - For simplicity we just use active but not delayed
                    // In a real app we'd compare dates. We'll mock it if duration is approaching.
                    acc[req.usn].dueSoon++;
                  }
                }
                return acc;
              }, {} as Record<string, any>);

              const studentsArray = Object.values(studentsMap);
              
              // Depending on 'CURRENT' or 'COMPLETED' tab, we might only want to show students who have relevant requests
              // Let's filter students who actually have active loans if CURRENT, or any history if COMPLETED
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

      {showCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={(croppedBase64) => {
            setNewDevice({ ...newDevice, photoUrl: croppedBase64 });
            setShowCropper(false);
            setImageToCrop(null);
          }}
          onCancel={() => {
            setShowCropper(false);
            setImageToCrop(null);
          }}
        />
      )}

      {/* QR Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md p-4" onClick={() => setShowScannerModal(false)}>
          <div
            className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col items-center text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowScannerModal(false)}
              className="absolute top-3 right-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-colors z-20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="mb-6 w-full">
              <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center justify-center gap-2`}>
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Scan Digital Pass
              </h3>
              <p className="text-slate-500 text-xs font-mono">Position the student's QR code in the frame</p>
            </div>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white border-2 border-emerald-500/30 relative">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    const usn = result[0].rawValue;
                    setScannedUsnFilter(usn);
                    setShowScannerModal(false);
                  }
                }}
                styles={{
                  container: { width: '100%', height: '100%' },
                  video: { objectFit: 'cover' }
                }}
              />
              {/* Scanner overlay effect */}
              <div className="absolute inset-0 border-[3px] border-emerald-500/50 m-8 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewModalOpen && previewImgUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => { setPreviewModalOpen(false); setPreviewImgUrl(null); }}
        >
          <div
            className="bg-white border border-slate-200 p-6 rounded-3xl max-w-xl w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setPreviewModalOpen(false); setPreviewImgUrl(null); }}
              className="absolute top-3 right-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-colors z-20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 text-left w-full border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                {previewType === 'RETURN' ? 'Return Proof' : 'Collection Proof'}
              </h3>
              <p className="text-slate-500 text-xs font-mono mt-0.5">VERIFIED VIA STUDENT GPS PORTAL</p>
            </div>

            <div className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-white aspect-video flex items-center justify-center relative">
              <img src={previewImgUrl} alt={previewType === 'RETURN' ? 'Return Proof' : 'Collection Proof'} className="max-w-full max-h-full object-contain" />
            </div>

            {previewAddress ? (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-500 w-full text-center flex flex-col gap-1.5">
                <div className="text-cyan-600 font-bold uppercase tracking-wider text-[10px]">Resolved Address</div>
                <div className="text-slate-700 text-sm leading-normal">{previewAddress}</div>
                
              </div>
            ) : (
              previewLatitude && previewLongitude && (
                <div className="mt-4 bg-white border border-slate-850 rounded-xl px-4 py-2 text-xs font-mono text-slate-500 w-full text-center">
                  LATITUDE: {previewLatitude.toFixed(6)} • LONGITUDE: {previewLongitude.toFixed(6)}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Confirm Action Modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-6 pl-11">{confirmModal.body}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-700 text-slate-600 font-semibold rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="flex-[2] py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-slate-900 font-bold rounded-xl text-sm transition-all active:scale-[0.98]">{confirmModal.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Condition Modal ── */}
      {returnConditionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Return Condition</h3>
              <button onClick={() => setReturnConditionModal(null)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition text-slate-500">✕</button>
            </div>
            
            {returnConditionModal.penaltyNote && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5">
                <p className="text-amber-600 text-xs font-semibold">{returnConditionModal.penaltyNote}</p>
              </div>
            )}
            
            <p className="text-slate-500 text-sm mb-5">Please inspect the component and select its current condition:</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => submitReturn(returnConditionModal.reservationId, 'GOOD', returnConditionModal.assetId)}
                className="w-full flex items-center gap-3 p-4 bg-slate-100 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <div className="font-bold text-emerald-600 mb-0.5">Working Good</div>
                  <div className="text-xs text-slate-500">Component is fully functional and in good shape.</div>
                </div>
              </button>
              
              <button 
                onClick={() => submitReturn(returnConditionModal.reservationId, 'DAMAGED', returnConditionModal.assetId)}
                className="w-full flex items-center gap-3 p-4 bg-slate-100 border border-rose-500/20 rounded-xl hover:bg-rose-500/10 hover:border-rose-500/40 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <div className="font-bold text-rose-600 mb-0.5">Damaged / Missing Parts</div>
                  <div className="text-xs text-slate-500">Component is broken, burnt, or missing pieces.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Request Modal ── */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">Approve Request</h3>
            </div>
            <p className="text-slate-500 text-sm mb-5 pl-11">Confirming <span className="text-slate-700 font-semibold">{approveModal.component}</span></p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Approved Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={approveModal.requestedQty}
                  value={approveQty}
                  onChange={e => setApproveQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <p className="text-slate-600 text-[11px] mt-1">Student requested: {approveModal.requestedQty}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Collection Date</label>
                <input
                  type="date"
                  value={approveDate}
                  onChange={e => handleApproveDateChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {approveModal.collectionDate && <p className="text-slate-600 text-[11px] mt-1">Student specified: {approveModal.collectionDate}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Collection Time / Slot</label>
                <input
                  type="text"
                  placeholder="e.g. 2PM–4PM, Lab 301"
                  value={approveTime}
                  onChange={e => setApproveTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {approveModal.collectionTime && <p className="text-slate-600 text-[11px] mt-1">Student specified: {approveModal.collectionTime}</p>}
              </div>
              {approveModal.valueTier === 'HIGH' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-600 text-xs font-semibold flex items-center gap-2">
                  <span>⚠️</span> High-value item — will forward to HOD for final approval.
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-700 text-slate-600 font-semibold rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={confirmApprove} className="flex-[2] py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold rounded-xl text-sm transition-all active:scale-[0.98]">✓ Approve Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Edit Modal ── */}
      {stockEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">Update Stock Count</h3>
            </div>
            <p className="text-slate-500 text-sm mb-5 pl-11 leading-relaxed"><span className="text-slate-600 font-medium">{stockEditModal.name}</span></p>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">New Total Stock</label>
              <input
                type="number"
                min="0"
                value={stockEditValue}
                onChange={e => setStockEditValue(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                autoFocus
              />
              <p className="text-slate-600 text-[11px] mt-1">Current total: {stockEditModal.currentTotal}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStockEditModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-700 text-slate-600 font-semibold rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={confirmUpdateStock} className="flex-[2] py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 font-bold rounded-xl text-sm transition-all active:scale-[0.98]">Update Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Manager Modal */}
      <QRManagerModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        componentId={String(qrComponentId)}
        componentName={qrComponentName}
      />

      {/* Order QR Label Modal */}
      {orderQrData && (
        <OrderQRModal
          isOpen={showOrderQrModal}
          onClose={() => setShowOrderQrModal(false)}
          reservationId={orderQrData.id}
          studentName={orderQrData.student}
          usn={orderQrData.usn}
          componentName={orderQrData.component}
          quantity={orderQrData.quantity}
        />
      )}

      {/* QR Scanner Modal for Checkout */}
      <QRScannerModal
        isOpen={showCheckoutScanner}
        onClose={() => setShowCheckoutScanner(false)}
        expectedComponentName={checkoutScanExpected}
        onScanSuccess={handleScanSuccess}
      />

      {/* Redesigned Student Details Modal */}
      {selectedStudentForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className={`${plusJakarta.className} text-xl font-bold text-slate-900 mb-1`}>Student Details</h3>
                <p className="text-slate-500 text-xs font-mono">{selectedStudentForDetails.usn}</p>
              </div>
              <button onClick={() => setSelectedStudentForDetails(null)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer text-slate-500">✕</button>
            </div>

            {(() => {
              const studentReqs = requests.filter(r => r.usn === selectedStudentForDetails.usn);
              const active = studentReqs.filter(r => r.status === 'CHECKED_OUT' || r.status === 'RETURN_REQUESTED');
              const overdueReqs = active.filter(r => calculatePenalty(r.dueDate, r.requestDate, r.duration, r.component).isDelayed);
              const completed = studentReqs.filter(r => r.status === 'RETURNED' || r.status === 'COMPLETED');
              const currentRequests = studentReqs.filter(r => r.status === 'PENDING_APPROVAL' || r.status === 'APPROVED' || r.status === 'READY_FOR_PICKUP');

              return (
                <div className="space-y-6">
                  {/* Profile Summary */}
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-slate-300">
                      <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedStudentForDetails.name}</h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{studentReqs[0]?.studentDepartment} - Section {studentReqs[0]?.section}</div>
                    </div>
                  </div>

                  {/* Summary Stats in requested format */}
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
                            ) : req.status === 'CHECKED_OUT' && penaltyInfo.isDelayed ? (
                              <div className="text-rose-600 text-sm flex items-center gap-1.5">
                                Overdue {penaltyInfo.delayDays} day{penaltyInfo.delayDays > 1 ? 's' : ''} ⚠
                              </div>
                            ) : req.status === 'CHECKED_OUT' ? (
                              <div className="text-amber-600 text-sm flex items-center gap-1.5">
                                Active loan
                              </div>
                            ) : req.status === 'RETURN_REQUESTED' ? (
                              <div className="text-amber-500 text-sm flex items-center gap-1.5">
                                Return Requested
                              </div>
                            ) : req.status === 'REJECTED' || req.status === 'CANCELLED' ? (
                              <div className="text-red-500 text-sm flex items-center gap-1.5">
                                {req.status === 'REJECTED' ? 'Rejected ❌' : 'Cancelled 🚫'}
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

      {/* Extension Review Modal */}
      {showExtensionModal && extensionData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/30 backdrop-blur-xl p-4">
          <div className="bg-white border border-blue-500/30 p-8 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(37,99,235,0.15)] relative">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Extension Request</h3>
            <p className="text-sm text-slate-500 mb-6 font-mono">ID: {extensionData.id}</p>

            <div className="space-y-4 mb-8">
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Student</div>
                <div className="text-slate-900 font-bold text-sm">{extensionData.studentName}</div>
                <div className="text-slate-500 text-xs font-mono">{extensionData.usn}</div>
              </div>
              
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Requested Extension</div>
                <div className="text-blue-600 font-bold text-lg">+{extensionData.extensionDays} Days</div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Reason Provided</div>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{extensionData.extensionReason}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => processExtension(extensionData.id, 'REJECT')} disabled={isProcessingExtension} className="flex-1 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-sm transition-colors border border-rose-500/20 disabled:opacity-50">Reject</button>
              <button onClick={() => processExtension(extensionData.id, 'APPROVE')} disabled={isProcessingExtension} className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 font-black transition-colors disabled:opacity-50 shadow-lg text-sm">Approve Extension</button>
            </div>
            
            <button onClick={() => setShowExtensionModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-slate-900 transition">✕</button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
