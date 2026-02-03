-- Add UUID foreign key columns to calculations
ALTER TABLE public.calculations 
ADD COLUMN customer_id uuid REFERENCES public.customers(id),
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Add UUID foreign key columns to calculation_versions
ALTER TABLE public.calculation_versions 
ADD COLUMN customer_id uuid,
ADD COLUMN organization_id uuid;

-- Create indexes for better query performance
CREATE INDEX idx_calculations_customer_id ON public.calculations(customer_id);
CREATE INDEX idx_calculations_organization_id ON public.calculations(organization_id);