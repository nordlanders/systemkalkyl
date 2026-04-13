-- Add validation trigger for pricing_config
CREATE OR REPLACE FUNCTION public.validate_pricing_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.price_per_unit <= 0 THEN
    RAISE EXCEPTION 'price_per_unit must be greater than 0';
  END IF;

  IF NEW.effective_to IS NOT NULL AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION 'effective_to must be on or after effective_from';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pricing_config_trigger
  BEFORE INSERT OR UPDATE ON public.pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pricing_config();