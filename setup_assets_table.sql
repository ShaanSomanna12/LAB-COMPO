-- Migration Script for Asset Tracking

-- 1. Update Components Table to include tracking_type and value_tier
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='components' AND column_name='tracking_type') THEN
        ALTER TABLE public.components ADD COLUMN tracking_type VARCHAR(20) DEFAULT 'QUANTITY';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='components' AND column_name='value_tier') THEN
        ALTER TABLE public.components ADD COLUMN value_tier VARCHAR(20) DEFAULT 'MEDIUM';
    END IF;
END $$;

-- 1.5 Create Reservation Status History Table
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

-- 2. Create Assets Table
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

-- 3. Create Reservation Assets Mapping Table
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

-- 4. Create Asset History Table
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
