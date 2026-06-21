-- Supabase Migration V6: Users Update Policy
-- Run this in your Supabase SQL Editor to enable profile updates

DROP POLICY IF EXISTS "Allow public update for Users" ON public.users;
CREATE POLICY "Allow public update for Users" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
