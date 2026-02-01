-- Add tracking columns to calculations table
ALTER TABLE public.calculations
ADD COLUMN created_by_name TEXT,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN updated_by_name TEXT;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_calculations_updated_at
BEFORE UPDATE ON public.calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();