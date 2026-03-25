
-- Create portal role enum
CREATE TYPE public.portal_role AS ENUM ('portal_admin', 'portal_user', 'portal_reader');

-- Portal users table
CREATE TABLE public.portal_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role portal_role NOT NULL DEFAULT 'portal_user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Junction: portal user <-> customer
CREATE TABLE public.portal_user_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(portal_user_id, customer_id)
);

-- Junction: portal user <-> organization
CREATE TABLE public.portal_user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(portal_user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_user_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS policies for portal_users
CREATE POLICY "Admins can view portal users" ON public.portal_users
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create portal users" ON public.portal_users
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update portal users" ON public.portal_users
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete portal users" ON public.portal_users
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for portal_user_customers
CREATE POLICY "Admins can view portal user customers" ON public.portal_user_customers
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage portal user customers" ON public.portal_user_customers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for portal_user_organizations
CREATE POLICY "Admins can view portal user organizations" ON public.portal_user_organizations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage portal user organizations" ON public.portal_user_organizations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_portal_users_updated_at BEFORE UPDATE ON public.portal_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
