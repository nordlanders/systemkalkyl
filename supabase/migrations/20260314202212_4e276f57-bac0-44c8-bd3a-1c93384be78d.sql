
-- Allow all authenticated users to read all calculations
CREATE POLICY "Authenticated users can view all calculations" ON public.calculations
FOR SELECT TO authenticated
USING (true);

-- Allow all authenticated users to read all calculation items
CREATE POLICY "Authenticated users can view all calculation items" ON public.calculation_items
FOR SELECT TO authenticated
USING (true);

-- Allow all authenticated users to read all calculation versions
CREATE POLICY "Authenticated users can view all calculation versions" ON public.calculation_versions
FOR SELECT TO authenticated
USING (true);
