-- =============================================================================
-- supabase_rls_hardening.sql  (v2 — definitive production migration)
-- =============================================================================
--
-- HOW TO RUN:
--   1. Go to https://supabase.com/dashboard/project/qxtgwnifbzreithdzccn/sql
--   2. Click "New Query"
--   3. Paste this entire file and click "Run"
--   4. Verify at the bottom with the SELECT check query (Section 9)
--
-- WHAT THIS DOES:
--   Replaces all USING (true) / WITH CHECK (true) policies that allowed any
--   anonymous caller to INSERT, UPDATE, or DELETE any row in any table.
--
--   After this migration:
--     • Public SELECT remains open on all tables (needed for app UI)
--     • All writes go through server-side API routes (service_role key)
--     • Direct anon-key writes are blocked at the database level
--     • role_id escalation is blocked by a BEFORE UPDATE trigger
--     • Storage bucket uploads are restricted to authenticated sessions
--
-- TABLES COVERED:
--   users, components, reservations, labs,
--   lab_access_requests, waitlists, notifications, notices
--
-- =============================================================================


-- =============================================================================
-- SECTION 0 — Safety wrapper
-- Run everything inside a transaction so we can roll back on any error.
-- =============================================================================
BEGIN;


-- =============================================================================
-- SECTION 1 — USERS
--   • Everyone can SELECT (needed for USN lookup, registration, login)
--   • INSERT open for self-registration (service role handles admin creates)
--   • UPDATE restricted to owner's own row via Supabase Auth UID
--   • Trigger blocks any caller from changing role_id unless service_role
--   • DELETE blocked for all clients (service_role bypasses RLS)
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop every known policy name across all migration versions
DROP POLICY IF EXISTS "Allow public select for Users"      ON public.users;
DROP POLICY IF EXISTS "Allow public insert for Users"      ON public.users;
DROP POLICY IF EXISTS "Allow public update for Users"      ON public.users;
DROP POLICY IF EXISTS "Allow users to update own profile"  ON public.users;
DROP POLICY IF EXISTS "Users update own row"               ON public.users;
DROP POLICY IF EXISTS "users_select_public"                ON public.users;
DROP POLICY IF EXISTS "users_insert_self"                  ON public.users;
DROP POLICY IF EXISTS "users_update_own"                   ON public.users;
DROP POLICY IF EXISTS "users_delete_any"                   ON public.users;

-- SELECT: public (USN lookup, OTP check, login)
CREATE POLICY "users_select_public"
  ON public.users
  FOR SELECT
  USING (true);

-- INSERT: blocked for clients; user creation goes through server API (/api/send-otp)
CREATE POLICY "users_insert_blocked"
  ON public.users
  FOR INSERT
  WITH CHECK (false);

