-- Add the constraint with the simplified name
ALTER TABLE public.calculations ADD CONSTRAINT valid_municipality CHECK (
  municipality IN (
    'Digitalisering och IT',
    'Sundsvalls kommun',
    'Ånge kommun',
    'Timrå kommun',
    'Nordanstigs kommun',
    'Hudiksvalls kommun',
    'Ljusdals kommun'
  )
);