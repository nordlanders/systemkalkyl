import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface Calculation {
  id: string;
  name: string | null;
  ci_identity: string;
  total_cost: number;
  version: number;
  status: string;
  calculation_year: number;
}

interface BudgetOutcome {
  id: string;
  objekt: string | null;
  ansvar: string | null;
  ukonto: string | null;
  budget_2025: number | null;
  budget_2026: number | null;
  utfall_ack: number | null;
  diff: number | null;
  extraction_date: string | null;
}

interface ConfigItem {
  id: string;
  ci_number: string;
  system_name: string;
  object_number: string | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

function getElapsedMonths(extractionDate: string | null): number {
  if (!extractionDate) return 12;
  const d = new Date(extractionDate);
  // The extraction date indicates how far into the year the data covers
  return d.getMonth() + 1; // 1-12
}

export default function FollowUpTab() {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState<string>('');
  const [budgetData, setBudgetData] = useState<BudgetOutcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      const [calcsRes, ciRes] = await Promise.all([
        supabase
          .from('calculations')
          .select('id, name, ci_identity, total_cost, version, status, calculation_year')
          .order('name', { ascending: true }),
        supabase
          .from('configuration_items')
          .select('id, ci_number, system_name, object_number')
          .eq('is_active', true),
      ]);
      setCalculations(calcsRes.data || []);
      setConfigItems(ciRes.data || []);
      setInitialLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedCalcId) {
      setBudgetData([]);
      return;
    }

