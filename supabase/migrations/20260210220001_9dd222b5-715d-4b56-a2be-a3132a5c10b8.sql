
-- Add version tracking columns to budget_outcomes
ALTER TABLE public.budget_outcomes
  ADD COLUMN import_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN extraction_date DATE,
  ADD COLUMN import_label TEXT;
