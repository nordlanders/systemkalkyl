import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Building, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SimPrice {
  pricing_config_id: string | null;
  price_type: string;
  original_price_per_unit: number;
  simulated_price_per_unit: number;
}

interface CalcItem {
  calculation_id: string;
  price_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pricing_config_id: string | null;
}

interface Calculation {
  id: string;
  name: string | null;
  ci_identity: string;
  total_cost: number;
  owning_organization: string | null;
  service_type: string;
  calculation_year: number;
  status: string;
}

const CHART_COLORS = {
  original: '#005595',
  simulated: '#a90074',
  diff: '#00733b',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface SimulationAnalysisProps {
  scenarioId: string;
  scenarioName: string;
  calculationYear: number;
}

export default function SimulationAnalysis({ scenarioId, scenarioName, calculationYear }: SimulationAnalysisProps) {
  const year = calculationYear;
  const [loading, setLoading] = useState(true);
  const [simPrices, setSimPrices] = useState<SimPrice[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [calcItems, setCalcItems] = useState<CalcItem[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState<string>('');

  useEffect(() => { loadData(); }, [scenarioId, year]);

  async function loadData() {
    setLoading(true);
    try {
      // Load sim prices
      const { data: sp } = await supabase
        .from('simulation_prices')
        .select('pricing_config_id, price_type, original_price_per_unit, simulated_price_per_unit')
        .eq('scenario_id', scenarioId);
      setSimPrices((sp || []) as SimPrice[]);

      // Calculations for selected year

      // Load approved calculations
      const { data: calcs } = await supabase
        .from('calculations')
        .select('id, name, ci_identity, total_cost, owning_organization, service_type, calculation_year, status')
        .eq('calculation_year', year)
        .eq('status', 'approved');
      setCalculations(calcs || []);

      const calcIds = (calcs || []).map(c => c.id);
      if (calcIds.length > 0) {
        const { data: items } = await supabase
          .from('calculation_items')
          .select('calculation_id, price_type, quantity, unit_price, total_price, pricing_config_id')
          .in('calculation_id', calcIds);
        setCalcItems((items || []) as CalcItem[]);
      } else {
        setCalcItems([]);
      }
    } catch (err) {
      console.error('Error loading simulation data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Build price lookup: pricing_config_id -> simulated price
  const priceMap = useMemo(() => {
    const map: Record<string, { original: number; simulated: number }> = {};
    // Also build by price_type for fallback
    const typeMap: Record<string, { original: number; simulated: number }> = {};
    simPrices.forEach(sp => {
      if (sp.pricing_config_id) {
        map[sp.pricing_config_id] = { original: sp.original_price_per_unit, simulated: sp.simulated_price_per_unit };
      }
      typeMap[sp.price_type] = { original: sp.original_price_per_unit, simulated: sp.simulated_price_per_unit };
    });
    return { byId: map, byType: typeMap };
  }, [simPrices]);

  function getSimulatedTotal(items: CalcItem[]): number {
    return items.reduce((sum, item) => {
      const lookup = (item.pricing_config_id && priceMap.byId[item.pricing_config_id]) || priceMap.byType[item.price_type];
      if (lookup) {
        return sum + item.quantity * lookup.simulated;
      }
      return sum + item.total_price;
    }, 0);
  }

  // Total impact data
  const totalOriginal = calculations.reduce((s, c) => s + Number(c.total_cost), 0);
  const totalSimulated = useMemo(() => getSimulatedTotal(calcItems), [calcItems, priceMap]);
  const totalDiff = totalSimulated - totalOriginal;
  const totalDiffPct = totalOriginal > 0 ? (totalDiff / totalOriginal) * 100 : 0;

  // Per organization data
  const orgData = useMemo(() => {
    const map: Record<string, { original: number; simulated: number; count: number }> = {};
    calculations.forEach(calc => {
      const org = calc.owning_organization || 'Ej angiven';
      if (!map[org]) map[org] = { original: 0, simulated: 0, count: 0 };
      map[org].original += Number(calc.total_cost);
      map[org].count += 1;
      const items = calcItems.filter(i => i.calculation_id === calc.id);
      map[org].simulated += getSimulatedTotal(items);
    });
    return Object.entries(map)
      .map(([org, d]) => ({ org, ...d, diff: d.simulated - d.original }))
      .sort((a, b) => b.original - a.original);
  }, [calculations, calcItems, priceMap]);

  // Per calculation data
  const calcData = useMemo(() => {
    return calculations.map(calc => {
      const items = calcItems.filter(i => i.calculation_id === calc.id);
      const simTotal = getSimulatedTotal(items);
      return {
        id: calc.id,
        name: calc.name || calc.ci_identity,
        original: Number(calc.total_cost),
        simulated: simTotal,
        diff: simTotal - Number(calc.total_cost),
        diffPct: Number(calc.total_cost) > 0 ? ((simTotal - Number(calc.total_cost)) / Number(calc.total_cost)) * 100 : 0,
        owningOrg: calc.owning_organization || 'Ej angiven',
      };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [calculations, calcItems, priceMap]);

  // Selected calc detail
  const selectedCalcDetail = useMemo(() => {
    if (!selectedCalcId) return null;
    const items = calcItems.filter(i => i.calculation_id === selectedCalcId);
    return items.map(item => {
      const lookup = (item.pricing_config_id && priceMap.byId[item.pricing_config_id]) || priceMap.byType[item.price_type];
      const simUnitPrice = lookup ? lookup.simulated : item.unit_price;
      const simTotal = item.quantity * simUnitPrice;
      return {
        ...item,
        simUnitPrice,
        simTotal,
        diff: simTotal - item.total_price,
      };
    });
  }, [selectedCalcId, calcItems, priceMap]);

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const DiffIcon = ({ val }: { val: number }) => {
    if (val > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (val < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const orgChartData = orgData.map(d => ({
    name: d.org.length > 20 ? d.org.substring(0, 20) + '...' : d.org,
    fullName: d.org,
    'Nuvarande': d.original,
    'Simulerat': d.simulated,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analys – {scenarioName} ({year})</h3>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Nuvarande totalkostnad</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{formatCurrency(totalOriginal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Simulerad totalkostnad</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono text-[#a90074]">{formatCurrency(totalSimulated)}</div></CardContent>
        </Card>
        <Card className={totalDiff > 0 ? 'border-destructive/50' : totalDiff < 0 ? 'border-green-500/50' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Differens</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono flex items-center gap-2 ${totalDiff > 0 ? 'text-destructive' : totalDiff < 0 ? 'text-green-600' : ''}`}>
              <DiffIcon val={totalDiff} />
              {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
            </div>
            <p className="text-xs text-muted-foreground">{totalDiffPct > 0 ? '+' : ''}{totalDiffPct.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {calculations.length === 0 ? (
        <Card><CardContent className="text-center py-8 text-muted-foreground">Inga godkända kalkyler för {year}</CardContent></Card>
      ) : (
        <Tabs defaultValue="total">
          <TabsList>
            <TabsTrigger value="total" className="gap-2"><BarChart3 className="h-4 w-4" />Totalpåverkan</TabsTrigger>
            <TabsTrigger value="per-calc" className="gap-2"><FileText className="h-4 w-4" />Per kalkyl</TabsTrigger>
            <TabsTrigger value="per-org" className="gap-2"><Building className="h-4 w-4" />Per organisation</TabsTrigger>
          </TabsList>

          {/* Total impact */}
          <TabsContent value="total">
            <Card>
              <CardHeader>
                <CardTitle>Totalpåverkan per pristyp</CardTitle>
                <CardDescription>Visar hur varje pristyp påverkas av de simulerade priserna</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Aggregate by price_type
                  const typeMap: Record<string, { original: number; simulated: number }> = {};
                  calcItems.forEach(item => {
                    if (!typeMap[item.price_type]) typeMap[item.price_type] = { original: 0, simulated: 0 };
                    typeMap[item.price_type].original += item.total_price;
                    const lookup = (item.pricing_config_id && priceMap.byId[item.pricing_config_id]) || priceMap.byType[item.price_type];
                    typeMap[item.price_type].simulated += lookup ? item.quantity * lookup.simulated : item.total_price;
                  });
                  const rows = Object.entries(typeMap)
                    .map(([pt, d]) => ({ priceType: pt, ...d, diff: d.simulated - d.original }))
                    .filter(r => r.diff !== 0)
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

                  const chartData = rows.slice(0, 10).map(r => ({
                    name: r.priceType.length > 25 ? r.priceType.substring(0, 25) + '...' : r.priceType,
                    fullName: r.priceType,
                    'Nuvarande': r.original,
                    'Simulerat': r.simulated,
                  }));

                  return (
                    <div className="space-y-6">
                      {chartData.length > 0 && (
                        <div className="h-[350px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                              />
                              <Legend />
                              <Bar dataKey="Nuvarande" fill={CHART_COLORS.original} radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Simulerat" fill={CHART_COLORS.simulated} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Pristyp</TableHead>
                              <TableHead className="text-right">Nuvarande</TableHead>
                              <TableHead className="text-right">Simulerat</TableHead>
                              <TableHead className="text-right">Differens</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map(r => (
                              <TableRow key={r.priceType}>
                                <TableCell className="font-medium max-w-[250px] truncate" title={r.priceType}>{r.priceType}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(r.original)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(r.simulated)}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={r.diff > 0 ? 'destructive' : 'default'} className={r.diff < 0 ? 'bg-green-600 hover:bg-green-700' : ''}>
                                    {r.diff > 0 ? '+' : ''}{formatCurrency(r.diff)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {rows.length === 0 && (
                              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Inga prisändringar i detta scenario</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Per calculation */}
          <TabsContent value="per-calc">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Påverkan per kalkyl</CardTitle>
                    <CardDescription>Välj en kalkyl för att se detaljerad radnivå-påverkan</CardDescription>
                  </div>
                  <Select value={selectedCalcId} onValueChange={setSelectedCalcId}>
                    <SelectTrigger className="w-[300px]"><SelectValue placeholder="Välj kalkyl..." /></SelectTrigger>
                    <SelectContent>
                      {calcData.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.owningOrg})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {/* Overview table */}
                <div className="rounded-md border mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kalkyl</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead className="text-right">Nuvarande</TableHead>
                        <TableHead className="text-right">Simulerat</TableHead>
                        <TableHead className="text-right">Differens</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calcData.slice(0, 20).map(c => (
                        <TableRow key={c.id} className={`cursor-pointer ${selectedCalcId === c.id ? 'bg-primary/10' : ''}`} onClick={() => setSelectedCalcId(c.id)}>
                          <TableCell className="font-medium max-w-[200px] truncate">{c.name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.owningOrg}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(c.original)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(c.simulated)}</TableCell>
                          <TableCell className="text-right">
                            {c.diff !== 0 && (
                              <Badge variant={c.diff > 0 ? 'destructive' : 'default'} className={c.diff < 0 ? 'bg-green-600 hover:bg-green-700' : ''}>
                                {c.diff > 0 ? '+' : ''}{formatCurrency(c.diff)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">{c.diffPct !== 0 ? `${c.diffPct > 0 ? '+' : ''}${c.diffPct.toFixed(1)}%` : '–'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Detail view */}
                {selectedCalcDetail && selectedCalcDetail.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Detaljvy – rader</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pristyp</TableHead>
                            <TableHead className="text-right">Antal</TableHead>
                            <TableHead className="text-right">Nuv. à-pris</TableHead>
                            <TableHead className="text-right">Sim. à-pris</TableHead>
                            <TableHead className="text-right">Nuv. total</TableHead>
                            <TableHead className="text-right">Sim. total</TableHead>
                            <TableHead className="text-right">Diff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCalcDetail.map((item, i) => (
                            <TableRow key={i} className={item.diff !== 0 ? 'bg-accent/20' : ''}>
                              <TableCell className="font-medium max-w-[200px] truncate">{item.price_type}</TableCell>
                              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(item.simUnitPrice)}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(item.total_price)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(item.simTotal)}</TableCell>
                              <TableCell className="text-right">
                                {item.diff !== 0 ? (
                                  <span className={item.diff > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                                    {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                                  </span>
                                ) : '–'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Per organization */}
          <TabsContent value="per-org">
            <Card>
              <CardHeader>
                <CardTitle>Påverkan per ägande organisation</CardTitle>
                <CardDescription>Jämförelse av nuvarande och simulerade kostnader per organisation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {orgChartData.length > 0 && (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orgChartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            formatter={(value: number, name: string) => [formatCurrency(value), name]}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                          />
                          <Legend />
                          <Bar dataKey="Nuvarande" fill={CHART_COLORS.original} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Simulerat" fill={CHART_COLORS.simulated} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organisation</TableHead>
                          <TableHead className="text-right">Antal kalkyler</TableHead>
                          <TableHead className="text-right">Nuvarande</TableHead>
                          <TableHead className="text-right">Simulerat</TableHead>
                          <TableHead className="text-right">Differens</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgData.map(d => {
                          const pct = d.original > 0 ? ((d.diff / d.original) * 100) : 0;
                          return (
                            <TableRow key={d.org}>
                              <TableCell className="font-medium">{d.org}</TableCell>
                              <TableCell className="text-right">{d.count}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(d.original)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(d.simulated)}</TableCell>
                              <TableCell className="text-right">
                                {d.diff !== 0 && (
                                  <Badge variant={d.diff > 0 ? 'destructive' : 'default'} className={d.diff < 0 ? 'bg-green-600 hover:bg-green-700' : ''}>
                                    {d.diff > 0 ? '+' : ''}{formatCurrency(d.diff)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm">{pct !== 0 ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '–'}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Totalt</TableCell>
                          <TableCell className="text-right">{orgData.reduce((s, d) => s + d.count, 0)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(totalOriginal)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(totalSimulated)}</TableCell>
                          <TableCell className="text-right">
                            {totalDiff !== 0 && (
                              <Badge variant={totalDiff > 0 ? 'destructive' : 'default'} className={totalDiff < 0 ? 'bg-green-600 hover:bg-green-700' : ''}>
                                {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">{totalDiffPct !== 0 ? `${totalDiffPct > 0 ? '+' : ''}${totalDiffPct.toFixed(1)}%` : '–'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
