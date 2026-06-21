'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ImageCropper from './ImageCropper';
import { Scanner } from '@yudiel/react-qr-scanner';
import { siteConfig } from '@/config/site';


type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'Pending HOD' | 'Ready for Collection' | 'Active' | 'Returned' | 'RETURNED' | 'BORROWED' | 'PENDING_RETURN' | 'PENDING_COLLECTION';

interface RequestItem {
  id: string;
  studentName: string;
  usn: string;
  component: string;
  department: string;
  duration: number;
  requestDate: string;
  status: RequestStatus;
  section?: string;
  studentDepartment?: string;
  returnedAt?: string;
  valueTier?: string;
  quantity?: number;
  collectionTime?: string;
  geotagImageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
}

const defaultInventory: InventoryItem[] = [
  { id: 1, name: 'Raspberry Pi 4 Model B', available: 4, total: 5, desc: 'High-performance single-board computer. Used for heavy processing and ML nodes.', department: 'EDL', location: 'Lab 201', status: 'Available' },
  { id: 2, name: 'Arduino Mega 2560', available: 0, total: 2, desc: 'Advanced microcontroller board based on the ATmega2560. Ideal for complex robotics projects.', department: 'MECH', location: 'Mechatronics Lab', status: 'Available' },
  { id: 3, name: 'NVIDIA Jetson Nano', available: 2, total: 2, desc: 'Small, powerful computer for embedded applications and AI neural networks.', department: 'EDL', location: 'AI Lab 404', status: 'Available' },
  { id: 4, name: 'Fluke 117 Multimeter', available: 12, total: 15, desc: 'True-RMS digital multimeter with integrated non-contact voltage detection.', department: 'EEE', location: 'Circuits Lab', status: 'Available' },
  { id: 5, name: 'RIGOL DS1054Z Oscilloscope', available: 3, total: 4, desc: '50 MHz Digital Oscilloscope with 4 channels. Crucial for signal analysis.', department: 'ECE', location: 'Signals Lab', status: 'Available' },
  { id: 6, name: 'ESP32 Wi-Fi/BT Module', available: 18, total: 20, desc: 'Low-cost, low-power system on a chip with integrated Wi-Fi and dual-mode Bluetooth.', department: 'EDL', location: 'IoT Lab', status: 'Available' },
  { id: 7, name: 'Hakko FX-888D Soldering Station', available: 6, total: 6, desc: 'Digital precision soldering iron with adjustable thermal recovery and heating speeds.', department: 'EEE', location: 'Fabrication Room', status: 'Under Repair' },
  { id: 8, name: 'Lidar Sensor (RPLIDAR A1)', available: 1, total: 2, desc: '360-degree 2D laser scanner (LIDAR) solution for ROS mapping and SLAM algorithms.', department: 'MECH', location: 'Autonomous Systems Lab', status: 'Available' }
];

const mockRequests: RequestItem[] = [
  { id: 'REQ-001', studentName: 'Rahul Kumar', usn: '4VV25CS045', component: 'Raspberry Pi 4 Model B', department: 'EDL', duration: 7, requestDate: '2026-04-18', status: 'Pending HOD' },
  { id: 'REQ-002', studentName: 'Aditi Sharma', usn: '4VV25EC012', component: 'RIGOL DS1054Z Oscilloscope', department: 'ECE', duration: 3, requestDate: '2026-04-18', status: 'Ready for Collection' },
  { id: 'REQ-003', studentName: 'Rohan Sharma', usn: '4VV25CS001', component: 'Arduino Mega 2560', department: 'MECH', duration: 14, requestDate: '2026-04-15', status: 'Active' },
];

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

