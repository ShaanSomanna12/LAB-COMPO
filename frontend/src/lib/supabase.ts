import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_URL = 'https://qxtgwnifbzreithdzccn.supabase.co';
const ACTIVE_ANON_KEY = 'sb_publishable_aPZQ12HF6vZfLIq-hgCfog_kH0jyMxQ';

const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = (!rawKey || rawKey.startsWith('eyJ')) ? ACTIVE_ANON_KEY : rawKey;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);