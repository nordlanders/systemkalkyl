-- Add comment column to calculation_items table
ALTER TABLE public.calculation_items
ADD COLUMN comment TEXT;