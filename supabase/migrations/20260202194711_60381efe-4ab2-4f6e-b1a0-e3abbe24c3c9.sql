-- Drop and recreate the valid_municipality constraint to include the new value
ALTER TABLE public.calculations DROP CONSTRAINT IF EXISTS valid_municipality;

ALTER TABLE public.calculations ADD CONSTRAINT valid_municipality CHECK (
  municipality IN (
    'Digitalisering och IT (används normalt för bastjänster)',
    'Sundsvalls kommun',
    'Ånge kommun',
    'Timrå kommun',
    'Nordanstigs kommun',
    'Hudiksvalls kommun',
    'Ljusdals kommun'
  )
);