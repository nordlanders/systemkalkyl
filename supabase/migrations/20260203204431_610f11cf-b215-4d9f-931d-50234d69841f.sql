-- Create configuration_items table for CI data
CREATE TABLE public.configuration_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ci_number TEXT NOT NULL UNIQUE,
  system_name TEXT NOT NULL,
  system_owner TEXT,
  system_administrator TEXT,
  organization TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.configuration_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view configuration items
CREATE POLICY "Anyone can view configuration items"
  ON public.configuration_items
  FOR SELECT
  USING (true);

-- Admins can manage configuration items
CREATE POLICY "Admins can create configuration items"
  ON public.configuration_items
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can update configuration items"
  ON public.configuration_items
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can delete configuration items"
  ON public.configuration_items
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_configuration_items_updated_at
  BEFORE UPDATE ON public.configuration_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();