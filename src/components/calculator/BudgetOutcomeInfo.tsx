import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BudgetOutcomeInfoProps {
  objectNumber: string | null;
}

interface UkontoRow {
  ukonto: string;
  utfall_ack: number;
  budget_2025: number;
  budget_2026: number;
}

export default function BudgetOutcomeInfo({ objectNumber }: BudgetOutcomeInfoProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UkontoRow[]>([]);

  useEffect(() => {
    if (!objectNumber) {
      setRows([]);
      return;
    }
    loadBudgetData(objectNumber);
  }, [objectNumber]);

  async function loadBudgetData(objNr: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('vht, budget_2025, budget_2026, utfall_ack, mot')
        .not('mot', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRows([]);
        return;
      }

      // Match on mot field numeric part
      const matched = data.filter((row) => {
        if (!row.mot) return false;
        const motNum = row.mot.split(' ')[0].trim();
        return motNum === objNr;
      });

      if (matched.length === 0) {
        setRows([]);
        return;
      }

      // Group by vht (verksamhetskonto) and sum values
      const map = new Map<string, UkontoRow>();
      matched.forEach((row) => {
        const key = row.vht || '(tomt)';
        const existing = map.get(key);
        if (existing) {
          existing.utfall_ack += row.utfall_ack || 0;
          existing.budget_2025 += row.budget_2025 || 0;
          existing.budget_2026 += row.budget_2026 || 0;
        } else {
          map.set(key, {
            ukonto: key,
            utfall_ack: row.utfall_ack || 0,
            budget_2025: row.budget_2025 || 0,
            budget_2026: row.budget_2026 || 0,
          });
        }
      });

      setRows(Array.from(map.values()).sort((a, b) => a.ukonto.localeCompare(b.ukonto, 'sv')));
    } catch (error) {
      console.error('Error loading budget data:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('sv-SE', {
      maximumFractionDigits: 0,
    }).format(value);
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

  if (rows.length === 0) {
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

  // Classify: positive budget_2026 = intäkt, negative = kostnad
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
      <CardContent>
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
              {incomeRows.length > 0 && renderSection('Intäkter', incomeRows, incomeTotals)}
              {costRows.length > 0 && renderSection('Kostnader', costRows, costTotals)}
              <TableRow className="font-semibold border-t-2">
                <TableCell className="text-xs">Netto</TableCell>
                <TableCell className="text-xs text-right">{formatNumber(grandTotals.utfall_ack)}</TableCell>
                <TableCell className="text-xs text-right">{formatNumber(grandTotals.budget_2025)}</TableCell>
                <TableCell className="text-xs text-right">{formatNumber(grandTotals.budget_2026)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
