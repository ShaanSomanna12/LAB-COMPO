import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://qxtgwnifbzreithdzccn.supabase.co';

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.startsWith('eyJ')) {
    throw new Error('Supabase Anon Key is missing or using a revoked legacy JWT key (starts with eyJ). Please update your environment variables to use the new sb_publishable_* key.');
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.startsWith('eyJ')) {
    throw new Error('Supabase Service Role Key is missing or using a revoked legacy JWT key (starts with eyJ). Please update your environment variables to use the new sb_secret_* key.');
  }
  return key;
}

export function getSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
