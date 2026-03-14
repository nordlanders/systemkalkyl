
-- 1. Remove overly broad calculations SELECT policy (own + admin policies already exist)
DROP POLICY IF EXISTS "Authenticated users can view all calculations" ON public.calculations;

-- 2. Same for calculation_items
DROP POLICY IF EXISTS "Authenticated users can view all calculation items" ON public.calculation_items;

-- 3. Same for calculation_versions
DROP POLICY IF EXISTS "Authenticated users can view all calculation versions" ON public.calculation_versions;

-- 4. Restrict audit_log SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can view audit log" ON public.audit_log;

CREATE POLICY "Admins can view audit log" ON public.audit_log
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 5. Restrict audit_log INSERT to admins too (or keep for own entries)
DROP POLICY IF EXISTS "Authenticated users can create audit entries" ON public.audit_log;

CREATE POLICY "Authenticated users can create own audit entries" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
