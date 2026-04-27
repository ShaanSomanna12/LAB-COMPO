'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const router = useRouter();
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({ date: '', time: '', days: '' });
  const [showLetter, setShowLetter] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<(string | null)[]>([null, null]);
  const [collegeName, setCollegeName] = useState('PHOENIX INSTITUTE OF TECHNOLOGY');

  const mockReservations = [
    { id: 'REQ-003', component: 'Arduino Mega 2560', department: 'MECH', requestDate: '2026-04-15', status: 'Active', dueDate: '2026-04-29' },
    { id: 'REQ-008', component: 'Lidar Sensor (RPLIDAR A1)', department: 'MECH', requestDate: '2025-11-20', status: 'Returned', dueDate: '2025-11-27' },
    { id: 'REQ-012', component: 'Fluke 117 Multimeter', department: 'EEE', requestDate: '2025-09-10', status: 'Returned', dueDate: '2025-09-15' }
  ];

  const [studentDetails, setStudentDetails] = useState({
    name: '',
    usn: ''
  });

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
    { id: 1, name: 'Raspberry Pi 4 Model B', available: 4, total: 5, desc: 'High-performance single-board computer. Used for heavy processing and ML nodes.', department: 'CSE', location: 'Lab 201', status: 'Available' },
    { id: 2, name: 'Arduino Mega 2560', available: 0, total: 2, desc: 'Advanced microcontroller board based on the ATmega2560. Ideal for complex robotics projects.', department: 'MECH', location: 'Mechatronics Lab', status: 'Available' },
    { id: 3, name: 'NVIDIA Jetson Nano', available: 2, total: 2, desc: 'Small, powerful computer for embedded applications and AI neural networks.', department: 'CSE', location: 'AI Lab 404', status: 'Available' },
    { id: 4, name: 'Fluke 117 Multimeter', available: 12, total: 15, desc: 'True-RMS digital multimeter with integrated non-contact voltage detection.', department: 'EEE', location: 'Circuits Lab', status: 'Available' },
    { id: 5, name: 'RIGOL DS1054Z Oscilloscope', available: 3, total: 4, desc: '50 MHz Digital Oscilloscope with 4 channels. Crucial for signal analysis.', department: 'ECE', location: 'Signals Lab', status: 'Available' },
    { id: 6, name: 'ESP32 Wi-Fi/BT Module', available: 18, total: 20, desc: 'Low-cost, low-power system on a chip with integrated Wi-Fi and dual-mode Bluetooth.', department: 'CSE', location: 'IoT Lab', status: 'Available' },
    { id: 7, name: 'Hakko FX-888D Soldering Station', available: 6, total: 6, desc: 'Digital precision soldering iron with adjustable thermal recovery and heating speeds.', department: 'EEE', location: 'Fabrication Room', status: 'Under Repair' },
    { id: 8, name: 'Lidar Sensor (RPLIDAR A1)', available: 1, total: 2, desc: '360-degree 2D laser scanner (LIDAR) solution for ROS mapping and SLAM algorithms.', department: 'MECH', location: 'Autonomous Systems Lab', status: 'Available' }
  ];

  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/inventory').then(res => res.json()).then(data => setComponents(data));
  }, []);

  const DEPT_INFO = [
    { 
      id: 'CSE', 
      title: 'Computer Science', 
      desc: 'IoT modules, AI computing boards, and networking gear.', 
      color: 'from-blue-600 to-indigo-600'
    },
    { 
      id: 'ECE', 
      title: 'Electronics & Comm.', 
      desc: 'Oscilloscopes, function generators, and signal processors.', 
      color: 'from-purple-600 to-pink-600'
    },
    { 
      id: 'EEE', 
      title: 'Electrical Engineering', 
      desc: 'Multimeters, soldering stations, and high voltage equipment.', 
      color: 'from-amber-500 to-orange-600'
    },
    { 
      id: 'MECH', 
      title: 'Mechanical Engineering', 
      desc: 'Robotics kits, lidar sensors, and mechatronic components.', 
      color: 'from-emerald-600 to-teal-600'
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
            <p className="mb-0">The Head of Department ({selectedItem.department}),</p>
            <p className="mb-0">{collegeName}.</p>
          </div>

          <div className="mb-3 font-serif leading-relaxed text-justify text-base">
            <p className="mb-2"><strong>Subject:</strong> Requisition for borrowing Laboratory Hardware ({selectedItem.name})</p>
            <p className="mb-2">Respected Sir/Madam,</p>
            <p className="mb-0">
              I, <strong>{studentDetails.name}</strong>, bearing University Serial Number (USN) <strong>{studentDetails.usn}</strong>, humbly request the allocation of the following laboratory hardware for academic project integration.
            </p>
          </div>

          <table className="w-full text-left border-collapse border border-zinc-400 mb-3 font-serif text-base">
            <tbody>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100 w-1/3">Component Requested</th>
                <td className="p-2">{selectedItem.name}</td>
              </tr>
              <tr className="border border-zinc-400">
                <th className="p-2 border border-zinc-400 bg-zinc-100">Lab Location</th>
                <td className="p-2">{selectedItem.location} ({selectedItem.department})</td>
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
              <p className="font-semibold text-base">Signature of Student</p>
              <p className="text-base">{studentDetails.name}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-base mb-6"></p>
              <p className="font-semibold text-base border-t border-black pt-1 px-4">Signature of Lab Admin</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-base mb-6"></p>
              <p className="font-semibold text-base border-t border-black pt-1 px-4">Signature of HOD</p>
            </div>
          </div>

          <div className="text-center text-sm font-medium text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg mt-6 mb-2 print:hidden shadow-sm">
            ⚠️ Note: Please submit the hard copy of this letter in the office after obtaining the signatures.
          </div>

          <div className="flex gap-4 mt-4 print:hidden">
            <button onClick={() => setShowLetter(false)} className="flex-1 px-5 py-2 bg-zinc-800 text-white rounded-lg font-medium text-sm hover:bg-zinc-700 transition">
              Back to Catalog
            </button>
            <button onClick={() => { setShowLetter(false); setShowPhotoUpload(true); }} className="flex-1 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">
              NEXT →
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
              onClick={() => {
                const allPhotosUploaded = uploadedPhotos.every(photo => photo !== null);
                if (allPhotosUploaded) {
                  alert('Request submitted successfully with all 2 images!');
                  setShowPhotoUpload(false);
                  setShowLetter(false);
                  setSelectedItem(null);
                  resetUploadedPhotos();
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
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">LAB CONNECT</h1>
          <p className="text-zinc-400 mt-1">
            {activeDept ? `Browsing ${activeDept} Department Inventory.` : 'Select a department to view available hardware.'}
          </p>
        </div>
        
        <div className="flex gap-4">
          {activeDept && !showReservations && (
              <button onClick={() => setActiveDept(null)} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm transition-colors font-medium">
                 ← Back to Departments
              </button>
          )}
          <button 
             onClick={() => { setShowReservations(!showReservations); setActiveDept(null); setSelectedItem(null); setShowLetter(false); setShowPhotoUpload(false); }} 
             className={`px-5 py-2 rounded-lg text-sm transition-colors font-medium border ${showReservations ? 'bg-zinc-100 text-black border-zinc-100 hover:bg-white' : 'bg-transparent text-zinc-300 border-zinc-700 hover:bg-zinc-800'}`}>
            {showReservations ? 'Catalog View' : 'My Reservations'}
          </button>
          <button 
            onClick={() => router.push('/')} 
            className="px-5 py-2 bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600/20 rounded-lg text-sm transition-colors font-medium ml-4"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Reservations View */}
      {showReservations && (
        <div className="max-w-4xl mx-auto mt-8">
          <h2 className="text-2xl font-bold mb-6">Reservation History</h2>
          <div className="space-y-4">
            {mockReservations.map(res => (
              <div key={res.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex justify-between items-center transition hover:border-zinc-700">
                <div>
                  <div className="text-xs text-zinc-500 font-mono mb-1">{res.id}</div>
                  <h3 className="text-lg font-bold text-white">{res.component}</h3>
                  <div className="text-sm text-zinc-400 mt-1">Requested: {res.requestDate} • Due: {res.dueDate}</div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    res.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {res.status}
                  </span>
                  {res.status === 'Returned' && (
                    <button 
                      onClick={() => {
                        setShowReservations(false);
                        setActiveDept(res.department);
                        const item = components.find(c => c.name === res.component);
                        if(item) setSelectedItem(item);
                      }} 
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4 transition"
                    >
                      Re-request Item
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Landing State: Select Department */}
      {!activeDept && !showReservations && (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto mt-12">
          {DEPT_INFO.map(dept => (
            <div 
              key={dept.id} 
              onClick={() => setActiveDept(dept.id)}
              className="group cursor-pointer rounded-2xl p-[1px] bg-gradient-to-r transition-all duration-300 hover:scale-[1.02] w-full"
            >
              <div className={`w-full bg-zinc-900 rounded-2xl p-6 hover:bg-gradient-to-r ${dept.color} transition-all duration-300 flex items-center gap-8 border border-zinc-800 hover:border-transparent opacity-90 hover:opacity-100`}>
                <div className="flex-1">
                  <h2 className="text-4xl font-black mb-1 tracking-tight drop-shadow-md"><span className={`bg-gradient-to-r ${dept.color} bg-clip-text text-transparent brightness-110`}>{dept.id}</span> <span className="text-white">Portal</span></h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-medium text-zinc-300 group-hover:text-white/90">{dept.title}</h3>
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-white/50 hidden md:block"></div>
                    <p className="text-zinc-500 group-hover:text-white/70 text-sm">{dept.desc}</p>
                  </div>
                </div>
                <div className="mr-4 text-zinc-600 group-hover:text-white/80 transition-colors">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid State: View Components in Selected Dept */}
      {activeDept && !showReservations && (
        <>
          {filteredComponents.length === 0 && (
            <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-xl border-dashed">
              <p className="text-zinc-500 font-medium my-4">No components actively cataloged for {activeDept}.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredComponents.map((item) => (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors flex flex-col justify-between min-h-[220px]">
                 <div>
                    <h3 className="text-xl font-semibold mb-3">{item.name}</h3>
                    <p className="text-zinc-400 text-sm mb-6">{item.desc}</p>
                 </div>
                 <div className="flex justify-between items-center mt-auto">
                    <div>
                       <div className="text-xs text-zinc-300 font-bold">{item.department}</div>
                       <div className="text-xs text-zinc-500">{item.location}</div>
                    </div>
                    {item.available > 0 ? (
                      <button onClick={() => setSelectedItem(item)} className="px-5 py-2 bg-white text-black font-semibold rounded-lg text-sm transition-all hover:bg-zinc-200">
                        Select 
                      </button>
                    ) : (
                      <button className="px-5 py-2 bg-zinc-800 text-zinc-500 rounded-lg text-sm cursor-not-allowed border border-zinc-800">
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
            <h2 className="text-2xl font-bold mb-1">Reserve Component</h2>
            <p className="text-blue-400 font-medium text-sm mb-6 pb-4 border-b border-zinc-800">{selectedItem.name}</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Full Name</label>
                <input type="text" value={studentDetails.name} onChange={e => setStudentDetails({...studentDetails, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
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
                if(studentDetails.name && formData.date && formData.time && formData.days) {
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

    </div>
  );
}
