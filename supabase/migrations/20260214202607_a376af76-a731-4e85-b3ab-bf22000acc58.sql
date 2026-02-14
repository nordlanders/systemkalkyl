-- Remove unique constraint on ci_number to allow duplicates
ALTER TABLE public.configuration_items DROP CONSTRAINT IF EXISTS configuration_items_ci_number_key;