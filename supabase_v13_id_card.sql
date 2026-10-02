-- Run this in the Supabase SQL Editor
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_card_url TEXT;
