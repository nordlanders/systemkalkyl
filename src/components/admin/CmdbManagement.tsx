import { useState, useRef } from 'react';
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
  Upload, Search, Trash2, Edit, Plus, Server, Cpu, HardDrive, MemoryStick,
  ArrowUpDown, Download,
} from 'lucide-react';

interface CmdbAsset {
  id: string;
  system_name: string;
  hostname: string | null;
  os: string | null;
  environment: string | null;
  datacenter: string | null;
  vcpu: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  server_count: number | null;
  ip_address: string | null;
  vlan: string | null;
  status: string | null;
  responsible_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  system_name: '',
  hostname: '',
  os: '',
  environment: 'production',
  datacenter: '',
  vcpu: 0,
  ram_gb: 0,
  disk_gb: 0,
  server_count: 1,
  ip_address: '',
  vlan: '',
  status: 'active',
  responsible_person: '',
  notes: '',
};

type SortField = keyof CmdbAsset;

export default function CmdbManagement() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CmdbAsset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sortField, setSortField] = useState<SortField>('system_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['cmdb-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmdb_assets')
        .select('*')
        .order('system_name');
      if (error) throw error;
      return data as CmdbAsset[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase
          .from('cmdb_assets')
          .update(values)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cmdb_assets')
          .insert({ ...values, created_by: user?.id, imported_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmdb-assets'] });
      setDialogOpen(false);
      setEditingAsset(null);
      setForm(emptyForm);
      toast({ title: editingAsset ? 'Uppdaterad' : 'Skapad', description: 'CMDB-posten har sparats.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cmdb_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmdb-assets'] });
      toast({ title: 'Borttagen', description: 'Posten har tagits bort.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    },
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      toast({ title: 'Fel', description: 'CSV-filen måste ha en rubrikrad och minst en datarad.', variant: 'destructive' });
      return;
    }

    const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const fieldMap: Record<string, string> = {
      'systemnamn': 'system_name',
      'system_name': 'system_name',
      'hostname': 'hostname',
      'os': 'os',
      'operativsystem': 'os',
      'miljö': 'environment',
      'environment': 'environment',
      'datacenter': 'datacenter',
      'vcpu': 'vcpu',
      'ram_gb': 'ram_gb',
      'ram': 'ram_gb',
      'disk_gb': 'disk_gb',
      'disk': 'disk_gb',
      'diskutrymme': 'disk_gb',
      'servrar': 'server_count',
      'server_count': 'server_count',
      'antal_servrar': 'server_count',
      'ip': 'ip_address',
      'ip_address': 'ip_address',
      'vlan': 'vlan',
      'status': 'status',
      'ansvarig': 'responsible_person',
      'responsible_person': 'responsible_person',
      'anteckningar': 'notes',
      'notes': 'notes',
    };

    const colMap = headers.map((h) => fieldMap[h] || null);
    const rows: Array<{ system_name: string; [key: string]: unknown }> = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(';').map((v) => v.trim());
      const row: Record<string, unknown> = { created_by: user?.id, imported_by: user?.id };
      colMap.forEach((field, idx) => {
        if (!field) return;
        const val = vals[idx] || '';
        if (['vcpu', 'ram_gb', 'disk_gb', 'server_count'].includes(field)) {
          row[field] = parseFloat(val.replace(',', '.')) || 0;
        } else {
          row[field] = val;
        }
      });
      if (row.system_name) rows.push(row);
    }

    if (!rows.length) {
      toast({ title: 'Fel', description: 'Inga giltiga rader hittades. Kontrollera att kolumnen "Systemnamn" finns.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('cmdb_assets').insert(rows);
    if (error) {
      toast({ title: 'Importfel', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['cmdb-assets'] });
      toast({ title: 'Import klar', description: `${rows.length} poster importerade.` });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportCsv = () => {
    const headers = ['Systemnamn', 'Hostname', 'OS', 'Miljö', 'Datacenter', 'vCPU', 'RAM (GB)', 'Disk (GB)', 'Antal servrar', 'IP', 'VLAN', 'Status', 'Ansvarig', 'Anteckningar'];
    const csvRows = [headers.join(';')];
    filtered.forEach((a) => {
      csvRows.push([
        a.system_name, a.hostname || '', a.os || '', a.environment || '', a.datacenter || '',
        a.vcpu ?? 0, a.ram_gb ?? 0, a.disk_gb ?? 0, a.server_count ?? 0,
        a.ip_address || '', a.vlan || '', a.status || '', a.responsible_person || '', a.notes || '',
      ].join(';'));
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cmdb-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (asset: CmdbAsset) => {
    setEditingAsset(asset);
    setForm({
      system_name: asset.system_name,
      hostname: asset.hostname || '',
      os: asset.os || '',
      environment: asset.environment || 'production',
      datacenter: asset.datacenter || '',
      vcpu: asset.vcpu ?? 0,
      ram_gb: asset.ram_gb ?? 0,
      disk_gb: asset.disk_gb ?? 0,
      server_count: asset.server_count ?? 1,
      ip_address: asset.ip_address || '',
      vlan: asset.vlan || '',
      status: asset.status || 'active',
      responsible_person: asset.responsible_person || '',
      notes: asset.notes || '',
    });
    setDialogOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = assets
    .filter((a) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = !s || [a.system_name, a.hostname, a.os, a.ip_address, a.responsible_person, a.datacenter]
        .some((v) => v?.toLowerCase().includes(s));
      const matchesEnv = envFilter === 'all' || a.environment === envFilter;
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesEnv && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'sv', { numeric: true });
      return sortAsc ? cmp : -cmp;
    });

  // Summary stats
  const totalServers = assets.reduce((s, a) => s + (a.server_count ?? 0), 0);
  const totalVcpu = assets.reduce((s, a) => s + (a.vcpu ?? 0), 0);
  const totalRam = assets.reduce((s, a) => s + Number(a.ram_gb ?? 0), 0);
  const totalDisk = assets.reduce((s, a) => s + Number(a.disk_gb ?? 0), 0);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Server className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">System</p><p className="text-2xl font-bold">{assets.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Cpu className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Totalt vCPU</p><p className="text-2xl font-bold">{totalVcpu}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><MemoryStick className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Totalt RAM</p><p className="text-2xl font-bold">{totalRam} GB</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><HardDrive className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Totalt disk</p><p className="text-2xl font-bold">{totalDisk} GB</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>CMDB - Infrastrukturregister</CardTitle>
              <CardDescription>Hantera servrar, system och infrastrukturresurser</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Importera CSV
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
                  <Button variant="outline" size="sm" onClick={() => { setEditingAsset(null); setForm(emptyForm); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Lägg till
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-1" /> Exportera
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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

          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader field="system_name" label="Systemnamn" />
                    <SortHeader field="hostname" label="Hostname" />
                    <SortHeader field="environment" label="Miljö" />
                    <SortHeader field="vcpu" label="vCPU" />
                    <SortHeader field="ram_gb" label="RAM (GB)" />
                    <SortHeader field="disk_gb" label="Disk (GB)" />
                    <SortHeader field="server_count" label="Servrar" />
                    <SortHeader field="os" label="OS" />
                    <SortHeader field="ip_address" label="IP" />
                    <SortHeader field="status" label="Status" />
                    <SortHeader field="responsible_person" label="Ansvarig" />
                    {isAdmin && <TableHead className="w-20">Åtgärder</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Inga poster hittades</TableCell></TableRow>
                  ) : filtered.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.system_name}</TableCell>
                      <TableCell>{asset.hostname}</TableCell>
                      <TableCell>
                        <Badge variant={asset.environment === 'production' ? 'default' : 'secondary'}>
                          {asset.environment === 'production' ? 'Prod' : asset.environment === 'test' ? 'Test' : asset.environment === 'development' ? 'Dev' : asset.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{asset.vcpu}</TableCell>
                      <TableCell className="text-right">{asset.ram_gb}</TableCell>
                      <TableCell className="text-right">{asset.disk_gb}</TableCell>
                      <TableCell className="text-right">{asset.server_count}</TableCell>
                      <TableCell>{asset.os}</TableCell>
                      <TableCell className="font-mono text-xs">{asset.ip_address}</TableCell>
                      <TableCell>
                        <Badge variant={asset.status === 'active' ? 'default' : 'outline'}>
                          {asset.status === 'active' ? 'Aktiv' : asset.status === 'inactive' ? 'Inaktiv' : 'Avvecklad'}
                        </Badge>
                      </TableCell>
                      <TableCell>{asset.responsible_person}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(asset)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('Ta bort denna post?')) deleteMutation.mutate(asset.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Visar {filtered.length} av {assets.length} poster</p>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Redigera systempost' : 'Lägg till systempost'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate({ ...form, ...(editingAsset ? { id: editingAsset.id } : {}) }); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div><Label>Systemnamn *</Label><Input value={form.system_name} onChange={(e) => setForm({ ...form, system_name: e.target.value })} required /></div>
              <div><Label>Hostname</Label><Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} /></div>
              <div><Label>OS</Label><Input value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} placeholder="t.ex. Windows Server 2022" /></div>
              <div>
                <Label>Miljö</Label>
                <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Produktion</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="development">Utveckling</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Datacenter</Label><Input value={form.datacenter} onChange={(e) => setForm({ ...form, datacenter: e.target.value })} /></div>
              <div><Label>vCPU</Label><Input type="number" value={form.vcpu} onChange={(e) => setForm({ ...form, vcpu: Number(e.target.value) })} min={0} /></div>
              <div><Label>RAM (GB)</Label><Input type="number" value={form.ram_gb} onChange={(e) => setForm({ ...form, ram_gb: Number(e.target.value) })} min={0} /></div>
              <div><Label>Disk (GB)</Label><Input type="number" value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: Number(e.target.value) })} min={0} /></div>
              <div><Label>Antal servrar</Label><Input type="number" value={form.server_count} onChange={(e) => setForm({ ...form, server_count: Number(e.target.value) })} min={0} /></div>
              <div><Label>IP-adress</Label><Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} /></div>
              <div><Label>VLAN</Label><Input value={form.vlan} onChange={(e) => setForm({ ...form, vlan: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="decommissioned">Avvecklad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ansvarig</Label><Input value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Anteckningar</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>{editingAsset ? 'Spara' : 'Lägg till'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
