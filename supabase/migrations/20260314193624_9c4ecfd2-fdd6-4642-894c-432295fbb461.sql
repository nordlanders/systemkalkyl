
-- 1. Fix profiles privilege escalation: restrict INSERT and UPDATE so users can't change sensitive fields

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate INSERT: users can only insert their own profile with safe defaults
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND can_approve = false
  AND permission_level = 'read_write'
  AND (approval_organizations IS NULL OR approval_organizations = '{}')
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate UPDATE: users can update own profile but cannot change sensitive fields
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND can_approve = (SELECT p.can_approve FROM public.profiles p WHERE p.user_id = auth.uid())
  AND permission_level = (SELECT p.permission_level FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approval_organizations IS NOT DISTINCT FROM (SELECT p.approval_organizations FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Add admin UPDATE policy so admins can change these fields via edge functions (service role bypasses RLS anyway, but good practice)
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 2. Restrict profiles SELECT: users see own full profile, others see only non-sensitive fields via a view
-- Actually, since we can't use column-level RLS, we'll restrict to own profile + admins see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 3. Fix configuration_items: require authentication
DROP POLICY IF EXISTS "Anyone can view configuration items" ON public.configuration_items;

CREATE POLICY "Authenticated users can view configuration items" ON public.configuration_items
FOR SELECT TO authenticated
USING (true);
