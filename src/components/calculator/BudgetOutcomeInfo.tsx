import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface BudgetOutcomeInfoProps {
  objectNumber: string | null;
}

interface RawRow {
  vht: string;
  ansvar: string;
  utfall_ack: number;
  budget_2025: number;
  budget_2026: number;
}

interface UkontoRow {
  ukonto: string;
  utfall_ack: number;
  budget_2025: number;
  budget_2026: number;
}

export default function BudgetOutcomeInfo({ objectNumber }: BudgetOutcomeInfoProps) {
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [selectedAnsvar, setSelectedAnsvar] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!objectNumber) {
      setRawRows([]);
      setSelectedAnsvar(new Set());
      return;
    }
    loadBudgetData(objectNumber);
  }, [objectNumber]);

  async function loadBudgetData(objNr: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('vht, ansvar, budget_2025, budget_2026, utfall_ack, mot')
        .not('mot', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRawRows([]);
        return;
      }

      const matched = data.filter((row) => {
        if (!row.mot) return false;
        return row.mot.split(' ')[0].trim() === objNr;
      });

      const rows: RawRow[] = matched.map((row) => ({
        vht: row.vht || '(tomt)',
        ansvar: row.ansvar || '(tomt)',
        utfall_ack: row.utfall_ack || 0,
        budget_2025: row.budget_2025 || 0,
        budget_2026: row.budget_2026 || 0,
      }));

      setRawRows(rows);
      // Default: all ansvar selected
      setSelectedAnsvar(new Set(rows.map(r => r.ansvar)));
    } catch (error) {
      console.error('Error loading budget data:', error);
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }

  const uniqueAnsvar = useMemo(() => 
    Array.from(new Set(rawRows.map(r => r.ansvar))).sort((a, b) => a.localeCompare(b, 'sv')),
    [rawRows]
  );

  const rows = useMemo(() => {
    const filtered = rawRows.filter(r => selectedAnsvar.has(r.ansvar));
    const map = new Map<string, UkontoRow>();
    filtered.forEach((row) => {
      const key = row.vht;
      const existing = map.get(key);
      if (existing) {
        existing.utfall_ack += row.utfall_ack;
        existing.budget_2025 += row.budget_2025;
        existing.budget_2026 += row.budget_2026;
      } else {
        map.set(key, {
          ukonto: key,
          utfall_ack: row.utfall_ack,
          budget_2025: row.budget_2025,
          budget_2026: row.budget_2026,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.ukonto.localeCompare(b.ukonto, 'sv'));
  }, [rawRows, selectedAnsvar]);

  function toggleAnsvar(ansvar: string) {
    setSelectedAnsvar(prev => {
      const next = new Set(prev);
      if (next.has(ansvar)) next.delete(ansvar);
      else next.add(ansvar);
      return next;
    });
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(value);
  }

  if (!objectNumber) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rawRows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ingen budget-/utfallsdata hittades för objekt {objectNumber}
          </p>
        </CardContent>
      </Card>
    );
  }

  const incomeRows = rows.filter(r => r.budget_2026 >= 0);
  const costRows = rows.filter(r => r.budget_2026 < 0);

  const sumRows = (arr: UkontoRow[]) => arr.reduce(
    (acc, r) => ({
      utfall_ack: acc.utfall_ack + r.utfall_ack,
      budget_2025: acc.budget_2025 + r.budget_2025,
      budget_2026: acc.budget_2026 + r.budget_2026,
    }),
    { utfall_ack: 0, budget_2025: 0, budget_2026: 0 }
  );

  const incomeTotals = sumRows(incomeRows);
  const costTotals = sumRows(costRows);
  const grandTotals = sumRows(rows);

  const renderSection = (title: string, sectionRows: UkontoRow[], sectionTotals: { utfall_ack: number; budget_2025: number; budget_2026: number }) => (
    <>
      <TableRow className="bg-muted/30">
        <TableCell colSpan={4} className="text-xs font-semibold py-1.5">{title}</TableCell>
      </TableRow>
      {sectionRows.map((row) => (
        <TableRow key={row.ukonto}>
          <TableCell className="text-xs font-medium pl-6">{row.ukonto}</TableCell>
          <TableCell className="text-xs text-right">{formatNumber(row.utfall_ack)}</TableCell>
          <TableCell className="text-xs text-right">{formatNumber(row.budget_2025)}</TableCell>
          <TableCell className="text-xs text-right">{formatNumber(row.budget_2026)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t">
        <TableCell className="text-xs font-semibold pl-6">Summa {title.toLowerCase()}</TableCell>
        <TableCell className="text-xs text-right font-semibold">{formatNumber(sectionTotals.utfall_ack)}</TableCell>
        <TableCell className="text-xs text-right font-semibold">{formatNumber(sectionTotals.budget_2025)}</TableCell>
        <TableCell className="text-xs text-right font-semibold">{formatNumber(sectionTotals.budget_2026)}</TableCell>
      </TableRow>
    </>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Budget & Utfall – Objekt {objectNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ansvar filter */}
        {uniqueAnsvar.length > 1 && (
          <div className="rounded-md border p-3 bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Inkluderade ansvar</p>
            <div className="flex flex-wrap gap-3">
              {uniqueAnsvar.map(a => (
                <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedAnsvar.has(a)}
                    onCheckedChange={() => toggleAnsvar(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedAnsvar(new Set(uniqueAnsvar))}>
                Markera alla
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedAnsvar(new Set())}>
                Avmarkera alla
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Konto</TableHead>
                <TableHead className="text-xs text-right">Utfall ack.</TableHead>
                <TableHead className="text-xs text-right">Budget 2025</TableHead>
                <TableHead className="text-xs text-right">Budget 2026</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">
                    Inga ansvar valda
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {incomeRows.length > 0 && renderSection('Intäkter', incomeRows, incomeTotals)}
                  {costRows.length > 0 && renderSection('Kostnader', costRows, costTotals)}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell className="text-xs">Netto</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(grandTotals.utfall_ack)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(grandTotals.budget_2025)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(grandTotals.budget_2026)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
