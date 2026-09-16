-- Migration Script: QR Serial Tracking

-- 1. Add assigned_serial_numbers to reservations (requests) table
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS assigned_serial_numbers JSONB DEFAULT '[]'::jsonb;

-- 2. Create component_instances table for serial tracking
CREATE TABLE IF NOT EXISTS public.component_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES public.components(component_id) ON DELETE CASCADE,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, IN_USE, MAINTENANCE
    current_reservation_id UUID REFERENCES public.reservations(reservation_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and insert/select/update/delete policy for Component Instances
ALTER TABLE public.component_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for Component Instances" ON public.component_instances FOR SELECT USING (true);
CREATE POLICY "Allow public insert for Component Instances" ON public.component_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for Component Instances" ON public.component_instances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for Component Instances" ON public.component_instances FOR DELETE USING (true);
