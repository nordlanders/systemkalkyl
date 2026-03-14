CREATE POLICY "Allow authenticated insert news"
ON public.news
FOR INSERT
TO authenticated
WITH CHECK (true);