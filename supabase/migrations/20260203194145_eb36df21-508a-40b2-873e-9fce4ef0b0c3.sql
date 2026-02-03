-- Rename account to internal_account and add external_account
ALTER TABLE public.pricing_config 
RENAME COLUMN account TO internal_account;

ALTER TABLE public.pricing_config 
ADD COLUMN external_account TEXT NULL;