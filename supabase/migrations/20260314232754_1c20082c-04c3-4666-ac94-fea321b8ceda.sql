
CREATE TABLE public.cmdb_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  hostname text,
  os text,
  environment text DEFAULT 'production',
  datacenter text,
  vcpu integer DEFAULT 0,
  ram_gb numeric DEFAULT 0,
  disk_gb numeric DEFAULT 0,
  server_count integer DEFAULT 1,
  ip_address text,
  vlan text,
  status text DEFAULT 'active',
  responsible_person text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  imported_at timestamptz DEFAULT now(),
  imported_by uuid
);

ALTER TABLE public.cmdb_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cmdb assets" ON public.cmdb_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert cmdb assets" ON public.cmdb_assets
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update cmdb assets" ON public.cmdb_assets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete cmdb assets" ON public.cmdb_assets
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cmdb_assets_updated_at
  BEFORE UPDATE ON public.cmdb_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
