import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, DollarSign, Info } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface BudgetCompensation {
  id: string;
  owning_organization_id: string;
  amount: number;
  year: number;
  imported_by: string | null;
  imported_at: string;
  created_at: string;
}

interface OwningOrganization {
  id: string;
  name: string;
}

export default function BudgetCompensationsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [compensations, setCompensations] = useState<BudgetCompensation[]>([]);
  const [organizations, setOrganizations] = useState<OwningOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<{ orgName: string; amount: number; year: number }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [compRes, orgRes] = await Promise.all([
        supabase.from('budget_compensations').select('*').order('year', { ascending: false }),
        supabase.from('owning_organizations').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (compRes.error) throw compRes.error;
      if (orgRes.error) throw orgRes.error;

      setCompensations(compRes.data || []);
      setOrganizations(orgRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Fel', description: 'Kunde inte ladda data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function getOrgName(orgId: string) {
    return organizations.find(o => o.id === orgId)?.name || 'Okänd';
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text, file);
    };
    reader.readAsText(file);
  }

  function parseCSV(text: string, file: File) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast({ title: 'Fel', description: 'CSV-filen verkar vara tom.', variant: 'destructive' });
      return;
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const parsed: { orgName: string; amount: number; year: number }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const parts = dataLines[i].split(';').map(p => p.trim().replace(/"/g, ''));
      if (parts.length < 3) {
        // Try comma separator
        const commaParts = dataLines[i].split(',').map(p => p.trim().replace(/"/g, ''));
        if (commaParts.length >= 3) {
          parts.length = 0;
          parts.push(...commaParts);
        } else {
          errors.push(`Rad ${i + 2}: Förväntar 3 kolumner (organisation, belopp, år)`);
          continue;
        }
      }

      const orgName = parts[0];
      const amount = parseFloat(parts[1].replace(/\s/g, '').replace(',', '.'));
      const year = parseInt(parts[2]);

      if (!orgName) {
        errors.push(`Rad ${i + 2}: Organisationsnamn saknas`);
        continue;
      }
      if (isNaN(amount)) {
        errors.push(`Rad ${i + 2}: Ogiltigt belopp "${parts[1]}"`);
        continue;
      }
      if (isNaN(year) || year < 2000 || year > 2100) {
        errors.push(`Rad ${i + 2}: Ogiltigt år "${parts[2]}"`);
        continue;
      }

      // Verify org exists
      const org = organizations.find(o => o.name.toLowerCase() === orgName.toLowerCase());
      if (!org) {
        errors.push(`Rad ${i + 2}: Okänd organisation "${orgName}"`);
        continue;
      }

      parsed.push({ orgName: org.name, amount, year });
    }

    if (errors.length > 0) {
      toast({
        title: `${errors.length} fel vid tolkning`,
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...och ${errors.length - 3} till` : ''),
        variant: 'destructive',
      });
    }

    if (parsed.length > 0) {
      setPreviewData(parsed);
      setCsvFile(file);
      setPreviewOpen(true);
    }
  }

  async function handleImport() {
    if (!previewData.length || !user) return;

    setImporting(true);
    try {
      const rows = previewData.map(row => {
        const org = organizations.find(o => o.name === row.orgName)!;
        return {
          owning_organization_id: org.id,
          amount: row.amount,
          year: row.year,
          imported_by: user.id,
        };
      });

      const { error } = await supabase.from('budget_compensations').insert(rows);
      if (error) throw error;

      toast({ title: 'Import klar', description: `${rows.length} kompensationer importerades.` });
      setPreviewOpen(false);
      setPreviewData([]);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData();
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Fel', description: 'Kunde inte importera data.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Är du säker på att du vill ta bort denna kompensation?')) return;

    try {
      const { error } = await supabase.from('budget_compensations').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Borttagen' });
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Fel', description: 'Kunde inte ta bort.', variant: 'destructive' });
    }
  }

  async function handleDeleteByYear(year: number) {
    if (!confirm(`Är du säker på att du vill ta bort alla kompensationer för ${year}?`)) return;

    try {
      const { error } = await supabase.from('budget_compensations').delete().eq('year', year);
      if (error) throw error;
      toast({ title: `Alla kompensationer för ${year} borttagna` });
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Fel', description: 'Kunde inte ta bort.', variant: 'destructive' });
    }
  }

  // Group by year
  const years = [...new Set(compensations.map(c => c.year))].sort((a, b) => b - a);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Import section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importera budgetkompensationer
          </CardTitle>
          <CardDescription>
            Ladda upp en CSV-fil med kolumnerna: <strong>Ägande organisation</strong>, <strong>Belopp</strong>, <strong>År</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="csv-upload" className="sr-only">Välj CSV-fil</Label>
              <Input
                id="csv-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Filen ska ha semikolon (;) eller komma (,) som separator. 
              Organisationsnamnen måste matcha befintliga ägande organisationer exakt.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Data per year */}
      {years.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga budgetkompensationer inlästa ännu.
          </CardContent>
        </Card>
      ) : (
        years.map(year => {
          const yearData = compensations.filter(c => c.year === year);
          const totalAmount = yearData.reduce((sum, c) => sum + c.amount, 0);

          return (
            <Card key={year}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Budgetkompensationer {year}
                  </CardTitle>
                  <CardDescription>
                    {yearData.length} poster • Totalt: {formatAmount(totalAmount)}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteByYear(year)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Ta bort alla
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ägande organisation</TableHead>
                      <TableHead className="text-right">Belopp</TableHead>
                      <TableHead>Importerad</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearData.map(comp => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-medium">
                          {getOrgName(comp.owning_organization_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(comp.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(comp.imported_at), 'd MMM yyyy', { locale: sv })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(comp.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Förhandsgranskning av import</DialogTitle>
            <DialogDescription>
              {previewData.length} rader tolkades från CSV-filen.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                  <TableHead>År</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.orgName}</TableCell>
                    <TableCell className="text-right">{formatAmount(row.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.year}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Avbryt</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importera {previewData.length} rader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
