-- Add service_types array column to pricing_config
-- This will store which service types a price config should appear in
ALTER TABLE public.pricing_config 
ADD COLUMN service_types text[] DEFAULT ARRAY['Anpassad drift', 'Anpassad förvaltning', 'Bastjänst Digital infrastruktur', 'Bastjänst IT infrastruktur']::text[];

-- Add a comment to document the column
COMMENT ON COLUMN public.pricing_config.service_types IS 'Array of service types where this pricing config should be displayed. If null or empty, shows in all service types.';