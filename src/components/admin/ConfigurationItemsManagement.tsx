import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil } from
'lucide-react';

const SERVICE_TYPES = [
  { value: 'Anpassad drift', label: 'Anpassad drift' },
  { value: 'Anpassad förvaltning', label: 'Anpassad förvaltning' },
  { value: 'Bastjänst Digital infrastruktur', label: 'Bastjänst Digital infrastruktur' },
  { value: 'Bastjänst IT infrastruktur', label: 'Bastjänst IT infrastruktur' },
];

interface ConfigurationItem {
  id: string;
  ci_number: string;
  system_name: string;
  system_owner: string | null;
  system_administrator: string | null;
  organization: string | null;
  object_number: string | null;
  service_type: string | null;
  customer_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

type SortKey = 'ci_number' | 'system_name' | 'system_owner' | 'system_administrator' | 'organization' | 'object_number' | 'service_type' | 'is_active';
type SortDir = 'asc' | 'desc';

const ANPASSAD_TYPES = ['Anpassad drift', 'Anpassad förvaltning'];
const BASTJANST_TYPES = ['Bastjänst Digital infrastruktur', 'Bastjänst IT infrastruktur'];

interface OwningOrg {
  id: string;
  name: string;
  is_active: boolean;
}

export default function ConfigurationItemsManagement() {
  const [items, setItems] = useState<ConfigurationItem[]>([]);
  const [owningOrgs, setOwningOrgs] = useState<OwningOrg[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingItem, setEditingItem] = useState<ConfigurationItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ ci_number: '', system_name: '', system_owner: '', system_administrator: '', organization: '', object_number: '', service_type: '', customer_id: '' });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const isBastjanst = BASTJANST_TYPES.includes(editForm.service_type);
  const isAnpassad = ANPASSAD_TYPES.includes(editForm.service_type);

  useEffect(() => {
    loadItems();
    loadOwningOrgs();
    loadCustomers();
  }, []);

  async function loadItems() {
    try {
      const { data, error } = await supabase.
      from('configuration_items').
      select('*').
      order('ci_number');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading CI items:', error);
      toast({
        title: 'Fel vid hämtning',
        description: 'Kunde inte hämta CI-poster.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadOwningOrgs() {
    try {
      const { data, error } = await supabase
        .from('owning_organizations')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setOwningOrgs(data || []);
    } catch (error) {
      console.error('Error loading owning organizations:', error);
    }
  }

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }

  function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    return lines.map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }

  async function readFileWithEncoding(file: File): Promise<string> {
    // Try UTF-8 first
    let text = await file.text();

    // Check if we have encoding issues (common with Swedish chars from Excel)
    if (text.includes('�') || text.includes('Ã¤') || text.includes('Ã¶') || text.includes('Ã¥')) {
      // Try reading with Windows-1252 (common for Swedish Excel exports)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file, 'windows-1252');
      });
    }

    return text;
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await readFileWithEncoding(file);
      const rows = parseCSV(text);

      if (rows.length < 2) {
        throw new Error('Filen innehåller ingen data (endast rubrikrad eller tom).');
      }

      // Validate header row
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const expectedColumns = ['ci nummer', 'systemnamn', 'systemägare', 'systemförvaltare', 'organisation', 'objektnummer'];

      // Map column indices
      const ciNumberIdx = header.findIndex((h) => h === 'ci nummer' || h === 'ci_nummer' || h === 'cinummer' || h === 'ci-nummer');
      const systemNameIdx = header.findIndex((h) => h === 'systemnamn' || h === 'system_name' || h === 'system namn');
      const systemOwnerIdx = header.findIndex((h) => h === 'systemägare' || h === 'system_owner' || h === 'system ägare');
      const systemAdminIdx = header.findIndex((h) => h === 'systemförvaltare' || h === 'system_administrator' || h === 'system förvaltare');
      const organizationIdx = header.findIndex((h) => h === 'organisation' || h === 'organization');
      const objectNumberIdx = header.findIndex((h) => h === 'objektnummer' || h === 'object_number' || h === 'objekt nummer' || h === 'objekt');

      if (ciNumberIdx === -1 && objectNumberIdx === -1) {
        throw new Error('Minst en av kolumnerna "CI nummer" eller "Objektnummer" måste finnas, samt "Systemnamn".');
      }
      if (systemNameIdx === -1) {
        throw new Error('Obligatorisk kolumn "Systemnamn" saknas.');
      }

      const dataRows = rows.slice(1);
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const ciNumber = ciNumberIdx >= 0 ? row[ciNumberIdx]?.trim() : '';
        const systemName = row[systemNameIdx]?.trim();
        const objectNumber = objectNumberIdx >= 0 ? row[objectNumberIdx]?.trim() : '';

        if (!ciNumber && !objectNumber) {
          errors.push(`Rad ${i + 2}: Varken CI nummer eller Objektnummer angivet.`);
          failed++;
          continue;
        }
        if (!systemName) {
          errors.push(`Rad ${i + 2}: Systemnamn saknas.`);
          failed++;
          continue;
        }

        const itemData = {
          ci_number: ciNumber || null,
          system_name: systemName,
          system_owner: systemOwnerIdx >= 0 ? row[systemOwnerIdx]?.trim() || null : null,
          system_administrator: systemAdminIdx >= 0 ? row[systemAdminIdx]?.trim() || null : null,
          organization: organizationIdx >= 0 ? row[organizationIdx]?.trim() || null : null,
          object_number: objectNumberIdx >= 0 ? row[objectNumberIdx]?.trim() || null : null,
          created_by: user?.id
        };

        // Insert new row with unique UUID
        const { error } = await supabase.
        from('configuration_items').
        insert(itemData);

        if (error) {
          errors.push(`Rad ${i + 2}: ${error.message}`);
          failed++;
        } else {
          success++;
        }
      }

      setImportResult({ success, failed, errors });

      if (success > 0) {
        toast({
          title: 'Import slutförd',
          description: `${success} poster importerades${failed > 0 ? `, ${failed} misslyckades` : ''}.`
        });
        loadItems();
      } else {
        toast({
          title: 'Import misslyckades',
          description: 'Inga poster kunde importeras.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: 'Fel vid import',
        description: error instanceof Error ? error.message : 'Kunde inte läsa CSV-filen.',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleToggleActive(id: string, currentlyActive: boolean) {
    try {
      const { error } = await supabase.
      from('configuration_items').
      update({ is_active: !currentlyActive }).
      eq('id', id);

      if (error) throw error;

      toast({
        title: currentlyActive ? 'CI-post inaktiverad' : 'CI-post aktiverad',
        description: currentlyActive ?
        'CI-posten har markerats som inaktiv.' :
        'CI-posten har markerats som aktiv.'
      });
      loadItems();
    } catch (error) {
      console.error('Error toggling CI status:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte ändra status på CI-posten.',
        variant: 'destructive'
      });
    }
  }

  function openEditDialog(item: ConfigurationItem) {
    setEditingItem(item);
    setEditForm({
      ci_number: item.ci_number,
      system_name: item.system_name,
      system_owner: item.system_owner || '',
      system_administrator: item.system_administrator || '',
      organization: item.organization || '',
      object_number: item.object_number || '',
      service_type: item.service_type || '',
      customer_id: item.customer_id || '',
    });
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    if (!editForm.ci_number.trim() && !editForm.object_number.trim()) {
      toast({ title: 'Validering', description: 'Antingen CI nummer eller Objektnummer måste anges.', variant: 'destructive' });
      return;
    }
    if (!editForm.system_name.trim()) {
      toast({ title: 'Validering', description: 'Systemnamn är obligatoriskt.', variant: 'destructive' });
      return;
    }
    if (!editForm.organization.trim()) {
      toast({ title: 'Validering', description: 'Ägande organisation är obligatorisk.', variant: 'destructive' });
      return;
    }
    if (ANPASSAD_TYPES.includes(editForm.service_type) && !editForm.customer_id) {
      toast({ title: 'Validering', description: 'Kund är obligatorisk för anpassade tjänster.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('configuration_items')
        .update({
          ci_number: editForm.ci_number.trim() || null,
          system_name: editForm.system_name.trim(),
          system_owner: editForm.system_owner.trim() || null,
          system_administrator: editForm.system_administrator.trim() || null,
          organization: editForm.organization.trim() || null,
          object_number: editForm.object_number.trim() || null,
          service_type: editForm.service_type || null,
          customer_id: editForm.customer_id || null,
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      toast({ title: 'Sparad', description: 'CI-posten har uppdaterats.' });
      setEditingItem(null);
      loadItems();
    } catch (error) {
      console.error('Error updating CI:', error);
      toast({ title: 'Fel', description: 'Kunde inte spara ändringarna.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function openCreateDialog() {
    setIsCreating(true);
    setEditingItem(null);
    setEditForm({ ci_number: '', system_name: '', system_owner: '', system_administrator: '', organization: '', object_number: '', service_type: '', customer_id: '' });
  }

  async function handleCreate() {
    if (!editForm.ci_number.trim() && !editForm.object_number.trim()) {
      toast({ title: 'Validering', description: 'Antingen CI nummer eller Objektnummer måste anges.', variant: 'destructive' });
      return;
    }
    if (!editForm.system_name.trim()) {
      toast({ title: 'Validering', description: 'Systemnamn är obligatoriskt.', variant: 'destructive' });
      return;
    }
    if (BASTJANST_TYPES.includes(editForm.service_type) && !editForm.organization.trim()) {
      toast({ title: 'Validering', description: 'Ägande organisation är obligatorisk för bastjänster.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('configuration_items')
        .insert({
          ci_number: editForm.ci_number.trim() || null,
          system_name: editForm.system_name.trim(),
          system_owner: editForm.system_owner.trim() || null,
          system_administrator: editForm.system_administrator.trim() || null,
          organization: editForm.organization.trim() || null,
          object_number: editForm.object_number.trim() || null,
          service_type: editForm.service_type || null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Skapad', description: 'Ny CI-post har skapats.' });
      setIsCreating(false);
      loadItems();
    } catch (error) {
      console.error('Error creating CI:', error);
      toast({ title: 'Fel', description: 'Kunde inte skapa CI-posten.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const header = 'CI nummer;Systemnamn;Systemägare;Systemförvaltare;Organisation;Objektnummer';
    const exampleRow = 'CI-12345;E-tjänstplattform;Anna Andersson;Erik Eriksson;IT-avdelningen;OBJ-001';
    const content = `${header}\n${exampleRow}`;

    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ci_mall.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  }

  const filteredItems = items.filter((item) =>
  (item.ci_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.system_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.system_owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.organization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;
    let aVal: string | boolean = '';
    let bVal: string | boolean = '';
    if (sortKey === 'is_active') {
      aVal = a.is_active;
      bVal = b.is_active;
      if (aVal === bVal) return 0;
      return sortDir === 'asc' ? (aVal ? -1 : 1) : (aVal ? 1 : -1);
    }
    aVal = (a[sortKey] || '').toLowerCase();
    bVal = (b[sortKey] || '').toLowerCase();
    const cmp = aVal.localeCompare(bVal, 'sv');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Objekt och Configuration Items (CI)</h2>
          <p className="text-muted-foreground">Hantera CI-poster genom import eller manuellt skapande</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateDialog} className="gap-2">
            + Ny CI-post
          </Button>
        )}
      </div>

      {/* Import section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importera från CSV
          </CardTitle>
          <CardDescription>
            Ladda upp en CSV-fil med CI-information. Befintliga poster uppdateras baserat på CI nummer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Förväntad kolumnstruktur</AlertTitle>
            <AlertDescription>
              <p className="mb-2">CSV-filen ska innehålla följande kolumner (semikolon eller komma som separator):</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>CI nummer</strong>CI nummer  - Unikt identifieringsnummer</li>
                <li><strong>Systemnamn</strong> (obligatorisk) - Namnet på systemet</li>
                <li><strong>Systemägare</strong>Systemägare - Ansvarig ägare för systemet</li>
                <li><strong>Systemförvaltare</strong> - Person som förvaltar systemet</li>
                <li><strong>Organisation</strong> - Tillhörande organisation</li>
                <li><strong>Objektnummer</strong> - Objektnummer kopplat till CI-posten</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="csvFile" className="sr-only">Välj CSV-fil</Label>
              <Input
                id="csvFile"
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                disabled={importing || !isAdmin}
                className="cursor-pointer" />

            </div>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="gap-2">

              <Download className="h-4 w-4" />
              Ladda ner mall
            </Button>
          </div>

          {importing &&
          <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importerar...
            </div>
          }

          {importResult &&
          <Alert variant={importResult.failed > 0 ? 'destructive' : 'default'}>
              {importResult.failed > 0 ?
            <AlertCircle className="h-4 w-4" /> :

            <CheckCircle2 className="h-4 w-4" />
            }
              <AlertTitle>Importresultat</AlertTitle>
              <AlertDescription>
                <p>{importResult.success} poster importerades, {importResult.failed} misslyckades.</p>
                {importResult.errors.length > 0 &&
              <ul className="mt-2 list-disc list-inside text-sm max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((err, i) =>
                <li key={i}>{err}</li>
                )}
                    {importResult.errors.length > 10 &&
                <li>...och {importResult.errors.length - 10} fler fel</li>
                }
                  </ul>
              }
              </AlertDescription>
            </Alert>
          }
        </CardContent>
      </Card>

      {/* List section */}
      <Card>
        <CardHeader>
          <CardTitle>Objekt och CI-poster</CardTitle>
          <CardDescription>
            {items.length} poster totalt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök på CI nummer, systemnamn, ägare eller organisation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10" />

            </div>
          </div>

          {filteredItems.length === 0 ?
          <p className="text-center text-muted-foreground py-8">
              {items.length === 0 ? 'Inga CI-poster har importerats ännu.' : 'Inga poster matchar sökningen.'}
            </p> :

          <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('ci_number')}>
                       <span className="flex items-center">CI nummer<SortIcon column="ci_number" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('system_name')}>
                       <span className="flex items-center">Systemnamn<SortIcon column="system_name" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('system_owner')}>
                       <span className="flex items-center">Systemägare<SortIcon column="system_owner" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('system_administrator')}>
                       <span className="flex items-center">Systemförvaltare<SortIcon column="system_administrator" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('organization')}>
                       <span className="flex items-center">Organisation<SortIcon column="organization" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('object_number')}>
                       <span className="flex items-center">Objektnummer<SortIcon column="object_number" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('service_type')}>
                       <span className="flex items-center">Tjänstetyp<SortIcon column="service_type" /></span>
                     </TableHead>
                     <TableHead className="cursor-pointer select-none" onClick={() => handleSort('is_active')}>
                       <span className="flex items-center">Status<SortIcon column="is_active" /></span>
                     </TableHead>
                     {isAdmin && <TableHead className="w-[80px]">Åtgärder</TableHead>}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) =>
                <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.ci_number}</TableCell>
                      <TableCell>{item.system_name}</TableCell>
                      <TableCell>{item.system_owner || '-'}</TableCell>
                      <TableCell>{item.system_administrator || '-'}</TableCell>
                      <TableCell>{item.organization || '-'}</TableCell>
                      <TableCell>{item.object_number || '-'}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {item.service_type || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      {isAdmin &&
                  <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                              className="text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(item.id, item.is_active)}
                              className={item.is_active ? 'text-muted-foreground hover:text-foreground' : 'text-primary hover:text-primary'}>
                              {item.is_active ? 'Inaktivera' : 'Aktivera'}
                            </Button>
                          </div>
                        </TableCell>
                  }
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          }
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={!!editingItem || isCreating} onOpenChange={(open) => { if (!open) { setEditingItem(null); setIsCreating(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Skapa ny CI-post' : 'Redigera CI-post'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-ci">CI nummer</Label>
              <Input id="edit-ci" value={editForm.ci_number} onChange={(e) => setEditForm({ ...editForm, ci_number: e.target.value })} placeholder="Krävs om objektnummer saknas" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Systemnamn *</Label>
              <Input id="edit-name" value={editForm.system_name} onChange={(e) => setEditForm({ ...editForm, system_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner">Systemägare</Label>
              <Input id="edit-owner" value={editForm.system_owner} onChange={(e) => setEditForm({ ...editForm, system_owner: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-admin">Systemförvaltare</Label>
              <Input id="edit-admin" value={editForm.system_administrator} onChange={(e) => setEditForm({ ...editForm, system_administrator: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tjänstetyp</Label>
              <Select value={editForm.service_type} onValueChange={(v) => setEditForm({ ...editForm, service_type: v, organization: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj tjänstetyp" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-org">
                {isBastjanst ? 'Ägande organisation inom DigIT av system och/eller kalkyl' : 'Organisation'}
                {isBastjanst && <span className="text-destructive"> *</span>}
              </Label>
              {isBastjanst ? (
                <Select value={editForm.organization} onValueChange={(v) => setEditForm({ ...editForm, organization: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj ägande organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {owningOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.name}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="edit-org" value={editForm.organization} onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-obj">Objektnummer</Label>
              <Input id="edit-obj" value={editForm.object_number} onChange={(e) => setEditForm({ ...editForm, object_number: e.target.value })} placeholder="Krävs om CI nummer saknas" />
            </div>
            <p className="text-xs text-muted-foreground">Minst ett av CI nummer eller Objektnummer måste anges.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingItem(null); setIsCreating(false); }}>Avbryt</Button>
            <Button onClick={isCreating ? handleCreate : handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isCreating ? 'Skapa' : 'Spara'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}