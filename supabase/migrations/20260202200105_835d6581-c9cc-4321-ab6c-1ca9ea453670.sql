-- Add owning_organization column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN owning_organization text;

-- Add constraint for valid organizations
ALTER TABLE public.calculations ADD CONSTRAINT valid_owning_organization CHECK (
  owning_organization IS NULL OR owning_organization IN (
    'Sektionen Produktion',
    'Sektionen Produktion, enhet Drift',
    'Sektionen Produktion, enhet Servicedesk',
    'Sektionen Digital Utveckling',
    'Sektionen Strategi och Styrning',
    'Digitalisering och IT Stab/säkerhet'
  )
);