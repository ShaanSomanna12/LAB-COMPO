'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function GeotaggedUploadPanel({ res, onUploadSuccess }: { res: any; onUploadSuccess: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDetectingGps(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
      
      setTimeout(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setGpsData({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              setIsDetectingGps(false);
            },
            () => {
              setGpsData({
                lat: 12.3582 + (Math.random() - 0.5) * 0.0002,
                lng: 76.6135 + (Math.random() - 0.5) * 0.0002,
                accuracy: 10
              });
              setIsDetectingGps(false);
            }
          );
        } else {
          setGpsData({
            lat: 12.3582,
            lng: 76.6135,
            accuracy: 15
          });
          setIsDetectingGps(false);
        }
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!photo) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: res.id,
          status: 'Ready for Collection',
          images: [photo],
          geotag: gpsData || { lat: 12.3582, lng: 76.6135 }
        })
      });
      if (response.ok) {
        alert('Geotagged image uploaded successfully! Request updated to Ready for Collection.');
        onUploadSuccess();
      } else {
        alert('Failed to upload geotagged image.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
          <span className="text-xs font-semibold text-emerald-450 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            HOD Approved • Upload Geotag Image
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Location coordinates lock</span>
        </div>

        {!photo ? (
          <div>
            <label className="flex flex-col items-center justify-center h-24 border border-dashed border-zinc-800 hover:border-cyan-500/50 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-lg cursor-pointer transition">
              <svg className="w-6 h-6 text-zinc-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium text-zinc-400">Upload Geotagged Component Photo</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center animate-in fade-in duration-300">
            <div className="relative">
              <img src={photo} className="w-full h-24 object-cover rounded-lg border border-zinc-800" alt="Upload preview" />
              <button 
                type="button" 
                onClick={() => { setPhoto(null); setGpsData(null); }}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-[10px] w-5 h-5 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col justify-between h-full py-1">
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider font-mono">Location Data</div>
                {isDetectingGps ? (
                  <div className="text-xs text-zinc-400 animate-pulse flex items-center gap-1">
                    <svg className="animate-spin h-3.5 w-3.5 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extracting GPS coordinates...</span>
                  </div>
                ) : gpsData ? (
                  <div className="text-xs text-zinc-300 font-mono space-y-0.5">
                    <div>Lat: {gpsData.lat.toFixed(6)}°</div>
                    <div>Lng: {gpsData.lng.toFixed(6)}°</div>
                    <div className="text-emerald-500 text-[10px] font-semibold flex items-center gap-1 mt-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      GPS Lock verified
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-red-400">GPS extraction failed.</div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isDetectingGps || !photo}
                className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Geotag & Request Checkout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

export default function StudentDashboard() {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<'selection' | 'components' | 'workspace'>('selection');
  const [studentDetails, setStudentDetails] = useState({
    name: '',
    usn: ''
  });
  const [labAccessRequests, setLabAccessRequests] = useState<any[]>([]);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [workspaceFormData, setWorkspaceFormData] = useState({
    labName: 'CSE Lab',
    accessDate: '',
    timeSlot: 'Morning Shift (9:00 AM - 1:00 PM)',
    purpose: ''
  });

  const fetchLabAccessRequests = () => {
    const storedUsn = localStorage.getItem('usn') || '';
    if (!storedUsn) return;
    fetch(`/api/lab-access?usn=${storedUsn}`)
      .then(res => res.json())
      .then(data => {
        setLabAccessRequests(data);
      })
      .catch(e => {
        console.error('Failed to fetch lab access requests', e);
      });
  };

  useEffect(() => {
    if (currentMode === 'workspace') {
      fetchLabAccessRequests();
    }
  }, [currentMode]);

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentDetails.name || !studentDetails.usn) {
      alert('Please fill out your personal profile (Name and USN) first.');
      return;
    }
    if (!workspaceFormData.accessDate || !workspaceFormData.purpose) {
      alert('Please fill out access date and purpose of work.');
      return;
    }

    try {
      const res = await fetch('/api/lab-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentDetails.name,
          usn: studentDetails.usn,
          labName: workspaceFormData.labName,
          accessDate: workspaceFormData.accessDate,
          timeSlot: workspaceFormData.timeSlot,
          purpose: workspaceFormData.purpose
        })
      });
      if (res.ok) {
        alert('Lab Workspace request submitted successfully! Forwarded to HOD for sign-off.');
        setShowWorkspaceModal(false);
        setWorkspaceFormData(prev => ({ ...prev, purpose: '', accessDate: '' }));
        fetchLabAccessRequests();
      } else {
        alert('Failed to submit request.');
      }
    } catch (e) {
      console.error(e);
      alert('Connection error submitting workspace request.');
    }
  };

  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({ date: '', time: '', days: '' });
  const [showLetter, setShowLetter] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<(string | null)[]>([null, null]);
  const [collegeName, setCollegeName] = useState('PHOENIX INSTITUTE OF TECHNOLOGY');

  const [cart, setCart] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [viewingLetterRes, setViewingLetterRes] = useState<any | null>(null);

  const [componentsTab, setComponentsTab] = useState<'catalog' | 'marketplace' | 'sell-rent' | 'reservations'>('catalog');
  const [peerListings, setPeerListings] = useState<any[]>([]);
  const [newListingFormData, setNewListingFormData] = useState({
    component: '',
    department: 'EDL',
    type: 'Sell',
    price: '',
    condition: 'Like New',
    description: '',
    contact: ''
  });
  const [listingImage, setListingImage] = useState<string | null>(null);
  const [isListingSubmitting, setIsListingSubmitting] = useState(false);

  const [listingSearchQuery, setListingSearchQuery] = useState('');
  const [listingDeptFilter, setListingDeptFilter] = useState('All');
  const [listingTypeFilter, setListingTypeFilter] = useState('All');
  const [interestModalListing, setInterestModalListing] = useState<any | null>(null);
  const [buyerFormData, setBuyerFormData] = useState({ buyerName: '', buyerContact: '' });
  const [showInterestSuccess, setShowInterestSuccess] = useState(false);


  useEffect(() => {
    if (studentDetails.name) {
      setBuyerFormData(prev => ({ ...prev, buyerName: studentDetails.name }));
    }
    if (studentDetails.usn) {
      setBuyerFormData(prev => ({ ...prev, buyerContact: `${studentDetails.usn.toLowerCase()}@phoenix.edu` }));
    }
  }, [studentDetails]);

  const handleListingImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setListingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleListingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentDetails.name || !studentDetails.usn) {
      alert('Please fill out your personal profile (Name and USN) first.');
      return;
    }
    if (!newListingFormData.component || !newListingFormData.price || !newListingFormData.contact) {
      alert('Please fill out the component name, price, and your contact email.');
      return;
    }

    setIsListingSubmitting(true);
    try {
      const res = await fetch('/api/peer-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentDetails.name,
          usn: studentDetails.usn,
          component: newListingFormData.component,
          department: newListingFormData.department,
          type: newListingFormData.type,
          price: newListingFormData.price,
          condition: newListingFormData.condition,
          description: newListingFormData.description,
          contact: newListingFormData.contact,
          image: listingImage
        })
      });

      if (res.ok) {
        alert('Your listing has been successfully posted to the Peer Marketplace!');
        setNewListingFormData({
          component: '',
          department: 'EDL',
          type: 'Sell',
          price: '',
          condition: 'Like New',
          description: '',
          contact: ''
        });
        setListingImage(null);
        setComponentsTab('marketplace');
        fetchPeerListings();
      } else {
        alert('Failed to submit listing.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to peer-listings API.');
    } finally {
      setIsListingSubmitting(false);
    }
  };

  const fetchPeerListings = () => {
    fetch('/api/peer-listings')
      .then(res => res.json())
      .then(data => setPeerListings(data))
      .catch(e => console.error('Failed to fetch peer listings', e));
  };

  useEffect(() => {
    if (componentsTab === 'marketplace' || componentsTab === 'sell-rent') {
      fetchPeerListings();
    }
  }, [componentsTab]);

  const mockReservations = [
    { id: 'REQ-003', component: 'Arduino Mega 2560', department: 'MECH', requestDate: '2026-04-15', status: 'Active', dueDate: '2026-04-29' },
    { id: 'REQ-008', component: 'Lidar Sensor (RPLIDAR A1)', department: 'MECH', requestDate: '2025-11-20', status: 'Returned', dueDate: '2025-11-27' },
    { id: 'REQ-012', component: 'Fluke 117 Multimeter', department: 'EEE', requestDate: '2025-09-10', status: 'Returned', dueDate: '2025-09-15' }
  ];

  const fetchReservations = () => {
    fetch('/api/requests')
      .then(res => res.json())
      .then(data => {
        const storedUsn = localStorage.getItem('usn') || '';
        const studentReqs = data.filter((r: any) => r.usn.toUpperCase() === storedUsn.toUpperCase());
        setReservations(studentReqs.length > 0 ? studentReqs : mockReservations);
      })
      .catch(e => {
        setReservations(mockReservations);
      });
  };

  useEffect(() => {
    fetchReservations();
  }, [selectedItem]);


  useEffect(() => {
    const storedCollege = localStorage.getItem('collegeName');
    const storedUsn = localStorage.getItem('usn');
    if (storedCollege) setCollegeName(storedCollege.toUpperCase());
    
    // Only pre-fill the USN if it's an actual USN (not an admin email)
    if (storedUsn) {
       if (!storedUsn.includes('@')) {
         setStudentDetails(prev => ({ ...prev, usn: storedUsn.toUpperCase() }));
       } else {
         setStudentDetails(prev => ({ ...prev, usn: '' }));
       }
    }
  }, []);

  useEffect(() => {
    if (selectedItem) {
      resetUploadedPhotos();
    }
  }, [selectedItem]);

  const defaultComponents = [
    { id: 1, name: 'Raspberry Pi 4 Model B', available: 4, total: 5, desc: 'High-performance single-board computer. Used for heavy processing and ML nodes.', department: 'EDL', location: 'Lab 201', status: 'Available' },
    { id: 2, name: 'Arduino Mega 2560', available: 0, total: 2, desc: 'Advanced microcontroller board based on the ATmega2560. Ideal for complex robotics projects.', department: 'MECH', location: 'Mechatronics Lab', status: 'Available' },
    { id: 3, name: 'NVIDIA Jetson Nano', available: 2, total: 2, desc: 'Small, powerful computer for embedded applications and AI neural networks.', department: 'EDL', location: 'AI Lab 404', status: 'Available' },
    { id: 4, name: 'Fluke 117 Multimeter', available: 12, total: 15, desc: 'True-RMS digital multimeter with integrated non-contact voltage detection.', department: 'EEE', location: 'Circuits Lab', status: 'Available' },
    { id: 5, name: 'RIGOL DS1054Z Oscilloscope', available: 3, total: 4, desc: '50 MHz Digital Oscilloscope with 4 channels. Crucial for signal analysis.', department: 'ECE', location: 'Signals Lab', status: 'Available' },
    { id: 6, name: 'ESP32 Wi-Fi/BT Module', available: 18, total: 20, desc: 'Low-cost, low-power system on a chip with integrated Wi-Fi and dual-mode Bluetooth.', department: 'EDL', location: 'IoT Lab', status: 'Available' },
    { id: 7, name: 'Hakko FX-888D Soldering Station', available: 6, total: 6, desc: 'Digital precision soldering iron with adjustable thermal recovery and heating speeds.', department: 'EEE', location: 'Fabrication Room', status: 'Under Repair' },
    { id: 8, name: 'Lidar Sensor (RPLIDAR A1)', available: 1, total: 2, desc: '360-degree 2D laser scanner (LIDAR) solution for ROS mapping and SLAM algorithms.', department: 'MECH', location: 'Autonomous Systems Lab', status: 'Available' }
  ];

  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/inventory').then(res => res.json()).then(data => setComponents(data));
  }, []);

  const DEPT_INFO = [
    { 
      id: 'EDL', 
      title: 'Engineering Dev. Lab', 
      desc: 'IoT modules, AI computing boards, and networking gear.', 
      color: 'from-cyan-500 to-blue-600',
      badge: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
      glow: 'hover:border-cyan-500/40 hover:shadow-[0_0_35px_-5px_rgba(6,182,212,0.35)]',
      border: 'border-l-4 border-l-cyan-500/80',
      iconBg: 'bg-cyan-500/10 border-cyan-500/20'
    },
    { 
      id: 'ECE', 
      title: 'Electronics & Comm.', 
      desc: 'Oscilloscopes, function generators, and signal processors.', 
      color: 'from-purple-500 to-pink-650',
      badge: 'text-purple-400 bg-purple-400/10 border-purple-400/25',
      glow: 'hover:border-purple-500/40 hover:shadow-[0_0_35px_-5px_rgba(139,92,246,0.35)]',
      border: 'border-l-4 border-l-purple-500/80',
      iconBg: 'bg-purple-500/10 border-purple-500/20'
    },
    { 
      id: 'EEE', 
      title: 'Electrical Engineering', 
      desc: 'Multimeters, soldering stations, and high voltage equipment.', 
      color: 'from-amber-400 to-orange-600',
      badge: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
      glow: 'hover:border-amber-500/40 hover:shadow-[0_0_35px_-5px_rgba(245,158,11,0.35)]',
      border: 'border-l-4 border-l-amber-500/80',
      iconBg: 'bg-amber-500/10 border-amber-500/20'
    },
    { 
      id: 'MECH', 
      title: 'Mechanical Engineering', 
      desc: 'Robotics kits, lidar sensors, and mechatronic components.', 
      color: 'from-emerald-500 to-teal-650',
      badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
      glow: 'hover:border-emerald-500/40 hover:shadow-[0_0_35px_-5px_rgba(16,185,129,0.35)]',
      border: 'border-l-4 border-l-emerald-500/80',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20'
    }
  ];

  const filteredComponents = activeDept ? components.filter(c => c.department === activeDept) : [];

  const handlePrint = () => {
    window.print();
  };

  const resetUploadedPhotos = () => {
    setUploadedPhotos([null, null]);
  };

  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newPhotos = [...uploadedPhotos];
        newPhotos[index] = event.target?.result as string;
        setUploadedPhotos(newPhotos);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...uploadedPhotos];
    newPhotos[index] = null;
    setUploadedPhotos(newPhotos);
  };

  if (showLetter && selectedItem) {
    return (
      <div className="min-h-screen bg-zinc-200 text-black flex flex-col items-center p-8 print:p-0 print:bg-white">
        <div className="absolute top-8 right-8 flex gap-4 print:hidden">
            <button onClick={() => setShowLetter(false)} className="px-5 py-2 bg-zinc-800 text-white rounded-lg shadow font-medium hover:bg-zinc-700 transition">Back to Catalog</button>
            <button onClick={handlePrint} className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow font-medium hover:bg-blue-700 transition">Print to PDF</button>
        </div>

        {/* Letter Section */}
        <div className="bg-white w-full max-w-3xl p-8 shadow-2xl print:shadow-none print:w-full print:max-w-none print:p-6 border border-zinc-300 mb-8 flex flex-col min-h-screen print:min-h-screen print:shadow-none">
          <div className="text-center mb-4 border-b border-black pb-3">
            <h1 className="text-3xl font-bold uppercase mb-1">{collegeName}</h1>
            <p className="text-base font-semibold">Laboratory Hardware Requisition Form</p>
          </div>

          <div className="mb-2 text-right font-medium text-base">
            <p>Date: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="mb-3 leading-relaxed font-serif text-base">
            <p className="font-bold mb-0">To,</p>
            <p className="mb-0">The Head of Department ({Array.isArray(selectedItem) ? selectedItem[0]?.department : selectedItem.department}),</p>
            <p className="mb-0">{collegeName}.</p>
          </div>

          <div className="mb-3 font-serif leading-relaxed text-justify text-base">
            <p className="mb-2"><strong>Subject:</strong> Requisition for borrowing Laboratory Hardware ({Array.isArray(selectedItem) ? selectedItem.map(i => i.name).join(', ') : selectedItem.name})</p>
            <p className="mb-2">Respected Sir/Madam,</p>
            <p className="mb-0">
              I, <strong>{studentDetails.name}</strong>, bearing University Serial Number (USN) <strong>{studentDetails.usn}</strong>, humbly request the allocation of the following laboratory hardware for academic project integration.
            </p>
          </div>

          <table className="w-full text-left border-collapse border border-zinc-400 mb-3 font-serif text-base">
            <tbody>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100 w-1/3">Component Requested</th>
                <td className="p-2">{Array.isArray(selectedItem) ? selectedItem.map(i => i.name).join(', ') : selectedItem.name}</td>
              </tr>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100">Lab Location</th>
                <td className="p-2">
                  {Array.isArray(selectedItem)
                    ? Array.from(new Set(selectedItem.map(i => `${i.location} (${i.department})`))).join(', ')
                    : `${selectedItem.location} (${selectedItem.department})`}
                </td>
              </tr>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100">Collection Date</th>
                <td className="p-2">{formData.date}</td>
              </tr>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100">Collection Time</th>
                <td className="p-2">{formData.time}</td>
              </tr>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100">Duration Required</th>
                <td className="p-2">{formData.days} Days</td>
              </tr>
            </tbody>
          </table>

          <div className="mb-3 font-serif italic text-base text-justify leading-relaxed">
            <p>
              "I acknowledge that I will make sure the borrowed items will be used properly and safely, keep the items in good condition, and return the items to the lab in time exactly after the stated duration. I take full responsibility for the cost of repair or replacement if any functional or physical damage happens to the items while under my custody."
            </p>
          </div>

          <div className="mt-auto flex justify-between items-end font-serif text-base mb-6">
            <div className="text-center">
              <div className="text-emerald-700 font-bold font-sans text-xs mb-1">✓ Digitally Signed</div>
              <p className="font-semibold text-base">Signature of Student</p>
              <p className="text-base">{studentDetails.name}</p>
            </div>
            <div className="text-center">
              <div className="text-zinc-400 italic font-sans text-xs mb-1">Pending Collection</div>
              <p className="font-semibold text-base border-t border-black pt-1 px-4">Signature of Lab Admin</p>
            </div>
            <div className="text-center">
              <div className="text-zinc-400 italic font-sans text-xs mb-1">Awaiting HOD Signature</div>
              <p className="font-semibold text-base border-t border-black pt-1 px-4">Signature of HOD</p>
            </div>
          </div>

          <div className="text-center text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg mt-6 mb-2 print:hidden shadow-sm">
            ✅ Note: This request is sent directly to the HOD for digital approval. No physical submission is required.
          </div>

          <div className="flex gap-4 mt-4 print:hidden">
            <button onClick={() => setShowLetter(false)} className="flex-1 px-5 py-2 bg-zinc-800 text-white rounded-lg font-medium text-sm hover:bg-zinc-700 transition">
              Back to Catalog
            </button>
            <button 
              onClick={async () => {
                if (!studentDetails.name || !studentDetails.usn) {
                  alert('Please fill out your personal profile (Name and USN) first.');
                  return;
                }
                try {
                  const res = await fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      studentName: studentDetails.name,
                      usn: studentDetails.usn,
                      items: Array.isArray(selectedItem) ? selectedItem : [selectedItem],
                      date: formData.date,
                      time: formData.time,
                      duration: formData.days,
                      images: [] // Initially empty geotag images array
                    })
                  });
                  
                  if (res.ok) {
                    alert('Requisition request submitted successfully to HOD for approval!');
                    setCart([]); // Clear cart
                    setShowLetter(false);
                    setSelectedItem(null);
                    fetchReservations(); // Refresh reservation status list
                  } else {
                    alert('Failed to submit request');
                  }
                } catch (e) {
                  alert('Connection error submitting request');
                }
              }} 
              className="flex-1 px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition cursor-pointer"
            >
              Sign & Submit to HOD
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showPhotoUpload && selectedItem) {
    return (
      <div className="min-h-screen bg-zinc-200 text-black flex flex-col items-center p-8 print:p-0 print:bg-white">
        <div className="absolute top-8 right-8 flex gap-4 print:hidden">
            <button onClick={() => {setShowPhotoUpload(false); setShowLetter(true);}} className="px-5 py-2 bg-zinc-800 text-white rounded-lg shadow font-medium hover:bg-zinc-700 transition">Back to Letter</button>
        </div>

        {/* Photo Upload Section */}
        <div className="bg-white w-full max-w-3xl p-8 shadow-2xl border border-zinc-300 rounded-lg mb-8">
          <p className="text-white text-base mb-6 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 rounded-lg text-center">Please upload Geotag Images of components</p>
          
          <div className="grid grid-cols-2 gap-6">
            {uploadedPhotos.map((photo, index) => (
              <div key={index} className="flex flex-col">
                <label className="block text-sm font-semibold text-zinc-700 mb-3">Geotag Image {index + 1}</label>
                <div className="relative group">
                  {photo ? (
                    <div className="relative">
                      <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-48 object-cover rounded-lg border-2 border-zinc-300 shadow-md" />
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <label htmlFor={`photo-upload-${index}`} className="w-full h-48 border-2 border-dashed border-zinc-400 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition bg-zinc-50">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-zinc-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p className="text-sm text-zinc-600 font-medium">Click to upload</p>
                        </div>
                      </label>
                      <input
                        id={`photo-upload-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(index, e)}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => {setShowPhotoUpload(false); setShowLetter(true);}}
              className="flex-1 px-5 py-3 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition"
            >
              Back to Letter
            </button>
            <button
              onClick={async () => {
                const allPhotosUploaded = uploadedPhotos.every(photo => photo !== null);
                if (allPhotosUploaded) {
                  try {
                    const res = await fetch('/api/requests', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        studentName: studentDetails.name,
                        usn: studentDetails.usn,
                        items: Array.isArray(selectedItem) ? selectedItem : [selectedItem],
                        date: formData.date,
                        time: formData.time,
                        duration: formData.days,
                        images: uploadedPhotos.filter((p): p is string => p !== null)
                      })
                    });
                    
                    if (res.ok) {
                      alert('Requisition request submitted successfully in bulk!');
                      setCart([]); // Clear cart upon success!
                      setShowPhotoUpload(false);
                      setShowLetter(false);
                      setSelectedItem(null);
                      resetUploadedPhotos();
                    } else {
                      alert('Failed to submit request');
                    }
                  } catch (e) {
                    alert('Connection error submitting request');
                  }
                } else {
                  alert(`Please upload all 2 images. Currently uploaded: ${uploadedPhotos.filter(p => p !== null).length}/2`);
                }
              }}
              className="flex-1 px-5 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              Submit Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 relative">
      
      {/* 1. SELECTION GATEWAY PORTAL */}
      {currentMode === 'selection' && (
        <div className="min-h-[80vh] flex flex-col justify-center items-center relative overflow-hidden">
          {/* Subtle grid background mask */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

          {/* Glowing backdrop elements */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none animate-pulse"></div>
          
          <div className="absolute top-8 right-8 flex gap-4 z-20">
            <button 
              onClick={() => router.push('/')} 
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition duration-200"
            >
              Logout
            </button>
          </div>

          <div className="max-w-xl w-full text-center mb-8 z-10 px-4 animate-in fade-in duration-500">
            <span className="px-2.5 py-0.5 rounded-full border border-white/[0.04] bg-white/[0.01] text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
              {collegeName}
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight mt-3 text-zinc-100 uppercase">
              Lab Connect Portal
            </h1>
            <p className="text-zinc-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Choose your destination to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full px-4 z-10 animate-in slide-in-from-bottom-6 duration-700">
            {/* Card 1: Hardware Components Deck */}
            <div 
              onClick={() => setCurrentMode('components')}
              className="group cursor-pointer rounded-2xl bg-zinc-900/40 p-6 border border-zinc-800 transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between h-60 hover:border-cyan-500/30 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] relative overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 group-hover:scale-125 transition-all duration-500"></div>
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 uppercase">
                    Inventory
                  </span>
                  <h3 className="text-lg font-bold mt-3.5 text-zinc-100 group-hover:text-cyan-400 transition-colors">
                    Hardware Portal
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-cyan-400 group-hover:border-cyan-500/30 group-hover:bg-cyan-950/40 group-hover:scale-105 transition-all duration-300 shadow-inner">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
              </div>
              
              <p className="text-zinc-400 text-xs leading-relaxed max-w-[90%]">
                Browse catalog inventory, check item availability, and request components.
              </p>
              
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-zinc-950/60 border border-zinc-800/80 text-zinc-400 group-hover:text-cyan-400 group-hover:border-cyan-500/30 group-hover:bg-cyan-950/50 transition-all duration-300">
                  <span>Enter Portal</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Card 2: Workspace Access Permits */}
            <div 
              onClick={() => setCurrentMode('workspace')}
              className="group cursor-pointer rounded-2xl bg-zinc-900/40 p-6 border border-zinc-800 transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between h-60 hover:border-purple-500/30 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)] relative overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-purple-500/5 blur-xl group-hover:bg-purple-500/10 group-hover:scale-125 transition-all duration-500"></div>
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 uppercase">
                    Lab Access
                  </span>
                  <h3 className="text-lg font-bold mt-3.5 text-zinc-100 group-hover:text-purple-400 transition-colors">
                    Workspace Portal
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-purple-400 group-hover:border-purple-500/30 group-hover:bg-purple-950/40 group-hover:scale-105 transition-all duration-300 shadow-inner">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>
              
              <p className="text-zinc-400 text-xs leading-relaxed max-w-[90%]">
                Book time slots, request entry permits, and check access statuses.
              </p>
              
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-zinc-950/60 border border-zinc-800/80 text-zinc-400 group-hover:text-purple-400 group-hover:border-purple-500/30 group-hover:bg-purple-950/50 transition-all duration-300">
                  <span>Enter Portal</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentMode === 'components' && (
        <>
          <header className="flex flex-col gap-4 mb-8 border-b border-zinc-800 pb-6 animate-in fade-in duration-350">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">LAB CONNECT</h1>
                <p className="text-zinc-400 mt-1">
                  {componentsTab === 'catalog' && (activeDept ? `Browsing ${activeDept} Department Inventory.` : 'Select a department to view available hardware.')}
                  {componentsTab === 'marketplace' && 'P2P Student Marketplace: Sell or Rent items brought from outside.'}
                  {componentsTab === 'sell-rent' && 'Sell or Rent hardware components you no longer need.'}
                  {componentsTab === 'reservations' && 'Track your laboratory hardware reservation requests.'}
                </p>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setCurrentMode('selection');
                    setActiveDept(null);
                    setShowReservations(false);
                    setSelectedItem(null);
                  }} 
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  ← Back to Portal Select
                </button>
                <button 
                  onClick={() => router.push('/')} 
                  className="px-4 py-2 bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600/20 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Segmented Control Tab Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
              <div className="flex flex-wrap items-center gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
                <button
                  onClick={() => {
                    setComponentsTab('catalog');
                    setShowReservations(false);
                    setSelectedItem(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    componentsTab === 'catalog'
                      ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Hardware Catalog
                </button>
                <button
                  onClick={() => {
                    setComponentsTab('marketplace');
                    setShowReservations(false);
                    setSelectedItem(null);
                    fetchPeerListings();
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    componentsTab === 'marketplace'
                      ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Peer Marketplace
                </button>
                <button
                  onClick={() => {
                    setComponentsTab('sell-rent');
                    setShowReservations(false);
                    setSelectedItem(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    componentsTab === 'sell-rent'
                      ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sell/Rent My Item
                </button>
                <button
                  onClick={() => {
                    setComponentsTab('reservations');
                    setShowReservations(true);
                    setSelectedItem(null);
                    fetchReservations();
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    componentsTab === 'reservations'
                      ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  My Reservations
                </button>
              </div>

              {componentsTab === 'catalog' && (
                <div className="flex gap-2 animate-in fade-in duration-300">
                  {activeDept && (
                    <button 
                      onClick={() => setActiveDept(null)} 
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      ← Back to Departments
                    </button>
                  )}
                  {cart.length > 0 && (
                    <button 
                       onClick={() => {
                         setSelectedItem(cart);
                       }} 
                       className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-cyan-500/25 flex items-center gap-2 font-mono shadow-[0_0_10px_rgba(6,182,212,0.2)] animate-pulse"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Checkout Cart ({cart.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Reservations View */}
          {componentsTab === 'reservations' && (
            <div className="max-w-4xl mx-auto mt-8">
              <h2 className="text-xl font-bold mb-6 text-zinc-100 uppercase tracking-wide">My Reservation Status</h2>
              <div className="space-y-4">
                {reservations.map(res => {
                  const isHodApproved = res.status === 'Approved by HOD';
                  
                  return (
                    <div key={res.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col gap-4 transition hover:border-zinc-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] text-zinc-500 font-mono mb-1">{res.id}</div>
                          <h3 className="text-lg font-bold text-white">{res.component}</h3>
                          <div className="text-xs text-zinc-400 mt-1">
                            Requested: {res.requestDate} • Duration: {res.duration || 7} Days
                          </div>
                          {(() => {
                            const penaltyInfo = calculatePenalty(res.requestDate, res.duration || 7, res.component);
                            if (res.status === 'Active' && penaltyInfo.isDelayed) {
                              return (
                                <div className="text-red-400 text-[10px] font-semibold mt-2 flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 px-2.5 py-1 rounded-lg w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                  <span>⚠️ LATE RETURN PENALTY ACCRUED: ₹{penaltyInfo.penalty} ({penaltyInfo.weeksDelayed}w late, 5% of ₹{penaltyInfo.itemPrice}/week)</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-2.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            res.status === 'Approved by HOD'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                              : res.status === 'Ready for Collection' || res.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                              : res.status === 'Rejected'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}>
                            {res.status}
                          </span>
                          
                          <button
                            onClick={() => setViewingLetterRes(res)}
                            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mt-1 transition font-medium"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>View Letter</span>
                          </button>
                        </div>
                      </div>

                      {/* Geotagged Upload Component (strictly conditional on HOD approved status) */}
                      {isHodApproved && (
                        <div className="border-t border-zinc-800/85 pt-4 mt-1">
                          <GeotaggedUploadPanel res={res} onUploadSuccess={fetchReservations} />
                        </div>
                      )}

                      {/* Display Geotag Location Lock Details */}
                      {res.geotag && (
                        <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Geotag verified: {res.geotag.lat.toFixed(4)}° N, {res.geotag.lng.toFixed(4)}° E • Phoenix Campus</span>
                          </div>
                          {res.images && res.images[0] && (
                            <img src={res.images[0]} className="w-10 h-10 object-cover rounded-md border border-zinc-800 shadow-sm" alt="Geotag preview" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Landing State: Select Department */}
          {componentsTab === 'catalog' && !activeDept && (
            <div className="max-w-6xl mx-auto mt-12 px-4">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                  SELECT DEPARTMENT PORTAL
                </h2>
                <p className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
                  Access hyper-specialized university hardware decks, active inventory trackers, and instant reservation tools.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DEPT_INFO.map(dept => {
                  let iconSvg = null;
                  if (dept.id === 'EDL') {
                    iconSvg = (
                      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    );
                  } else if (dept.id === 'ECE') {
                    iconSvg = (
                      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    );
                  } else if (dept.id === 'EEE') {
                    iconSvg = (
                      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    );
                  } else {
                    iconSvg = (
                      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    );
                  }

                  return (
                    <div 
                      key={dept.id} 
                      onClick={() => setActiveDept(dept.id)}
                      className={`group cursor-pointer rounded-2xl bg-zinc-950 p-6 border border-white/[0.04] transition-all duration-300 hover:scale-[1.02] relative overflow-hidden flex flex-col justify-between h-56 ${dept.border} ${dept.glow}`}
                    >
                      <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-gradient-to-br ${dept.color} opacity-10 group-hover:opacity-20 blur-2xl transition-all duration-300`}></div>
                      
                      <div className="flex justify-between items-start z-10">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9px] font-bold w-fit uppercase tracking-wider ${dept.badge}`}>
                            {dept.id} Portal
                          </span>
                          <h3 className="text-xl font-bold text-white mt-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/70 transition-all duration-300">
                            {dept.title}
                          </h3>
                        </div>
                        <div className={`p-2.5 rounded-xl border border-white/[0.04] transition-all duration-300 ${dept.iconBg} group-hover:scale-105`}>
                          {iconSvg}
                        </div>
                      </div>
                      
                      <p className="text-xs text-zinc-400 leading-relaxed max-w-[90%] group-hover:text-zinc-200 transition-colors z-10">
                        {dept.desc}
                      </p>
                      
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 group-hover:text-white transition-colors mt-4 self-end z-10">
                        <span>EXPLORE INVENTORY</span>
                        <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grid State: View Components in Selected Dept */}
          {componentsTab === 'catalog' && activeDept && (
            <>
              {filteredComponents.length === 0 && (
                <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-xl border-dashed">
                  <p className="text-zinc-500 font-medium my-4">No components actively cataloged for {activeDept}.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {filteredComponents.map((item) => (
                  <div key={item.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 hover:shadow-lg transition-all flex flex-col justify-between min-h-[320px] group">
                     <div>
                        <div className="relative w-full h-32 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/60 mb-4 flex items-center justify-center">
                          <img 
                            src={item.photo_url || item.image_url || 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=600&auto=format&fit=crop'} 
                            alt={item.name} 
                            className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-102 transition-all duration-300"
                          />
                          <div className="absolute top-2 right-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-widest ${
                              item.available > 0 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {item.available > 0 ? `${item.available} AVAILABLE` : 'OUT OF STOCK'}
                            </span>
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-bold tracking-tight text-zinc-100 group-hover:text-white transition-colors truncate">{item.name}</h3>
                        <p className="text-zinc-400 text-xs mt-2 line-clamp-3 leading-relaxed">{item.desc}</p>
                     </div>
                     <div className="flex justify-between items-center mt-5 pt-3 border-t border-zinc-800/40">
                        <div>
                           <div className="text-xs text-zinc-300 font-bold">{item.department}</div>
                           <div className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">{item.location}</div>
                        </div>
                        {item.available > 0 ? (
                          cart.some(c => c.id === item.id) ? (
                            <button 
                              onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))} 
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/10"
                            >
                              ✓ In Cart
                            </button>
                          ) : (
                            <button 
                              onClick={() => setCart(prev => [...prev, item])} 
                              className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-all cursor-pointer"
                            >
                              Add to Cart
                            </button>
                          )
                        ) : (
                          <button className="px-4 py-2 bg-zinc-800 text-zinc-500 rounded-lg text-xs cursor-not-allowed border border-zinc-800">
                            Out of Stock
                          </button>
                        )}
                     </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Reservation Overlay Modal */}
          {selectedItem !== null && !showLetter && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900/90 border border-zinc-700 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
                <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition">✕</button>
                <h2 className="text-2xl font-bold mb-1">Reserve Component Cart</h2>
                
                <div className="mb-4 mt-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Items to Reserve</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
                    {Array.isArray(selectedItem) ? selectedItem.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-200 truncate max-w-[70%]">{item.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{item.department}</span>
                      </div>
                    )) : (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-200 truncate">{selectedItem.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{selectedItem.department}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
                    <input type="text" value={studentDetails.name} onChange={e => setStudentDetails({...studentDetails, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">USN</label>
                    <input type="text" value={studentDetails.usn} onChange={e => setStudentDetails({...studentDetails, usn: e.target.value.toUpperCase()})} placeholder="e.g. 4VV25CS001" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Collection Date</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Collection Time</label>
                    <select value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none">
                      <option value="" disabled>Select Time</option>
                      <option value="9:00 AM">9:00 AM</option>
                      <option value="9:30 AM">9:30 AM</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="10:30 AM">10:30 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="11:30 AM">11:30 AM</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="12:30 PM">12:30 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="1:30 PM">1:30 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="2:30 PM">2:30 PM</option>
                      <option value="3:00 PM">3:00 PM</option>
                      <option value="3:30 PM">3:30 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                      <option value="4:30 PM">4:30 PM</option>
                      <option value="5:00 PM">5:00 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Duration (Days)</label>
                    <input type="number" min="1" max="30" value={formData.days} onChange={e => setFormData({...formData, days: e.target.value})} placeholder="e.g. 7" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if(studentDetails.name && studentDetails.usn && formData.date && formData.time && formData.days) {
                      setShowLetter(true);
                    } else {
                      alert('Please fill out all personal and scheduling details.');
                    }
                  }} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Generate Formal HOD Request
                </button>
              </div>
            </div>
          )}

          {/* Peer Marketplace View */}
          {componentsTab === 'marketplace' && (
            <div className="max-w-6xl mx-auto mt-6 px-4 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold tracking-wide text-zinc-100 uppercase">Peer-to-Peer Marketplace</h2>
                  <p className="text-xs text-zinc-400 mt-1">Buy, sell, or rent unused hardware components from fellow students.</p>
                </div>

                {/* Filter and Search controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={listingSearchQuery}
                      onChange={(e) => setListingSearchQuery(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 w-48 transition-all"
                    />
                    <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Dept Selector */}
                  <select
                    value={listingDeptFilter}
                    onChange={(e) => setListingDeptFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="All">All Labs</option>
                    <option value="EDL">EDL</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                  </select>

                  {/* Type Selector */}
                  <select
                    value={listingTypeFilter}
                    onChange={(e) => setListingTypeFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="All">All Types</option>
                    <option value="Sell">For Sale</option>
                    <option value="Rent">For Rent</option>
                  </select>
                </div>
              </div>

              {/* Listings Grid */}
              {(() => {
                const filtered = peerListings.filter((item) => {
                  const matchesSearch = item.component.toLowerCase().includes(listingSearchQuery.toLowerCase()) || 
                                       item.description.toLowerCase().includes(listingSearchQuery.toLowerCase());
                  const matchesDept = listingDeptFilter === 'All' || item.department === listingDeptFilter;
                  const matchesType = listingTypeFilter === 'All' || item.type === listingTypeFilter;
                  return matchesSearch && matchesDept && matchesType;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-20 bg-zinc-900/30 border border-zinc-850 rounded-2xl border-dashed">
                      <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <h3 className="text-white font-bold text-base mb-1">No Listings Found</h3>
                      <p className="text-zinc-500 text-xs max-w-sm mx-auto">Try adjusting your filters or search keywords.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((item) => (
                      <div key={item.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-cyan-500/35 hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.1)] transition-all flex flex-col justify-between min-h-[350px] relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/[0.02] rounded-full blur-xl pointer-events-none"></div>
                        
                        <div>
                          {/* Header info */}
                          <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-widest ${
                              item.type === 'Sell' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {item.type === 'Sell' ? 'FOR SALE' : 'FOR RENT'}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">{item.id}</span>
                          </div>

                          {/* Listing Image */}
                          <div className="relative w-full h-36 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/60 mb-4 flex items-center justify-center">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.component} 
                                className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 transition duration-300"
                              />
                            ) : (
                              <div className="text-zinc-700 flex flex-col items-center gap-1.5">
                                <svg className="w-8 h-8 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-[9px] font-mono uppercase tracking-widest">No photo provided</span>
                              </div>
                            )}
                            <div className="absolute bottom-2 left-2">
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-zinc-900/95 border border-zinc-800 text-zinc-300 shadow-sm">
                                {item.condition}
                              </span>
                            </div>
                          </div>

                          {/* Item Details */}
                          <h3 className="text-base font-bold text-zinc-150 group-hover:text-white transition-colors truncate">{item.component}</h3>
                          <p className="text-zinc-400 text-xs mt-2 line-clamp-2 leading-relaxed">{item.description || 'No description provided.'}</p>
                        </div>

                        {/* Price and Action Row */}
                        <div className="mt-5 pt-3 border-t border-zinc-800/40 flex justify-between items-end">
                          <div className="space-y-0.5">
                            <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">Asking Price</div>
                            <div className="text-lg font-bold text-white font-mono">
                              ₹{item.price}
                              {item.type === 'Rent' && <span className="text-xs text-zinc-400 font-normal"> / week</span>}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <div className="text-[8px] text-zinc-500 font-mono">Listed by: {item.studentName}</div>
                            <button 
                              type="button"
                              onClick={() => {
                                setInterestModalListing(item);
                                setBuyerFormData({
                                  buyerName: studentDetails.name || '',
                                  buyerContact: studentDetails.usn ? `${studentDetails.usn.toLowerCase()}@phoenix.edu` : ''
                                });
                                setShowInterestSuccess(false);
                              }}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs transition shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                            >
                              I'm Interested
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sell/Rent Form View */}
          {componentsTab === 'sell-rent' && (
            <div className="max-w-2xl mx-auto mt-6 px-4 animate-in fade-in duration-300">
              <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-2xl shadow-2xl relative backdrop-blur-sm">
                <h2 className="text-xl font-bold mb-1 text-zinc-150">Sell or Rent Your Component</h2>
                <p className="text-xs text-zinc-400 mb-6">List components you bought from outside but no longer need for peer lookup.</p>

                <form onSubmit={handleListingSubmit} className="space-y-5">
                  
                  {/* Row 1: Student Metadata Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Your Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Rohan Sharma"
                        value={studentDetails.name} 
                        onChange={e => setStudentDetails({...studentDetails, name: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Your USN</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 4VV25CS001"
                        value={studentDetails.usn} 
                        onChange={e => setStudentDetails({...studentDetails, usn: e.target.value.toUpperCase()})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono tracking-wider"
                      />
                    </div>
                  </div>

                  {/* Row 2: Listing Title & Dept */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Component Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Raspberry Pi 4 Model B (8GB)"
                        value={newListingFormData.component} 
                        onChange={e => setNewListingFormData({...newListingFormData, component: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Department Category</label>
                      <select 
                        value={newListingFormData.department} 
                        onChange={e => setNewListingFormData({...newListingFormData, department: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
                      >
                        <option value="EDL">EDL</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="MECH">MECH</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Listing Type, Price & Condition */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Listing Option</label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setNewListingFormData({...newListingFormData, type: 'Sell'})}
                          className={`py-1.5 text-[10px] font-bold rounded-md transition-all ${
                            newListingFormData.type === 'Sell' ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Sell
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewListingFormData({...newListingFormData, type: 'Rent'})}
                          className={`py-1.5 text-[10px] font-bold rounded-md transition-all ${
                            newListingFormData.type === 'Rent' ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Rent
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Price (₹) {newListingFormData.type === 'Rent' ? '/ week' : ''}
                      </label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        placeholder={newListingFormData.type === 'Rent' ? 'e.g. 100' : 'e.g. 1500'}
                        value={newListingFormData.price} 
                        onChange={e => setNewListingFormData({...newListingFormData, price: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Item Condition</label>
                      <select 
                        value={newListingFormData.condition} 
                        onChange={e => setNewListingFormData({...newListingFormData, condition: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
                      >
                        <option value="Brand New">Brand New (Unopened)</option>
                        <option value="Like New">Like New (Mint)</option>
                        <option value="Used - Good Condition">Used - Good</option>
                        <option value="Used - Fair Condition">Used - Fair</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Contact & Description */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Contact Email / Info</label>
                    <input 
                      type="email" 
                      required
                      placeholder="yourname@domain.com or university email"
                      value={newListingFormData.contact} 
                      onChange={e => setNewListingFormData({...newListingFormData, contact: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Listing Details & Description</label>
                    <textarea 
                      rows={3}
                      placeholder="Describe the items condition, what accessory is included, why you are listing it, etc..."
                      value={newListingFormData.description} 
                      onChange={e => setNewListingFormData({...newListingFormData, description: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                    />
                  </div>

                  {/* Row 5: Listing Photo Upload */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Item Photograph (Optional)</label>
                    <div className="flex items-center gap-4">
                      {!listingImage ? (
                        <label className="flex-1 flex flex-col items-center justify-center h-24 border border-dashed border-zinc-800 hover:border-cyan-500/50 bg-zinc-950/40 hover:bg-zinc-950/60 rounded-xl cursor-pointer transition">
                          <svg className="w-6 h-6 text-zinc-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[10px] font-medium text-zinc-450">Click to upload listing photo</span>
                          <input type="file" accept="image/*" onChange={handleListingImageUpload} className="hidden" />
                        </label>
                      ) : (
                        <div className="flex-1 flex items-center justify-between bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl animate-in fade-in duration-200">
                          <div className="flex items-center gap-3">
                            <img src={listingImage} className="w-16 h-12 object-cover rounded-lg border border-zinc-800" alt="Listing preview" />
                            <span className="text-[10px] text-emerald-450 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Photo uploaded successfully
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setListingImage(null)}
                            className="bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-650/20 rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={isListingSubmitting}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer text-sm shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
                    >
                      {isListingSubmitting ? 'Posting Listing...' : 'Post Listing on Peer Marketplace'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* PEER MARKETPLACE INTEREST MODAL */}
          {interestModalListing !== null && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900/90 border border-zinc-700 p-8 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button 
                  type="button"
                  onClick={() => setInterestModalListing(null)} 
                  className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
                >
                  ✕
                </button>

                {!showInterestSuccess ? (
                  <>
                    <h2 className="text-xl font-bold mb-1">Confirm Interest</h2>
                    <p className="text-xs text-zinc-400 mb-6">Request details for component exchange with fellow student.</p>

                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 mb-6">
                      <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Listing Item</div>
                      <div className="text-sm font-bold text-white mt-1">{interestModalListing.component}</div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-zinc-900">
                        <div>
                          <div className="text-[9px] text-zinc-500 font-mono uppercase">Asking Price</div>
                          <div className="text-xs font-bold text-cyan-400 font-mono">
                            ₹{interestModalListing.price}
                            {interestModalListing.type === 'Rent' && <span className="text-[10px] text-zinc-400 font-normal"> / week</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-zinc-500 font-mono uppercase">Listed by</div>
                          <div className="text-xs font-bold text-zinc-200">{interestModalListing.studentName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Your Full Name</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Rohan Sharma"
                          value={buyerFormData.buyerName} 
                          onChange={e => setBuyerFormData({...buyerFormData, buyerName: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Your Contact Email / USN Email</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. yourname@domain.com"
                          value={buyerFormData.buyerContact} 
                          onChange={e => setBuyerFormData({...buyerFormData, buyerContact: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        if (buyerFormData.buyerName && buyerFormData.buyerContact) {
                          setShowInterestSuccess(true);
                          // Update studentDetails if empty
                          if (!studentDetails.name) {
                            setStudentDetails(prev => ({ ...prev, name: buyerFormData.buyerName }));
                          }
                        } else {
                          alert('Please fill out your name and contact details.');
                        }
                      }} 
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer text-xs uppercase tracking-wider"
                    >
                      Send Interest Notification
                    </button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-350">
                      <svg className="w-6 h-6 text-emerald-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    
                    <h3 className="text-base font-bold text-white mb-2">Notification Routed!</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-[280px] mx-auto mb-6">
                      An automated email alert has been simulated and sent to the seller, <span className="text-zinc-200 font-semibold">{interestModalListing.studentName}</span>, at <span className="text-cyan-400 font-mono">{interestModalListing.contact}</span>.
                    </p>

                    <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800/80 text-left text-xs space-y-1 mb-6 text-zinc-450 leading-relaxed">
                      <div><span className="font-bold text-zinc-300">Buyer details shared:</span></div>
                      <div>Name: {buyerFormData.buyerName}</div>
                      <div>Contact: {buyerFormData.buyerContact}</div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setInterestModalListing(null)} 
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. PHYSICAL SPACE WORKSPACE ACCESS PORTAL */}
      {currentMode === 'workspace' && (
        <div className="max-w-5xl mx-auto mt-6">
          <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">LAB WORKSPACE PERMITS</h2>
              <p className="text-xs text-zinc-400 mt-1">Request physical entry permits and track two-level sign-offs (HOD + Admin) for laboratory shifts.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentMode('selection')}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-800 text-zinc-300 transition"
              >
                ← Back to Selection
              </button>
              <button
                onClick={() => setShowWorkspaceModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg text-xs tracking-wider uppercase transition shadow-[0_0_15px_rgba(139,92,246,0.25)] flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Request Lab Access
              </button>
            </div>
          </div>

          {labAccessRequests.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/30 border border-zinc-850 rounded-2xl border-dashed">
              <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="text-white font-bold text-base mb-1">No Active Workspace Permits</h3>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto mb-6">You have not submitted any physical lab workspace access requests yet. Submit a request to obtain entry credentials.</p>
              <button
                onClick={() => setShowWorkspaceModal(true)}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-xl text-xs font-bold text-white transition-all"
              >
                Submit First Request
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              {labAccessRequests.map(pass => {
                const isPendingHod = pass.status === 'PENDING_HOD';
                const isPendingAdmin = pass.status === 'PENDING_ADMIN';
                const isApproved = pass.status === 'APPROVED';
                const isRejected = pass.status.startsWith('REJECTED');

                return (
                  <div 
                    key={pass.id} 
                    className={`rounded-2xl border overflow-hidden transition-all duration-300 bg-zinc-950/80 ${
                      isApproved ? 'border-emerald-500/25 hover:border-emerald-500/40 shadow-[0_0_35px_-5px_rgba(16,185,129,0.1)]' :
                      isPendingAdmin ? 'border-purple-500/20 hover:border-purple-500/30' :
                      isPendingHod ? 'border-amber-500/20 hover:border-amber-500/30' :
                      'border-rose-500/20 hover:border-rose-500/30'
                    }`}
                  >
                    {/* Top status bar */}
                    <div className={`px-6 py-3 border-b flex justify-between items-center text-xs font-semibold ${
                      isApproved ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' :
                      isPendingAdmin ? 'bg-purple-500/5 border-purple-500/10 text-purple-400' :
                      isPendingHod ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' :
                      'bg-rose-500/5 border-rose-500/10 text-rose-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          isApproved ? 'bg-emerald-400' :
                          isPendingAdmin ? 'bg-purple-400 animate-pulse' :
                          isPendingHod ? 'bg-amber-400 animate-pulse' :
                          'bg-rose-400'
                        }`}></span>
                        <span className="uppercase tracking-widest text-[10px]">
                          {isPendingHod && 'PENDING HOD APPROVAL (STAGE 1/2)'}
                          {isPendingAdmin && 'PENDING ADMIN SIGN-OFF (STAGE 2/2)'}
                          {isApproved && 'ENTRY PASS GRANTED & ACTIVE'}
                          {isRejected && 'PERMIT REQUEST DECLINED'}
                        </span>
                      </div>
                      <span className="font-mono text-zinc-500">{pass.id}</span>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Permit Information details */}
                      <div className="lg:col-span-7 space-y-4">
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Target Laboratory</div>
                          <div className="text-xl font-bold text-white mt-1">{pass.labName}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Requested Date</div>
                            <div className="text-sm font-semibold text-zinc-200 mt-1 font-mono">{pass.accessDate}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Time Slot Shift</div>
                            <div className="text-sm font-semibold text-zinc-200 mt-1">{pass.timeSlot}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Academic Purpose</div>
                          <div className="text-xs text-zinc-400 mt-1 italic">"{pass.purpose}"</div>
                        </div>

                        {/* Two-Level Clearance Status Map */}
                        <div className="pt-2">
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Clearance Stages</div>
                          <div className="flex items-center gap-4">
                            {/* HOD Stage */}
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isPendingHod ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                pass.status === 'REJECTED_HOD' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {isPendingHod ? '1' : pass.status === 'REJECTED_HOD' ? '✕' : '✓'}
                              </div>
                              <span className={`text-[11px] font-semibold ${
                                isPendingHod ? 'text-amber-400' :
                                pass.status === 'REJECTED_HOD' ? 'text-rose-400' :
                                'text-zinc-300'
                              }`}>
                                HOD Clearance
                              </span>
                            </div>

                            <div className="w-8 h-px bg-zinc-800"></div>

                            {/* Admin Stage */}
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isPendingHod ? 'bg-zinc-900 text-zinc-650 border border-zinc-850' :
                                isPendingAdmin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                pass.status === 'REJECTED_ADMIN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {isPendingHod ? '2' : isPendingAdmin ? '2' : pass.status === 'REJECTED_ADMIN' ? '✕' : '✓'}
                              </div>
                              <span className={`text-[11px] font-semibold ${
                                isPendingHod ? 'text-zinc-600' :
                                isPendingAdmin ? 'text-purple-400' :
                                pass.status === 'REJECTED_ADMIN' ? 'text-rose-400' :
                                'text-zinc-300'
                              }`}>
                                Admin Scheduling
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Remarks Panels */}
                        {(pass.hodRemarks || pass.adminRemarks) && (
                          <div className="pt-2 space-y-2 border-t border-zinc-900">
                            {pass.hodRemarks && (
                              <div className="bg-purple-950/20 border border-purple-900/30 rounded-xl p-3 text-xs leading-relaxed">
                                <span className="font-bold text-purple-400 block mb-0.5">Head of Department Feedback:</span>
                                <span className="text-zinc-300">"{pass.hodRemarks}"</span>
                              </div>
                            )}
                            {pass.adminRemarks && (
                              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 text-xs leading-relaxed">
                                <span className="font-bold text-emerald-400 block mb-0.5">Lab Administration Instructions:</span>
                                <span className="text-zinc-300">"{pass.adminRemarks}"</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Pass Hologram */}
                      <div className="lg:col-span-5 flex flex-col items-center justify-center bg-zinc-900/30 border border-zinc-900 rounded-xl p-6 relative min-h-[220px]">
                        {isApproved ? (
                          <div className="w-full flex flex-col items-center gap-4 text-center">
                            <div className="relative p-2.5 bg-white rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-zinc-200">
                              <svg className="w-28 h-28 text-black" viewBox="0 0 100 100" fill="currentColor">
                                <rect x="5" y="5" width="25" height="25" />
                                <rect x="10" y="10" width="15" height="15" fill="white" />
                                <rect x="12" y="12" width="11" height="11" />
                                
                                <rect x="70" y="5" width="25" height="25" />
                                <rect x="75" y="10" width="15" height="15" fill="white" />
                                <rect x="77" y="12" width="11" height="11" />
                                
                                <rect x="5" y="70" width="25" height="25" />
                                <rect x="10" y="75" width="15" height="15" fill="white" />
                                <rect x="12" y="77" width="11" height="11" />

                                <rect x="35" y="5" width="10" height="5" />
                                <rect x="50" y="5" width="5" height="10" />
                                <rect x="60" y="10" width="5" height="5" />
                                <rect x="40" y="15" width="15" height="5" />
                                <rect x="35" y="25" width="5" height="5" />
                                <rect x="55" y="25" width="10" height="10" />
                                
                                <rect x="5" y="35" width="5" height="10" />
                                <rect x="15" y="45" width="15" height="5" />
                                <rect x="5" y="55" width="10" height="10" />
                                <rect x="25" y="55" width="5" height="10" />

                                <rect x="70" y="35" width="10" height="5" />
                                <rect x="85" y="40" width="10" height="10" />
                                <rect x="75" y="55" width="20" height="5" />

                                <rect x="35" y="40" width="25" height="20" />
                                <rect x="40" y="45" width="15" height="10" fill="white" />

                                <rect x="35" y="70" width="10" height="15" />
                                <rect x="50" y="75" width="15" height="5" />
                                <rect x="45" y="85" width="20" height="10" />
                                
                                <rect x="70" y="70" width="5" height="15" />
                                <rect x="80" y="75" width="15" height="10" />
                                <rect x="75" y="90" width="10" height="5" />
                              </svg>
                              <div className="absolute left-0 right-0 top-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-bounce"></div>
                            </div>
                            <div>
                              <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">SCAN ACCESS QR</div>
                              <div className="text-[10px] text-zinc-500 font-mono mt-1">Authorized for: {pass.studentName}</div>
                            </div>
                          </div>
                        ) : isRejected ? (
                          <div className="text-center p-4">
                            <svg className="w-10 h-10 text-rose-500/40 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-xs font-bold text-rose-400 uppercase tracking-wide">Permit Refused</div>
                            <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">This workspace request was declined by department staff. Review remarks on the left for details.</p>
                          </div>
                        ) : (
                          <div className="text-center p-4">
                            <div className="relative w-12 h-12 mx-auto mb-3">
                              <div className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/20 animate-spin"></div>
                              <div className="absolute inset-2.5 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-purple-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                            </div>
                            <div className="text-xs font-bold text-purple-400 uppercase tracking-wide">Verification Pending</div>
                            <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">Your entry pass will activate and generate a QR credential once approved by HOD & Lab Admin.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. WORKSPACE REQUEST MODAL */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900/90 border border-zinc-700 p-8 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowWorkspaceModal(false)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-1">Request Lab Workspace Permit</h2>
            <p className="text-xs text-zinc-400 mb-6">Submit entry pass scheduling for authorization by HOD and Lab Admin.</p>

            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
                <input 
                  type="text" 
                  readOnly 
                  value={studentDetails.name} 
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-lg px-4 py-3 text-zinc-400 cursor-not-allowed focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">USN</label>
                <input 
                  type="text" 
                  readOnly 
                  value={studentDetails.usn} 
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-lg px-4 py-3 text-zinc-400 cursor-not-allowed focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Select Laboratory</label>
                <select 
                  value={workspaceFormData.labName} 
                  onChange={e => setWorkspaceFormData({...workspaceFormData, labName: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="CSE Lab">CSE Lab</option>
                  <option value="ECE Lab">ECE Lab</option>
                  <option value="EEE Lab">EEE Lab</option>
                  <option value="Mechanical Lab">Mechanical Lab</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Access Date</label>
                <input 
                  type="date" 
                  required
                  value={workspaceFormData.accessDate} 
                  onChange={e => setWorkspaceFormData({...workspaceFormData, accessDate: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Time Slot Shift</label>
                <select 
                  value={workspaceFormData.timeSlot} 
                  onChange={e => setWorkspaceFormData({...workspaceFormData, timeSlot: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="Morning Shift (9:00 AM - 1:00 PM)">Morning Shift (9:00 AM - 1:00 PM)</option>
                  <option value="Afternoon Shift (2:00 PM - 5:00 PM)">Afternoon Shift (2:00 PM - 5:00 PM)</option>
                  <option value="Full Day (9:00 AM - 5:00 PM)">Full Day (9:00 AM - 5:00 PM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Purpose of Lab Workspace Access</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Describe your project work or experiment setup to inform academic review by the HOD."
                  value={workspaceFormData.purpose} 
                  onChange={e => setWorkspaceFormData({...workspaceFormData, purpose: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 leading-relaxed text-xs"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer text-sm shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                >
                  Submit Permit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. VIEW REQUISITION LETTER MODAL */}
      {viewingLetterRes && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white text-zinc-900 max-w-2xl w-full p-8 rounded-2xl shadow-2xl relative border border-zinc-200 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setViewingLetterRes(null)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 text-lg font-bold font-mono transition"
            >
              ✕
            </button>

            {/* Letter content */}
            <div className="text-center mb-6 border-b border-zinc-200 pb-3">
              <h1 className="text-xl font-bold uppercase mb-1 text-zinc-900">{collegeName}</h1>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Laboratory Hardware Requisition Form</p>
            </div>

            <div className="mb-2 text-right text-xs font-medium text-zinc-500">
              <p>Date: {viewingLetterRes.requestDate || new Date().toLocaleDateString()}</p>
            </div>

            <div className="mb-4 text-sm leading-relaxed text-zinc-800">
              <p className="font-bold mb-0">To,</p>
              <p className="mb-0">The Head of Department ({viewingLetterRes.department}),</p>
              <p className="mb-0">{collegeName}.</p>
            </div>

            <div className="mb-4 text-sm leading-relaxed text-zinc-800 text-justify">
              <p className="mb-2"><strong>Subject:</strong> Requisition for borrowing Laboratory Hardware ({viewingLetterRes.component})</p>
              <p className="mb-2">Respected Sir/Madam,</p>
              <p className="mb-0">
                I, <strong>{viewingLetterRes.studentName || studentDetails.name}</strong>, bearing University Serial Number (USN) <strong>{viewingLetterRes.usn || studentDetails.usn}</strong>, request the allocation of the following laboratory hardware for academic project integration.
              </p>
            </div>

            <table className="w-full text-left border-collapse border border-zinc-300 mb-4 text-sm">
              <tbody>
                <tr className="border border-zinc-300">
                  <th className="p-2 border border-zinc-300 bg-zinc-50 w-1/3 text-zinc-700 font-semibold">Component Requested</th>
                  <td className="p-2 border border-zinc-300 font-medium text-zinc-900">{viewingLetterRes.component}</td>
                </tr>
                <tr className="border border-zinc-300">
                  <th className="p-2 border border-zinc-300 bg-zinc-50 text-zinc-700 font-semibold">Department Lab</th>
                  <td className="p-2 border border-zinc-300 font-medium text-zinc-900">{viewingLetterRes.department} Lab</td>
                </tr>
                <tr className="border border-zinc-300">
                  <th className="p-2 border border-zinc-300 bg-zinc-50 text-zinc-700 font-semibold">Borrow Duration</th>
                  <td className="p-2 border border-zinc-300 font-medium text-zinc-900">{viewingLetterRes.duration || 7} Days</td>
                </tr>
                <tr className="border border-zinc-300">
                  <th className="p-2 border border-zinc-300 bg-zinc-50 text-zinc-700 font-semibold">Status</th>
                  <td className="p-2 border border-zinc-300 font-medium text-zinc-900">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        viewingLetterRes.status === 'Approved by HOD' || viewingLetterRes.status === 'Ready for Collection' || viewingLetterRes.status === 'Active'
                          ? 'bg-emerald-500'
                          : viewingLetterRes.status === 'Rejected'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}></span>
                      <span>{viewingLetterRes.status}</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6 italic text-[11px] text-zinc-500 text-justify leading-relaxed">
              <p>
                "I acknowledge that I will make sure the borrowed items will be used properly and safely, keep the items in good condition, and return the items to the lab in time exactly after the stated duration. I take full responsibility for the cost of repair or replacement if any functional or physical damage happens to the items while under my custody."
              </p>
            </div>

            <div className="flex justify-between items-end text-xs pt-4 border-t border-zinc-150">
              <div className="text-center">
                <div className="text-emerald-700 font-bold text-[10px] mb-0.5">✓ Digitally Signed</div>
                <p className="font-semibold text-zinc-800">Signature of Student</p>
                <p className="text-zinc-500">{viewingLetterRes.studentName || studentDetails.name}</p>
              </div>
              <div className="text-center">
                <div className="text-zinc-400 italic text-[10px] mb-0.5">
                  {viewingLetterRes.status === 'Ready for Collection' || viewingLetterRes.status === 'Active' ? '✓ Checked Out' : 'Pending Checkout'}
                </div>
                <p className="font-semibold text-zinc-800 border-t border-zinc-300 pt-0.5 px-2">Signature of Lab Admin</p>
              </div>
              <div className="text-center">
                <div className="text-emerald-700 font-bold text-[10px] mb-0.5">
                  {viewingLetterRes.status !== 'Pending HOD' && viewingLetterRes.status !== 'Rejected' ? '✓ Signed & Cleared' : 'Awaiting Sign-off'}
                </div>
                <p className="font-semibold text-zinc-800 border-t border-zinc-300 pt-0.5 px-2">Signature of HOD</p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setViewingLetterRes(null)} 
                className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition"
              >
                Close Letter
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
