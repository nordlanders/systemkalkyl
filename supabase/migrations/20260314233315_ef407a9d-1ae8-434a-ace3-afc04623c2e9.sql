
-- Create systems table
CREATE TABLE public.cmdb_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  environment text DEFAULT 'production',
  responsible_person text,
  system_owner text,
  system_administrator text,
  description text,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  imported_by uuid
);

ALTER TABLE public.cmdb_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cmdb systems" ON public.cmdb_systems
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cmdb systems" ON public.cmdb_systems
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cmdb systems" ON public.cmdb_systems
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete cmdb systems" ON public.cmdb_systems
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cmdb_systems_updated_at
  BEFORE UPDATE ON public.cmdb_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create servers table linked to systems
CREATE TABLE public.cmdb_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.cmdb_systems(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  os text,
  datacenter text,
  vcpu integer DEFAULT 0,
  ram_gb numeric DEFAULT 0,
  disk_gb numeric DEFAULT 0,
  ip_address text,
  vlan text,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  imported_by uuid
);

ALTER TABLE public.cmdb_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cmdb servers" ON public.cmdb_servers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cmdb servers" ON public.cmdb_servers
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cmdb servers" ON public.cmdb_servers
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete cmdb servers" ON public.cmdb_servers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cmdb_servers_updated_at
  BEFORE UPDATE ON public.cmdb_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop old table
DROP TABLE IF EXISTS public.cmdb_assets;
