-- Add CI identity column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN ci_identity text;