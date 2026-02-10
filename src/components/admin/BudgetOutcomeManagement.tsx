import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Upload, Trash2, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface BudgetRow {
  ansvar: string;
  ukonto: string;
  vht: string;
  akt: string;
  proj: string;
  objekt: string;
  mot: string;
  kgrp: string;
  budget_2025: number;
  utfall_ack: number;
  diff: number;
  budget_2026: number;
}

const CSV_HEADERS = ['ANSVAR', 'UKONTO', 'VHT', 'AKT', 'PROJ', 'OBJEKT', 'MOT', 'KGRP', 'BUDGET 2025', 'UTFALL Ack', 'Diff', 'BUDGET 2026'];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ';' || char === ',') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(val: string): number {
  if (!val || val.trim() === '') return 0;
  // Handle Swedish number format: spaces as thousands sep, comma as decimal
  const cleaned = val.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export default function BudgetOutcomeManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BudgetRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: existingData = [], isLoading } = useQuery({
    queryKey: ['budget-outcomes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('*')
        .order('ansvar', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('budget_outcomes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-outcomes'] });
      toast({ title: 'All data raderad' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fel vid radering', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setParseError('Filen innehåller ingen data.');
          return;
        }

        const headerLine = parseCsvLine(lines[0]);
        // Validate headers loosely
        const normalizedHeaders = headerLine.map(h => h.toUpperCase().trim());
        const expectedFirst = ['ANSVAR', 'UKONTO'];
        if (!expectedFirst.every(eh => normalizedHeaders.includes(eh))) {
          setParseError('CSV-filen saknar förväntade kolumner (ANSVAR, UKONTO). Kontrollera formatet.');
          return;
        }

        const rows: BudgetRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          if (cols.length < 12) continue;
          rows.push({
            ansvar: cols[0] || '',
            ukonto: cols[1] || '',
            vht: cols[2] || '',
            akt: cols[3] || '',
            proj: cols[4] || '',
            objekt: cols[5] || '',
            mot: cols[6] || '',
            kgrp: cols[7] || '',
            budget_2025: parseNumber(cols[8]),
            utfall_ack: parseNumber(cols[9]),
            diff: parseNumber(cols[10]),
            budget_2026: parseNumber(cols[11]),
          });
        }

        if (rows.length === 0) {
          setParseError('Inga giltiga rader hittades i filen.');
          return;
        }

        setPreview(rows);
      } catch {
        setParseError('Kunde inte läsa filen. Kontrollera formatet.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      // Insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < preview.length; i += batchSize) {
        const batch = preview.slice(i, i + batchSize).map(row => ({
          ...row,
          imported_by: user?.id,
        }));
        const { error } = await supabase.from('budget_outcomes').insert(batch);
        if (error) throw error;
      }
      toast({ title: 'Import klar', description: `${preview.length} rader importerade.` });
      setPreview([]);
      queryClient.invalidateQueries({ queryKey: ['budget-outcomes'] });
    } catch (err: any) {
      toast({ title: 'Importfel', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(num);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget & Utfall</h1>
          <p className="text-muted-foreground">Importera budget- och utfallsdata från CSV-fil</p>
        </div>
      </div>

      {/* Upload section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importera CSV
          </CardTitle>
          <CardDescription>
            Välj en CSV-fil med kolumnerna: {CSV_HEADERS.join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Välj CSV-fil
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            {existingData.length > 0 && (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Radera all befintlig data ({existingData.length} rader)
              </Button>
            )}
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview section */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Förhandsvisning ({preview.length} rader)</CardTitle>
            <CardDescription>Granska data innan import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto max-h-96 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {CSV_HEADERS.map(h => (
                      <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{row.ansvar}</TableCell>
                      <TableCell className="text-xs">{row.ukonto}</TableCell>
                      <TableCell className="text-xs">{row.vht}</TableCell>
                      <TableCell className="text-xs">{row.akt}</TableCell>
                      <TableCell className="text-xs">{row.proj}</TableCell>
                      <TableCell className="text-xs">{row.objekt}</TableCell>
                      <TableCell className="text-xs">{row.mot}</TableCell>
                      <TableCell className="text-xs">{row.kgrp}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.budget_2025)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.utfall_ack)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.diff)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.budget_2026)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.length > 50 && (
              <p className="text-sm text-muted-foreground">Visar 50 av {preview.length} rader</p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importera {preview.length} rader
              </Button>
              <Button variant="outline" onClick={() => setPreview([])}>Avbryt</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing data */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : existingData.length > 0 && preview.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Importerad data ({existingData.length} rader)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {CSV_HEADERS.map(h => (
                      <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingData.slice(0, 100).map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{row.ansvar}</TableCell>
                      <TableCell className="text-xs">{row.ukonto}</TableCell>
                      <TableCell className="text-xs">{row.vht}</TableCell>
                      <TableCell className="text-xs">{row.akt}</TableCell>
                      <TableCell className="text-xs">{row.proj}</TableCell>
                      <TableCell className="text-xs">{row.objekt}</TableCell>
                      <TableCell className="text-xs">{row.mot}</TableCell>
                      <TableCell className="text-xs">{row.kgrp}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.budget_2025)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.utfall_ack)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.diff)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(row.budget_2026)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {existingData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-2">Visar 100 av {existingData.length} rader</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
