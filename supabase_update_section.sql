-- Supabase DB Alteration Script
-- Run this in your Supabase SQL Editor to add the required tracking columns

ALTER TABLE public.reservations
ADD COLUMN section VARCHAR(10) NOT NULL DEFAULT 'A',
ADD COLUMN student_department VARCHAR(50) NOT NULL DEFAULT 'CSE';

-- Note: The DEFAULT values are required because the table may already have existing records
-- and we are adding NOT NULL constraints. 
