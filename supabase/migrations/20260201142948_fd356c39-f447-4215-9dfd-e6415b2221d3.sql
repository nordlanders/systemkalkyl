-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Admins can view all calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can view own calculations" ON public.calculations;

-- Create permissive policies (default) so that either condition grants access
CREATE POLICY "Admins can view all calculations" 
ON public.calculations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own calculations" 
ON public.calculations 
FOR SELECT 
USING (auth.uid() = user_id);