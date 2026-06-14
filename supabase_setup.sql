-- Supabase DDL Setup Script for LAB CONNECT
-- Copy and paste this script into the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql) to set up all tables.

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    before_img_url VARCHAR(1000),
    after_img_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/update policy for Reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Reservations" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Reservations" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Reservations" ON public.reservations FOR UPDATE USING (true);

-- 4. Create Labs Table
CREATE TABLE IF NOT EXISTS public.labs (
    lab_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    room_number VARCHAR(100),
    department VARCHAR(100),
    description TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/delete policy for Labs
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Labs" ON public.labs FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Labs" ON public.labs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete for Labs" ON public.labs FOR DELETE USING (true);

-- 5. Create Lab Access Requests Table
CREATE TABLE IF NOT EXISTS public.lab_access_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name VARCHAR(255) NOT NULL,
    usn VARCHAR(50) NOT NULL,
    lab_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    access_date DATE NOT NULL,
    time_slot VARCHAR(100) NOT NULL,
    purpose TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    admin_remarks TEXT,
    hod_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/update policy for Lab Access Requests
ALTER TABLE public.lab_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Lab Access Requests" ON public.lab_access_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Lab Access Requests" ON public.lab_access_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Lab Access Requests" ON public.lab_access_requests FOR UPDATE USING (true);
