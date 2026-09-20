ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS extension_requested BOOLEAN DEFAULT false;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS extension_reason TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS extension_days INTEGER;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS extension_status VARCHAR(50);