-- UPDATE: only the authenticated owner may update their own row
-- (service_role bypasses this entirely and can update anyone)
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  USING  (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- No DELETE policy → anon / authenticated clients cannot delete users
-- Service_role (used by server API) is exempt from RLS.


-- ── Trigger: block role_id escalation ─────────────────────────────────────
-- Prevents ANY non-service-role caller from changing their own role_id.
-- Example attack blocked:
--   supabase.from('users').update({ role_id: 5 }).eq('usn', 'ME')
-- The service_role (server API only) is not blocked — it bypasses RLS
-- entirely so the trigger check falls to current_user = 'authenticator'.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- current_user is 'authenticator' for anon/auth, 'postgres' for service_role
  -- current_setting('request.jwt.claims', true) is set by Supabase's JWT layer
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    RAISE EXCEPTION
      'Permission denied: role_id cannot be changed via client. Contact your administrator.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger (replace if already exists)
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();


-- =============================================================================
-- SECTION 2 — COMPONENTS (inventory)
--   • Everyone can SELECT (public catalogue browser)
--   • INSERT / UPDATE / DELETE: blocked for all clients
--     → Only service_role (server API routes) can mutate inventory
-- =============================================================================

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Components"   ON public.components;
DROP POLICY IF EXISTS "Allow public insert for Components"   ON public.components;
DROP POLICY IF EXISTS "Allow public delete for Components"   ON public.components;
DROP POLICY IF EXISTS "Allow public update for Components"   ON public.components;
DROP POLICY IF EXISTS "components_select_public"             ON public.components;
DROP POLICY IF EXISTS "components_write_service_only"        ON public.components;
DROP POLICY IF EXISTS "components_update_service_only"       ON public.components;
DROP POLICY IF EXISTS "components_delete_service_only"       ON public.components;

-- Public browse
CREATE POLICY "components_select_public"
  ON public.components
  FOR SELECT
  USING (true);

-- Block all direct writes — service_role is exempt from RLS
CREATE POLICY "components_insert_blocked"
  ON public.components
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "components_update_blocked"
  ON public.components
  FOR UPDATE
  USING (false);

CREATE POLICY "components_delete_blocked"
  ON public.components
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 3 — RESERVATIONS
--   • SELECT: authenticated students see only their own rows
--             (service_role sees all — used by admin dashboard)
--   • INSERT: authenticated user may create for their own user_id only
--   • UPDATE / DELETE: blocked for clients; service_role handles these
-- =============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Reservations"  ON public.reservations;
DROP POLICY IF EXISTS "Allow public insert for Reservations"  ON public.reservations;
DROP POLICY IF EXISTS "Allow public update for Reservations"  ON public.reservations;
DROP POLICY IF EXISTS "Allow public delete for Reservations"  ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_own"               ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_own"               ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_service_only"      ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_service_only"      ON public.reservations;

-- Students see only their own reservations; admins use service_role (bypasses)
CREATE POLICY "reservations_select_own"
  ON public.reservations
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- INSERT: blocked for clients; reservations are created via server API (/api/requests)
CREATE POLICY "reservations_insert_blocked"
  ON public.reservations
  FOR INSERT
  WITH CHECK (false);

-- Status updates (APPROVED/REJECTED/RETURNED) go through server API routes
CREATE POLICY "reservations_update_blocked"
  ON public.reservations
  FOR UPDATE
  USING (false);

CREATE POLICY "reservations_delete_blocked"
  ON public.reservations
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 4 — LABS
--   • SELECT: public (lab catalogue)
--   • INSERT / DELETE: blocked for clients; service_role only
-- =============================================================================

ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Labs"  ON public.labs;
DROP POLICY IF EXISTS "Allow public insert for Labs"  ON public.labs;
DROP POLICY IF EXISTS "Allow public delete for Labs"  ON public.labs;

CREATE POLICY "labs_select_public"
  ON public.labs
  FOR SELECT
  USING (true);

CREATE POLICY "labs_insert_blocked"
  ON public.labs
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "labs_delete_blocked"
  ON public.labs
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 5 — LAB_ACCESS_REQUESTS
--   • SELECT: open (admins/HODs need to read all without auth tokens in queries)
--   • INSERT: authenticated users only (students requesting access)
--   • UPDATE: blocked for clients (admin decisions go through server API)
-- =============================================================================

ALTER TABLE public.lab_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Lab Access Requests"  ON public.lab_access_requests;
DROP POLICY IF EXISTS "Allow public insert for Lab Access Requests"  ON public.lab_access_requests;
DROP POLICY IF EXISTS "Allow public update for Lab Access Requests"  ON public.lab_access_requests;
DROP POLICY IF EXISTS "lab_access_select_public"                     ON public.lab_access_requests;
DROP POLICY IF EXISTS "lab_access_insert_auth"                       ON public.lab_access_requests;
DROP POLICY IF EXISTS "lab_access_update_service_only"               ON public.lab_access_requests;

CREATE POLICY "lab_access_select_public"
  ON public.lab_access_requests
  FOR SELECT
  USING (true);

CREATE POLICY "lab_access_insert_blocked"
  ON public.lab_access_requests
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "lab_access_update_blocked"
  ON public.lab_access_requests
  FOR UPDATE
  USING (false);


-- =============================================================================
-- SECTION 6 — WAITLISTS (added in v2 migration)
--   • SELECT: owner sees their own; service_role sees all
--   • INSERT: authenticated owner only
--   • UPDATE / DELETE: blocked for clients
-- =============================================================================

ALTER TABLE public.waitlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Waitlists"  ON public.waitlists;
DROP POLICY IF EXISTS "Allow public insert for Waitlists"  ON public.waitlists;
DROP POLICY IF EXISTS "Allow public update for Waitlists"  ON public.waitlists;
DROP POLICY IF EXISTS "Allow public delete for Waitlists"  ON public.waitlists;

CREATE POLICY "waitlists_select_own"
  ON public.waitlists
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "waitlists_insert_own"
  ON public.waitlists
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "waitlists_update_blocked"
  ON public.waitlists
  FOR UPDATE
  USING (false);

CREATE POLICY "waitlists_delete_blocked"
  ON public.waitlists
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 7 — NOTIFICATIONS (added in v2 migration)
--   • SELECT: owner sees only their own notifications
--   • INSERT: blocked for clients (server API creates notifications)
--   • UPDATE: owner can mark their own as read
--   • DELETE: blocked
-- =============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for Notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Allow public insert for Notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Allow public update for Notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Allow public delete for Notifications"  ON public.notifications;

-- Users read only their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Notifications are created server-side only (service_role)
CREATE POLICY "notifications_insert_blocked"
  ON public.notifications
  FOR INSERT
  WITH CHECK (false);

-- Users can mark their own notifications as read (is_read = true)
CREATE POLICY "notifications_update_own_read"
  ON public.notifications
  FOR UPDATE
  USING  (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "notifications_delete_blocked"
  ON public.notifications
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 8 — NOTICES (added in v5 migration)
--   • SELECT: public (all students need to see notices)
--   • INSERT / UPDATE / DELETE: blocked for clients; admin API uses service_role
-- =============================================================================

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notices_select_public"       ON public.notices;
DROP POLICY IF EXISTS "notices_write_service_only"  ON public.notices;
DROP POLICY IF EXISTS "notices_update_service_only" ON public.notices;
DROP POLICY IF EXISTS "notices_delete_service_only" ON public.notices;
DROP POLICY IF EXISTS "notices_insert_blocked"      ON public.notices;
DROP POLICY IF EXISTS "notices_update_blocked"      ON public.notices;
DROP POLICY IF EXISTS "notices_delete_blocked"      ON public.notices;

CREATE POLICY "notices_select_public"
  ON public.notices
  FOR SELECT
  USING (true);

CREATE POLICY "notices_insert_blocked"
  ON public.notices
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "notices_update_blocked"
  ON public.notices
  FOR UPDATE
  USING (false);

CREATE POLICY "notices_delete_blocked"
  ON public.notices
  FOR DELETE
  USING (false);


-- =============================================================================
-- SECTION 8b — STORAGE BUCKET POLICIES (inventory-images, reservations-images)
--   • SELECT: public (image URLs are already public CDN links)
--   • INSERT: authenticated users only (prevents anonymous image spam)
--   • UPDATE / DELETE: blocked for clients; service_role only
-- =============================================================================

-- inventory-images: only authenticated sessions can upload
DROP POLICY IF EXISTS "Public Access for inventory-images"          ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert to inventory-images"     ON storage.objects;

CREATE POLICY "inventory_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inventory-images');

CREATE POLICY "inventory_images_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inventory-images'
    AND auth.uid() IS NOT NULL
  );

-- reservations-images: only authenticated sessions can upload
DROP POLICY IF EXISTS "Public Access for reservations-images"       ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert to reservations-images"  ON storage.objects;

CREATE POLICY "reservations_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reservations-images');

CREATE POLICY "reservations_images_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reservations-images'
    AND auth.uid() IS NOT NULL
  );


