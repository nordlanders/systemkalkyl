
-- Fix calculation_versions: add superadmin
DROP POLICY IF EXISTS "Admins can view all calculation versions" ON public.calculation_versions;
CREATE POLICY "Admins can view all calculation versions" ON public.calculation_versions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Fix pricing_config: add superadmin to write policies
DROP POLICY IF EXISTS "Admins can manage pricing" ON public.pricing_config;
CREATE POLICY "Admins can manage pricing" ON public.pricing_config
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update pricing" ON public.pricing_config;
CREATE POLICY "Admins can update pricing" ON public.pricing_config
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete pricing" ON public.pricing_config;
CREATE POLICY "Admins can delete pricing" ON public.pricing_config
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Fix customers: add superadmin
DROP POLICY IF EXISTS "Admins can create customers" ON public.customers;
CREATE POLICY "Admins can create customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers" ON public.customers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Fix organizations: add superadmin
DROP POLICY IF EXISTS "Admins can create organizations" ON public.organizations;
CREATE POLICY "Admins can create organizations" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update organizations" ON public.organizations;
CREATE POLICY "Admins can update organizations" ON public.organizations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete organizations" ON public.organizations;
CREATE POLICY "Admins can delete organizations" ON public.organizations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Fix owning_organizations: add superadmin
DROP POLICY IF EXISTS "Admins can create owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can create owning organizations" ON public.owning_organizations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can update owning organizations" ON public.owning_organizations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can delete owning organizations" ON public.owning_organizations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Fix news: add superadmin
DROP POLICY IF EXISTS "Admins can create news" ON public.news;
CREATE POLICY "Admins can create news" ON public.news
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update news" ON public.news;
CREATE POLICY "Admins can update news" ON public.news
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
CREATE POLICY "Admins can delete news" ON public.news
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can view all news" ON public.news;
CREATE POLICY "Admins can view all news" ON public.news
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
