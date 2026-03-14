import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Upload, Search, Trash2, Edit, Plus, Server, Cpu, HardDrive, MemoryStick,
  Download, ChevronRight, ChevronDown, Monitor, Network, Info,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SystemRelationshipGraph from './SystemRelationshipGraph';

// Types
interface CmdbSystem {
  id: string;
  system_name: string;
  environment: string | null;
  responsible_person: string | null;
  system_owner: string | null;
  system_administrator: string | null;
  ops_responsible: string | null;
  ops_team: string | null;
  description: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CmdbServer {
  id: string;
  system_id: string;
  hostname: string;
  os: string | null;
  datacenter: string | null;
  vcpu: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  ip_address: string | null;
  vlan: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const emptySystemForm = {
  system_name: '', environment: 'production', responsible_person: '', system_owner: '',
  system_administrator: '', ops_responsible: '', ops_team: '', description: '', status: 'active', notes: '',
};

const emptyServerForm = {
  system_id: '', hostname: '', os: '', datacenter: '', vcpu: 0, ram_gb: 0,
  disk_gb: 0, ip_address: '', vlan: '', status: 'active', notes: '',
};

export default function CmdbManagement() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const systemFileRef = useRef<HTMLInputElement>(null);
  const serverFileRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());

  // System dialog
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<CmdbSystem | null>(null);
  const [systemForm, setSystemForm] = useState(emptySystemForm);

  // Server dialog
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<CmdbServer | null>(null);
  const [serverForm, setServerForm] = useState(emptyServerForm);

  // Graph dialog
  const [graphSystem, setGraphSystem] = useState<CmdbSystem | null>(null);

