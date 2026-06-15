-- Supabase Migration V4: Trust Score & Dynamic Limits
-- Run this in your Supabase SQL Editor

-- 1. Add trust_score to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100;
