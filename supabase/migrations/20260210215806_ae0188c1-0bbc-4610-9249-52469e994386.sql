
-- Create table for budget/outcome data imported from CSV
CREATE TABLE public.budget_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ansvar TEXT,
  ukonto TEXT,
  vht TEXT,
  akt TEXT,
  proj TEXT,
  objekt TEXT,
  mot TEXT,
  kgrp TEXT,
  budget_2025 NUMERIC DEFAULT 0,
  utfall_ack NUMERIC DEFAULT 0,
  diff NUMERIC DEFAULT 0,
  budget_2026 NUMERIC DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.budget_outcomes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view budget outcomes"
  ON public.budget_outcomes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can insert budget outcomes"
  ON public.budget_outcomes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can update budget outcomes"
  ON public.budget_outcomes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can delete budget outcomes"
  ON public.budget_outcomes FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
