import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Calculation {
  id: string;
  name: string | null;
  ci_identity: string;
  service_type: string;
  total_cost: number;
  status: string;
  calculation_year: number;
  created_at: string;
  created_by_name: string | null;
  version: number;
  owning_organization: string | null;
  updated_at: string | null;
  approved_at: string | null;
}

interface ConfigurationItem {
  ci_number: string;
  system_name: string;
  object_number: string | null;
  organization: string | null;
  service_type: string | null;
}

interface ObjectGroup {
  objectNumber: string;
  ciItems: ConfigurationItem[];
  calculations: Calculation[];
}

type SortKey = 'objectNumber' | 'ciCount' | 'calcCount' | 'totalCost';
type SortDir = 'asc' | 'desc';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusLabels: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Väntar godkännande',
  approved: 'Godkänd',
  closed: 'Stängd',
};

export default function ObjectCalculationsOverview() {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [ciItems, setCiItems] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('objectNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [calcRes, ciRes] = await Promise.all([
      supabase.from('calculations').select('id, name, ci_identity, service_type, total_cost, status, calculation_year, created_at, created_by_name, version, owning_organization, updated_at, approved_at'),
      supabase.from('configuration_items').select('ci_number, system_name, object_number, organization, service_type').eq('is_active', true),
    ]);
    setCalculations(calcRes.data ?? []);
    setCiItems(ciRes.data ?? []);
    setLoading(false);
  }

  const objectGroups = useMemo(() => {
    // Build a map: ci_number -> CI item
    const ciMap = new Map<string, ConfigurationItem>();
    ciItems.forEach(ci => ciMap.set(ci.ci_number, ci));

    // Group calculations by object number
    const groupMap = new Map<string, ObjectGroup>();

    calculations.forEach(calc => {
      const ci = ciMap.get(calc.ci_identity);
      const objNum = ci?.object_number || '(utan objektnummer)';

      if (!groupMap.has(objNum)) {
        groupMap.set(objNum, { objectNumber: objNum, ciItems: [], calculations: [] });
      }
      const group = groupMap.get(objNum)!;
      group.calculations.push(calc);
      if (ci && !group.ciItems.find(c => c.ci_number === ci.ci_number)) {
        group.ciItems.push(ci);
      }
    });

    // Also add CI items without calculations
    ciItems.forEach(ci => {
      const objNum = ci.object_number || '(utan objektnummer)';
      if (!groupMap.has(objNum)) {
        groupMap.set(objNum, { objectNumber: objNum, ciItems: [ci], calculations: [] });
      } else {
        const group = groupMap.get(objNum)!;
        if (!group.ciItems.find(c => c.ci_number === ci.ci_number)) {
          group.ciItems.push(ci);
        }
      }
    });

    let groups = Array.from(groupMap.values());

    // Filter by service type
    if (selectedServiceType !== 'all') {
      groups = groups.filter(g =>
        g.calculations.some(c => c.service_type === selectedServiceType) ||
        g.ciItems.some(ci => ci.service_type === selectedServiceType)
      );
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      groups = groups.filter(g =>
        g.objectNumber.toLowerCase().includes(term) ||
        g.ciItems.some(ci => ci.system_name.toLowerCase().includes(term) || ci.ci_number.toLowerCase().includes(term)) ||
        g.calculations.some(c => c.name?.toLowerCase().includes(term) || c.ci_identity.toLowerCase().includes(term))
      );
    }

    // Sort
    groups.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'objectNumber': cmp = a.objectNumber.localeCompare(b.objectNumber, 'sv'); break;
        case 'ciCount': cmp = a.ciItems.length - b.ciItems.length; break;
        case 'calcCount': cmp = a.calculations.length - b.calculations.length; break;
        case 'totalCost': {
          const sumA = a.calculations.reduce((s, c) => s + c.total_cost, 0);
          const sumB = b.calculations.reduce((s, c) => s + c.total_cost, 0);
          cmp = sumA - sumB;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return groups;
  }, [calculations, ciItems, searchTerm, sortKey, sortDir, selectedServiceType]);

  const toggleGroup = (objNum: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(objNum) ? next.delete(objNum) : next.add(objNum);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const totalCalcCount = calculations.length;
  const uniqueObjects = new Set(ciItems.map(ci => ci.object_number).filter(Boolean)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kalkyler per objekt</h1>
        <p className="text-muted-foreground mt-1">Översikt över kalkyler grupperade per objektnummer</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unika objekt</CardDescription>
            <CardTitle className="text-2xl">{uniqueObjects}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt antal kalkyler</CardDescription>
            <CardTitle className="text-2xl">{totalCalcCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CI-poster</CardDescription>
            <CardTitle className="text-2xl">{ciItems.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök på objektnummer, systemnamn, CI..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('objectNumber')} className="gap-1 -ml-3">
                    Objektnummer <SortIcon column="objectNumber" />
                  </Button>
                </TableHead>
                <TableHead>System</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('calcCount')} className="gap-1 -ml-3">
                    Kalkyler <SortIcon column="calcCount" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('totalCost')} className="gap-1">
                    Total kostnad <SortIcon column="totalCost" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Inga resultat hittades
                  </TableCell>
                </TableRow>
              ) : (
                objectGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.objectNumber);
                  const totalCost = group.calculations.reduce((s, c) => s + c.total_cost, 0);
                  const systemNames = [...new Set(group.ciItems.map(ci => ci.system_name))].join(', ');

                  return (
                    <> 
                      <TableRow
                        key={group.objectNumber}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleGroup(group.objectNumber)}
                      >
                        <TableCell className="w-8">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{group.objectNumber}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px] truncate">{systemNames || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={group.calculations.length > 0 ? 'default' : 'outline'}>
                            {group.calculations.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {totalCost > 0 ? `${Math.round(totalCost).toLocaleString('sv-SE')} kr/år` : '—'}
                        </TableCell>
                      </TableRow>

                      {isExpanded && group.calculations.length > 0 && (
                        <TableRow key={`${group.objectNumber}-details`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="px-8 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead>Kalkylnamn</TableHead>
                                    <TableHead>Tjänstetyp</TableHead>
                                    <TableHead>År</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Senast sparad/godkänd</TableHead>
                                    <TableHead>Skapad av</TableHead>
                                    <TableHead className="text-right">Kostnad</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.calculations
                                    .sort((a, b) => b.calculation_year - a.calculation_year || b.version - a.version)
                                    .map(calc => {
                                      const lastDate = calc.status === 'approved' && calc.approved_at
                                        ? calc.approved_at
                                        : calc.updated_at || calc.created_at;
                                      const dateLabel = calc.status === 'approved' && calc.approved_at
                                        ? 'Godkänd'
                                        : 'Sparad';
                                      return (
                                      <TableRow key={calc.id} className="text-sm">
                                        <TableCell>{calc.name || '—'}</TableCell>
                                        
                                        <TableCell className="text-muted-foreground">{calc.service_type}</TableCell>
                                        <TableCell>{calc.calculation_year}</TableCell>
                                        <TableCell>v{calc.version}</TableCell>
                                        <TableCell>
                                          <Badge className={statusColors[calc.status] || ''} variant="secondary">
                                            {statusLabels[calc.status] || calc.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                          <span>{dateLabel} {format(new Date(lastDate), 'd MMM yyyy', { locale: sv })}</span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{calc.created_by_name || '—'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                          {Math.round(calc.total_cost).toLocaleString('sv-SE')} kr/år
                                        </TableCell>
                                      </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {isExpanded && group.calculations.length === 0 && (
                        <TableRow key={`${group.objectNumber}-empty`}>
                          <TableCell colSpan={5} className="bg-muted/30 text-center text-muted-foreground py-4 text-sm">
                            Inga kalkyler för detta objekt
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