  // Queries
  const { data: systems = [], isLoading: loadingSystems } = useQuery({
    queryKey: ['cmdb-systems'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cmdb_systems').select('*').order('system_name');
      if (error) throw error;
      return data as CmdbSystem[];
    },
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['cmdb-servers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cmdb_servers').select('*').order('hostname');
      if (error) throw error;
      return data as CmdbServer[];
    },
  });

  // Group servers by system
  const serversBySystem = servers.reduce<Record<string, CmdbServer[]>>((acc, s) => {
    (acc[s.system_id] ??= []).push(s);
    return acc;
  }, {});

  // Mutations
  const upsertSystem = useMutation({
    mutationFn: async (vals: typeof emptySystemForm & { id?: string }) => {
      const { id, ...rest } = vals;
      if (id) {
        const { error } = await supabase.from('cmdb_systems').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cmdb_systems').insert({ ...rest, created_by: user?.id, imported_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cmdb-systems'] });
      setSystemDialogOpen(false);
      setEditingSystem(null);
      setSystemForm(emptySystemForm);
      toast({ title: 'Sparat', description: 'Systemet har sparats.' });
    },
    onError: (e: Error) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const deleteSystem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cmdb_systems').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cmdb-systems'] });
      qc.invalidateQueries({ queryKey: ['cmdb-servers'] });
      toast({ title: 'Borttagen' });
    },
    onError: (e: Error) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const upsertServer = useMutation({
    mutationFn: async (vals: typeof emptyServerForm & { id?: string }) => {
      const { id, ...rest } = vals;
      if (id) {
        const { error } = await supabase.from('cmdb_servers').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cmdb_servers').insert({ ...rest, created_by: user?.id, imported_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cmdb-servers'] });
      setServerDialogOpen(false);
      setEditingServer(null);
      setServerForm(emptyServerForm);
      toast({ title: 'Sparat', description: 'Servern har sparats.' });
    },
    onError: (e: Error) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const deleteServer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cmdb_servers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cmdb-servers'] });
      toast({ title: 'Borttagen' });
    },
    onError: (e: Error) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  // CSV import systems
  const handleSystemCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) { toast({ title: 'Fel', description: 'Minst rubrikrad + en datarad krävs.', variant: 'destructive' }); return; }

    const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const fieldMap: Record<string, string> = {
      'systemnamn': 'system_name', 'system_name': 'system_name',
      'miljö': 'environment', 'environment': 'environment',
      'ansvarig': 'responsible_person', 'responsible_person': 'responsible_person',
      'systemägare': 'system_owner', 'system_owner': 'system_owner',
      'systemförvaltare': 'system_administrator', 'system_administrator': 'system_administrator',
      'driftansvarig': 'ops_responsible', 'ops_responsible': 'ops_responsible',
      'driftteam': 'ops_team', 'ops_team': 'ops_team', 'driftansvarigt team': 'ops_team',
      'beskrivning': 'description', 'description': 'description',
      'status': 'status', 'anteckningar': 'notes', 'notes': 'notes',
    };
    const colMap = headers.map((h) => fieldMap[h] || null);
    const rows: Array<{ system_name: string; [k: string]: unknown }> = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(';').map((v) => v.trim());
      const row: Record<string, unknown> = { created_by: user?.id, imported_by: user?.id };
      colMap.forEach((f, idx) => { if (f) row[f] = vals[idx] || ''; });
      if (row.system_name) rows.push(row as { system_name: string; [k: string]: unknown });
    }

    if (!rows.length) { toast({ title: 'Fel', description: 'Inga giltiga rader. Kolumnen "Systemnamn" krävs.', variant: 'destructive' }); return; }
    const { error } = await supabase.from('cmdb_systems').insert(rows);
    if (error) toast({ title: 'Importfel', description: error.message, variant: 'destructive' });
    else { qc.invalidateQueries({ queryKey: ['cmdb-systems'] }); toast({ title: 'Import klar', description: `${rows.length} system importerade.` }); }
    if (systemFileRef.current) systemFileRef.current.value = '';
  };

  // CSV import servers
  const handleServerCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) { toast({ title: 'Fel', description: 'Minst rubrikrad + en datarad krävs.', variant: 'destructive' }); return; }

    const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const fieldMap: Record<string, string> = {
      'systemnamn': '_system_name', 'system_name': '_system_name', 'system': '_system_name',
      'hostname': 'hostname', 'servernamn': 'hostname',
      'os': 'os', 'operativsystem': 'os',
      'datacenter': 'datacenter',
      'vcpu': 'vcpu', 'ram_gb': 'ram_gb', 'ram': 'ram_gb',
      'disk_gb': 'disk_gb', 'disk': 'disk_gb', 'diskutrymme': 'disk_gb',
      'ip': 'ip_address', 'ip_address': 'ip_address',
      'vlan': 'vlan', 'status': 'status',
      'anteckningar': 'notes', 'notes': 'notes',
    };
    const colMap = headers.map((h) => fieldMap[h] || null);

    // Build system name -> id lookup
    const systemLookup: Record<string, string> = {};
    systems.forEach((s) => { systemLookup[s.system_name.toLowerCase()] = s.id; });

    const rows: Array<{ hostname: string; system_id: string; [k: string]: unknown }> = [];
    const unknownSystems: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(';').map((v) => v.trim());
      const row: Record<string, unknown> = { created_by: user?.id, imported_by: user?.id };
      let sysName = '';
      colMap.forEach((f, idx) => {
        if (!f) return;
        const val = vals[idx] || '';
        if (f === '_system_name') { sysName = val; return; }
        if (['vcpu', 'ram_gb', 'disk_gb'].includes(f)) row[f] = parseFloat(val.replace(',', '.')) || 0;
        else row[f] = val;
      });
      const sysId = systemLookup[sysName.toLowerCase()];
      if (!sysId) { if (sysName) unknownSystems.push(sysName); continue; }
      row.system_id = sysId;
      if (row.hostname) rows.push(row as { hostname: string; system_id: string; [k: string]: unknown });
    }

    if (unknownSystems.length) {
      const unique = [...new Set(unknownSystems)];
      toast({ title: 'Varning', description: `Okända system (hoppa över): ${unique.join(', ')}`, variant: 'destructive' });
    }

    if (!rows.length) { toast({ title: 'Fel', description: 'Inga giltiga rader. Kolumnerna "Systemnamn" och "Hostname" krävs.', variant: 'destructive' }); return; }
    const { error } = await supabase.from('cmdb_servers').insert(rows);
    if (error) toast({ title: 'Importfel', description: error.message, variant: 'destructive' });
    else { qc.invalidateQueries({ queryKey: ['cmdb-servers'] }); toast({ title: 'Import klar', description: `${rows.length} servrar importerade.` }); }
    if (serverFileRef.current) serverFileRef.current.value = '';
  };

  // Export
  const handleExportCsv = () => {
    const headers = ['Systemnamn', 'Hostname', 'OS', 'Miljö', 'Datacenter', 'vCPU', 'RAM (GB)', 'Disk (GB)', 'IP', 'VLAN', 'Status', 'Ansvarig'];
    const csvRows = [headers.join(';')];
    systems.forEach((sys) => {
      const sysServers = serversBySystem[sys.id] || [];
      if (sysServers.length === 0) {
        csvRows.push([sys.system_name, '', '', sys.environment || '', '', '', '', '', '', '', sys.status || '', sys.responsible_person || ''].join(';'));
      } else {
        sysServers.forEach((srv) => {
          csvRows.push([sys.system_name, srv.hostname, srv.os || '', sys.environment || '', srv.datacenter || '', srv.vcpu ?? 0, srv.ram_gb ?? 0, srv.disk_gb ?? 0, srv.ip_address || '', srv.vlan || '', srv.status || '', sys.responsible_person || ''].join(';'));
        });
      }
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `cmdb-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filtered systems
  const filtered = systems.filter((s) => {
    const term = searchTerm.toLowerCase();
    const sysServers = serversBySystem[s.id] || [];
    const matchesSearch = !term || [s.system_name, s.responsible_person, s.system_owner, s.system_administrator, s.ops_responsible, s.ops_team]
      .some((v) => v?.toLowerCase().includes(term)) ||
      sysServers.some((srv) => [srv.hostname, srv.ip_address, srv.os].some((v) => v?.toLowerCase().includes(term)));
    const matchesEnv = envFilter === 'all' || s.environment === envFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesOwner = ownerFilter === 'all' || s.system_owner === ownerFilter;
    const matchesAdmin = adminFilter === 'all' || s.system_administrator === adminFilter;
    const matchesOpsResp = opsResponsibleFilter === 'all' || s.ops_responsible === opsResponsibleFilter;
    const matchesOpsTeam = opsTeamFilter === 'all' || s.ops_team === opsTeamFilter;
    return matchesSearch && matchesEnv && matchesStatus && matchesOwner && matchesAdmin && matchesOpsResp && matchesOpsTeam;
  });

  // Filters for new fields
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [adminFilter, setAdminFilter] = useState('all');
  const [opsResponsibleFilter, setOpsResponsibleFilter] = useState('all');
  const [opsTeamFilter, setOpsTeamFilter] = useState('all');

  // Unique values for filters
  const uniqueOwners = useMemo(() => [...new Set(systems.map(s => s.system_owner).filter(Boolean))].sort() as string[], [systems]);
  const uniqueAdmins = useMemo(() => [...new Set(systems.map(s => s.system_administrator).filter(Boolean))].sort() as string[], [systems]);
  const uniqueOpsResponsible = useMemo(() => [...new Set(systems.map(s => s.ops_responsible).filter(Boolean))].sort() as string[], [systems]);
  const uniqueOpsTeams = useMemo(() => [...new Set(systems.map(s => s.ops_team).filter(Boolean))].sort() as string[], [systems]);

  // Stats
  const totalVcpu = servers.reduce((s, a) => s + (a.vcpu ?? 0), 0);
  const totalRam = servers.reduce((s, a) => s + Number(a.ram_gb ?? 0), 0);
  const totalDisk = servers.reduce((s, a) => s + Number(a.disk_gb ?? 0), 0);

  const openEditSystem = (sys: CmdbSystem) => {
    setEditingSystem(sys);
    setSystemForm({
      system_name: sys.system_name, environment: sys.environment || 'production',
      responsible_person: sys.responsible_person || '', system_owner: sys.system_owner || '',
      system_administrator: sys.system_administrator || '', ops_responsible: sys.ops_responsible || '',
      ops_team: sys.ops_team || '', description: sys.description || '',
      status: sys.status || 'active', notes: sys.notes || '',
    });
    setSystemDialogOpen(true);
  };

  const openAddServer = (systemId: string) => {
    setEditingServer(null);
    setServerForm({ ...emptyServerForm, system_id: systemId });
    setServerDialogOpen(true);
  };

  const openEditServer = (srv: CmdbServer) => {
    setEditingServer(srv);
    setServerForm({
      system_id: srv.system_id, hostname: srv.hostname, os: srv.os || '',
      datacenter: srv.datacenter || '', vcpu: srv.vcpu ?? 0, ram_gb: srv.ram_gb ?? 0,
      disk_gb: srv.disk_gb ?? 0, ip_address: srv.ip_address || '', vlan: srv.vlan || '',
      status: srv.status || 'active', notes: srv.notes || '',
    });
    setServerDialogOpen(true);
  };

  const StatusBadge = ({ status }: { status: string | null }) => (
    <Badge variant={status === 'active' ? 'default' : 'outline'}>
      {status === 'active' ? 'Aktiv' : status === 'inactive' ? 'Inaktiv' : 'Avvecklad'}
    </Badge>
  );

  const EnvBadge = ({ env }: { env: string | null }) => (
    <Badge variant={env === 'production' ? 'default' : 'secondary'}>
      {env === 'production' ? 'Prod' : env === 'test' ? 'Test' : env === 'development' ? 'Dev' : env || '-'}
    </Badge>
  );

  // Calculate last updated timestamp
  const lastUpdated = useMemo(() => {
    const allDates = [
      ...systems.map((s) => s.updated_at),
      ...servers.map((s) => s.updated_at),
    ].filter(Boolean);
    if (!allDates.length) return null;
    return new Date(Math.max(...allDates.map((d) => new Date(d).getTime())));
  }, [systems, servers]);

  return (
    <div className="space-y-6">
      {/* Replica info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Detta är en replika av den aktuella CMDB-databasen</p>
          <p className="text-muted-foreground">
            Informationen synkroniseras via import och kan avvika från källsystemet.
            {lastUpdated && (
              <> Senast uppdaterad: <span className="font-medium text-foreground">{lastUpdated.toLocaleDateString('sv-SE')} {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Monitor className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">System</p><p className="text-2xl font-bold">{systems.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Server className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Servrar</p><p className="text-2xl font-bold">{servers.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Cpu className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Totalt vCPU</p><p className="text-2xl font-bold">{totalVcpu}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><HardDrive className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Totalt disk</p><p className="text-2xl font-bold">{totalDisk} GB</p></div>
        </CardContent></Card>
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>CMDB - Infrastrukturregister</CardTitle>
              <CardDescription>System med tillhörande servrar och infrastrukturresurser</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setEditingSystem(null); setSystemForm(emptySystemForm); setSystemDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> System
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => systemFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Import system
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => serverFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Import servrar
                  </Button>
                  <input ref={systemFileRef} type="file" accept=".csv" className="hidden" onChange={handleSystemCsvImport} />
                  <input ref={serverFileRef} type="file" accept=".csv" className="hidden" onChange={handleServerCsvImport} />
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-1" /> Exportera
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Sök system, hostname, IP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Miljö" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla miljöer</SelectItem>
                <SelectItem value="production">Produktion</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="development">Utveckling</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Inaktiv</SelectItem>
                <SelectItem value="decommissioned">Avvecklad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingSystems ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Inga system hittades</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((sys) => {
                const sysServers = serversBySystem[sys.id] || [];
                const expanded = expandedSystems.has(sys.id);
                const sysVcpu = sysServers.reduce((s, a) => s + (a.vcpu ?? 0), 0);
                const sysRam = sysServers.reduce((s, a) => s + Number(a.ram_gb ?? 0), 0);
                const sysDisk = sysServers.reduce((s, a) => s + Number(a.disk_gb ?? 0), 0);

                return (
                  <Collapsible key={sys.id} open={expanded} onOpenChange={() => toggleExpand(sys.id)}>
                    <div className="rounded-lg border bg-card">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Monitor className="h-5 w-5 text-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{sys.system_name}</span>
                              <EnvBadge env={sys.environment} />
                              <StatusBadge status={sys.status} />
                            </div>
                            <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground mt-0.5">
                              {sys.system_owner && <span>Systemägare: {sys.system_owner}</span>}
                              {sys.system_administrator && <span>Systemförvaltare: {sys.system_administrator}</span>}
                              {sys.ops_responsible && <span>Driftansvarig: {sys.ops_responsible}</span>}
                              {sys.ops_team && <span>Driftteam: {sys.ops_team}</span>}
                              {sys.responsible_person && <span>Ansvarig: {sys.responsible_person}</span>}
                            </div>
                          </div>
                          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Server className="h-3 w-3" /> {sysServers.length} servrar</span>
                            <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {sysVcpu} vCPU</span>
                            <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" /> {sysRam} GB RAM</span>
                            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {sysDisk} GB</span>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" title="Visa relationsdiagram" onClick={() => setGraphSystem(sys)}><Network className="h-4 w-4 text-primary" /></Button>
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => openEditSystem(sys)}><Edit className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Ta bort systemet och alla servrar?')) deleteSystem.mutate(sys.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </>
                              )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4">
                          {sys.description && <p className="text-sm text-muted-foreground py-2">{sys.description}</p>}
                          <div className="flex items-center justify-between py-2">
                            <h4 className="text-sm font-medium flex items-center gap-1"><Server className="h-4 w-4" /> Servrar ({sysServers.length})</h4>
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => openAddServer(sys.id)}>
                                <Plus className="h-3 w-3 mr-1" /> Lägg till server
                              </Button>
                            )}
                          </div>
                          {sysServers.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Inga servrar registrerade</p>
                          ) : (
                            <div className="rounded-md border overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Hostname</TableHead>
                                    <TableHead>OS</TableHead>
                                    <TableHead>Datacenter</TableHead>
                                    <TableHead className="text-right">vCPU</TableHead>
                                    <TableHead className="text-right">RAM (GB)</TableHead>
                                    <TableHead className="text-right">Disk (GB)</TableHead>
                                    <TableHead>IP</TableHead>
                                    <TableHead>VLAN</TableHead>
                                    <TableHead>Status</TableHead>
                                    {isAdmin && <TableHead className="w-20">Åtgärder</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sysServers.map((srv) => (
                                    <TableRow key={srv.id}>
                                      <TableCell className="font-medium">{srv.hostname}</TableCell>
                                      <TableCell>{srv.os}</TableCell>
                                      <TableCell>{srv.datacenter}</TableCell>
                                      <TableCell className="text-right">{srv.vcpu}</TableCell>
                                      <TableCell className="text-right">{srv.ram_gb}</TableCell>
                                      <TableCell className="text-right">{srv.disk_gb}</TableCell>
                                      <TableCell className="font-mono text-xs">{srv.ip_address}</TableCell>
                                      <TableCell>{srv.vlan}</TableCell>
                                      <TableCell><StatusBadge status={srv.status} /></TableCell>
                                      {isAdmin && (
                                        <TableCell>
                                          <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEditServer(srv)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('Ta bort servern?')) deleteServer.mutate(srv.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Visar {filtered.length} av {systems.length} system, totalt {servers.length} servrar</p>
        </CardContent>
      </Card>

      {/* System Dialog */}
      <Dialog open={systemDialogOpen} onOpenChange={setSystemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSystem ? 'Redigera system' : 'Lägg till system'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertSystem.mutate({ ...systemForm, ...(editingSystem ? { id: editingSystem.id } : {}) }); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="md:col-span-2"><Label>Systemnamn *</Label><Input value={systemForm.system_name} onChange={(e) => setSystemForm({ ...systemForm, system_name: e.target.value })} required /></div>
              <div>
                <Label>Miljö</Label>
                <Select value={systemForm.environment} onValueChange={(v) => setSystemForm({ ...systemForm, environment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Produktion</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="development">Utveckling</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={systemForm.status} onValueChange={(v) => setSystemForm({ ...systemForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="decommissioned">Avvecklad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Systemägare</Label><Input value={systemForm.system_owner} onChange={(e) => setSystemForm({ ...systemForm, system_owner: e.target.value })} /></div>
              <div><Label>Systemförvaltare</Label><Input value={systemForm.system_administrator} onChange={(e) => setSystemForm({ ...systemForm, system_administrator: e.target.value })} /></div>
              <div><Label>Driftansvarig</Label><Input value={systemForm.ops_responsible} onChange={(e) => setSystemForm({ ...systemForm, ops_responsible: e.target.value })} /></div>
              <div><Label>Driftansvarigt team</Label><Input value={systemForm.ops_team} onChange={(e) => setSystemForm({ ...systemForm, ops_team: e.target.value })} /></div>
              <div><Label>Ansvarig</Label><Input value={systemForm.responsible_person} onChange={(e) => setSystemForm({ ...systemForm, responsible_person: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Beskrivning</Label><Input value={systemForm.description} onChange={(e) => setSystemForm({ ...systemForm, description: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Anteckningar</Label><Input value={systemForm.notes} onChange={(e) => setSystemForm({ ...systemForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSystemDialogOpen(false)}>Avbryt</Button>
              <Button type="submit" disabled={upsertSystem.isPending}>{editingSystem ? 'Spara' : 'Lägg till'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Server Dialog */}
      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingServer ? 'Redigera server' : 'Lägg till server'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertServer.mutate({ ...serverForm, ...(editingServer ? { id: editingServer.id } : {}) }); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <Label>System *</Label>
                <Select value={serverForm.system_id} onValueChange={(v) => setServerForm({ ...serverForm, system_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj system" /></SelectTrigger>
                  <SelectContent>
                    {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Hostname *</Label><Input value={serverForm.hostname} onChange={(e) => setServerForm({ ...serverForm, hostname: e.target.value })} required /></div>
              <div><Label>OS</Label><Input value={serverForm.os} onChange={(e) => setServerForm({ ...serverForm, os: e.target.value })} placeholder="t.ex. Windows Server 2022" /></div>
              <div><Label>Datacenter</Label><Input value={serverForm.datacenter} onChange={(e) => setServerForm({ ...serverForm, datacenter: e.target.value })} /></div>
              <div><Label>vCPU</Label><Input type="number" value={serverForm.vcpu} onChange={(e) => setServerForm({ ...serverForm, vcpu: Number(e.target.value) })} min={0} /></div>
              <div><Label>RAM (GB)</Label><Input type="number" value={serverForm.ram_gb} onChange={(e) => setServerForm({ ...serverForm, ram_gb: Number(e.target.value) })} min={0} /></div>
              <div><Label>Disk (GB)</Label><Input type="number" value={serverForm.disk_gb} onChange={(e) => setServerForm({ ...serverForm, disk_gb: Number(e.target.value) })} min={0} /></div>
              <div><Label>IP-adress</Label><Input value={serverForm.ip_address} onChange={(e) => setServerForm({ ...serverForm, ip_address: e.target.value })} /></div>
              <div><Label>VLAN</Label><Input value={serverForm.vlan} onChange={(e) => setServerForm({ ...serverForm, vlan: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={serverForm.status} onValueChange={(v) => setServerForm({ ...serverForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="decommissioned">Avvecklad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Anteckningar</Label><Input value={serverForm.notes} onChange={(e) => setServerForm({ ...serverForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setServerDialogOpen(false)}>Avbryt</Button>
              <Button type="submit" disabled={upsertServer.isPending}>{editingServer ? 'Spara' : 'Lägg till'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Graph Dialog */}
      <Dialog open={!!graphSystem} onOpenChange={(open) => { if (!open) setGraphSystem(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Relationsdiagram – {graphSystem?.system_name}
            </DialogTitle>
          </DialogHeader>
          {graphSystem && (
            <SystemRelationshipGraph
              systemName={graphSystem.system_name}
              servers={serversBySystem[graphSystem.id] || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
