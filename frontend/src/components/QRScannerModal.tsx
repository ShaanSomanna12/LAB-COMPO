'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false, loading: () => <div className="p-8 text-center text-zinc-500 animate-pulse bg-zinc-900 rounded-xl border border-zinc-800">Initializing Camera...</div> }
);

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedComponentName: string;
  onScanSuccess: (serialNumber: string) => void;
}

export default function QRScannerModal({ isOpen, onClose, expectedComponentName, onScanSuccess }: QRScannerModalProps) {
  const [error, setError] = useState('');
  
  if (!isOpen) return null;

  const handleScan = (result: any) => {
    if (result && result.length > 0) {
      const scannedValue = result[0].rawValue;
      // Expecting format like: ARD-1234
      const prefix = expectedComponentName.substring(0, 3).toUpperCase();
      if (scannedValue.startsWith(prefix)) {
        onScanSuccess(scannedValue);
      } else {
        setError(`Invalid QR Code for ${expectedComponentName}. Scanned: ${scannedValue}`);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-cyan-950/20 to-blue-950/20">
          <div>
            <h2 className="text-lg font-bold text-white mb-0.5 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              Scan Component Label
            </h2>
            <p className="text-zinc-500 text-xs">Verify: <span className="text-zinc-300 font-mono">{expectedComponentName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-6">
          <div className="rounded-xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-black relative">
            <Scanner
              onScan={handleScan}
              formats={['qr_code']}
              components={{
                finder: false
              }}
            />
            {/* Scanner Overlay UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-48 h-48 border-2 border-cyan-400/50 rounded-lg shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                {/* Scanner corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br"></div>
                
                {/* Laser line animation */}
                <div className="w-full h-0.5 bg-cyan-400/80 shadow-[0_0_8px_2px_rgba(34,211,238,0.4)] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
          </div>
          
          <div className="mt-5 text-center">
            {error ? (
              <div className="text-rose-400 text-sm font-semibold bg-rose-500/10 py-2 rounded-lg animate-pulse">{error}</div>
            ) : (
              <p className="text-zinc-500 text-sm">Align the QR code sticker within the frame to automatically verify.</p>
            )}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { top: 100%; }
        }
      `}} />
    </div>
  );
}
