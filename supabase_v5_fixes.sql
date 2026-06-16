-- 1. Add missing DELETE policy for reservations
DROP POLICY IF EXISTS "Allow public delete for Reservations" ON public.reservations;
CREATE POLICY "Allow public delete for Reservations" ON public.reservations FOR DELETE USING (true);

-- 2. Make reservations-images bucket public
UPDATE storage.buckets SET public = true WHERE id = 'reservations-images';

-- 3. Make inventory-images bucket public (just in case)
UPDATE storage.buckets SET public = true WHERE id = 'inventory-images';

-- 4. Ensure select policies exist for these buckets
DROP POLICY IF EXISTS "Public Access for reservations-images" ON storage.objects;
CREATE POLICY "Public Access for reservations-images" ON storage.objects FOR SELECT USING (bucket_id = 'reservations-images');

DROP POLICY IF EXISTS "Public Access for inventory-images" ON storage.objects;
CREATE POLICY "Public Access for inventory-images" ON storage.objects FOR SELECT USING (bucket_id = 'inventory-images');

-- 5. Ensure INSERT policies exist so students and admins can upload images
DROP POLICY IF EXISTS "Allow public insert to reservations-images" ON storage.objects;
CREATE POLICY "Allow public insert to reservations-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reservations-images');

DROP POLICY IF EXISTS "Allow public insert to inventory-images" ON storage.objects;
CREATE POLICY "Allow public insert to inventory-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'inventory-images');

-- 6. Set default value_tier for any existing components
UPDATE public.components SET value_tier = 'MEDIUM' WHERE value_tier IS NULL;
