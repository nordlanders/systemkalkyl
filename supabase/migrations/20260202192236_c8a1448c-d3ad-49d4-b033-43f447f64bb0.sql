-- Add column to track which service types are NOT allowed for a pricing config
ALTER TABLE public.pricing_config 
ADD COLUMN disallowed_service_types text[] DEFAULT NULL;