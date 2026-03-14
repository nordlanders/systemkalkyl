
-- 1. News: restrict published news to authenticated users
DROP POLICY IF EXISTS "Users can view published news" ON public.news;
CREATE POLICY "Authenticated users can view published news" ON public.news
FOR SELECT TO authenticated
USING (published = true);

-- 2. Customers: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers" ON public.customers
FOR SELECT TO authenticated
USING (true);

-- 3. Organizations: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;
CREATE POLICY "Authenticated users can view organizations" ON public.organizations
FOR SELECT TO authenticated
USING (true);

-- 4. Owning organizations: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view owning organizations" ON public.owning_organizations;
CREATE POLICY "Authenticated users can view owning organizations" ON public.owning_organizations
FOR SELECT TO authenticated
USING (true);
