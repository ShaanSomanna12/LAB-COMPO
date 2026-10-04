import { createBrowserClient } from '@supabase/ssr';

// --- Supabase Dev Overlay Fix ---
// Next.js 14+ catches console.error and shows a full-screen overlay.
// gotrue-js logs an AuthApiError to console when a refresh token is missing/expired.
// We intercept and suppress this specific error to prevent the annoying dev overlay,
// since it's an expected flow when a session expires.
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('AuthApiError') || args[0].includes('Refresh Token Not Found'))
    ) {
      return;
    }
    if (args[0] && args[0].name === 'AuthApiError' && args[0].message.includes('Refresh Token Not Found')) {
      // Automatically clear the corrupted Supabase auth tokens from local storage/cookies
      document.cookie.split(";").forEach((c) => {
        if (c.trim().startsWith("sb-")) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        }
      });
      // Clear localStorage items starting with sb- (iterate backwards since we are mutating it)
      if (typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        }
      }
      return;
    }
    originalConsoleError(...args);
  };
}
// ---------------------------------

const FALLBACK_URL = 'https://qxtgwnifbzreithdzccn.supabase.co';
const ACTIVE_ANON_KEY = 'sb_publishable_aPZQ12HF6vZfLIq-hgCfog_kH0jyMxQ';

const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = (!rawKey || rawKey.startsWith('eyJ')) ? ACTIVE_ANON_KEY : rawKey;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);