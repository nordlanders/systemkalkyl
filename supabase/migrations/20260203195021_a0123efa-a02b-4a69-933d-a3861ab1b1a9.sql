-- Add customer_id to organizations table
ALTER TABLE public.organizations 
ADD COLUMN customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL;