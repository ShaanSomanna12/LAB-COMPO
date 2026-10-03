-- =============================================================================
-- supabase_v16_transaction_safety.sql
-- =============================================================================
-- Fixes the Medium Severity issue: Database Transaction Safety on History Logging
-- Wraps the reservation update and history log insert into a single 
-- atomic PostgreSQL transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.checkout_reservation_safe(
  p_reservation_id UUID,
  p_borrowed_at TIMESTAMPTZ,
  p_due_date TIMESTAMPTZ,
  p_changed_by UUID,
  p_note TEXT,
  p_old_status VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation JSONB;
BEGIN
  -- 1. Update reservation
  UPDATE public.reservations
  SET 
    status = 'CHECKED_OUT',
    borrowed_at = p_borrowed_at,
    due_date = p_due_date
  WHERE reservation_id = p_reservation_id;

  -- 2. Insert history log atomically
  INSERT INTO public.reservation_status_history (
    reservation_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    p_reservation_id,
    p_old_status,
    'CHECKED_OUT',
    p_changed_by,
    p_note
  );

  -- 3. Return the updated reservation as JSON
  SELECT row_to_json(r) INTO v_reservation
  FROM public.reservations r
  WHERE reservation_id = p_reservation_id;

  RETURN v_reservation;
END;
$$;

COMMIT;
