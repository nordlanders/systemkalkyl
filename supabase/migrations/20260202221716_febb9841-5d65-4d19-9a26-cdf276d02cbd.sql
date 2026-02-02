-- Fix RLS policy for calculation_items to include superadmin
DROP POLICY IF EXISTS "Admins can view all calculation items" ON public.calculation_items;

CREATE POLICY "Admins can view all calculation items" 
ON public.calculation_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role)
);