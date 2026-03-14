
-- calculations: change write policies from public to authenticated
DROP POLICY IF EXISTS "Users can create own calculations" ON public.calculations;
CREATE POLICY "Users can create own calculations" ON public.calculations
FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = user_id) AND has_write_permission(auth.uid()));

DROP POLICY IF EXISTS "Users can update own calculations" ON public.calculations;
CREATE POLICY "Users can update own calculations" ON public.calculations
FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) AND has_write_permission(auth.uid()))
WITH CHECK ((auth.uid() = user_id) AND has_write_permission(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own calculations" ON public.calculations;
CREATE POLICY "Users can delete own calculations" ON public.calculations
FOR DELETE TO authenticated
USING ((auth.uid() = user_id) AND has_write_permission(auth.uid()));

DROP POLICY IF EXISTS "Users can view own calculations" ON public.calculations;
CREATE POLICY "Users can view own calculations" ON public.calculations
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all calculations" ON public.calculations;
CREATE POLICY "Admins can view all calculations" ON public.calculations
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- calculation_items
DROP POLICY IF EXISTS "Users can view own calculation items" ON public.calculation_items;
CREATE POLICY "Users can view own calculation items" ON public.calculation_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_items.calculation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all calculation items" ON public.calculation_items;
CREATE POLICY "Admins can view all calculation items" ON public.calculation_items
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Users can insert own calculation items" ON public.calculation_items;
CREATE POLICY "Users can insert own calculation items" ON public.calculation_items
FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_items.calculation_id AND c.user_id = auth.uid())) AND has_write_permission(auth.uid()));

DROP POLICY IF EXISTS "Users can update own calculation items" ON public.calculation_items;
CREATE POLICY "Users can update own calculation items" ON public.calculation_items
FOR UPDATE TO authenticated
USING ((EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_items.calculation_id AND c.user_id = auth.uid())) AND has_write_permission(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own calculation items" ON public.calculation_items;
CREATE POLICY "Users can delete own calculation items" ON public.calculation_items
FOR DELETE TO authenticated
USING ((EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_items.calculation_id AND c.user_id = auth.uid())) AND has_write_permission(auth.uid()));

-- calculation_versions
DROP POLICY IF EXISTS "Users can view own calculation versions" ON public.calculation_versions;
CREATE POLICY "Users can view own calculation versions" ON public.calculation_versions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_versions.calculation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all calculation versions" ON public.calculation_versions;
CREATE POLICY "Admins can view all calculation versions" ON public.calculation_versions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users with write permission can insert calculation versions" ON public.calculation_versions;
CREATE POLICY "Users with write permission can insert calculation versions" ON public.calculation_versions
FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM calculations c WHERE c.id = calculation_versions.calculation_id AND c.user_id = auth.uid())) AND has_write_permission(auth.uid()));

-- budget_outcomes
DROP POLICY IF EXISTS "Admins can view budget outcomes" ON public.budget_outcomes;
CREATE POLICY "Admins can view budget outcomes" ON public.budget_outcomes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can insert budget outcomes" ON public.budget_outcomes;
CREATE POLICY "Admins can insert budget outcomes" ON public.budget_outcomes
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update budget outcomes" ON public.budget_outcomes;
CREATE POLICY "Admins can update budget outcomes" ON public.budget_outcomes
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete budget outcomes" ON public.budget_outcomes;
CREATE POLICY "Admins can delete budget outcomes" ON public.budget_outcomes
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- customers: write policies
DROP POLICY IF EXISTS "Admins can create customers" ON public.customers;
CREATE POLICY "Admins can create customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers" ON public.customers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- organizations: write policies
DROP POLICY IF EXISTS "Admins can create organizations" ON public.organizations;
CREATE POLICY "Admins can create organizations" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update organizations" ON public.organizations;
CREATE POLICY "Admins can update organizations" ON public.organizations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete organizations" ON public.organizations;
CREATE POLICY "Admins can delete organizations" ON public.organizations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- owning_organizations: write policies
DROP POLICY IF EXISTS "Admins can create owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can create owning organizations" ON public.owning_organizations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can update owning organizations" ON public.owning_organizations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete owning organizations" ON public.owning_organizations;
CREATE POLICY "Admins can delete owning organizations" ON public.owning_organizations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- configuration_items: write policies
DROP POLICY IF EXISTS "Admins can create configuration items" ON public.configuration_items;
CREATE POLICY "Admins can create configuration items" ON public.configuration_items
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update configuration items" ON public.configuration_items;
CREATE POLICY "Admins can update configuration items" ON public.configuration_items
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can delete configuration items" ON public.configuration_items;
CREATE POLICY "Admins can delete configuration items" ON public.configuration_items
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- news: write policies
DROP POLICY IF EXISTS "Admins can create news" ON public.news;
CREATE POLICY "Admins can create news" ON public.news
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update news" ON public.news;
CREATE POLICY "Admins can update news" ON public.news
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
CREATE POLICY "Admins can delete news" ON public.news
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all news" ON public.news;
CREATE POLICY "Admins can view all news" ON public.news
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles: critical - change ALL policy from public to authenticated
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
