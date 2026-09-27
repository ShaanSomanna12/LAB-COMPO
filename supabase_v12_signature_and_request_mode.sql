-- Add signature_url, request_mode, project_purpose, and hackathon details columns to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS request_mode TEXT DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS project_purpose TEXT,
ADD COLUMN IF NOT EXISTS hackathon_date TEXT,
ADD COLUMN IF NOT EXISTS hackathon_venue TEXT;
