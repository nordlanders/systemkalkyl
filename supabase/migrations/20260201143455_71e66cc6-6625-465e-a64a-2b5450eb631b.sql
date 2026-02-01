-- Make ci_identity required (NOT NULL) for new calculations
-- First update any existing NULL values to a placeholder
UPDATE public.calculations 
SET ci_identity = 'LEGACY-' || LEFT(id::text, 8)
WHERE ci_identity IS NULL;

-- Now make the column NOT NULL
ALTER TABLE public.calculations 
ALTER COLUMN ci_identity SET NOT NULL;