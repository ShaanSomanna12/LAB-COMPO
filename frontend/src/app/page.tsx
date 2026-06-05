'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }
      
      localStorage.setItem('collegeName', collegeName.toUpperCase());
      localStorage.setItem('usn', usn.toUpperCase());
      
      if (data.user.roleId === 1) {
        router.push('/student');
      } else if (data.user.roleId === 4) {
        router.push('/hod');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError('Connection refused. Is the authentication node online?');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030303] text-zinc-100 overflow-x-hidden font-sans select-none">
      
      {/* Background Grid & Ambient Glow Orbs */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none z-0 animate-grid-drift"></div>
      
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full glow-glow-blue opacity-30 mix-blend-screen pointer-events-none blur-[100px] z-0 animate-float-slow-1"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[45vw] h-[45vw] rounded-full glow-glow-purple opacity-25 mix-blend-screen pointer-events-none blur-[120px] z-0 animate-float-slow-2"></div>
      <div className="absolute top-1/2 left-2/3 w-[30vw] h-[30vw] rounded-full glow-glow-cyan opacity-20 mix-blend-screen pointer-events-none blur-[90px] z-0 animate-pulse-slow"></div>

      {/* Holographic Scanline effect overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 opacity-[0.03]">
        <div className="w-full h-[5px] bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-scanline"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-8 md:py-16">
        
        {/* Main Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-gradient-to-r from-zinc-50 via-cyan-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-md">
            LAB CONNECT
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-2 font-mono tracking-wider max-w-md mx-auto uppercase">
            Interactive Access Node &amp; Component Portal
          </p>
        </div>

        {/* Credentials Form Container */}
        <div className="max-w-md mx-auto w-full">
          <div className="bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {/* Aesthetic Corner Crosshairs */}
            <div className="absolute top-3 left-3 text-zinc-700 font-mono text-[10px] select-none">+</div>
            <div className="absolute top-3 right-3 text-zinc-700 font-mono text-[10px] select-none">+</div>
            <div className="absolute bottom-3 left-3 text-zinc-700 font-mono text-[10px] select-none">+</div>
            <div className="absolute bottom-3 right-3 text-zinc-700 font-mono text-[10px] select-none">+</div>

            <div>
              {/* Form Status Banner */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
                <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">[ AUTHENTICATION_FLOW ]</span>
                <span className="text-[10px] font-mono text-zinc-400">NODE_ID // 01</span>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs mb-6 font-mono flex items-start gap-2 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <span className="font-bold text-rose-500 block uppercase mb-0.5">Access Denied //</span>
                    {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                
                {/* Institutional USN */}
                <div className="group relative">
                  <label className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 transition-colors ${activeField === 'usn' ? 'text-cyan-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      Institutional ID (USN)
                    </span>
                    <span className="text-[9px] text-zinc-600 font-normal">REQUIRED</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 4VV25CS001"
                      onFocus={() => setActiveField('usn')}
                      onBlur={() => setActiveField(null)}
                      className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-xl focus:outline-none text-zinc-100 placeholder-zinc-700 transition-all font-mono tracking-wider ${
                        activeField === 'usn' 
                          ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' 
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                      value={usn}
                      onChange={(e) => setUsn(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* College Name */}
                <div className="group relative">
                  <label className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 transition-colors ${activeField === 'college' ? 'text-indigo-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      College Authority Name
                    </span>
                    <span className="text-[9px] text-zinc-600 font-normal">REQUIRED</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. VIDYAVARDHAKA COLLEGE"
                      onFocus={() => setActiveField('college')}
                      onBlur={() => setActiveField(null)}
                      className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-xl focus:outline-none text-zinc-100 placeholder-zinc-700 transition-all font-mono tracking-wider uppercase ${
                        activeField === 'college' 
                          ? 'border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30' 
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="group relative">
                  <label className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 transition-colors ${activeField === 'password' ? 'text-cyan-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Security Password
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required
                      placeholder="••••••••"
                      onFocus={() => setActiveField('password')}
                      onBlur={() => setActiveField(null)}
                      className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-xl focus:outline-none text-zinc-100 placeholder-zinc-700 transition-all ${
                        activeField === 'password' 
                          ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' 
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none p-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="relative w-full py-3.5 px-4 bg-zinc-50 hover:bg-white text-zinc-950 font-bold rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-[0.98] mt-4 flex items-center justify-center overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  
                  {isLoading ? (
                    <span className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase">
                      <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      INITIALIZING SESSION...
                    </span>
                  ) : (
                    <span className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
                      Request Identity Grant
                      <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Cyber Utilities */}
            <div className="mt-8 pt-4 border-t border-zinc-900/60 flex flex-wrap gap-4 items-center justify-between text-[9px] font-mono text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <span>SECURED HANDSHAKE : TLS_1.3</span>
              </div>
              <div>
                <span>SYS_BUILD : V1.6.2</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
