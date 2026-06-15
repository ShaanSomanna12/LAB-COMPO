-- Supabase Migration V3: Profile Enhancement
-- Run this in your Supabase SQL Editor

-- Modify Users Table for advanced profile tracking
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS section VARCHAR(10),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS branch VARCHAR(100);

-- Make sure RLS allows users to update their own profiles
-- (Assuming an update policy already exists, if not, create one:
-- CREATE POLICY "Allow users to update own profile" ON public.users FOR UPDATE USING (auth.uid() = user_id);
-- )
