
-- Simulation scenarios table
CREATE TABLE public.simulation_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Simulation prices table (copies of pricing_config with modified prices)
CREATE TABLE public.simulation_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.simulation_scenarios(id) ON DELETE CASCADE,
  pricing_config_id UUID REFERENCES public.pricing_config(id) ON DELETE SET NULL,
  price_type TEXT NOT NULL,
  original_price_per_unit NUMERIC NOT NULL DEFAULT 0,
  simulated_price_per_unit NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  category TEXT,
  ukonto TEXT,
  account_type TEXT NOT NULL DEFAULT 'kostnad',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for simulation_scenarios
CREATE POLICY "Admins can view simulation scenarios" ON public.simulation_scenarios
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create simulation scenarios" ON public.simulation_scenarios
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update simulation scenarios" ON public.simulation_scenarios
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete simulation scenarios" ON public.simulation_scenarios
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for simulation_prices
CREATE POLICY "Admins can view simulation prices" ON public.simulation_prices
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create simulation prices" ON public.simulation_prices
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update simulation prices" ON public.simulation_prices
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete simulation prices" ON public.simulation_prices
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger for scenarios
CREATE TRIGGER update_simulation_scenarios_updated_at
  BEFORE UPDATE ON public.simulation_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
