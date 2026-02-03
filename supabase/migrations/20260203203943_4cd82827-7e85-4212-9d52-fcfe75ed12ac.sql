-- Remove the municipality check constraint since we now use customer_id instead
ALTER TABLE public.calculations DROP CONSTRAINT IF EXISTS valid_municipality;