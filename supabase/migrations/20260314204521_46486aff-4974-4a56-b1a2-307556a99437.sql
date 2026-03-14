
-- Create budget_compensations table
CREATE TABLE public.budget_compensations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owning_organization_id UUID REFERENCES public.owning_organizations(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_compensations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view budget compensations"
  ON public.budget_compensations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert budget compensations"
  ON public.budget_compensations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can update budget compensations"
  ON public.budget_compensations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can delete budget compensations"
  ON public.budget_compensations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
