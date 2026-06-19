-- supabase_v5_notices_time.sql
-- Migration to add Notices system and Collection Time override

-- 1. Create the notices table
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_dept varchar(50) NOT NULL,
  message text NOT NULL,
  type varchar(50) DEFAULT 'info', -- 'info', 'warning', 'alert'
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add collection_time to reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS collection_time varchar(50);
