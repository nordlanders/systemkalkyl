-- Fix RLS policy for calculations to include superadmin
DROP POLICY IF EXISTS "Admins can view all calculations" ON public.calculations;

CREATE POLICY "Admins can view all calculations" 
ON public.calculations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role)
);