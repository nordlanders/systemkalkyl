-- Create a function to check if user has read_write permission
CREATE OR REPLACE FUNCTION public.has_write_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND permission_level = 'read_write'
  )
$$;

-- Update INSERT policy to require write permission
DROP POLICY IF EXISTS "Users can create own calculations" ON public.calculations;
CREATE POLICY "Users can create own calculations" 
ON public.calculations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND has_write_permission(auth.uid()));

-- Update UPDATE policy to require write permission
DROP POLICY IF EXISTS "Users can update own calculations" ON public.calculations;
CREATE POLICY "Users can update own calculations" 
ON public.calculations 
FOR UPDATE 
USING (auth.uid() = user_id AND has_write_permission(auth.uid()))
WITH CHECK (auth.uid() = user_id AND has_write_permission(auth.uid()));

-- Update DELETE policy to require write permission
DROP POLICY IF EXISTS "Users can delete own calculations" ON public.calculations;
CREATE POLICY "Users can delete own calculations" 
ON public.calculations 
FOR DELETE 
USING (auth.uid() = user_id AND has_write_permission(auth.uid()));