
CREATE TABLE public.guide_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_order integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL DEFAULT 'FileText',
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  tip text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(step_order)
);

ALTER TABLE public.guide_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active guide steps"
  ON public.guide_steps FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all guide steps"
  ON public.guide_steps FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert guide steps"
  ON public.guide_steps FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update guide steps"
  ON public.guide_steps FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete guide steps"
  ON public.guide_steps FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing hardcoded steps
INSERT INTO public.guide_steps (step_order, title, description, icon_name, details, tip) VALUES
(1, 'Steg 1: Grunduppgifter', 'Börja med att fylla i grundläggande information om kalkylen.', 'FileText',
 '["Ange ett namn för kalkylen", "Välj CI (Configuration Item) från listan", "Välj tjänstetyp (t.ex. Anpassad drift)", "Välj kund och ägande organisation", "Välj kalkylår"]'::jsonb,
 'Alla fält måste fyllas i innan du kan gå vidare till nästa steg.'),
(2, 'Steg 2: Prisrader', 'Lägg till och konfigurera prisrader för kalkylen.', 'ListPlus',
 '["Klicka \"Lägg till rad\" för att lägga till en prispost", "Välj pristyp från prislistan", "Ange antal/kvantitet", "Enhetspris hämtas automatiskt från priskonfigurationen", "Lägg till en kommentar vid behov", "Du kan lägga till flera rader för olika tjänster"]'::jsonb,
 'Totalbeloppet beräknas automatiskt. Du kan redigera eller ta bort rader genom att klicka på dem.'),
(3, 'Steg 3: Sammanställning & Spara', 'Granska kalkylen och välj status innan du sparar.', 'BarChart3',
 '["Granska alla prisrader och totalkostnaden", "Total årskostnad visas som primärt värde", "Månadskostnad visas inom parentes", "Välj status: Utkast eller Skicka för godkännande", "Klicka \"Spara\" för att spara kalkylen"]'::jsonb,
 'Du kan spara som utkast och komma tillbaka senare, eller skicka direkt för godkännande.'),
(4, 'Hantera kalkyler', 'Efter att du sparat kan du hantera dina kalkyler från listan.', 'Settings',
 '["Alla dina kalkyler visas i kalkyloversikten", "Filtrera på år, status, tjänstetyp m.m.", "Klicka på en kalkyl för att redigera den", "Godkända kalkyler kan bara läsas, inte redigeras", "Du kan skapa en ny version av en godkänd kalkyl", "Exportera till PDF direkt från listan"]'::jsonb,
 'Använd \"Visa alla\" för att se kalkyler från andra användare (skrivskyddat).');
