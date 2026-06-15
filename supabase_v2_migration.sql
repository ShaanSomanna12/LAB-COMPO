-- Supabase Migration V2: Advanced Lab Features
-- Run this in your Supabase SQL Editor

-- 1. Modify Reservations Table for Cart, Projects, and Condition Reporting
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS project_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_condition VARCHAR(50) DEFAULT 'WORKING',
ADD COLUMN IF NOT EXISTS is_damaged BOOLEAN DEFAULT FALSE;

-- 2. Modify Components Table for Smart Approvals
ALTER TABLE public.components
ADD COLUMN IF NOT EXISTS value_tier VARCHAR(20) DEFAULT 'LOW'; 
-- 'LOW' tier gets auto-approved, 'HIGH' tier requires admin approval

-- 3. Create Waitlists Table
CREATE TABLE IF NOT EXISTS public.waitlists (
    waitlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.components(component_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'WAITING', -- WAITING, NOTIFIED, FULFILLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Waitlists
ALTER TABLE public.waitlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Waitlists" ON public.waitlists FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Waitlists" ON public.waitlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Waitlists" ON public.waitlists FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for Waitlists" ON public.waitlists FOR DELETE USING (true);

-- 4. Create Notifications Table (In-App Alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, SUCCESS, WARNING, ERROR
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for Notifications" ON public.notifications FOR DELETE USING (true);
