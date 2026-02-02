-- Create enum for calculation status
CREATE TYPE public.calculation_status AS ENUM ('draft', 'pending_approval', 'approved');

-- Add status column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN status public.calculation_status NOT NULL DEFAULT 'draft';

-- Add version column to calculations table
ALTER TABLE public.calculations 
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add approval fields to calculations table
ALTER TABLE public.calculations 
ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN approved_by_name TEXT,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

-- Add can_approve field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN can_approve BOOLEAN NOT NULL DEFAULT false;

-- Add approval_organizations array field to profiles table (which organizations can user approve)
ALTER TABLE public.profiles 
ADD COLUMN approval_organizations TEXT[] DEFAULT '{}';

-- Create calculation_versions table for version history
CREATE TABLE public.calculation_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT,
  ci_identity TEXT NOT NULL,
  service_type TEXT NOT NULL,
  municipality TEXT NOT NULL,
  owning_organization TEXT,
  calculation_year INTEGER NOT NULL,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  status public.calculation_status NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  UNIQUE(calculation_id, version)
);

-- Enable RLS on calculation_versions
ALTER TABLE public.calculation_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for calculation_versions
CREATE POLICY "Users can view own calculation versions" 
ON public.calculation_versions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM calculations c 
    WHERE c.id = calculation_versions.calculation_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all calculation versions" 
ON public.calculation_versions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users with write permission can insert calculation versions" 
ON public.calculation_versions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM calculations c 
    WHERE c.id = calculation_versions.calculation_id 
    AND c.user_id = auth.uid()
  ) AND has_write_permission(auth.uid())
);

-- Create index for faster lookups
CREATE INDEX idx_calculation_versions_calculation_id ON public.calculation_versions(calculation_id);
CREATE INDEX idx_calculations_status ON public.calculations(status);
CREATE INDEX idx_profiles_can_approve ON public.profiles(can_approve) WHERE can_approve = true;