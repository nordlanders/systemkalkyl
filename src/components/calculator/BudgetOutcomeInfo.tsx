import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BudgetOutcomeInfoProps {
  objectNumber: string | null;
}

interface BudgetSummary {
  budget_2025: number;
  budget_2026: number;
  utfall_ack: number;
  diff: number;
  rowCount: number;
}

export default function BudgetOutcomeInfo({ objectNumber }: BudgetOutcomeInfoProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);

  useEffect(() => {
    if (!objectNumber) {
      setSummary(null);
      return;
    }
    loadBudgetData(objectNumber);
  }, [objectNumber]);

  async function loadBudgetData(objNr: string) {
    setLoading(true);
    try {
      // Fetch all budget rows that have a mot (motpart) value — this is where object numbers (starting with 6, 7 digits) are stored
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('budget_2025, budget_2026, utfall_ack, diff, mot')
        .not('mot', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSummary(null);
        return;
      }

      // Match: compare CI object_number against the numeric part (before first space) of budget mot field
      const matched = data.filter((row) => {
        if (!row.mot) return false;
        const motNum = row.mot.split(' ')[0].trim();
        return motNum === objNr;
      });

      if (matched.length === 0) {
        setSummary(null);
        return;
      }

      const totals = matched.reduce<BudgetSummary>(
        (acc, row) => ({
          budget_2025: acc.budget_2025 + (row.budget_2025 || 0),
          budget_2026: acc.budget_2026 + (row.budget_2026 || 0),
          utfall_ack: acc.utfall_ack + (row.utfall_ack || 0),
          diff: acc.diff + (row.diff || 0),
          rowCount: acc.rowCount + 1,
        }),
        { budget_2025: 0, budget_2026: 0, utfall_ack: 0, diff: 0, rowCount: 0 }
      );

      setSummary(totals);
    } catch (error) {
      console.error('Error loading budget data:', error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
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

  if (!summary) {
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

  const DiffIcon = summary.diff > 0 ? TrendingUp : summary.diff < 0 ? TrendingDown : Minus;
  const diffColor = summary.diff > 0 ? 'text-green-600' : summary.diff < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Budget & Utfall – Objekt {objectNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Budget 2025</p>
            <p className="text-sm font-semibold">{formatCurrency(summary.budget_2025)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Budget 2026</p>
            <p className="text-sm font-semibold">{formatCurrency(summary.budget_2026)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Utfall ack.</p>
            <p className="text-sm font-semibold">{formatCurrency(summary.utfall_ack)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Differens</p>
            <p className={`text-sm font-semibold flex items-center gap-1 ${diffColor}`}>
              <DiffIcon className="h-3 w-3" />
              {formatCurrency(summary.diff)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Baserat på {summary.rowCount} budgetrad{summary.rowCount !== 1 ? 'er' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
