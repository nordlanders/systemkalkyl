
-- Remove the hardcoded check constraint
ALTER TABLE public.calculations DROP CONSTRAINT IF EXISTS valid_owning_organization;

-- Create a trigger function to validate owning_organization against the registry
CREATE OR REPLACE FUNCTION public.validate_owning_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owning_organization IS NOT NULL AND NEW.owning_organization != '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.owning_organizations WHERE name = NEW.owning_organization
    ) THEN
      RAISE EXCEPTION 'Ogiltig ägande organisation: %', NEW.owning_organization;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_validate_owning_organization
BEFORE INSERT OR UPDATE ON public.calculations
FOR EACH ROW
EXECUTE FUNCTION public.validate_owning_organization();
