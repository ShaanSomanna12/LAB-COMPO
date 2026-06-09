'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageCropper from './ImageCropper';

// Curated high-fidelity hardware component image presets from Unsplash
const IMAGE_PRESETS = [
  {
    name: 'Microcontrollers / Arduino',
    url: 'https://images.unsplash.com/photo-1608564697071-ddf911d81370?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'AI Computing / GPU',
    url: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Single Board Computers / Pi',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Oscilloscopes / Test Gear',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Lidar / Robotics Sensors',
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Multimeters / Tools',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop',
  }
];

type RequestStatus = 'Pending HOD' | 'Ready for Collection' | 'Active' | 'Returned';

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
  const [collegeName, setCollegeName] = useState('PHOENIX INSTITUTE');
  const [showAddModal, setShowAddModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [imageTab, setImageTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState('2026-06');
  const [hoveredAnalyticsIdx, setHoveredAnalyticsIdx] = useState<number | null>(null);
  const [newDevice, setNewDevice] = useState({
    name: '',
    department: 'EDL',
    total: 1,
    desc: '',
    location: 'Main Lab',
    photoUrl: IMAGE_PRESETS[0].url
  });
  const [adminDept, setAdminDept] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('A');
  const [studentDeptFilter, setStudentDeptFilter] = useState<string>('CSE');

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
    { id: 'EDL', title: 'Engineering Dev. Lab', desc: 'Manage EDL requests & stock.', color: 'from-blue-600 to-indigo-600' },
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

    // Fetch unified data from API
    fetch('/api/inventory').then(res => res.json()).then(data => setInventory(data));
    fetch('/api/requests').then(res => res.json()).then(data => setRequests(data));
    fetchLabRequests();
  }, []);

  const getMonthlyStats = (monthStr: string) => {
    const targetYear = parseInt(monthStr.split('-')[0], 10);
    const targetMonth = parseInt(monthStr.split('-')[1], 10) - 1;

    const monthReqs = requests.filter(r => {
      if (!r.requestDate) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthLabReqs = labRequests.filter(r => {
      if (!r.accessDate) return false;
      const d = new Date(r.accessDate);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const prevMonthReqs = requests.filter(r => {
      if (!r.requestDate) return false;
      const d = new Date(r.requestDate);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    });

    const prevMonthLabReqs = labRequests.filter(r => {
      if (!r.accessDate) return false;
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

      const reqsCount = requests.filter(r => r.requestDate === datePrefix).length;
      const labsCount = labRequests.filter(r => r.accessDate === datePrefix).length;

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
      if (!r.requestDate) return;
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
      if (!l.accessDate) return;
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

  const updateRequestStatus = async (id: string, status: string) => {
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
  };

  const handleApprove = async (id: string) => {
    await updateRequestStatus(id, 'Ready for Collection');
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: 'Ready for Collection' } : r));
  };

  const handleReject = async (id: string) => {
    await updateRequestStatus(id, 'Rejected');
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const handleCheckout = async (id: string) => {
    await updateRequestStatus(id, 'Active');
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: 'Active' } : r));
  };

  const handleReturn = async (id: string) => {
    const req = requests.find(r => r.id === id);
    if (req) {
      const penaltyInfo = calculatePenalty(req.requestDate, req.duration, req.component);
      if (penaltyInfo.isDelayed) {
        alert(`Component returned successfully!\nOutstanding Penalty to Settle: ₹${penaltyInfo.penalty} (${penaltyInfo.weeksDelayed} week(s) late, computed at 5% of ₹${penaltyInfo.itemPrice} per week).`);
      } else {
        alert('Component returned successfully with zero penalty.');
      }
    }
    await updateRequestStatus(id, 'Returned');
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const toggleRepairStatus = async (id: string | number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newStatus = item.status === 'Available' ? 'Under Repair' : 'Available';
    const newAvailable = newStatus === 'Under Repair' ? Math.max(0, item.available - 1) : Math.min(item.total, item.available + 1);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          status: newStatus,
          available: newAvailable,
          photoUrl: item.photo_url || ''
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          total: newTotal,
          available: newTotal,
          photoUrl: item.photo_url || ''
        })
      });

      if (res.ok) {
        setInventory(prev => prev.map(i => i.id === id ? { ...i, total: newTotal, available: newTotal } : i));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDevice.name.trim()) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          department: adminDept || 'EDL'
        })
      });
      const data = await res.json();

      if (data.success) {
        setInventory(prev => [...prev, data.item]);
        setShowAddModal(false);
        setNewDevice({
          name: '',
          department: adminDept || 'EDL',
          total: 1,
          desc: '',
          location: 'Main Lab',
          photoUrl: IMAGE_PRESETS[0].url
        });
      }
    } catch (err) {
      alert('Error adding component');
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
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">LAB ADMIN PORTAL</h1>
          <p className="text-zinc-400 mt-1">
            {adminDept ? `Managing ${adminDept} Department.` : collegeName}
          </p>
        </div>
        <div className="flex gap-4">
          {adminDept && (
            <button onClick={() => setAdminDept(null)} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm transition-colors font-medium">
              ← Back to Departments
            </button>
          )}
          {adminDept && (
            <>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'requests' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Requests Workflow
              </button>
              <button
                onClick={() => setActiveTab('lab-access')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'lab-access' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Lab Workspace Access
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Inventory Management
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Monthly Updates
              </button>
              <button
                onClick={() => setActiveTab('section-tracking')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'section-tracking' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Section Tracking
              </button>
            </>
          )}
          <button onClick={() => router.push('/')} className="px-5 py-2 bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600/20 rounded-lg text-sm transition-colors font-medium ml-4">
            Logout
          </button>
        </div>
      </header>

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
              <div className={`w-full bg-zinc-900 rounded-2xl p-6 hover:bg-gradient-to-r ${dept.color} transition-all duration-300 flex items-center gap-8 border border-zinc-800 hover:border-transparent opacity-90 hover:opacity-100`}>
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
          <h2 className="text-2xl font-bold mb-4">{adminDept} Pending & Active Requests</h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Request ID</th>
                  <th className="px-6 py-4">Student Info</th>
                  <th className="px-6 py-4">Component</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {requests.filter(r => r.department === adminDept).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No active requests found.</td>
                  </tr>
                )}
                {requests.filter(req => req.department === adminDept).map(req => (
                  <tr key={req.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-300">{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{req.studentName}</div>
                      <div className="text-zinc-500 text-xs">{req.usn}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-blue-400">{req.component}</div>
                      <div className="text-zinc-500 text-xs">Duration: {req.duration} Days</div>
                      {(() => {
                        const penaltyInfo = calculatePenalty(req.requestDate, req.duration, req.component);
                        if (req.status === 'Active' && penaltyInfo.isDelayed) {
                          return (
                            <div className="text-red-400 text-[10px] font-semibold mt-1.5 flex items-center gap-1 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse animate-duration-1000"></span>
                              <span>Late by {penaltyInfo.delayDays} days • Penalty: ₹{penaltyInfo.penalty} ({penaltyInfo.weeksDelayed}w @ 5%)</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${req.status === 'Pending HOD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        req.status === 'Ready for Collection' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {req.status === 'Pending HOD' && (
                        <>
                          <button onClick={() => handleApprove(req.id)} className="px-3 py-1.5 bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-500/30 rounded text-xs font-semibold transition">Approve</button>
                          <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 bg-red-600/20 text-red-500 hover:bg-red-600/30 border border-red-500/30 rounded text-xs font-semibold transition">Reject</button>
                        </>
                      )}
                      {req.status === 'Ready for Collection' && (
                        <button onClick={() => handleCheckout(req.id)} className="px-4 py-1.5 bg-cyan-600 text-white hover:bg-cyan-500 rounded text-xs font-bold transition shadow-lg shadow-cyan-500/20">Check Out</button>
                      )}
                      {req.status === 'Active' && (
                        <button onClick={() => handleReturn(req.id)} className="px-4 py-1.5 bg-zinc-700 text-white hover:bg-zinc-600 rounded text-xs font-bold transition">Mark Returned</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminDept && activeTab === 'lab-access' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{adminDept} Lab Workspace Access Requests</h2>
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

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
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
                {labRequests.filter(r => r.department === adminDept).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No lab access requests found.</td>
                  </tr>
                )}
                {labRequests.filter(req => req.department === adminDept).map(req => {
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
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ UNIQUE_ITEMS ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-zinc-200">{inventory.filter(item => item.department === adminDept).length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ TOTAL_STOCK ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-zinc-200">{inventory.filter(item => item.department === adminDept).reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">[ ACTIVE_LOANS ]</div>
              <div className="text-2xl font-black mt-2 font-mono text-indigo-400">
                {Math.max(0, inventory.filter(item => item.department === adminDept).reduce((acc, curr) => acc + (Number(curr.total) || 0), 0) - inventory.filter(item => item.department === adminDept).reduce((acc, curr) => acc + (Number(curr.available) || 0), 0))}
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
                setNewDevice({
                  name: '',
                  department: adminDept,
                  total: 1,
                  desc: '',
                  location: 'Main Lab',
                  photoUrl: IMAGE_PRESETS[0].url
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
                          onClick={() => handleDeleteDevice(item.id)}
                          className="p-1 bg-zinc-950 border border-zinc-850 rounded hover:text-rose-400 hover:border-rose-905 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Location: {item.location}</div>
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
                          Adjust Qty
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
          {/* Controls */}
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div>
              <h3 className="font-bold text-lg text-white">Monthly Updates Analytics</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Historical activity performance and transaction summaries.</p>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-6 md:p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">

            {/* Corner decors */}
            <div className="absolute top-3 left-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute top-3 right-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 left-3 text-zinc-700 font-mono text-[9px] select-none">+</div>
            <div className="absolute bottom-3 right-3 text-zinc-700 font-mono text-[9px] select-none">+</div>

            <div className="flex justify-between items-center border-b border-zinc-900 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white uppercase">[{adminDept}_Register_New_Hardware]</h2>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">Database Registration Node</p>
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
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
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

                  {/* Tabs header */}
                  <div className="flex bg-zinc-900/80 p-1 border border-zinc-800/80 rounded-xl mb-4 gap-1">
                    {(['upload', 'preset', 'url'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setImageTab(tab)}
                        className={`flex-1 py-2 text-center rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${imageTab === tab
                          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                          : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                      >
                        {tab === 'upload' ? 'Upload File' : tab === 'preset' ? 'Presets' : 'Image URL'}
                      </button>
                    ))}
                  </div>

                  {/* Tab Contents */}
                  {imageTab === 'upload' && (
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
                  )}

                  {imageTab === 'preset' && (
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 animate-in fade-in duration-200">
                      {IMAGE_PRESETS.map((preset, index) => (
                        <div
                          key={index}
                          onClick={() => setNewDevice({ ...newDevice, photoUrl: preset.url })}
                          className={`relative h-20 rounded-xl overflow-hidden border cursor-pointer group transition-all duration-300 ${newDevice.photoUrl === preset.url
                            ? 'border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40'
                            : 'border-zinc-950 opacity-65 hover:opacity-100 hover:border-zinc-800'
                            }`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end p-2">
                            <span className="text-[9px] font-mono font-bold text-zinc-200 truncate w-full group-hover:text-white transition-colors">{preset.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {imageTab === 'url' && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <input
                        type="text"
                        placeholder="https://example.com/image.jpg"
                        value={newDevice.photoUrl && !newDevice.photoUrl.startsWith('data:') ? newDevice.photoUrl : ''}
                        onChange={e => setNewDevice({ ...newDevice, photoUrl: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-850 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                      />
                      <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-wide">Enter a direct image link from the web.</p>
                    </div>
                  )}
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
                      {newDevice.photoUrl && newDevice.photoUrl.startsWith('data:') ? '✓ CUSTOM CROPPED FILE' : (IMAGE_PRESETS.find(p => p.url === newDevice.photoUrl)?.name || '✓ CUSTOM URL LINKED')}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-zinc-50 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs font-mono tracking-widest uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-[0.98] cursor-pointer mt-2"
                >
                  REGISTRATION REQUEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminDept && activeTab === 'section-tracking' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{adminDept} Section Tracking</h2>
            <div className="flex gap-4">
              <select value={studentDeptFilter} onChange={e => setStudentDeptFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500">
                <option value="CSE">CSE</option>
                <option value="MECH">Mechanical</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="CIVIL">CIVIL</option>
              </select>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500">
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Request ID</th>
                  <th className="px-6 py-4">Student Info</th>
                  <th className="px-6 py-4">Section</th>
                  <th className="px-6 py-4">Component</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {requests.filter(r => r.department === adminDept && r.studentDepartment === studentDeptFilter && r.section === sectionFilter).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No requests found for this section.</td>
                  </tr>
                )}
                {requests.filter(req => req.department === adminDept && req.studentDepartment === studentDeptFilter && req.section === sectionFilter).map(req => {
                  const isUnreturned = req.status !== 'Returned';
                  return (
                    <tr key={req.id} className={`hover:bg-zinc-800/30 transition-colors ${isUnreturned ? 'bg-rose-950/10' : ''}`}>
                      <td className="px-6 py-4 font-mono text-zinc-300">{req.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{req.studentName}</div>
                        <div className="text-zinc-500 font-mono text-xs mt-0.5">{req.usn}</div>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">{req.studentDepartment || 'CSE'} - {req.section || 'A'}</td>
                      <td className="px-6 py-4">
                        <div className="text-blue-400">{req.component}</div>
                      </td>
                      <td className="px-6 py-4">
                        {isUnreturned ? (
                          <span className="px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs font-bold flex items-center w-fit gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            Unreturned ({req.status})
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-bold">
                            Returned
                          </span>
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

    </div>
  );
}
