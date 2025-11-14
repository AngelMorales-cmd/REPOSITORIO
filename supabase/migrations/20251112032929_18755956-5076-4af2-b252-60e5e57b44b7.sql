-- Add new fields to candidates table for party details
ALTER TABLE public.candidates
ADD COLUMN academic_formation text,
ADD COLUMN professional_experience text,
ADD COLUMN campaign_proposal text;

-- Create admin user credentials
-- Email: admin@elecciones.pe
-- Password: Admin2024!
-- Note: You'll need to create this user in Supabase Auth with this password
-- Then we'll assign the admin role

-- Insert admin role for the admin user (this will be executed after user creation)
-- The user_id will need to be obtained after creating the user in Supabase Auth