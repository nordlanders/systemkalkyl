-- Add municipality/customer column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN municipality text NOT NULL DEFAULT 'Sundsvalls kommun';

-- Add a check constraint to ensure valid municipality values
ALTER TABLE public.calculations
ADD CONSTRAINT valid_municipality CHECK (municipality IN (
  'Sundsvalls kommun',
  'Ånge kommun',
  'Timrå kommun',
  'Nordanstigs kommun',
  'Hudiksvalls kommun',
  'Ljusdals kommun'
));