    async function loadBudget() {
      setLoading(true);
      const calc = calculations.find(c => c.id === selectedCalcId);
      if (!calc) { setLoading(false); return; }

      const ci = configItems.find(c => c.id === calc.ci_identity);
      const objectNumber = ci?.object_number;

      if (objectNumber) {
        const { data: budgetRows } = await supabase
          .from('budget_outcomes')
          .select('id, objekt, ansvar, ukonto, budget_2025, budget_2026, utfall_ack, diff, extraction_date')
          .not('objekt', 'is', null);

        const matchedRows = (budgetRows || []).filter((r: any) =>
          r.objekt && r.objekt.toString().split(' ')[0].trim() === objectNumber
        );
        setBudgetData(matchedRows);
      } else {
        setBudgetData([]);
      }
      setLoading(false);
    }
    loadBudget();
  }, [selectedCalcId, calculations, configItems]);

  const selectedCalc = calculations.find(c => c.id === selectedCalcId);
  const selectedCI = selectedCalc ? configItems.find(c => c.id === selectedCalc.ci_identity) : null;

  // Determine how many months the outcome covers
  const elapsedMonths = useMemo(() => {
    if (budgetData.length === 0) return 12;
    // Use the first row's extraction_date as representative
    const firstDate = budgetData.find(r => r.extraction_date)?.extraction_date;
    return getElapsedMonths(firstDate);
  }, [budgetData]);

  const isPartialYear = elapsedMonths < 12;

  // Aggregate budget data
  const utfallTotal = budgetData.reduce((s, r) => s + Number(r.utfall_ack || 0), 0);
  const budgetTotal2025 = budgetData.reduce((s, r) => s + Number(r.budget_2025 || 0), 0);
  const budgetTotal2026 = budgetData.reduce((s, r) => s + Number(r.budget_2026 || 0), 0);

  // Full-year forecast: extrapolate linearly
  const fullYearForecast = isPartialYear ? (utfallTotal / elapsedMonths) * 12 : utfallTotal;

  const calcCost = selectedCalc ? Number(selectedCalc.total_cost) : 0;

  // Diff: forecast vs calculation
  const forecastVsCalc = fullYearForecast - calcCost;
  const forecastVsCalcPercent = calcCost !== 0 ? forecastVsCalc / calcCost : 0;

  // Per-ukonto breakdown with forecast
  const ukontoBreakdown = useMemo(() => {
    const map = new Map<string, { ukonto: string; utfall: number; budget2025: number; budget2026: number }>();
    budgetData.forEach(r => {
      const key = r.ukonto || '(okänt)';
      const existing = map.get(key) || { ukonto: key, utfall: 0, budget2025: 0, budget2026: 0 };
      existing.utfall += Number(r.utfall_ack || 0);
      existing.budget2025 += Number(r.budget_2025 || 0);
      existing.budget2026 += Number(r.budget_2026 || 0);
      map.set(key, existing);
    });
    return Array.from(map.values())
      .map(row => ({
        ...row,
        forecast: isPartialYear ? (row.utfall / elapsedMonths) * 12 : row.utfall,
      }))
      .sort((a, b) => Math.abs(b.forecast) - Math.abs(a.forecast));
  }, [budgetData, elapsedMonths, isPartialYear]);

  const chartData = selectedCalc ? [
    { name: 'Kalkyl', value: calcCost },
    { name: `Utfall (${elapsedMonths} mån)`, value: utfallTotal },
    ...(isPartialYear ? [{ name: 'Helårsprognos', value: fullYearForecast }] : []),
    { name: 'Budget 2025', value: budgetTotal2025 },
    { name: 'Budget 2026', value: budgetTotal2026 },
  ] : [];

  const filteredCalcs = useMemo(() => {
    if (!searchQuery) return calculations;
    const q = searchQuery.toLowerCase();
    return calculations.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      c.ci_identity.toLowerCase().includes(q)
    );
  }, [calculations, searchQuery]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Uppföljning – Utfall vs Kalkyl
        </CardTitle>
        <CardDescription>
          Jämför verkligt ekonomiskt utfall med kalkylerad kostnad. Vid delårsutfall beräknas en helårsprognos automatiskt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sök och välj kalkyl</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på namn eller CI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCalcId} onValueChange={setSelectedCalcId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kalkyl" />
              </SelectTrigger>
              <SelectContent>
                {filteredCalcs.map(c => {
                  const ci = configItems.find(ci => ci.id === c.ci_identity);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || ci?.system_name || c.ci_identity} (v{c.version})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedCI && (
            <div className="space-y-2">
              <label className="text-sm font-medium">CI-information</label>
              <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                <div><span className="text-muted-foreground">CI:</span> {selectedCI.ci_number}</div>
                <div><span className="text-muted-foreground">System:</span> {selectedCI.system_name}</div>
                <div>
                  <span className="text-muted-foreground">Objektnr:</span>{' '}
                  {selectedCI.object_number ? (
                    <Badge variant="secondary">{selectedCI.object_number}</Badge>
                  ) : (
                    <span className="text-destructive">Saknas</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedCalcId && budgetData.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Datakälla</label>
              <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                <div>
                  <span className="text-muted-foreground">Utfallsperiod:</span>{' '}
                  <Badge variant={isPartialYear ? 'outline' : 'secondary'}>
                    {elapsedMonths} av 12 månader
                  </Badge>
                </div>
                {isPartialYear && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Helårsprognos beräknas automatiskt
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Rader:</span> {budgetData.length}
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedCalcId && !loading && (
          <>
            {!selectedCI?.object_number ? (
              <div className="text-center py-8 text-muted-foreground">
                Vald kalkyl har ingen CI med objektnummer. Kan inte jämföra med utfall.
              </div>
            ) : budgetData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen utfallsdata hittades för objektnummer <strong>{selectedCI.object_number}</strong>.
              </div>
            ) : (
              <>
                {/* Chart */}
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => {
                          const colors = [
                            'hsl(var(--primary))',
                            'hsl(var(--chart-3))',
                            'hsl(var(--chart-2))',
                            'hsl(var(--chart-1))',
                            'hsl(var(--chart-4))',
                          ];
                          return <Cell key={i} fill={colors[i % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Kalkylkostnad</p>
                    <p className="text-xl font-bold font-mono text-primary">{formatCurrency(calcCost)}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Utfall ack. ({elapsedMonths} mån)</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(utfallTotal)}</p>
                  </div>
                  {isPartialYear && (
                    <div className="rounded-lg border p-4 space-y-1 border-dashed">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Helårsprognos
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">beräknad</Badge>
                      </p>
                      <p className="text-xl font-bold font-mono">{formatCurrency(fullYearForecast)}</p>
                    </div>
                  )}
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {isPartialYear ? 'Prognos' : 'Utfall'} vs Kalkyl
                    </p>
                    <p className={`text-xl font-bold font-mono ${forecastVsCalc > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {forecastVsCalc > 0 ? '+' : ''}{formatCurrency(forecastVsCalc)}
                    </p>
                    <p className={`text-xs ${forecastVsCalc > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {forecastVsCalc > 0 ? '+' : ''}{formatPercent(forecastVsCalcPercent)}
                    </p>
                  </div>
                </div>

                {/* Status indicator */}
                <div className={`rounded-lg border p-4 flex items-center gap-3 ${
                  Math.abs(forecastVsCalcPercent) <= 0.05
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                    : forecastVsCalc > 0
                    ? 'bg-destructive/5 border-destructive/20'
                    : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                }`}>
                  {Math.abs(forecastVsCalcPercent) <= 0.05 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : forecastVsCalc > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {Math.abs(forecastVsCalcPercent) <= 0.05
                        ? 'Utfallet ligger i linje med kalkylen'
                        : forecastVsCalc > 0
                        ? `${isPartialYear ? 'Prognosen' : 'Utfallet'} överstiger kalkylen`
                        : `${isPartialYear ? 'Prognosen' : 'Utfallet'} understiger kalkylen`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPartialYear
                        ? `Baserat på ${elapsedMonths} månaders utfall, linjärt extrapolerat till helår`
                        : 'Baserat på helårsutfall'}
                    </p>
                  </div>
                </div>

                {/* Breakdown table per ukonto */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Uppdelning per ukonto</h3>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ukonto</TableHead>
                          <TableHead className="text-right">Utfall ({elapsedMonths} mån)</TableHead>
                          {isPartialYear && <TableHead className="text-right">Helårsprognos</TableHead>}
                          <TableHead className="text-right">Budget 2025</TableHead>
                          <TableHead className="text-right">Budget 2026</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ukontoBreakdown.map(row => (
                          <TableRow key={row.ukonto}>
                            <TableCell className="font-mono text-sm">{row.ukonto}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(row.utfall)}
                            </TableCell>
                            {isPartialYear && (
                              <TableCell className="text-right font-mono text-sm text-muted-foreground italic">
                                {formatCurrency(row.forecast)}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(row.budget2025)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(row.budget2026)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Totalt</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(utfallTotal)}</TableCell>
                          {isPartialYear && (
                            <TableCell className="text-right font-mono italic">{formatCurrency(fullYearForecast)}</TableCell>
                          )}
                          <TableCell className="text-right font-mono">{formatCurrency(budgetTotal2025)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(budgetTotal2026)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedCalcId && (
          <div className="text-center py-12 text-muted-foreground">
            Välj en kalkyl ovan för att se uppföljning mot ekonomiskt utfall.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
