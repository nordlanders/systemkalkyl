-- Create permission level enum
CREATE TYPE public.permission_level AS ENUM ('read_only', 'read_write');

-- Add permission_level to profiles table
ALTER TABLE public.profiles 
ADD COLUMN permission_level public.permission_level NOT NULL DEFAULT 'read_write';

-- Update handle_new_user function to set default permission
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, permission_level)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'read_write');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;