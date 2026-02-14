-- Add 'closed' to the calculation_status enum
ALTER TYPE public.calculation_status ADD VALUE IF NOT EXISTS 'closed';