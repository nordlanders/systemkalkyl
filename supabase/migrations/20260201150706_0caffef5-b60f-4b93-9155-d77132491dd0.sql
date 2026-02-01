-- Add new columns to pricing_config to match the CSV structure
ALTER TABLE public.pricing_config 
ADD COLUMN IF NOT EXISTS unit TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS comment TEXT,
ADD COLUMN IF NOT EXISTS cost_owner TEXT;

-- Rename component_type to price_type for clarity
ALTER TABLE public.pricing_config 
RENAME COLUMN component_type TO price_type;