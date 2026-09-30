import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('=').map(part => part.trim())));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const run = async () => {
  const { data, error } = await supabase.rpc('query', { query: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_url TEXT;' });
  console.log('Result:', data, error);
};
run();
