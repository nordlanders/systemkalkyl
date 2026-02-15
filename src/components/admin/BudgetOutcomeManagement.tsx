import { useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Upload, Trash2, FileSpreadsheet, Loader2, AlertCircle, Calendar, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

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
  const cleaned = val.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

interface ImportVersion {
  import_date: string;
  extraction_date: string | null;
  import_label: string | null;
  imported_at: string;
  count: number;
}

export default function BudgetOutcomeManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BudgetRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [extractionDate, setExtractionDate] = useState('');
  const [importLabel, setImportLabel] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const { data: existingData = [], isLoading } = useQuery({
    queryKey: ['budget-outcomes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('*')
        .order('import_date', { ascending: false })
        .order('ansvar', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Group data by import_date to create versions
  const versions = useMemo<ImportVersion[]>(() => {
    const map = new Map<string, ImportVersion>();
    existingData.forEach((row: any) => {
      const key = row.import_date;
      if (!map.has(key)) {
        map.set(key, {
          import_date: row.import_date,
          extraction_date: row.extraction_date,
          import_label: row.import_label,
          imported_at: row.imported_at,
          count: 0,
        });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.import_date.localeCompare(a.import_date));
  }, [existingData]);

  const filteredData = useMemo(() => {
    if (!selectedVersion) return [];
    return existingData.filter((row: any) => row.import_date === selectedVersion);
  }, [existingData, selectedVersion]);

  const deleteVersionMutation = useMutation({
    mutationFn: async (importDate: string) => {
      const { error } = await supabase
        .from('budget_outcomes')
        .delete()
        .eq('import_date', importDate);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-outcomes'] });
      setSelectedVersion(null);
      toast({ title: 'Version raderad' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fel vid radering', description: err.message, variant: 'destructive' });
    },
  });

  const parseFileContent = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      setParseError('Filen innehåller ingen data.');
      return;
    }

    const headerLine = parseCsvLine(lines[0]);
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
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setPreview([]);

    // First try reading as ArrayBuffer to detect encoding
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);

        // Check for BOM or try to detect Windows-1252 vs UTF-8
        let text: string;

        // UTF-8 BOM
        if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
          text = new TextDecoder('utf-8').decode(buffer);
        } else {
          // Try UTF-8 first
          const utf8Text = new TextDecoder('utf-8', { fatal: true });
          try {
            text = utf8Text.decode(buffer);
          } catch {
            // Fallback to Windows-1252 (common for Swedish Excel exports)
            text = new TextDecoder('windows-1252').decode(buffer);
          }
        }

        parseFileContent(text);
      } catch {
        setParseError('Kunde inte läsa filen. Kontrollera formatet.');
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const batchSize = 500;
      for (let i = 0; i < preview.length; i += batchSize) {
        const batch = preview.slice(i, i + batchSize).map(row => ({
          ...row,
          imported_by: user?.id,
          import_date: today,
          extraction_date: extractionDate || null,
          import_label: importLabel || null,
        }));
        const { error } = await supabase.from('budget_outcomes').insert(batch);
        if (error) throw error;
      }
      toast({ title: 'Import klar', description: `${preview.length} rader importerade.` });
      setPreview([]);
      setExtractionDate('');
      setImportLabel('');
      queryClient.invalidateQueries({ queryKey: ['budget-outcomes'] });
    } catch (err: any) {
      toast({ title: 'Importfel', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(num);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: sv });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Budget & Utfall</h1>
        <p className="text-muted-foreground">Importera och versionshantera budget- och utfallsdata från CSV-fil</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="extraction-date">Uttagsdatum</Label>
              <Input
                id="extraction-date"
                type="date"
                value={extractionDate}
                onChange={(e) => setExtractionDate(e.target.value)}
                placeholder="Välj uttagsdatum"
              />
              <p className="text-xs text-muted-foreground">Datum då data togs ut ur källsystemet</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-label">Etikett (valfritt)</Label>
              <Input
                id="import-label"
                value={importLabel}
                onChange={(e) => setImportLabel(e.target.value)}
                placeholder="T.ex. 'Månadsrapport januari'"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">Valfri beskrivning av importen</p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2" disabled={!extractionDate || !importLabel.trim()}>
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
            <CardDescription>
              Importdatum: {format(new Date(), 'd MMM yyyy', { locale: sv })}
              {extractionDate && ` · Uttagsdatum: ${formatDate(extractionDate)}`}
              {importLabel && ` · ${importLabel}`}
            </CardDescription>
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

      {/* Version history */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length > 0 && preview.length === 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Importhistorik ({versions.length} versioner)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.import_date}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedVersion === v.import_date
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() =>
                      setSelectedVersion(selectedVersion === v.import_date ? null : v.import_date)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Importerad: {formatDate(v.import_date)}</span>
                          {v.import_label && (
                            <Badge variant="secondary">{v.import_label}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {v.extraction_date
                            ? `Uttagsdatum: ${formatDate(v.extraction_date)}`
                            : 'Inget uttagsdatum angivet'}
                          {' · '}
                          {v.count} rader
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVersion(
                            selectedVersion === v.import_date ? null : v.import_date
                          );
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Visa
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVersionMutation.mutate(v.import_date);
                        }}
                        disabled={deleteVersionMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Radera
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected version data */}
          {selectedVersion && filteredData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Data för import {formatDate(selectedVersion)} ({filteredData.length} rader)
                </CardTitle>
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
                      {filteredData.slice(0, 100).map((row: any) => (
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
                {filteredData.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-2">Visar 100 av {filteredData.length} rader</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
