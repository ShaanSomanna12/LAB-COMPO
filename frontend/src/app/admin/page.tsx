'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
}

interface InventoryItem {
  id: number;
  name: string;
  available: number;
  total: number;
  department: string;
  status: 'Available' | 'Under Repair';
  desc: string;
  location: string;
}

const defaultInventory: InventoryItem[] = [
  { id: 1, name: 'Raspberry Pi 4 Model B', available: 4, total: 5, desc: 'High-performance single-board computer. Used for heavy processing and ML nodes.', department: 'CSE', location: 'Lab 201', status: 'Available' },
  { id: 2, name: 'Arduino Mega 2560', available: 0, total: 2, desc: 'Advanced microcontroller board based on the ATmega2560. Ideal for complex robotics projects.', department: 'MECH', location: 'Mechatronics Lab', status: 'Available' },
  { id: 3, name: 'NVIDIA Jetson Nano', available: 2, total: 2, desc: 'Small, powerful computer for embedded applications and AI neural networks.', department: 'CSE', location: 'AI Lab 404', status: 'Available' },
  { id: 4, name: 'Fluke 117 Multimeter', available: 12, total: 15, desc: 'True-RMS digital multimeter with integrated non-contact voltage detection.', department: 'EEE', location: 'Circuits Lab', status: 'Available' },
  { id: 5, name: 'RIGOL DS1054Z Oscilloscope', available: 3, total: 4, desc: '50 MHz Digital Oscilloscope with 4 channels. Crucial for signal analysis.', department: 'ECE', location: 'Signals Lab', status: 'Available' },
  { id: 6, name: 'ESP32 Wi-Fi/BT Module', available: 18, total: 20, desc: 'Low-cost, low-power system on a chip with integrated Wi-Fi and dual-mode Bluetooth.', department: 'CSE', location: 'IoT Lab', status: 'Available' },
  { id: 7, name: 'Hakko FX-888D Soldering Station', available: 6, total: 6, desc: 'Digital precision soldering iron with adjustable thermal recovery and heating speeds.', department: 'EEE', location: 'Fabrication Room', status: 'Under Repair' },
  { id: 8, name: 'Lidar Sensor (RPLIDAR A1)', available: 1, total: 2, desc: '360-degree 2D laser scanner (LIDAR) solution for ROS mapping and SLAM algorithms.', department: 'MECH', location: 'Autonomous Systems Lab', status: 'Available' }
];

