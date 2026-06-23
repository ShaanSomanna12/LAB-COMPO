-- Supabase Migration V7: Users RLS Policy Fix
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public select for Users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert for Users" ON public.users;
DROP POLICY IF EXISTS "Allow public update for Users" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.users;

-- 1. SELECT: Allow public read access to users (needed for check/verify screens)
CREATE POLICY "Allow public select for Users" 
ON public.users 
FOR SELECT 
USING (true);

-- 2. INSERT: Allow public inserts (needed for registration step 1)
CREATE POLICY "Allow public insert for Users" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

-- 3. UPDATE: Allow public updates (needed for upsert conflict resolution and OTP updates)
CREATE POLICY "Allow public update for Users" 
ON public.users 
FOR UPDATE 
USING (true) 
WITH CHECK (true);
