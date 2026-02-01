import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3, PieChart, TrendingUp, Layers, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface CalculationItem {
  price_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  calculation_id: string;
}

interface Calculation {
  id: string;
  name: string | null;
  service_type: string;
  total_cost: number;
  ci_identity: string;
  calculation_year: number;
}

interface AggregatedData {
  name: string;
  totalQuantity: number;
  totalCost: number;
  count: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(215, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(45, 85%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(350, 70%, 55%)',
  'hsl(190, 70%, 50%)',
  'hsl(100, 50%, 45%)',
];

export default function AnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [loading, setLoading] = useState(true);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [items, setItems] = useState<CalculationItem[]>([]);
  const [byServiceType, setByServiceType] = useState<AggregatedData[]>([]);
  const [byPriceType, setByPriceType] = useState<AggregatedData[]>([]);
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedYear]);

  async function loadData() {
    try {
      // Load all calculations to get available years
      const { data: allCalcsData, error: allCalcsError } = await supabase
        .from('calculations')
        .select('calculation_year');

      if (allCalcsError) throw allCalcsError;

      // Extract unique years and sort descending
      const years = [...new Set((allCalcsData || []).map(c => c.calculation_year))].sort((a, b) => b - a);
      if (years.length > 0) {
        setAvailableYears(years);
      }

      // Load calculations filtered by selected year
      const { data: calcsData, error: calcsError } = await supabase
        .from('calculations')
        .select('id, name, service_type, total_cost, ci_identity, calculation_year')
        .eq('calculation_year', parseInt(selectedYear));

      if (calcsError) throw calcsError;

      const calcs = calcsData || [];
      const calcIds = calcs.map(c => c.id);

      // Load calculation items for filtered calculations
      let allItems: CalculationItem[] = [];
      if (calcIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('calculation_items')
          .select('price_type, quantity, unit_price, total_price, calculation_id')
          .in('calculation_id', calcIds);

        if (itemsError) throw itemsError;
        allItems = itemsData || [];
      }

      setCalculations(calcs);
      setItems(allItems);

      // Aggregate by service type
      const serviceTypeMap = new Map<string, AggregatedData>();
      calcs.forEach((calc) => {
        const existing = serviceTypeMap.get(calc.service_type) || {
          name: calc.service_type,
          totalQuantity: 0,
          totalCost: 0,
          count: 0,
        };
        existing.totalCost += Number(calc.total_cost);
        existing.count += 1;
        serviceTypeMap.set(calc.service_type, existing);
      });
      setByServiceType(Array.from(serviceTypeMap.values()).sort((a, b) => b.totalCost - a.totalCost));

      // Aggregate by price type
      const priceTypeMap = new Map<string, AggregatedData>();
      allItems.forEach((item) => {
        const existing = priceTypeMap.get(item.price_type) || {
          name: item.price_type,
          totalQuantity: 0,
          totalCost: 0,
          count: 0,
        };
        existing.totalQuantity += Number(item.quantity);
        existing.totalCost += Number(item.total_price);
        existing.count += 1;
        priceTypeMap.set(item.price_type, existing);
      });
      setByPriceType(Array.from(priceTypeMap.values()).sort((a, b) => b.totalCost - a.totalCost));

    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const totalCost = calculations.reduce((sum, c) => sum + Number(c.total_cost), 0);
  const totalCalculations = calculations.length;
  const totalItems = items.length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analysöversikt</h1>
            <p className="text-muted-foreground mt-1">
              Sammanställning och pivottabeller för alla kalkyler
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Välj år" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total kostnad</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-primary">
                    {formatCurrency(totalCost)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Summa av alla kalkyler
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Antal kalkyler</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCalculations}</div>
                  <p className="text-xs text-muted-foreground">
                    Totalt antal sparade kalkyler
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Antal prisrader</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalItems}</div>
                  <p className="text-xs text-muted-foreground">
                    Totalt antal rader i alla kalkyler
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pivot Tables */}
            <Tabs defaultValue="service-type" className="space-y-4">
              <TabsList>
                <TabsTrigger value="service-type" className="gap-2">
                  <PieChart className="h-4 w-4" />
                  Per tjänstetyp
                </TabsTrigger>
                <TabsTrigger value="price-type" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Per pristyp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="service-type">
                <Card>
                  <CardHeader>
                    <CardTitle>Kostnad per tjänstetyp</CardTitle>
                    <CardDescription>
                      Sammanställning av totala kostnader grupperat efter tjänstetyp
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {byServiceType.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Inga data att visa
                      </p>
                    ) : (
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Pie Chart */}
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                              <Pie
                                data={byServiceType.map((item, index) => ({
                                  ...item,
                                  fill: CHART_COLORS[index % CHART_COLORS.length],
                                }))}
                                dataKey="totalCost"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name.substring(0, 15)}${name.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`}
                                labelLine={false}
                              >
                                {byServiceType.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tjänstetyp</TableHead>
                              <TableHead className="text-right">Antal</TableHead>
                              <TableHead className="text-right">Kostnad</TableHead>
                              <TableHead className="text-right">Andel</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {byServiceType.map((row, index) => (
                              <TableRow key={row.name}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full shrink-0" 
                                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                    />
                                    <span className="truncate max-w-[150px]" title={row.name}>{row.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{row.count}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(row.totalCost)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {totalCost > 0 
                                    ? `${((row.totalCost / totalCost) * 100).toFixed(1)}%`
                                    : '0%'
                                  }
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell>Totalt</TableCell>
                              <TableCell className="text-right">{totalCalculations}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(totalCost)}
                              </TableCell>
                              <TableCell className="text-right">100%</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="price-type">
                <Card>
                  <CardHeader>
                    <CardTitle>Debitering per pristyp</CardTitle>
                    <CardDescription>
                      Sammanställning av antal och kostnader per pristyp (t.ex. timmar)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {byPriceType.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Inga data att visa
                      </p>
                    ) : (
                    <div className="space-y-6">
                        {/* Bar Chart */}
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={byPriceType.slice(0, 10).map((item, index) => ({
                                ...item,
                                shortName: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
                              }))}
                              layout="vertical"
                              margin={{ left: 20, right: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis 
                                type="number" 
                                tickFormatter={(value) => formatCurrency(value)}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                              />
                              <YAxis 
                                type="category" 
                                dataKey="shortName" 
                                width={150}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                              />
                              <Tooltip 
                                formatter={(value: number) => formatCurrency(value)}
                                labelFormatter={(label) => {
                                  const item = byPriceType.find(p => p.name.startsWith(label.replace('...', '')));
                                  return item?.name || label;
                                }}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Bar dataKey="totalCost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {byPriceType.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Visar topp 10 av {byPriceType.length} pristyper
                          </p>
                        )}

                        {/* Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Pristyp</TableHead>
                              <TableHead className="text-right">Antal</TableHead>
                              <TableHead className="text-right">Rader</TableHead>
                              <TableHead className="text-right">Kostnad</TableHead>
                              <TableHead className="text-right">Andel</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {byPriceType.map((row) => {
                              const itemsTotalCost = items.reduce((sum, i) => sum + Number(i.total_price), 0);
                              return (
                                <TableRow key={row.name}>
                                  <TableCell className="font-medium max-w-[200px] truncate" title={row.name}>
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatNumber(row.totalQuantity)}
                                  </TableCell>
                                  <TableCell className="text-right">{row.count}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(row.totalCost)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {itemsTotalCost > 0 
                                      ? `${((row.totalCost / itemsTotalCost) * 100).toFixed(1)}%`
                                      : '0%'
                                    }
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell>Totalt</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatNumber(byPriceType.reduce((sum, r) => sum + r.totalQuantity, 0))}
                              </TableCell>
                              <TableCell className="text-right">{totalItems}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(byPriceType.reduce((sum, r) => sum + r.totalCost, 0))}
                              </TableCell>
                              <TableCell className="text-right">100%</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
