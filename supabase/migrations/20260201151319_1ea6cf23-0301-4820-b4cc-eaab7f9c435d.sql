-- Add service_type column to calculations
ALTER TABLE public.calculations 
ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'Bastjänst IT infrastruktur';

-- Add a check constraint for valid values
ALTER TABLE public.calculations
ADD CONSTRAINT calculations_service_type_check 
CHECK (service_type IN ('Anpassad drift', 'Anpassad förvaltning', 'Bastjänst Digital infrastruktur', 'Bastjänst IT infrastruktur'));