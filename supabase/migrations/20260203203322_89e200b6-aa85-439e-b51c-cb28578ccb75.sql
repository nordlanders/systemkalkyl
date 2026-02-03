-- Add owning_organization_id column to calculations
ALTER TABLE public.calculations 
ADD COLUMN owning_organization_id uuid REFERENCES public.owning_organizations(id);

-- Add owning_organization_id column to calculation_versions
ALTER TABLE public.calculation_versions 
ADD COLUMN owning_organization_id uuid;

-- Migrate existing data: link calculations to owning_organizations by name
UPDATE public.calculations c
SET owning_organization_id = oo.id
FROM public.owning_organizations oo
WHERE c.owning_organization = oo.name
AND c.owning_organization IS NOT NULL;

-- Migrate existing data in calculation_versions
UPDATE public.calculation_versions cv
SET owning_organization_id = oo.id
FROM public.owning_organizations oo
WHERE cv.owning_organization = oo.name
AND cv.owning_organization IS NOT NULL;