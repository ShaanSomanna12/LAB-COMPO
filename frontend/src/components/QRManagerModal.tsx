'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

interface QRManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId: string;
  componentName: string;
}

interface ComponentInstance {
  instance_id: string;
  serial_number: string;
  status: string;
}

export default function QRManagerModal({ isOpen, onClose, componentId, componentName }: QRManagerModalProps) {
  const [instances, setInstances] = useState<ComponentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && componentId) {
      fetchInstances();
    }
  }, [isOpen, componentId]);

  const fetchInstances = async () => {
    setIsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('component_instances')
        .select('*')
        .eq('component_id', componentId)
        .order('created_at', { ascending: true });
        
      if (err) throw err;
      setInstances(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewSerial = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const serialNumber = `${componentName.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const { error: err } = await supabase
        .from('component_instances')
        .insert([
          { component_id: componentId, serial_number: serialNumber }
        ]);

      if (err) throw err;
      await fetchInstances();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteInstance = async (id: string) => {
    try {
      await supabase.from('component_instances').delete().eq('instance_id', id);
      await fetchInstances();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:bg-white print:p-0 print:block">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:h-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center print:hidden bg-gradient-to-r from-indigo-950/20 to-purple-950/20">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Manage QR Codes</h2>
            <p className="text-zinc-500 text-sm">Component: <span className="text-zinc-300 font-mono">{componentName}</span></p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={instances.length === 0}
              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Labels
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar print:p-0 print:overflow-visible">
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm print:hidden">
              {error}
            </div>
          )}
          
          <div className="mb-6 print:hidden">
            <button
              onClick={generateNewSerial}
              disabled={isGenerating}
              className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-sm transition-all border-dashed"
            >
              {isGenerating ? 'Generating...' : '+ Generate New Serial & QR Code'}
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-zinc-500 print:hidden">Loading existing serials...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 print:hidden">No QR codes generated yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
              {instances.map(inst => (
                <div key={inst.instance_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col items-center gap-4 relative group print:border-black print:bg-white print:p-4">
                  <button 
                    onClick={() => deleteInstance(inst.instance_id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-rose-500 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity print:hidden flex items-center justify-center"
                    title="Delete Instance"
                  >
                    &times;
                  </button>
                  <div className="bg-white p-3 rounded-xl print:p-0">
                    <QRCodeSVG value={inst.serial_number} size={140} level="H" />
                  </div>
                  <div className="text-center w-full">
                    <div className="font-mono text-cyan-400 font-bold text-lg tracking-wider print:text-black">
                      {inst.serial_number}
                    </div>
                    <div className="text-zinc-500 text-[10px] uppercase font-semibold mt-1 print:text-gray-600">
                      {componentName}
                    </div>
                    <div className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded inline-block uppercase tracking-wider print:hidden ${
                      inst.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400' : 
                      inst.status === 'IN_USE' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {inst.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
