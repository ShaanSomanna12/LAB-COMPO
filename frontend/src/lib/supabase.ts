import { createClient } from '@supabase/supabase-js'

// Hardcoding the keys here to bypass the Next.js environment file glitch
const supabaseUrl = "https://qxtgwnifbzreithdzccn.sb_publishable_aPZQ12HF6vZfLIq-hgCfog_kH0jyMxQsupabase.co"
const supabaseKey = "sb_publishable_aPZQ12HF6vZFLIq-hgCfog_kH0jyMxQ"

export const supabase = createClient(supabaseUrl, supabaseKey)