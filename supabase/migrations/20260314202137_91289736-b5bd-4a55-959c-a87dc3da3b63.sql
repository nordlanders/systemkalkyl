
-- Allow all authenticated users to read budget_outcomes
CREATE POLICY "Authenticated users can view budget outcomes" ON public.budget_outcomes
FOR SELECT TO authenticated
USING (true);
