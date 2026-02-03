import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Download,
  Search
} from 'lucide-react';

interface ConfigurationItem {
  id: string;
  ci_number: string;
  system_name: string;
  system_owner: string | null;
  system_administrator: string | null;
  organization: string | null;
  is_active: boolean;
  created_at: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function ConfigurationItemsManagement() {
  const [items, setItems] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('configuration_items')
        .select('*')
        .order('ci_number');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading CI items:', error);
      toast({
        title: 'Fel vid hämtning',
        description: 'Kunde inte hämta CI-poster.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
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

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        throw new Error('Filen innehåller ingen data (endast rubrikrad eller tom).');
      }

      // Validate header row
      const header = rows[0].map(h => h.toLowerCase().trim());
      const expectedColumns = ['ci nummer', 'systemnamn', 'systemägare', 'systemförvaltare', 'organisation'];
      
      // Map column indices
      const ciNumberIdx = header.findIndex(h => h === 'ci nummer' || h === 'ci_nummer' || h === 'cinummer' || h === 'ci-nummer');
      const systemNameIdx = header.findIndex(h => h === 'systemnamn' || h === 'system_name' || h === 'system namn');
      const systemOwnerIdx = header.findIndex(h => h === 'systemägare' || h === 'system_owner' || h === 'system ägare');
      const systemAdminIdx = header.findIndex(h => h === 'systemförvaltare' || h === 'system_administrator' || h === 'system förvaltare');
      const organizationIdx = header.findIndex(h => h === 'organisation' || h === 'organization');

      if (ciNumberIdx === -1 || systemNameIdx === -1) {
        throw new Error('Obligatoriska kolumner saknas. "CI nummer" och "Systemnamn" måste finnas.');
      }

      const dataRows = rows.slice(1);
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const ciNumber = row[ciNumberIdx]?.trim();
        const systemName = row[systemNameIdx]?.trim();

        if (!ciNumber || !systemName) {
          errors.push(`Rad ${i + 2}: CI nummer eller Systemnamn saknas.`);
          failed++;
          continue;
        }

        const itemData = {
          ci_number: ciNumber,
          system_name: systemName,
          system_owner: systemOwnerIdx >= 0 ? row[systemOwnerIdx]?.trim() || null : null,
          system_administrator: systemAdminIdx >= 0 ? row[systemAdminIdx]?.trim() || null : null,
          organization: organizationIdx >= 0 ? row[organizationIdx]?.trim() || null : null,
          created_by: user?.id,
        };

        // Upsert - update if CI number exists, otherwise insert
        const { error } = await supabase
          .from('configuration_items')
          .upsert(itemData, { onConflict: 'ci_number' });

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
          description: `${success} poster importerades${failed > 0 ? `, ${failed} misslyckades` : ''}.`,
        });
        loadItems();
      } else {
        toast({
          title: 'Import misslyckades',
          description: 'Inga poster kunde importeras.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: 'Fel vid import',
        description: error instanceof Error ? error.message : 'Kunde inte läsa CSV-filen.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Är du säker på att du vill ta bort denna CI-post?')) return;

    try {
      const { error } = await supabase
        .from('configuration_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'CI-post borttagen',
        description: 'CI-posten har tagits bort.',
      });
      loadItems();
    } catch (error) {
      console.error('Error deleting CI:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort CI-posten.',
        variant: 'destructive',
      });
    }
  }

  function downloadTemplate() {
    const header = 'CI nummer;Systemnamn;Systemägare;Systemförvaltare;Organisation';
    const exampleRow = 'CI-12345;E-tjänstplattform;Anna Andersson;Erik Eriksson;IT-avdelningen';
    const content = `${header}\n${exampleRow}`;
    
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ci_mall.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredItems = items.filter(item =>
    item.ci_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.system_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.system_owner?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.organization?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configuration Items (CI)</h2>
          <p className="text-muted-foreground">Hantera CI-poster genom att importera från CSV-fil</p>
        </div>
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
                <li><strong>CI nummer</strong> (obligatorisk) - Unikt identifieringsnummer</li>
                <li><strong>Systemnamn</strong> (obligatorisk) - Namnet på systemet</li>
                <li><strong>Systemägare</strong> - Ansvarig person för systemet</li>
                <li><strong>Systemförvaltare</strong> - Person som förvaltar systemet</li>
                <li><strong>Organisation</strong> - Tillhörande organisation</li>
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
                className="cursor-pointer"
              />
            </div>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Ladda ner mall
            </Button>
          </div>

          {importing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importerar...
            </div>
          )}

          {importResult && (
            <Alert variant={importResult.failed > 0 ? 'destructive' : 'default'}>
              {importResult.failed > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>Importresultat</AlertTitle>
              <AlertDescription>
                <p>{importResult.success} poster importerades, {importResult.failed} misslyckades.</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-sm max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...och {importResult.errors.length - 10} fler fel</li>
                    )}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* List section */}
      <Card>
        <CardHeader>
          <CardTitle>Registrerade CI-poster</CardTitle>
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
                className="pl-10"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {items.length === 0 ? 'Inga CI-poster har importerats ännu.' : 'Inga poster matchar sökningen.'}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CI nummer</TableHead>
                    <TableHead>Systemnamn</TableHead>
                    <TableHead>Systemägare</TableHead>
                    <TableHead>Systemförvaltare</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="w-[80px]">Åtgärder</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.ci_number}</TableCell>
                      <TableCell>{item.system_name}</TableCell>
                      <TableCell>{item.system_owner || '-'}</TableCell>
                      <TableCell>{item.system_administrator || '-'}</TableCell>
                      <TableCell>{item.organization || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
