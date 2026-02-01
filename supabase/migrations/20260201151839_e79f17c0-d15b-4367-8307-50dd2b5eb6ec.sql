-- Create a table for calculation line items
CREATE TABLE public.calculation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  pricing_config_id UUID REFERENCES public.pricing_config(id) ON DELETE SET NULL,
  price_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calculation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage items for their own calculations
CREATE POLICY "Users can view own calculation items" 
ON public.calculation_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.calculations c 
    WHERE c.id = calculation_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all calculation items" 
ON public.calculation_items 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own calculation items" 
ON public.calculation_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calculations c 
    WHERE c.id = calculation_id AND c.user_id = auth.uid()
  ) AND has_write_permission(auth.uid())
);

CREATE POLICY "Users can update own calculation items" 
ON public.calculation_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.calculations c 
    WHERE c.id = calculation_id AND c.user_id = auth.uid()
  ) AND has_write_permission(auth.uid())
);

CREATE POLICY "Users can delete own calculation items" 
ON public.calculation_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.calculations c 
    WHERE c.id = calculation_id AND c.user_id = auth.uid()
  ) AND has_write_permission(auth.uid())
);