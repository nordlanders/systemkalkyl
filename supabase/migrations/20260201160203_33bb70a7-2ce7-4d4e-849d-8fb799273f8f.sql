-- Add calculation_year column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN calculation_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

-- Update existing calculations to have 2026 as calculation year
UPDATE public.calculations SET calculation_year = 2026;