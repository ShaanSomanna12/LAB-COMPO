ALTER TABLE public.reservations
ADD COLUMN project_type VARCHAR(50) DEFAULT 'Normal',
ADD COLUMN id_card_url VARCHAR(1000),
ADD COLUMN team_members JSONB;