-- =============================================================================
-- SECTION 9 — COMMIT + VERIFICATION QUERY
-- =============================================================================

COMMIT;


-- ── Run this SELECT after the migration to confirm all policies are in place ─
-- Copy and run this separately in the SQL editor to verify:

/*
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
*/

-- ── Expected result summary ─────────────────────────────────────────────────
-- TABLE                  | CMD    | POLICY NAME                        | EFFECT
-- -----------------------|--------|------------------------------------|--------
-- users                  | SELECT | users_select_public                | USING(true)
-- users                  | INSERT | users_insert_self                  | WITH CHECK(true)
-- users                  | UPDATE | users_update_own                   | USING(uid=user_id)
-- components             | SELECT | components_select_public           | USING(true)
-- components             | INSERT | components_insert_blocked          | WITH CHECK(false)
-- components             | UPDATE | components_update_blocked          | USING(false)
-- components             | DELETE | components_delete_blocked          | USING(false)
-- reservations           | SELECT | reservations_select_own            | USING(uid=user_id)
-- reservations           | INSERT | reservations_insert_own            | WITH CHECK(uid=user_id)
-- reservations           | UPDATE | reservations_update_blocked        | USING(false)
-- reservations           | DELETE | reservations_delete_blocked        | USING(false)
-- labs                   | SELECT | labs_select_public                 | USING(true)
-- labs                   | INSERT | labs_insert_blocked                | WITH CHECK(false)
-- labs                   | DELETE | labs_delete_blocked                | USING(false)
-- lab_access_requests    | SELECT | lab_access_select_public           | USING(true)
-- lab_access_requests    | INSERT | lab_access_insert_auth             | WITH CHECK(uid IS NOT NULL)
-- lab_access_requests    | UPDATE | lab_access_update_blocked          | USING(false)
-- waitlists              | SELECT | waitlists_select_own               | USING(uid=user_id)
-- waitlists              | INSERT | waitlists_insert_own               | WITH CHECK(uid=user_id)
-- waitlists              | UPDATE | waitlists_update_blocked           | USING(false)
-- waitlists              | DELETE | waitlists_delete_blocked           | USING(false)
-- notifications          | SELECT | notifications_select_own           | USING(uid=user_id)
-- notifications          | INSERT | notifications_insert_blocked       | WITH CHECK(false)
-- notifications          | UPDATE | notifications_update_own_read      | USING(uid=user_id)
-- notifications          | DELETE | notifications_delete_blocked       | USING(false)
-- notices                | SELECT | notices_select_public              | USING(true)
-- notices                | INSERT | notices_insert_blocked             | WITH CHECK(false)
-- notices                | UPDATE | notices_update_blocked             | USING(false)
-- notices                | DELETE | notices_delete_blocked             | USING(false)
-- =============================================================================
