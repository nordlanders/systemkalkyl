import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3, PieChart, TrendingUp, Layers, Calendar, Building2, Filter, Settings2, Users, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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
  municipality: string;
  owning_organization: string | null;
}

interface AggregatedData {
  name: string;
  totalQuantity: number;
  totalCost: number;
  count: number;
}

const MUNICIPALITIES = [
  'Digitalisering och IT',
  'Sundsvalls kommun',
  'Ånge kommun',
  'Timrå kommun',
  'Nordanstigs kommun',
  'Hudiksvalls kommun',
  'Ljusdals kommun',
];

const SERVICE_TYPES = [
  'Anpassad drift',
  'Anpassad förvaltning',
  'Bastjänst Digital infrastruktur',
  'Bastjänst IT infrastruktur',
];

const OWNING_ORGANIZATIONS = [
  'Sektionen Produktion',
  'Sektionen Produktion, enhet Drift',
  'Sektionen Produktion, enhet Servicedesk',
  'Sektionen Digital Utveckling',
  'Sektionen Strategi och Styrning',
  'Digitalisering och IT Stab/säkerhet',
];

const CHART_COLORS = [
  'hsl(var(--chart-4))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4) / 0.7)',
  'hsl(var(--chart-1) / 0.7)',
  'hsl(var(--chart-2) / 0.7)',
  'hsl(var(--chart-3) / 0.7)',
];

export default function AnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>(MUNICIPALITIES);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(SERVICE_TYPES);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(OWNING_ORGANIZATIONS);
  const [selectedStatus, setSelectedStatus] = useState<string>('approved');
  const [loading, setLoading] = useState(true);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [items, setItems] = useState<CalculationItem[]>([]);
  const [byServiceType, setByServiceType] = useState<AggregatedData[]>([]);
  const [byPriceType, setByPriceType] = useState<AggregatedData[]>([]);

  const toggleMunicipality = (municipality: string) => {
    setSelectedMunicipalities(prev => 
      prev.includes(municipality)
        ? prev.filter(m => m !== municipality)
        : [...prev, municipality]
    );
  };

  const selectAllMunicipalities = () => {
    setSelectedMunicipalities(MUNICIPALITIES);
  };

  const clearMunicipalities = () => {
    setSelectedMunicipalities([]);
  };

  const toggleServiceType = (serviceType: string) => {
    setSelectedServiceTypes(prev => 
      prev.includes(serviceType)
        ? prev.filter(s => s !== serviceType)
        : [...prev, serviceType]
    );
  };

  const selectAllServiceTypes = () => {
    setSelectedServiceTypes(SERVICE_TYPES);
  };

  const clearServiceTypes = () => {
    setSelectedServiceTypes([]);
  };

  const toggleOrganization = (org: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(org)
        ? prev.filter(o => o !== org)
        : [...prev, org]
    );
  };

  const selectAllOrganizations = () => {
    setSelectedOrganizations(OWNING_ORGANIZATIONS);
  };

  const clearOrganizations = () => {
    setSelectedOrganizations([]);
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedYear, selectedMunicipalities, selectedServiceTypes, selectedOrganizations, selectedStatus]);

  async function loadData() {
    try {
      setLoading(true);
      
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

      // Load calculations filtered by selected year, municipalities, service types, organizations and status
      let query = supabase
        .from('calculations')
        .select('id, name, service_type, total_cost, ci_identity, calculation_year, municipality, owning_organization, status')
        .eq('calculation_year', parseInt(selectedYear));

      // Apply status filter
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus as 'draft' | 'pending_approval' | 'approved');
      }

      if (selectedMunicipalities.length > 0 && selectedMunicipalities.length < MUNICIPALITIES.length) {
        query = query.in('municipality', selectedMunicipalities);
      } else if (selectedMunicipalities.length === 0) {
        // No municipalities selected, return empty
        setCalculations([]);
        setItems([]);
        setByServiceType([]);
        setByPriceType([]);
        setLoading(false);
        return;
      }

      if (selectedServiceTypes.length > 0 && selectedServiceTypes.length < SERVICE_TYPES.length) {
        query = query.in('service_type', selectedServiceTypes);
      } else if (selectedServiceTypes.length === 0) {
        // No service types selected, return empty
        setCalculations([]);
        setItems([]);
        setByServiceType([]);
        setByPriceType([]);
        setLoading(false);
        return;
      }

      if (selectedOrganizations.length > 0 && selectedOrganizations.length < OWNING_ORGANIZATIONS.length) {
        query = query.in('owning_organization', selectedOrganizations);
      } else if (selectedOrganizations.length === 0) {
        // No organizations selected, return empty
        setCalculations([]);
        setItems([]);
        setByServiceType([]);
        setByPriceType([]);
        setLoading(false);
        return;
      }

      const { data: calcsData, error: calcsError } = await query;

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
          <div className="flex items-center gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Kunder
                  {selectedMunicipalities.length < MUNICIPALITIES.length && (
                    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {selectedMunicipalities.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Välj kunder</h4>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={selectAllMunicipalities}
                      >
                        Alla
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={clearMunicipalities}
                      >
                        Rensa
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {MUNICIPALITIES.map((municipality) => (
                      <div key={municipality} className="flex items-center space-x-2">
                        <Checkbox
                          id={municipality}
                          checked={selectedMunicipalities.includes(municipality)}
                          onCheckedChange={() => toggleMunicipality(municipality)}
                        />
                        <Label 
                          htmlFor={municipality} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {municipality}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Tjänstetyper
                  {selectedServiceTypes.length < SERVICE_TYPES.length && (
                    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {selectedServiceTypes.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Välj tjänstetyper</h4>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={selectAllServiceTypes}
                      >
                        Alla
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={clearServiceTypes}
                      >
                        Rensa
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {SERVICE_TYPES.map((serviceType) => (
                      <div key={serviceType} className="flex items-center space-x-2">
                        <Checkbox
                          id={`st-${serviceType}`}
                          checked={selectedServiceTypes.includes(serviceType)}
                          onCheckedChange={() => toggleServiceType(serviceType)}
                        />
                        <Label 
                          htmlFor={`st-${serviceType}`} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {serviceType}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Users className="h-4 w-4" />
                  Ägare
                  {selectedOrganizations.length < OWNING_ORGANIZATIONS.length && (
                    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {selectedOrganizations.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Välj ägande organisation</h4>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={selectAllOrganizations}
                      >
                        Alla
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={clearOrganizations}
                      >
                        Rensa
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {OWNING_ORGANIZATIONS.map((org) => (
                      <div key={org} className="flex items-center space-x-2">
                        <Checkbox
                          id={`org-${org}`}
                          checked={selectedOrganizations.includes(org)}
                          onCheckedChange={() => toggleOrganization(org)}
                        />
                        <Label 
                          htmlFor={`org-${org}`} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {org}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Kalkylstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  <SelectItem value="draft">Ej klar</SelectItem>
                  <SelectItem value="pending_approval">Väntar godkännande</SelectItem>
                  <SelectItem value="approved">Godkänd</SelectItem>
                </SelectContent>
              </Select>
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
