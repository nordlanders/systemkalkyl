
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone DEFAULT now();
