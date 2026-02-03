-- Add description field to customers table
ALTER TABLE public.customers 
ADD COLUMN description text NULL;

-- Add description field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN description text NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN public.customers.description IS 'Beskrivning av kunden som visas i kalkyler och andra ställen';
COMMENT ON COLUMN public.organizations.description IS 'Beskrivning av organisationen som visas i kalkyler och andra ställen';