const mockRequests: RequestItem[] = [
  { id: 'REQ-001', studentName: 'Rahul Kumar', usn: '4VV25CS045', component: 'Raspberry Pi 4 Model B', department: 'CSE', duration: 7, requestDate: '2026-04-18', status: 'Pending HOD' },
  { id: 'REQ-002', studentName: 'Aditi Sharma', usn: '4VV25EC012', component: 'RIGOL DS1054Z Oscilloscope', department: 'ECE', duration: 3, requestDate: '2026-04-18', status: 'Ready for Collection' },
  { id: 'REQ-003', studentName: 'Shaan Somanna', usn: '4VV25CS001', component: 'Arduino Mega 2560', department: 'MECH', duration: 14, requestDate: '2026-04-15', status: 'Active' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'requests' | 'inventory'>('requests');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [collegeName, setCollegeName] = useState('PHOENIX INSTITUTE');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', department: 'CSE', total: 1, desc: '' });
  const [adminDept, setAdminDept] = useState<string | null>(null);

  const DEPT_INFO = [
    { id: 'CSE', title: 'Computer Science', desc: 'Manage CSE requests & stock.', color: 'from-blue-600 to-indigo-600' },
    { id: 'ECE', title: 'Electronics & Comm.', desc: 'Manage ECE requests & stock.', color: 'from-purple-600 to-pink-600' },
    { id: 'EEE', title: 'Electrical Engineering', desc: 'Manage EEE requests & stock.', color: 'from-amber-500 to-orange-600' },
    { id: 'MECH', title: 'Mechanical Engineering', desc: 'Manage MECH requests & stock.', color: 'from-emerald-600 to-teal-600' }
  ];

  useEffect(() => {
    const storedCollege = localStorage.getItem('collegeName');
    if (storedCollege) setCollegeName(storedCollege.toUpperCase());
    
    // Fetch unified data from API
    fetch('/api/inventory').then(res => res.json()).then(data => setInventory(data));
    fetch('/api/requests').then(res => res.json()).then(data => setRequests(data));
  }, []);

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
    await updateRequestStatus(id, 'Returned');
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const toggleRepairStatus = (id: number) => {
    setInventory(inv => inv.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: item.status === 'Available' ? 'Under Repair' : 'Available',
          available: item.status === 'Available' ? Math.max(0, item.available - 1) : item.available + 1
        };
      }
      return item;
    }));
  };

  const handleUpdateStock = (id: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newTotalStr = window.prompt("Enter new total stock count for " + item.name + ":", item.total.toString());
    if (newTotalStr === null) return;
    
    const newTotal = parseInt(newTotalStr, 10);
    if (isNaN(newTotal) || newTotal < 0) {
      alert("Please enter a valid positive number.");
      return;
    }
    
    const diff = newTotal - item.total;
    const newAvailable = Math.max(0, item.available + diff);

    setInventory(inv => inv.map(i => i.id === id ? { ...i, total: newTotal, available: newAvailable } : i));
  };

  const handleAddDevice = async () => {
    if (!newDevice.name.trim()) return;
    
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDevice)
    });
    const data = await res.json();
    
    if (data.success) {
      setInventory([...inventory, data.item]);
      setShowAddModal(false);
      setNewDevice({ name: '', department: 'CSE', total: 1, desc: '' });
    }
  };

  const handleDeleteDevice = async (id: number) => {
    if (window.confirm('Are you sure you want to completely remove this component from the inventory? This cannot be undone.')) {
      await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
      setInventory(inv => inv.filter(item => item.id !== id));
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
                onClick={() => setActiveTab('inventory')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
              >
                Inventory Management
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
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        req.status === 'Pending HOD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
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

      {adminDept && activeTab === 'inventory' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Lab Hardware Inventory</h2>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-200 transition">
              + Add New Device
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventory.filter(item => item.department === adminDept).map(item => (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition relative group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg max-w-[70%]">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-1 bg-zinc-800 text-zinc-400 rounded uppercase">{item.department}</span>
                    <button 
                      onClick={() => handleDeleteDevice(item.id)} 
                      className="text-zinc-600 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      title="Remove Component"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-6">
                  <div>
                    <div className="text-3xl font-black mb-1 flex items-baseline gap-2">
                       {item.available} <span className="text-sm font-medium text-zinc-500">/ {item.total}</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Available</div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {item.status === 'Under Repair' && (
                       <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Under Repair
                       </span>
                    )}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUpdateStock(item.id)}
                        className="text-xs px-3 py-1.5 rounded font-semibold transition bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30"
                      >
                        Update Stock
                      </button>
                      <button 
                        onClick={() => toggleRepairStatus(item.id)}
                        className={`text-xs px-3 py-1.5 rounded font-semibold transition ${item.status === 'Available' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600/30'}`}
                      >
                        {item.status === 'Available' ? 'Mark as Broken' : 'Mark Fixed'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition">✕</button>
            <h2 className="text-2xl font-bold mb-6">Add Inventory</h2>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Component Name</label>
                <input type="text" value={newDevice.name} onChange={e => setNewDevice({...newDevice, name: e.target.value})} placeholder="e.g. Logic Analyzer" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
              </div>
              <input type="hidden" value={adminDept || 'CSE'} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Department</label>
                <select value={newDevice.department} onChange={e => setNewDevice({...newDevice, department: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none" disabled>
                  <option value={adminDept || 'CSE'}>{adminDept || 'CSE'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Total Quantity</label>
                <input type="number" min="1" value={newDevice.total} onChange={e => setNewDevice({...newDevice, total: parseInt(e.target.value) || 1})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Description (Optional)</label>
                <textarea 
                  value={newDevice.desc} 
                  onChange={e => setNewDevice({...newDevice, desc: e.target.value})} 
                  placeholder="e.g. Important specifications" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <button 
              onClick={handleAddDevice} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Add to Catalog
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