const calculatePenalty = (requestDateStr: string, durationDays: number, componentName: string) => {
  if (!requestDateStr) return { isDelayed: false, delayDays: 0, penalty: 0, dueDateStr: '' };

  const reqDate = new Date(requestDateStr);
  const duration = parseInt(String(durationDays), 10) || 7;

  const dueDate = new Date(reqDate.getTime() + duration * 24 * 60 * 60 * 1000);
  const currentDate = new Date("2026-06-05"); // Simulated current date aligning with project lifecycle

  const dueDateStr = dueDate.toISOString().split('T')[0];
  if (currentDate.getTime() <= dueDate.getTime()) {
    return { isDelayed: false, delayDays: 0, penalty: 0, dueDateStr };
  }

  const diffTime = currentDate.getTime() - dueDate.getTime();
  const delayDays = Math.ceil(diffTime / (24 * 60 * 60 * 1000));

  const price = getComponentPrice(componentName);
  const weeksDelayed = Math.ceil(delayDays / 7);
  const penaltyRate = 0.05; // 5%
  const penalty = price * penaltyRate * weeksDelayed;

  return {
    isDelayed: true,
    delayDays,
    weeksDelayed,
    penalty,
    dueDateStr,
    itemPrice: price
  };
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'requests' | 'inventory' | 'lab-access' | 'analytics' | 'section-tracking'>('requests');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [collegeName, setCollegeName] = useState(siteConfig.collegeName);
  const [showAddModal, setShowAddModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState('2026-06');
  const [hoveredAnalyticsIdx, setHoveredAnalyticsIdx] = useState<number | null>(null);
  const [newDevice, setNewDevice] = useState({
    name: '',
    department: 'EDL',
    total: 1,
    desc: '',
    location: 'Main Lab',
    photoUrl: '',
    valueTier: 'MEDIUM'
  });
  const [adminDept, setAdminDept] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('A');
  const [studentDeptFilter, setStudentDeptFilter] = useState<string>('CSE');
  const [sectionSearchQuery, setSectionSearchQuery] = useState<string>('');
  const [sectionStartDate, setSectionStartDate] = useState<string>('');
  const [sectionEndDate, setSectionEndDate] = useState<string>('');
  const [showSectionFilters, setShowSectionFilters] = useState<boolean>(false);
  const [sectionTrackingTab, setSectionTrackingTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');
  const [workflowTab, setWorkflowTab] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');

  // Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedUsnFilter, setScannedUsnFilter] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | number | null>(null);
  
  const [notices, setNotices] = useState<any[]>([]);
  const [newNoticeMsg, setNewNoticeMsg] = useState('');
  const [newNoticeType, setNewNoticeType] = useState('info');

  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLatitude, setPreviewLatitude] = useState<number | null>(null);
  const [previewLongitude, setPreviewLongitude] = useState<number | null>(null);

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
    { id: 'MECH', title: 'Mechanical Engineering', desc: 'Manage MECH requests & stock.', color: 'from-emerald-600 to-teal-600' }
  ];

  const fetchLabRequests = async () => {
    try {
      const res = await fetch('/api/lab-access');
      const data = await res.json();
      setLabRequests(data);
    } catch (e) {
      console.error('Failed to fetch lab access requests', e);
    }
  };

  useEffect(() => {
    const storedCollege = localStorage.getItem('collegeName');
    if (storedCollege) setCollegeName(storedCollege.toUpperCase());

    const storedAdminDept = localStorage.getItem('admin_dept');
    if (storedAdminDept) {
      setAdminDept(storedAdminDept);
      setIsLocked(true);
    }

    // Fetch unified data from API
    fetch('/api/inventory').then(res => res.json()).then(data => setInventory(data));
    fetch('/api/requests').then(res => res.json()).then(data => setRequests(data));
    fetchLabRequests();
  }, []);

  const fetchNotices = async (dept: string) => {
    try {
      const res = await fetch(`/api/notices?department=${dept}`);
      const data = await res.json();
      if(Array.isArray(data)) setNotices(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (adminDept) {
      fetchNotices(adminDept);
    }
  }, [adminDept]);

  const handlePostNotice = async () => {
    if (!newNoticeMsg.trim() || !adminDept) return;
    await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_dept: adminDept, message: newNoticeMsg, type: newNoticeType })
    });
    setNewNoticeMsg('');
    fetchNotices(adminDept);
  };

  const handleDeleteNotice = async (id: string) => {
    if(!window.confirm("Delete this notice?")) return;
    await fetch(`/api/notices?id=${id}`, { method: 'DELETE' });
    if(adminDept) fetchNotices(adminDept);
  };

  const getMonthlyStats = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const monthReqs = requests.filter(r => {
      if (!r.requestDate || r.department !== adminDept || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthLabReqs = labRequests.filter(r => {
      if (!r.accessDate || r.department !== adminDept || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.accessDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const prevMonthReqs = requests.filter(r => {
      if (!r.requestDate || r.department !== adminDept || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    });

    const prevMonthLabReqs = labRequests.filter(r => {
      if (!r.accessDate || r.department !== adminDept || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return false;
      const d = new Date(r.accessDate);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    });

    return {
      curr: {
        reqs: monthReqs.length,
        labs: monthLabReqs.length,
        total: monthReqs.length + monthLabReqs.length
      },
      prev: {
        reqs: prevMonthReqs.length,
        labs: prevMonthLabReqs.length,
        total: prevMonthReqs.length + prevMonthLabReqs.length
      }
    };
  };

  const getChartDataForMonth = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dailyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const datePrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const reqsCount = requests.filter(r => r.requestDate === datePrefix && r.department === adminDept && (!scannedUsnFilter || r.usn === scannedUsnFilter)).length;
      const labsCount = labRequests.filter(r => r.accessDate === datePrefix && r.department === adminDept && (!scannedUsnFilter || r.usn === scannedUsnFilter)).length;

      dailyData.push({
        day,
        dateStr: datePrefix,
        reservations: reqsCount,
        labAccess: labsCount,
        total: reqsCount + labsCount
      });
    }
    return dailyData;
  };

  const getRecentActivity = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const activities: any[] = [];

    requests.forEach(r => {
      if (!r.requestDate || r.department !== adminDept || (scannedUsnFilter && r.usn !== scannedUsnFilter)) return;
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

    labRequests.forEach(l => {
      if (!l.accessDate || l.department !== adminDept || (scannedUsnFilter && l.usn !== scannedUsnFilter)) return;
      const d = new Date(l.accessDate);
      if (d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
        activities.push({
          type: 'lab-access',
          id: l.id || `LAB-${Math.floor(1000 + Math.random() * 9000)}`,
          title: `Lab Access: ${l.labName}`,
          student: `${l.studentName} (${l.usn})`,
          date: l.accessDate,
          status: l.status,
          timestamp: new Date(l.accessDate).getTime()
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
  const labsChangeStr = getPercentageChange(analyticsStats.curr.labs, analyticsStats.prev.labs);

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
    '2026-06': 'June 2026',
    '2026-05': 'May 2026',
    '2026-04': 'April 2026',
    '2026-03': 'March 2026',
    '2026-02': 'February 2026'
  };
  const selectedMonthLabel = monthLabels[selectedAnalyticsMonth] || selectedAnalyticsMonth;

  const handleLabAccessAction = async (id: string, approve: boolean, remarks: string) => {
    const newStatus = approve ? 'APPROVED' : 'REJECTED_ADMIN';
    try {
      const res = await fetch('/api/lab-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, adminRemarks: remarks })
      });
      if (res.ok) {
        setLabRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, adminRemarks: remarks } : r));
        alert(approve ? 'Workspace access permit granted!' : 'Workspace access permit denied.');
      } else {
        alert('Failed to update workspace access permit.');
      }
    } catch (e) {
      console.error(e);
      alert('Connection error.');
    }
  };

  const updateRequestStatus = async (id: string, status: string, quantity?: number, collectionTime?: string) => {
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, quantity, collectionTime })
    });
  };

  const handleApprove = async (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    
    let finalQuantity = req.quantity || 1;
    const inputQty = prompt(`Approve request for ${req.component}\nRequested quantity: ${req.quantity || 1}\nEnter quantity to approve:`, String(req.quantity || 1));
    if (inputQty === null) return; // Cancelled
    
    const parsedQty = parseInt(inputQty, 10);
    if (!isNaN(parsedQty) && parsedQty > 0) {
      finalQuantity = parsedQty;
    }

    let finalCollectionTime = req.collectionTime || '';
    const inputTime = prompt(`Approve request for ${req.component}\nStudent requested time: ${req.collectionTime || 'Not specified'}\nEnter approved collection time (leave as is to accept student's time):`, req.collectionTime || '');
    if (inputTime === null) return; // Cancelled
    finalCollectionTime = inputTime;

    const newStatus = req.valueTier === 'HIGH' ? 'Pending HOD' : 'APPROVED';
    await updateRequestStatus(id, newStatus, finalQuantity, finalCollectionTime);
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: newStatus, quantity: finalQuantity, collectionTime: finalCollectionTime } : r));
  };

  const handleReject = async (id: string) => {
    await updateRequestStatus(id, 'REJECTED');
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const handleCheckout = async (id: string) => {
    if (!window.confirm("Are you sure you want to mark this component as checked out / collected?")) {
      return;
    }
    await updateRequestStatus(id, 'Active');
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: 'Active' } : r));
  };

  const handleReturn = async (id: string) => {
    if (!window.confirm("Are you sure you want to confirm the return of this component?")) {
      return;
    }
    const req = requests.find(r => r.id === id);
    if (req) {
      const penaltyInfo = calculatePenalty(req.requestDate, req.duration, req.component);
      if (penaltyInfo.isDelayed) {
        alert(`Component returned successfully!\nOutstanding Penalty to Settle: ₹${penaltyInfo.penalty} (${penaltyInfo.weeksDelayed} week(s) late, computed at 5% of ₹${penaltyInfo.itemPrice} per week).`);
      } else {
        alert('Component returned successfully with zero penalty.');
      }
    }
    await updateRequestStatus(id, 'RETURNED');
    setRequests(reqs => reqs.filter(r => r.id !== id));
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

  const handleUpdateStock = async (id: string | number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newTotalStr = window.prompt(`Enter new total stock count for ${item.name}:`, item.total.toString());
    if (newTotalStr === null) return;

    const newTotal = parseInt(newTotalStr, 10);
    if (isNaN(newTotal) || newTotal < 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          total: newTotal,
          available: newTotal
        })
      });

      if (res.ok) {
        setInventory(prev => prev.map(i => i.id === id ? { ...i, total: newTotal, available: newTotal } : i));
      }
    } catch (err) {
      console.error(err);
    }
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
        location: newDevice.location
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
          total: 1,
          desc: '',
          location: 'Main Lab',
          photoUrl: '',
          valueTier: 'MEDIUM'
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

  const handleDeleteDevice = async (id: string | number) => {
    if (window.confirm('Are you sure you want to completely remove this component from the inventory? This cannot be undone.')) {
      try {
        const res = await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setInventory(prev => prev.filter(item => item.id !== id));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-zinc-800 pb-6 relative">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">LAB ADMIN PORTAL</h1>
          <p className="text-zinc-400 mt-1">
            {adminDept ? `Managing ${adminDept} Department.` : collegeName}
          </p>
        </div>

        {/* Desktop & Mobile Top Actions */}
        <div className="flex items-center gap-4">
          {adminDept && !isLocked && (
            <button onClick={() => setAdminDept(null)} className="hidden md:block px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm transition-colors font-medium">
              ← Back to Departments
            </button>
          )}
          <button onClick={() => {
            localStorage.removeItem('admin_dept');
            localStorage.removeItem('hod_dept');
            router.push('/');
          }} className="px-5 py-2 bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600/20 rounded-lg text-sm transition-colors font-medium">
            Logout
          </button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      {adminDept && (
        <div className="flex overflow-x-auto gap-2 pb-4 mb-6 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <button
            onClick={() => setActiveTab('requests')}
            className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white shadow-sm'}`}
          >
            Requests Workflow
          </button>
          <button
            onClick={() => setActiveTab('lab-access')}
            className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'lab-access' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white shadow-sm'}`}
          >
            Lab Workspace Access
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'inventory' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white shadow-sm'}`}
          >
            Inventory Management
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white shadow-sm'}`}
          >
            Monthly Updates
          </button>
          <button
            onClick={() => setActiveTab('section-tracking')}
            className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'section-tracking' ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]' : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white shadow-sm'}`}
          >
            Section Tracking
          </button>
        </div>
      )}

      {/* Landing State */}
      {!adminDept && (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto mt-12">
          <div className="text-center mb-6">
            <h2 className="text-3xl text-white font-bold mb-2">{collegeName}</h2>
            <p className="text-lg text-zinc-400">Please select your administrative department to manage requests and inventory.</p>
          </div>
          {DEPT_INFO.map(dept => (
            <div
              key={dept.id}
              onClick={() => setAdminDept(dept.id)}
              className="group cursor-pointer rounded-2xl p-[1px] bg-gradient-to-r transition-all duration-300 hover:scale-[1.02] w-full"
            >
              <div className={`w-full bg-zinc-900 rounded-2xl p-6 hover:bg-gradient-to-r ${dept.color} transition-all duration-300 flex flex-col md:flex-row items-center gap-4 md:gap-8 border border-zinc-800 hover:border-transparent opacity-90 hover:opacity-100 text-center md:text-left`}>
                <div className="flex-1">
                  <h2 className="text-4xl font-black mb-1 flex items-center gap-3 tracking-tight drop-shadow-md">
                    <span className={`bg-gradient-to-r ${dept.color} bg-clip-text text-transparent brightness-110`}>{dept.id}</span>
                    <span className="text-white text-2xl font-bold text-zinc-300">HQ</span>
                  </h2>
                  <p className="text-zinc-500 group-hover:text-white/70 text-sm mt-1">{dept.desc}</p>
                </div>
                <div className="mr-4 text-zinc-600 group-hover:text-white/80 transition-colors">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard View */}
      {adminDept && activeTab === 'requests' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{adminDept} Pending & Active Requests</h2>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200">
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
            <button
              onClick={() => setShowScannerModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Scan Student Pass
            </button>
          </div>

          <div className="flex gap-4 mb-4 border-b border-zinc-800 pb-2">
            <button
              onClick={() => setWorkflowTab('CURRENT')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${workflowTab === 'CURRENT' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Current Requests
            </button>
            <button
              onClick={() => setWorkflowTab('COMPLETED')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${workflowTab === 'COMPLETED' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Completed Requests
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 w-1/4">Student Info</th>
                  <th className="px-6 py-4">Requested Components</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(() => {
                  const currentStatuses = ['PENDING', 'APPROVED', 'Pending HOD', 'Ready for Collection', 'Active', 'BORROWED', 'PENDING_RETURN', 'PENDING_COLLECTION'];
                  const groupedRequests = requests
                    .filter(r => r.department === adminDept && (!scannedUsnFilter || r.usn === scannedUsnFilter))
                    .filter(req => workflowTab === 'CURRENT' ? currentStatuses.includes(req.status) : !currentStatuses.includes(req.status))
                    .reduce((acc, req) => {
                      const key = `${req.usn}_${req.requestDate}`;
                      if (!acc[key]) {
                        acc[key] = {
                          groupId: key,
                          studentName: req.studentName,
                          usn: req.usn,
                          requestDate: req.requestDate,
                          items: []
                        };
                      }
                      acc[key].items.push(req);
                      return acc;
                    }, {} as Record<string, { groupId: string, studentName: string, usn: string, requestDate: string, items: RequestItem[] }>);

                  const groupedRequestsArray = Object.values(groupedRequests);

                  if (groupedRequestsArray.length === 0) {
                    return (
                      <tr>
                        <td colSpan={2} className="px-6 py-8 text-center text-zinc-500">No {workflowTab.toLowerCase()} requests found.</td>
                      </tr>
                    );
                  }

                  return groupedRequestsArray.map(group => (
                    <tr key={group.groupId} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 align-top border-r border-zinc-800/50">
                        <div className="font-medium text-white text-base">{group.studentName}</div>
                        <div className="text-zinc-500 font-mono text-xs mt-1">{group.usn}</div>
                        <div className="text-zinc-500 text-xs mt-3 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Requested: {group.requestDate}
                        </div>
                        <div className="text-cyan-400 text-xs mt-2 font-bold uppercase tracking-widest">
                          {group.items.length} Item{group.items.length > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-3">
                          {group.items.map(req => (
                            <div key={req.id} className="flex justify-between items-center bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                              <div className="flex-1">
                                <div className="font-bold text-blue-400 text-sm flex items-center gap-2">
                                  {req.component} {req.quantity ? <span className="text-zinc-400 text-xs">(Qty: {req.quantity})</span> : ''}
                                  <span className="text-zinc-600 font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded">#{req.id}</span>
                                </div>
                                <div className="text-zinc-500 text-xs mt-1">Duration: <span className="text-zinc-300 font-mono">{req.duration} Days</span></div>
                                {(() => {
                                  const penaltyInfo = calculatePenalty(req.requestDate, req.duration, req.component);
                                  if (req.status === 'Active' && penaltyInfo.isDelayed) {
                                    return (
                                      <div className="text-red-400 text-[10px] font-bold mt-2 flex items-center gap-1.5 bg-red-950/30 border border-red-900/50 px-2.5 py-1 rounded-md w-fit">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                        <span>Late by {penaltyInfo.delayDays} days • Penalty: ₹{penaltyInfo.penalty}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex items-center gap-5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                  req.status === 'APPROVED' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                    req.status === 'PENDING_COLLECTION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                      (req.status === 'Active' || req.status === 'BORROWED') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        req.status === 'PENDING_RETURN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                          'bg-green-500/10 text-green-400 border-green-500/20'
                                  }`}>
                                  {req.status === 'PENDING_COLLECTION' ? 'PENDING CHECKOUT' : req.status}
                                </span>
                                <div className="text-right space-x-2 flex-shrink-0 min-w-[140px] flex justify-end">
                                  {req.status === 'PENDING' && (
                                    <>
                                      <button onClick={() => handleApprove(req.id)} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-bold transition">Approve</button>
                                      <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-bold transition">Reject</button>
                                    </>
                                  )}
                                  {req.status === 'APPROVED' && (
                                    <button onClick={() => handleCheckout(req.id)} className="px-4 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-xs font-bold transition">Mark Check Out</button>
                                  )}
                                  {req.status === 'PENDING_COLLECTION' && (
                                    <div className="flex gap-2 items-center">
                                      {req.geotagImageUrl && (
                                        <button 
                                          onClick={() => {
                                            setPreviewImgUrl(req.geotagImageUrl || null);
                                            setPreviewLatitude(req.latitude || null);
                                            setPreviewLongitude(req.longitude || null);
                                            setPreviewModalOpen(true);
                                          }}
                                          className="px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          View Proof
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => handleCheckout(req.id)} 
                                        className="px-4 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-xs font-bold transition"
                                      >
                                        Approve Checkout
                                      </button>
                                    </div>
                                  )}
                                  {(req.status === 'Active' || req.status === 'BORROWED') && (
                                    <button onClick={() => handleReturn(req.id)} className="px-4 py-1.5 bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold transition">Mark Returned</button>
                                  )}
                                  {req.status === 'PENDING_RETURN' && (
                                    <button onClick={() => handleReturn(req.id)} className="px-4 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-bold transition">Accept Return</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminDept && activeTab === 'lab-access' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{adminDept} Lab Workspace Access Requests</h2>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200">
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
            <button
              onClick={fetchLabRequests}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
              </svg>
              Refresh Queue
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Request ID</th>
                  <th className="px-6 py-4">Student Info</th>
                  <th className="px-6 py-4">Workspace / Lab</th>
                  <th className="px-6 py-4">Date & Slot</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {labRequests.filter(r => r.department === adminDept && (!scannedUsnFilter || r.usn === scannedUsnFilter)).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No lab access requests found.</td>
                  </tr>
                )}
                {labRequests.filter(req => req.department === adminDept && (!scannedUsnFilter || req.usn === scannedUsnFilter)).map(req => {
                  return (
                    <tr key={req.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-zinc-300">{req.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{req.studentName}</div>
                        <div className="text-zinc-500 font-mono text-xs mt-0.5">{req.usn}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-200">{req.labName}</div>
                        <div className="text-xs text-zinc-500 italic truncate max-w-xs mt-1" title={req.purpose}>
                          "{req.purpose}"
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-300 font-mono">{req.accessDate}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{req.timeSlot}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 w-fit ${req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          req.status === 'PENDING_ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            req.status === 'PENDING_HOD' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'APPROVED' ? 'bg-emerald-400' :
                            req.status === 'PENDING_ADMIN' ? 'bg-purple-400 animate-pulse' :
                              req.status === 'PENDING_HOD' ? 'bg-amber-400 animate-pulse' :
                                'bg-rose-400'
                            }`}></span>
                          {req.status === 'PENDING_HOD' ? 'Awaiting HOD' :
                            req.status === 'PENDING_ADMIN' ? 'Awaiting Admin' :
                              req.status === 'APPROVED' ? 'Approved & Active' : 'Declined'}
                        </span>

                        {req.hodRemarks && (
                          <div className="mt-2 text-[11px] text-purple-400 max-w-xs leading-tight">
                            <span className="font-semibold font-sans">HOD Remarks:</span> {req.hodRemarks}
                          </div>
                        )}
                        {req.adminRemarks && (
                          <div className="mt-1 text-[11px] text-zinc-400 max-w-xs leading-tight">
                            <span className="font-semibold font-sans">Admin Remarks:</span> {req.adminRemarks}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'PENDING_HOD' && (
                          <span className="text-xs text-zinc-500 italic">Locked (Awaiting HOD Sign-off)</span>
                        )}
                        {req.status === 'PENDING_ADMIN' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                const remarks = prompt('Enter rejection reason for this permit request (optional):');
                                if (remarks !== null) {
                                  handleLabAccessAction(req.id, false, remarks);
                                }
                              }}
                              className="px-3 py-1.5 bg-red-600/15 text-red-500 border border-red-500/20 hover:bg-red-650 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Deny Pass
                            </button>
                            <button
                              onClick={() => {
                                const remarks = prompt('Enter logistics instructions or remarks for student (optional):', 'Pass granted. Please bring your institutional ID card.');
                                if (remarks !== null) {
                                  handleLabAccessAction(req.id, true, remarks);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-black font-bold rounded-lg text-xs transition cursor-pointer"
                            >
                              Grant Pass
                            </button>
                          </div>
                        )}
                        {(req.status === 'APPROVED' || req.status.startsWith('REJECTED')) && (
                          <span className="text-xs text-zinc-500">Request Decided</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminDept && activeTab === 'inventory' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* HUD Metrics Cards */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ OUT_OF_STOCK ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-amber-400">{inventory.filter(item => item.department === adminDept && item.available === 0).length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ TOTAL_STOCK ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-zinc-200">{inventory.filter(item => item.department === adminDept).length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ ACTIVE_LOANS ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-indigo-400">
                {requests.filter(req => req.department === adminDept && ['Active', 'BORROWED', 'PENDING_RETURN'].includes(req.status)).reduce((sum, req) => sum + (req.quantity || 1), 0)}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ BROKEN_UNITS ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-rose-400">{inventory.filter(item => item.department === adminDept && item.status === 'Under Repair').length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ PORTAL_SYNC ]</div>
              <div className="text-sm font-bold mt-3 font-mono text-emerald-400 flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </div>
            </div>
          </section>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">[{adminDept}_INVENTORY_CATALOG]</h2>
            <button
              onClick={() => {
                setEditingDeviceId(null);
                setNewDevice({
                  name: '',
                  department: adminDept,
                  total: 1,
                  desc: '',
                  location: 'Main Lab',
                  photoUrl: '',
                  valueTier: 'MEDIUM'
                });
                setShowAddModal(true);
              }}
              className="px-5 py-2 bg-zinc-50 hover:bg-white text-zinc-950 font-bold rounded-lg text-xs font-mono tracking-widest uppercase transition-all shadow-[0_0_10px_rgba(255,255,255,0.1)] cursor-pointer"
            >
              + ADD NEW DEVICE
            </button>
          </div>

          {inventory.filter(item => item.department === adminDept).length === 0 ? (
            <div className="text-center py-16 bg-zinc-900/30 border border-zinc-850 border-dashed rounded-xl">
              <p className="text-zinc-500 text-sm font-mono uppercase tracking-wider">No cataloged hardware in this department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.filter(item => item.department === adminDept).map((item, index) => (

                <div

                  key={item.id || index}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden flex flex-col justify-between min-h-[350px] group hover:border-zinc-700 transition-all duration-300 relative"
                >
                  {/* Photo Header */}
                  <div className="relative w-full h-36 bg-zinc-950 overflow-hidden border-b border-zinc-850 flex items-center justify-center">
                    <img
                      src={item.photo_url || 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=600&auto=format&fit=crop'}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-102 transition-transform duration-500 opacity-90"
                    />
                    {item.status === 'Under Repair' && (
                      <div className="absolute inset-0 bg-rose-950/45 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded text-[8px] font-mono font-bold tracking-wider uppercase">
                          ● UNDER REPAIR
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-base text-zinc-100 group-hover:text-white truncate">{item.name}</h3>
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
                              valueTier: item.value_tier || 'MEDIUM'
                            });
                            setShowAddModal(true);
                          }}
                          className="p-1 bg-zinc-950 border border-zinc-850 rounded hover:text-cyan-400 hover:border-cyan-900 transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit Component"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(item.id)}
                          className="p-1 bg-zinc-950 border border-zinc-850 rounded hover:text-rose-400 hover:border-rose-905 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Component"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-[10px] text-zinc-500 font-mono">Location: {item.location}</div>
                        <select
                          value={item.value_tier || 'MEDIUM'}
                          onChange={(e) => handleTierChange(item.id, e.target.value)}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider cursor-pointer appearance-none outline-none ${item.value_tier === 'LOW' ? 'text-green-400 bg-green-500/10' : item.value_tier === 'HIGH' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'}`}
                        >
                          <option value="LOW" className="bg-zinc-900 text-green-400">LOW (Auto)</option>
                          <option value="MEDIUM" className="bg-zinc-900 text-amber-400">MEDIUM (Admin)</option>
                          <option value="HIGH" className="bg-zinc-900 text-rose-400">HIGH (Admin + HOD)</option>
                        </select>
                      </div>
                      <p className="text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">{item.desc || 'No item specifications provided.'}</p>
                    </div>

                    <div className="flex justify-between items-end mt-4 pt-3 border-t border-zinc-800/40">
                      <div>
                        <div className="text-2xl font-black font-mono text-zinc-200">
                          {item.available}
                          <span className="text-[10px] font-normal text-zinc-500 font-sans ml-1">/ {item.total} Qty</span>
                        </div>
                        <div className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">Available Stock</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStock(item.id)}
                          className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 rounded text-[9px] font-mono font-bold tracking-wide uppercase text-zinc-300 transition-all cursor-pointer"
                        >
                          Adj. Qty
                        </button>
                        <button
                          onClick={() => toggleRepairStatus(item.id)}
                          className={`px-2.5 py-1 border rounded text-[9px] font-mono font-bold tracking-wide uppercase transition-all cursor-pointer ${item.status === 'Available'
                            ? 'bg-zinc-950 hover:bg-rose-950/20 border-zinc-850 hover:border-rose-900/60 hover:text-rose-400'
                            : 'bg-rose-950/15 border-rose-900/30 text-rose-400 hover:bg-zinc-950 hover:border-zinc-850 hover:text-zinc-300'
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
          {/* Lab Notices Component */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h3 className="font-bold text-lg text-white mb-4">Lab Notices & Announcements</h3>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input
                type="text"
                placeholder="E.g. Lab is closed today, Collection time 2PM-4PM"
                value={newNoticeMsg}
                onChange={e => setNewNoticeMsg(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <select value={newNoticeType} onChange={e => setNewNoticeType(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="alert">Alert</option>
              </select>
              <button onClick={handlePostNotice} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-sm transition shrink-0">
                Publish Notice
              </button>
            </div>

            <div className="space-y-3">
              {notices.length === 0 ? (
                <p className="text-zinc-500 text-sm">No active notices.</p>
              ) : (
                notices.map(notice => (
                  <div key={notice.id} className={`flex justify-between items-center p-3 rounded-lg border ${notice.type === 'alert' ? 'bg-red-500/10 border-red-500/20 text-red-400' : notice.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    <span className="text-sm font-medium">{notice.message}</span>
                    <button onClick={() => handleDeleteNotice(notice.id)} className="text-xs hover:underline opacity-80 hover:opacity-100 shrink-0 ml-4">Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">Monthly Updates Analytics</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Historical activity performance and transaction summaries.</p>
              </div>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200 h-fit">
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
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
              >
                <option value="2026-06">June 2026 (Current)</option>
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
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-purple-500/5 blur-xl pointer-events-none"></div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Workspace Access Permits</p>
              <h2 className="text-4xl font-extrabold mt-3 text-white tracking-tight">{analyticsStats.curr.labs}</h2>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded ${parseInt(labsChangeStr) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {labsChangeStr}
                </span>
                <span className="text-zinc-500">vs previous month ({analyticsStats.prev.labs})</span>
              </div>
            </div>
          </div>

          {/* Graph and Feed Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Graph Component */}
            <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-lg text-white">Daily Updates Traffic</h3>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Activity graph for {selectedMonthLabel}</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-zinc-300">Total Updates</span>
                  </div>
                </div>
              </div>

              {/* SVG interactive graph */}
              <div className="relative w-full h-[250px] bg-zinc-950/45 rounded-xl border border-zinc-850 p-4">
                <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="gradient-updates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 1, 2, 3, 4].map(idx => {
                    const val = Math.round((analyticsYMax / 4) * idx);
                    const y = 180 - (idx / 4) * 140;
                    return (
                      <g key={idx}>
                        {idx > 0 && (
                          <line x1="45" y1={y} x2="575" y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
                        )}
                        <text x="35" y={y + 4} textAnchor="end" className="text-[10px] font-mono fill-zinc-500">{val}</text>
                      </g>
                    );
                  })}

                  {/* X-axis indicators */}
                  <line x1="45" y1="180" x2="575" y2="180" stroke="rgba(255, 255, 255, 0.1)" strokeWidth={1} />
                  <text x="45" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day 1</text>
                  <text x="310" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day 15</text>
                  <text x="575" y="198" textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">Day {analyticsChartData.length}</text>

                  {/* Chart path & area */}
                  {analyticsChartData.length > 0 && (
                    <>
                      <path d={updatesAreaPath} fill="url(#gradient-updates)" />
                      <path d={updatesLinePath} fill="none" stroke="#22d3ee" strokeWidth={2.5} strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(6,182,212,0.3)]" />
                    </>
                  )}

                  {/* Highlight dots on hover */}
                  {analyticsChartData.map((d, idx) => {
                    if (hoveredAnalyticsIdx !== idx) return null;
                    const x = 45 + idx * (530 / (analyticsChartData.length - 1));
                    const y = 180 - (d.total / analyticsYMax) * 140;
                    return (
                      <g key={idx}>
                        <line x1={x} y1="40" x2={x} y2="180" stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="2,2" />
                        <circle cx={x} cy={y} r={6} fill="#22d3ee" stroke="#09090b" strokeWidth={2} />
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
                    className="absolute bg-zinc-950/95 border border-zinc-800 rounded-xl p-3 shadow-xl backdrop-blur-md pointer-events-none transition-all duration-150 z-20 text-xs flex flex-col gap-1"
                    style={{
                      left: `${Math.min(Math.max(45 + hoveredAnalyticsIdx * (530 / (analyticsChartData.length - 1)) - 60, 10), 460) / 600 * 100}%`,
                      top: '10px'
                    }}
                  >
                    <div className="font-bold text-zinc-300 border-b border-zinc-850 pb-1 mb-1">
                      Day {analyticsChartData[hoveredAnalyticsIdx].day} - {selectedMonthLabel}
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-zinc-500">Reservations:</span>
                      <span className="font-mono text-fuchsia-400 font-bold">{analyticsChartData[hoveredAnalyticsIdx].reservations}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-zinc-500">Lab Passes:</span>
                      <span className="font-mono text-purple-400 font-bold">{analyticsChartData[hoveredAnalyticsIdx].labAccess}</span>
                    </div>
                    <div className="flex justify-between gap-6 border-t border-zinc-900 pt-1 font-bold">
                      <span className="text-zinc-300">Total Updates:</span>
                      <span className="font-mono text-cyan-400">{analyticsChartData[hoveredAnalyticsIdx].total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 flex flex-col h-[354px]">
              <div className="mb-4">
                <h3 className="font-bold text-lg text-white">Recent Activity</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Latest updates in {selectedMonthLabel}</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {analyticsRecentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 border border-zinc-850 border-dashed rounded-xl">
                    <svg className="w-8 h-8 text-zinc-650 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-zinc-500 text-xs">No updates tracked in this month.</span>
                  </div>
                ) : (
                  analyticsRecentActivity.map((activity, idx) => (
                    <div key={idx} className="bg-zinc-950/40 border border-zinc-850 p-3 rounded-xl flex flex-col gap-1.5 hover:border-zinc-805 transition">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-white text-xs leading-tight">{activity.title}</span>
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border uppercase shrink-0 ${activity.status.includes('Approved') || activity.status === 'Ready for Collection' || activity.status === 'APPROVED' || activity.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : activity.status.includes('Reject') || activity.status.includes('DENIED')
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-750'
                          }`}>
                          {activity.status === 'Approved by HOD' ? 'Approved' : activity.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-950 border border-zinc-800 p-6 md:p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">

            {/* Corner decors */}
            <div className="absolute top-3 left-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute top-3 right-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 left-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 right-3 text-zinc-700 font-mono text-[9px] select-none">+</div>

            <div className="flex justify-between items-center border-b border-zinc-900 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-1 uppercase font-mono">{editingDeviceId ? 'EDIT COMPONENT' : 'REGISTER NEW HARDWARE'}</h3>
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">{editingDeviceId ? 'Save updates to this device' : 'Add to inventory catalog'}</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">Component Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Logic Analyzer 16-Ch"
                    value={newDevice.name}
                    onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                    disabled={!!editingDeviceId}
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors ${editingDeviceId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      readOnly
                      value={adminDept || 'EDL'}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-400 font-mono focus:outline-none cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">Stock Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newDevice.total}
                      onChange={e => setNewDevice({ ...newDevice, total: parseInt(e.target.value) || 1 })}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">Lab Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IoT Lab room 304"
                      value={newDevice.location}
                      onChange={e => setNewDevice({ ...newDevice, location: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider text-emerald-400">Value Tier (Approval)</label>
                    <select
                      value={newDevice.valueTier}
                      onChange={e => setNewDevice({ ...newDevice, valueTier: e.target.value })}
                      className="w-full bg-zinc-950 border border-emerald-500/30 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono appearance-none"
                    >
                      <option value="LOW">LOW (Auto-Approve)</option>
                      <option value="MEDIUM">MEDIUM (Admin)</option>
                      <option value="HIGH">HIGH (Admin + HOD)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">Specifications (Description)</label>
                  <textarea
                    placeholder="e.g. 100MHz bandwidth, 1 GSa/s sample rate..."
                    value={newDevice.desc}
                    onChange={e => setNewDevice({ ...newDevice, desc: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all leading-relaxed"
                    rows={3}
                  />
                </div>
              </div>

              {/* Right Form Image Selector */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-2.5 uppercase tracking-wider">Configure Component Image</label>

                  <div className="animate-in fade-in duration-200">
                    <label className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/60 bg-zinc-950/60 rounded-xl h-52 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group hover:shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                      <svg className="w-12 h-12 text-zinc-500 group-hover:text-cyan-400 transition-colors mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-mono text-zinc-300 group-hover:text-white font-semibold">Select Local Image File</span>
                      <span className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">PNG, JPG, JPEG</span>
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
                <div className="border border-zinc-850 rounded-xl p-3 bg-zinc-950/40 flex items-center gap-4">
                  <div className="w-24 h-16 rounded-lg bg-zinc-950 border border-zinc-850 overflow-hidden shrink-0 shadow-inner">
                    {newDevice.photoUrl ? (
                      <img src={newDevice.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700 font-mono">NO IMAGE</div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">SELECTED PREVIEW</div>
                    <div className="text-xs font-mono font-semibold text-cyan-400 uppercase truncate mt-0.5">
                      {newDevice.photoUrl ? '✓ CUSTOM CROPPED FILE' : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className={`w-full py-3.5 px-4 bg-zinc-50 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs font-mono tracking-widest uppercase transition-all duration-300 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-[0.98] cursor-pointer'} mt-2`}
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
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">{adminDept} Section Tracking</h2>
              {scannedUsnFilter && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-in fade-in duration-200">
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
              <input
                type="text"
                placeholder="Search Student Name or USN..."
                value={sectionSearchQuery}
                onChange={e => setSectionSearchQuery(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500 w-64"
              />
              <button
                onClick={() => setShowSectionFilters(!showSectionFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${showSectionFilters ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
              </button>
            </div>
          </div>

          {showSectionFilters && (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 mb-6 flex flex-wrap gap-6 items-end animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase tracking-wider">Department</label>
                <select value={studentDeptFilter} onChange={e => setStudentDeptFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500 w-32">
                  <option value="CSE">CSE</option>
                  <option value="MECH">Mechanical</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="CIVIL">CIVIL</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase tracking-wider">Section</label>
                <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500 w-32">
                  {Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                    <option key={char} value={char}>Section {char}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase tracking-wider">Date Range</label>
                <div className="flex gap-2 items-center text-zinc-500 text-sm">
                  <input
                    type="date"
                    value={sectionStartDate}
                    onChange={e => setSectionStartDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-cyan-500"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={sectionEndDate}
                    onChange={e => setSectionEndDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 mb-4 border-b border-zinc-800 pb-2">
            <button
              onClick={() => setSectionTrackingTab('CURRENT')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${sectionTrackingTab === 'CURRENT' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Current Tracking
            </button>
            <button
              onClick={() => setSectionTrackingTab('COMPLETED')}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${sectionTrackingTab === 'COMPLETED' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Completed Tracking
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 w-1/4">Student Info</th>
                  <th className="px-6 py-4">Requested Components</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(() => {
                  const currentStatuses = ['PENDING', 'APPROVED', 'Pending HOD', 'Ready for Collection', 'Active', 'BORROWED', 'PENDING_RETURN', 'PENDING_COLLECTION'];
                  const groupedRequests = requests
                    .filter(req => req.department === adminDept && req.studentDepartment === studentDeptFilter && req.section === sectionFilter && (!scannedUsnFilter || req.usn === scannedUsnFilter))
                    .filter(req => sectionTrackingTab === 'CURRENT' ? currentStatuses.includes(req.status) : !currentStatuses.includes(req.status))
                    .filter(req => {
                      if (!sectionStartDate && !sectionEndDate) return true;
                      const reqDate = new Date(req.requestDate).getTime();
                      const start = sectionStartDate ? new Date(sectionStartDate).getTime() : 0;
                      // Include the whole end date by adding 1 day (86400000 ms) or just check up to end of that day.
                      // Or since req.requestDate is just YYYY-MM-DD, a direct timestamp comparison works if end is parsed.
                      const end = sectionEndDate ? new Date(sectionEndDate).getTime() : Infinity;
                      return reqDate >= start && reqDate <= end;
                    })
                    .filter(req => {
                      if (!sectionSearchQuery.trim()) return true;
                      const query = sectionSearchQuery.toLowerCase();
                      return req.studentName.toLowerCase().includes(query) || req.usn.toLowerCase().includes(query);
                    })
                    .reduce((acc, req) => {
                      const key = `${req.usn}_${req.requestDate}`;
                      if (!acc[key]) {
                        acc[key] = {
                          groupId: key,
                          studentName: req.studentName,
                          usn: req.usn,
                          requestDate: req.requestDate,
                          items: []
                        };
                      }
                      acc[key].items.push(req);
                      return acc;
                    }, {} as Record<string, { groupId: string, studentName: string, usn: string, requestDate: string, items: RequestItem[] }>);

                  const groupedRequestsArray = Object.values(groupedRequests);

                  if (groupedRequestsArray.length === 0) {
                    return (
                      <tr>
                        <td colSpan={2} className="px-6 py-8 text-center text-zinc-500">No requests found for this section.</td>
                      </tr>
                    );
                  }

                  return groupedRequestsArray.map(group => (
                    <tr key={group.groupId} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 align-top border-r border-zinc-800/50">
                        <div className="font-medium text-white text-base">{group.studentName}</div>
                        <div className="text-zinc-500 font-mono text-xs mt-1">{group.usn}</div>
                        <div className="text-zinc-500 text-xs mt-3 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Requested: {group.requestDate}
                        </div>
                        <div className="text-cyan-400 text-xs mt-2 font-bold uppercase tracking-widest">
                          {group.items.length} Item{group.items.length > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-3">
                          {group.items.map(req => {
                            const isUnreturned = req.status !== 'Returned' && req.status !== 'RETURNED';
                            return (
                              <div key={req.id} className={`flex flex-col gap-2.5 bg-zinc-950/50 p-3.5 rounded-xl border ${isUnreturned ? 'border-rose-900/50' : 'border-zinc-800/80'} transition-colors`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-bold text-blue-400 text-sm flex items-center gap-2">
                                      {req.component}
                                      <span className="text-zinc-600 font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded">#{req.id}</span>
                                    </div>
                                    {!isUnreturned && req.returnedAt && (
                                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 mt-2">
                                        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Returned at: {new Date(req.returnedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-5 ml-4">
                                    {isUnreturned ? (
                                      <span className="px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[10px] font-black uppercase tracking-widest flex items-center w-fit gap-1.5 shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                        Unreturned ({req.status === 'PENDING_COLLECTION' ? 'PENDING CHECKOUT' : req.status})
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-black uppercase tracking-widest shrink-0">
                                        Returned
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowScannerModal(false)}>
          <div
            className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col items-center text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowScannerModal(false)}
              className="absolute top-3 right-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-colors z-20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="mb-6 w-full">
              <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Scan Digital Pass
              </h3>
              <p className="text-zinc-400 text-xs font-mono">Position the student's QR code in the frame</p>
            </div>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/30 relative">
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

      {/* Geotag Image Preview Modal */}
      {previewModalOpen && previewImgUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => { setPreviewModalOpen(false); setPreviewImgUrl(null); }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl max-w-xl w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center text-center relative"
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
            
            <div className="mb-4 text-left w-full border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Geotagged Collection Proof</h3>
              <p className="text-zinc-500 text-xs font-mono mt-0.5">VERIFIED VIA STUDENT GPS PORTAL</p>
            </div>

            <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center relative">
              <img src={previewImgUrl} alt="Collection Proof" className="max-w-full max-h-full object-contain" />
            </div>

            {previewLatitude && previewLongitude && (
              <div className="mt-4 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2 text-xs font-mono text-zinc-400 w-full text-center">
                LATITUDE: {previewLatitude.toFixed(6)} • LONGITUDE: {previewLongitude.toFixed(6)}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
