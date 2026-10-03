'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Global application error caught by boundary:', error);
  }, [error]);

  return (
    <div className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6 selection:bg-blue-200`}>
      <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-3xl shadow-xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 border border-red-100 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Something went wrong!</h1>
        <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
          An unexpected error occurred while loading this page. Our team has been notified.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
          
          <Link href="/" className="flex-1 px-5 py-2.5 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
