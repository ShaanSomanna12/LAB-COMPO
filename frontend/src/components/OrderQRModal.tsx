'use client';

import { QRCodeSVG } from 'qrcode.react';

interface OrderQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  studentName: string;
  usn: string;
  componentName: string;
  quantity?: number;
}

export default function OrderQRModal({ isOpen, onClose, reservationId, studentName, usn, componentName, quantity = 1 }: OrderQRModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:bg-white print:p-0 print:block">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:h-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center print:hidden bg-gradient-to-r from-indigo-950/20 to-purple-950/20">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Print Order Label</h2>
            <p className="text-zinc-500 text-sm">Paste this on the component box</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-sm font-bold transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Label
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-8 flex flex-col items-center justify-center bg-white text-black print:p-4">
          <div className="border-4 border-black p-6 rounded-2xl w-full max-w-sm flex flex-col items-center gap-4 print:border-none print:p-0">
            <div className="text-center w-full border-b-2 border-black pb-3">
              <h2 className="text-2xl font-black uppercase tracking-widest">LAB CHECKOUT</h2>
              <p className="text-sm font-bold text-gray-600 font-mono mt-1">ID: {reservationId.substring(0, 8).toUpperCase()}</p>
            </div>
            
            <div className="bg-white p-2">
              <QRCodeSVG value={reservationId} size={180} level="H" />
            </div>

            <div className="w-full text-left mt-2 space-y-2 border-t-2 border-black pt-4">
              <div>
                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Component</div>
                <div className="font-bold text-lg leading-tight">{componentName} {quantity > 1 ? `(x${quantity})` : ''}</div>
              </div>
              
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Student</div>
                  <div className="font-bold">{studentName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">USN</div>
                  <div className="font-bold font-mono">{usn}</div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-2 w-full pt-2 border-t border-dashed border-gray-400 text-xs text-gray-500">
              Please return this label with the component.
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
