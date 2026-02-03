-- Add account field to pricing_config table
ALTER TABLE public.pricing_config 
ADD COLUMN account TEXT NULL;