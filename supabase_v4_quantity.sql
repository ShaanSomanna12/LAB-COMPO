-- Supabase Migration V4: Add quantity to reservations
-- Run this in your Supabase SQL Editor

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
