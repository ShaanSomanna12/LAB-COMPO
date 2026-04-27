'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
        return;
      }
      
      localStorage.setItem('collegeName', collegeName.toUpperCase());
      localStorage.setItem('usn', usn.toUpperCase());
      
      if (data.user.roleId === 1) {
        router.push('/student');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError('Connection failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800">
        <h1 className="text-3xl font-bold text-center mb-2 tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">LAB CONNECT</h1>
        <p className="text-xs text-zinc-400 text-center mb-8">Component Management Platform</p>
        
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 tracking-wide uppercase">Institutional USN</label>
            <input 
              type="text" 
              required
              placeholder="e.g. 4VV25CS001"
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-zinc-600 transition-all font-mono"
              value={usn}
              onChange={(e) => setUsn(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 tracking-wide uppercase">College Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. VIDYAVARDHAKA COLLEGE"
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-zinc-600 transition-all font-mono uppercase"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 tracking-wide uppercase">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors mt-2"
          >
            Authenticate Identity
          </button>
        </form>
      </div>
    </div>
  );
}
