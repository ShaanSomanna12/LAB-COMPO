UPDATE public.reservations SET created_at = timezone('utc'::text, now()) WHERE created_at > timezone('utc'::text, now());
