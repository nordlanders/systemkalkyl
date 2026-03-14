import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

const CHART_COLORS = [
  '#005595', '#00733b', '#5b1f78', '#a90074',
  '#005595B3', '#00733bB3', '#5b1f78B3', '#a90074B3',
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);

interface ServiceCostRow {
  owningOrg: string;
  owningOrgId: string | null;
  calcCount: number;
  totalCost: number;
  compensation: number;
  netCost: number;
}

export default function ServiceCostTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceCostRow[]>([]);
  const [showCompensation, setShowCompensation] = useState(true);

  useEffect(() => {
    loadData();
  }, [year]);

  async function loadData() {
    setLoading(true);
    try {
      // Get available years
      const { data: yearData } = await supabase
        .from('calculations')
        .select('calculation_year');
      const years = [...new Set((yearData || []).map((c) => c.calculation_year))].sort((a, b) => b - a);
      if (years.length) setAvailableYears(years);

      // Get approved calculations for selected year
      const { data: calcs } = await supabase
        .from('calculations')
        .select('id, total_cost, owning_organization, owning_organization_id, service_type')
        .eq('calculation_year', year)
        .eq('status', 'approved');

      // Get budget compensations for selected year
      const { data: comps } = await supabase
        .from('budget_compensations')
        .select('owning_organization_id, amount');
      
      // Filter compensations by year
      const { data: compsFiltered } = await supabase
        .from('budget_compensations')
        .select('owning_organization_id, amount')
        .eq('year', year);

      // Get owning organizations for name lookup
      const { data: orgs } = await supabase
        .from('owning_organizations')
        .select('id, name');

      const orgNameMap: Record<string, string> = {};
      (orgs || []).forEach((o) => { orgNameMap[o.id] = o.name; });

      // Aggregate compensations by org
      const compByOrg: Record<string, number> = {};
      (compsFiltered || []).forEach((c) => {
        compByOrg[c.owning_organization_id] = (compByOrg[c.owning_organization_id] || 0) + Number(c.amount);
      });

      // Aggregate calculations by owning organization
      const map: Record<string, { totalCost: number; calcCount: number; orgId: string | null }> = {};
      (calcs || []).forEach((c) => {
        const key = c.owning_organization || 'Ej angiven';
        if (!map[key]) map[key] = { totalCost: 0, calcCount: 0, orgId: c.owning_organization_id };
        map[key].totalCost += Number(c.total_cost);
        map[key].calcCount += 1;
      });

      const result: ServiceCostRow[] = Object.entries(map).map(([org, data]) => {
        const comp = data.orgId ? (compByOrg[data.orgId] || 0) : 0;
        return {
          owningOrg: org,
          owningOrgId: data.orgId,
          calcCount: data.calcCount,
          totalCost: data.totalCost,
          compensation: comp,
          netCost: data.totalCost - comp,
        };
      }).sort((a, b) => b.totalCost - a.totalCost);

      setRows(result);
    } catch (err) {
      console.error('Error loading service costs:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);
  const totalComp = rows.reduce((s, r) => s + r.compensation, 0);
  const totalNet = rows.reduce((s, r) => s + r.netCost, 0);
  const totalCalcs = rows.reduce((s, r) => s + r.calcCount, 0);

  const chartData = rows.map((r, i) => ({
    name: r.owningOrg.length > 25 ? r.owningOrg.substring(0, 25) + '...' : r.owningOrg,
    fullName: r.owningOrg,
    'Kalkylkostnad': r.totalCost,
    'Budgetkompensation': r.compensation,
    'Nettokostnad': r.netCost,
  }));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Kostnad per bastjänst</CardTitle>
            <CardDescription>
              Sammanställning av kostnader per ägande organisation med möjlighet att visa med/utan budgetkompensationer (avskrivningar)
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="show-comp" checked={showCompensation} onCheckedChange={setShowCompensation} />
              <Label htmlFor="show-comp" className="text-sm cursor-pointer">Visa budgetkompensation</Label>
            </div>
            <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Inga godkända kalkyler för {year}</p>
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Legend />
                  <Bar dataKey="Kalkylkostnad" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  {showCompensation && (
                    <>
                      <Bar dataKey="Budgetkompensation" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Nettokostnad" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ägande organisation</TableHead>
                    <TableHead className="text-right">Antal kalkyler</TableHead>
                    <TableHead className="text-right">Kalkylkostnad</TableHead>
                    {showCompensation && (
                      <>
                        <TableHead className="text-right">Budgetkompensation</TableHead>
                        <TableHead className="text-right">Nettokostnad</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Andel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const displayTotal = showCompensation ? totalNet : totalCost;
                    const displayCost = showCompensation ? r.netCost : r.totalCost;
                    const pct = displayTotal > 0 ? (displayCost / displayTotal * 100) : 0;
                    return (
                      <TableRow key={r.owningOrg}>
                        <TableCell className="font-medium">{r.owningOrg}</TableCell>
                        <TableCell className="text-right">{r.calcCount}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.totalCost)}</TableCell>
                        {showCompensation && (
                          <>
                            <TableCell className="text-right font-mono">
                              {r.compensation > 0 ? (
                                <span className="text-green-600">-{formatCurrency(r.compensation)}</span>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">{formatCurrency(r.netCost)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Totalt</TableCell>
                    <TableCell className="text-right">{totalCalcs}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalCost)}</TableCell>
                    {showCompensation && (
                      <>
                        <TableCell className="text-right font-mono text-green-600">
                          {totalComp > 0 ? `-${formatCurrency(totalComp)}` : '–'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalNet)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {showCompensation && totalComp > 0 && (
              <p className="text-xs text-muted-foreground">
                Budgetkompensationer avser avskrivningskompensationer som dras av från den totala kalkylkostnaden för att visa nettokostnad.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
