-- SQL Script to set up reservation status history tracking and migrate existing records

-- 1. Create the History Table
CREATE TABLE IF NOT EXISTS public.reservation_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(reservation_id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT
);

-- 2. Enable RLS and setup policies
ALTER TABLE public.reservation_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for History" ON public.reservation_status_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert for History" ON public.reservation_status_history FOR INSERT WITH CHECK (true);

-- 3. Update existing statuses to the new normalized string names
UPDATE public.reservations SET status = 'PENDING_APPROVAL' WHERE status IN ('PENDING', 'Pending HOD', 'PENDING_ADMIN');
UPDATE public.reservations SET status = 'READY_FOR_PICKUP' WHERE status IN ('Ready for Collection', 'PENDING_COLLECTION');
UPDATE public.reservations SET status = 'CHECKED_OUT' WHERE status IN ('Active', 'BORROWED');
UPDATE public.reservations SET status = 'RETURN_REQUESTED' WHERE status = 'PENDING_RETURN';
UPDATE public.reservations SET status = 'RETURNED' WHERE status = 'Returned';
UPDATE public.reservations SET status = 'CANCELLED' WHERE status = 'WITHDRAWN';
UPDATE public.reservations SET status = 'REJECTED' WHERE status = 'Rejected';

-- Note: Make sure to run this script in your Supabase SQL Editor to apply the database changes.
