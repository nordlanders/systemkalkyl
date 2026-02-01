-- Add UPDATE policy for calculations table so users can edit their own calculations
CREATE POLICY "Users can update own calculations" 
ON public.calculations 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for calculations table so users can delete their own calculations
CREATE POLICY "Users can delete own calculations" 
ON public.calculations 
FOR DELETE 
USING (auth.uid() = user_id);