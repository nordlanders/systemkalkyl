
-- Allow all authenticated users to view all calculations
CREATE POLICY "Authenticated users can view all calculations"
ON public.calculations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view all calculation items (needed to view others' calculations)
CREATE POLICY "Authenticated users can view all calculation items"
ON public.calculation_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view all calculation versions
CREATE POLICY "Authenticated users can view all calculation versions"
ON public.calculation_versions
FOR SELECT
USING (auth.uid() IS NOT NULL);
