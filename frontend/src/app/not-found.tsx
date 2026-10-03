import Link from 'next/link';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function NotFound() {
  return (
    <div className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6 selection:bg-blue-200`}>
      <div className="max-w-md w-full bg-white border border-slate-200 p-10 rounded-3xl shadow-xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 border border-blue-100 shadow-sm relative">
          <div className="text-3xl font-black tracking-tighter">404</div>
          {/* Orbiting dot */}
          <div className="absolute w-2 h-2 bg-blue-400 rounded-full animate-ping top-0 right-0"></div>
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Page Not Found</h1>
        <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
          The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
        </p>
        
        <Link 
          href="/" 
          className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
