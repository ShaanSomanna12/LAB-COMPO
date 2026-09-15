-- =============================================================================
-- supabase_v8_student_rls_fix.sql
-- =============================================================================
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO APPLY THE SECURITY FIXES
--
-- WHAT THIS DOES:
--   Blocks direct client-side INSERTS on the following tables because they 
--   must go through your Next.js API logic (which handles trust scores and verification):
--   - public.users
--   - public.reservations
--   - public.lab_access_requests

BEGIN;

-- 1. USERS: Block anon INSERTS
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
DROP POLICY IF EXISTS "users_insert_blocked" ON public.users;

CREATE POLICY "users_insert_blocked"
  ON public.users
  FOR INSERT
  WITH CHECK (false);


-- 2. RESERVATIONS: Block client INSERTS (prevents auto-approvals)
DROP POLICY IF EXISTS "reservations_insert_own" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_blocked" ON public.reservations;

CREATE POLICY "reservations_insert_blocked"
  ON public.reservations
  FOR INSERT
  WITH CHECK (false);


-- 3. LAB_ACCESS_REQUESTS: Block client INSERTS
DROP POLICY IF EXISTS "lab_access_insert_auth" ON public.lab_access_requests;
DROP POLICY IF EXISTS "lab_access_insert_blocked" ON public.lab_access_requests;

CREATE POLICY "lab_access_insert_blocked"
  ON public.lab_access_requests
  FOR INSERT
  WITH CHECK (false);

COMMIT;
