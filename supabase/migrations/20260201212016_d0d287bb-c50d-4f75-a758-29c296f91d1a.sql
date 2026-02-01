-- Create news table for admin announcements
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view published news
CREATE POLICY "Users can view published news"
ON public.news
FOR SELECT
USING (published = true);

-- Admins can view all news
CREATE POLICY "Admins can view all news"
ON public.news
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can create news
CREATE POLICY "Admins can create news"
ON public.news
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update news
CREATE POLICY "Admins can update news"
ON public.news
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete news
CREATE POLICY "Admins can delete news"
ON public.news
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();