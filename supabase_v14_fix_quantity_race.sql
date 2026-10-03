-- =============================================================================
-- supabase_v14_fix_quantity_race.sql
-- =============================================================================
-- This script fixes the Critical Race Condition found during the audit.
-- It ensures that available_quantity can NEVER drop below 0 by enforcing
-- a database-level constraint, and provides atomic increment/decrement RPCs.

BEGIN;

-- 1. Add CHECK constraint to ensure available_quantity cannot go below 0
-- This is the ultimate defense against race conditions. PostgreSQL will 
-- reject any UPDATE that violates this.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_available_quantity_non_negative'
    ) THEN
        ALTER TABLE public.components 
        ADD CONSTRAINT check_available_quantity_non_negative 
        CHECK (available_quantity >= 0);
    END IF;
END
$$;

-- 2. Drop existing and Create atomic decrement RPC
DROP FUNCTION IF EXISTS public.decrement_inventory(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.decrement_inventory(p_component_id UUID, p_qty INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.components
    SET available_quantity = available_quantity - p_qty
    WHERE component_id = p_component_id 
      AND available_quantity >= p_qty; -- Double check before constraint

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- Return true if successful, false if insufficient stock
    RETURN updated_rows > 0;
END;
$$;

-- 3. Drop existing and Create atomic increment RPC
DROP FUNCTION IF EXISTS public.increment_inventory(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.increment_inventory(p_component_id UUID, p_qty INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.components
    SET available_quantity = available_quantity + p_qty
    WHERE component_id = p_component_id;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$;

COMMIT;
