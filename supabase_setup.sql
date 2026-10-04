-- Supabase DDL Setup Script for LAB CONNECT
-- Copy and paste this script into the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql) to set up all tables.

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Create Storage Buckets (if they do not exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('id_cards', 'id_cards', true, 104857600),
  ('signatures', 'signatures', true, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usn VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL DEFAULT 1, -- 1:Student, 2:Faculty, 3:LabAdmin, 4:HOD, 5:SuperAdmin
    password_hash VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10),
    otp_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select policy for Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Users" ON public.users FOR INSERT WITH CHECK (true);

-- 2. Create Components (Inventory Items) Table
CREATE TABLE IF NOT EXISTS public.components (
    component_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    lab_location VARCHAR(255) NOT NULL,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    base_condition TEXT,
    photo_url TEXT, -- Dynamic Image Column
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/delete policy for Components
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Components" ON public.components FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Components" ON public.components FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete for Components" ON public.components FOR DELETE USING (true);

-- 3. Create Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.components(component_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    section VARCHAR(10) NOT NULL DEFAULT 'A',
    student_department VARCHAR(50) NOT NULL DEFAULT 'CSE',
    project_title VARCHAR(255),
    due_date TIMESTAMP WITH TIME ZONE,
    quantity INTEGER DEFAULT 1,
    collection_time VARCHAR(100),
    is_damaged BOOLEAN DEFAULT false,
    return_condition TEXT,
    returned_at TIMESTAMP WITH TIME ZONE,
    borrowed_at TIMESTAMP WITH TIME ZONE,
    before_img_url VARCHAR(1000),
    after_img_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/update policy for Reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Reservations" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Reservations" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Reservations" ON public.reservations FOR UPDATE USING (true);

-- 6. Create Reservation Status History Table
CREATE TABLE IF NOT EXISTS public.reservation_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(reservation_id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT
);

-- Enable RLS and insert/select policy for History
ALTER TABLE public.reservation_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for History" ON public.reservation_status_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert for History" ON public.reservation_status_history FOR INSERT WITH CHECK (true);

-- 7. Create Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    component_id UUID NOT NULL REFERENCES public.components(component_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    condition TEXT DEFAULT 'GOOD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Assets" ON public.assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Assets" ON public.assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for Assets" ON public.assets FOR DELETE USING (true);

-- 8. Create Reservation Assets Mapping Table
CREATE TABLE IF NOT EXISTS public.reservation_assets (
    reservation_id UUID NOT NULL REFERENCES public.reservations(reservation_id) ON DELETE CASCADE,
    asset_id VARCHAR(50) NOT NULL REFERENCES public.assets(asset_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    returned_at TIMESTAMP WITH TIME ZONE,
    return_condition TEXT,
    PRIMARY KEY (reservation_id, asset_id)
);

-- Enable RLS for Reservation Assets
ALTER TABLE public.reservation_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Reservation Assets" ON public.reservation_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Reservation Assets" ON public.reservation_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Reservation Assets" ON public.reservation_assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for Reservation Assets" ON public.reservation_assets FOR DELETE USING (true);

-- 9. Create Asset History Table
CREATE TABLE IF NOT EXISTS public.asset_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id VARCHAR(50) NOT NULL REFERENCES public.assets(asset_id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(reservation_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    note TEXT,
    changed_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Asset History
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Asset History" ON public.asset_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Asset History" ON public.asset_history FOR INSERT WITH CHECK (true);

-- Extension Requests Feature
ALTER TABLE public.reservations
ADD COLUMN extension_requested BOOLEAN DEFAULT false,
ADD COLUMN extension_reason TEXT,
ADD COLUMN extension_days INTEGER,
ADD COLUMN extension_status VARCHAR(50);

-- Support for multi-field checkout form
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS student_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS usn VARCHAR(50),
ADD COLUMN IF NOT EXISTS branch VARCHAR(50),
ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
ADD COLUMN IF NOT EXISTS target_department VARCHAR(100),
ADD COLUMN IF NOT EXISTS request_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS id_card_url TEXT,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS project_description TEXT,
ADD COLUMN IF NOT EXISTS project_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS hackathon_date DATE,
ADD COLUMN IF NOT EXISTS hackathon_venue VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_team_project BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS team_members JSONB;



ALTER TABLE public.components ADD COLUMN IF NOT EXISTS value_tier VARCHAR(50) DEFAULT 'STANDARD';
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS assigned_serial_numbers TEXT[], ADD COLUMN IF NOT EXISTS request_mode VARCHAR(50) DEFAULT 'NORMAL';

 - -   4 .   S t o r a g e   P o l i c i e s   f o r   U p l o a d s 
 C R E A T E   P O L I C Y   \  
 A l l o w  
 p u b l i c  
 i n s e r t  
 t o  
 i d _ c a r d s  
 b u c k e t \   O N   s t o r a g e . o b j e c t s   F O R   I N S E R T   W I T H   C H E C K   ( b u c k e t _ i d   =   ' i d _ c a r d s ' ) ; 
 C R E A T E   P O L I C Y   \ A l l o w  
 p u b l i c  
 s e l e c t  
 f r o m  
 i d _ c a r d s  
 b u c k e t \   O N   s t o r a g e . o b j e c t s   F O R   S E L E C T   U S I N G   ( b u c k e t _ i d   =   ' i d _ c a r d s ' ) ; 
 C R E A T E   P O L I C Y   \ A l l o w  
 p u b l i c  
 i n s e r t  
 t o  
 s i g n a t u r e s  
 b u c k e t \   O N   s t o r a g e . o b j e c t s   F O R   I N S E R T   W I T H   C H E C K   ( b u c k e t _ i d   =   ' s i g n a t u r e s ' ) ; 
 C R E A T E   P O L I C Y   \ A l l o w  
 p u b l i c  
 s e l e c t  
 f r o m  
 s i g n a t u r e s  
 b u c k e t \   O N   s t o r a g e . o b j e c t s   F O R   S E L E C T   U S I N G   ( b u c k e t _ i d   =   ' s i g n a t u r e s ' ) ; 
  
 
