-- Create a table for owning organizations (internal organizations)
CREATE TABLE public.owning_organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.owning_organizations ENABLE ROW LEVEL SECURITY;

-- Anyone can view owning organizations
CREATE POLICY "Anyone can view owning organizations" 
ON public.owning_organizations 
FOR SELECT 
USING (true);

-- Admins can create owning organizations
CREATE POLICY "Admins can create owning organizations" 
ON public.owning_organizations 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update owning organizations
CREATE POLICY "Admins can update owning organizations" 
ON public.owning_organizations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete owning organizations
CREATE POLICY "Admins can delete owning organizations" 
ON public.owning_organizations 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_owning_organizations_updated_at
BEFORE UPDATE ON public.owning_organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing owning_organization values from calculations
INSERT INTO public.owning_organizations (name)
SELECT DISTINCT owning_organization 
FROM public.calculations 
WHERE owning_organization IS NOT NULL AND owning_organization != ''
ON CONFLICT (name) DO NOTHING;

-- Migrate existing approval_organizations from profiles
INSERT INTO public.owning_organizations (name)
SELECT DISTINCT unnest(approval_organizations) 
FROM public.profiles 
WHERE approval_organizations IS NOT NULL AND array_length(approval_organizations, 1) > 0
ON CONFLICT (name) DO NOTHING;