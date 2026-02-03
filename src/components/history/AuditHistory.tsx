import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { type AuditLog, type Calculation } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  History, 
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calculator,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type SortField = 'type' | 'name' | 'ci_identity' | 'version' | 'status' | 'performedBy' | 'date';
type SortDirection = 'asc' | 'desc';

export default function AuditHistory() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculation, setSelectedCalculation] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  async function loadData() {
    try {
      // Load audit logs
      const { data: logs, error: logsError } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setAuditLogs(logs as AuditLog[]);

      // Load calculations (user's own or all if admin)
      let calculationsQuery = supabase
        .from('calculations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        calculationsQuery = calculationsQuery.eq('user_id', user?.id);
      }

      const { data: calcs, error: calcsError } = await calculationsQuery.limit(50);

      if (calcsError) throw calcsError;
      setCalculations(calcs as Calculation[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fel vid laddning av historik',
        description: 'Kunde inte ladda historikdata.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="h-4 w-4 text-success" />;
      case 'update':
        return <Pencil className="h-4 w-4 text-accent" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
    };
    const labels: Record<string, string> = {
      create: 'Skapad',
      update: 'Uppdaterad',
      delete: 'Borttagen',
    };
    return (
      <Badge variant={variants[action] || 'outline'}>
        {labels[action] || action}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      draft: { label: 'Ej klar', variant: 'outline' },
      pending_approval: { label: 'Klar', variant: 'secondary' },
      approved: { label: 'Godkänd', variant: 'default' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const translateTableName = (name: string) => {
    const translations: Record<string, string> = {
      'pricing_config': 'Priskonfiguration',
      'calculations': 'Beräkningar',
      'user_roles': 'Användarroller',
      'profiles': 'Profiler',
    };
    return translations[name] || name;
  };

  // Generate events from calculations
  const allEvents = useMemo(() => {
    return calculations.flatMap((calc) => {
      const events = [];
      
      // Created event
      events.push({
        id: `${calc.id}-created`,
        calcId: calc.id,
        type: 'created',
        label: 'Skapad',
        icon: <Plus className="h-4 w-4 text-success" />,
        name: calc.name || 'Namnlös',
        ci_identity: calc.ci_identity,
        version: 1,
        status: 'draft' as const,
        performedBy: calc.created_by_name || 'Okänd',
        date: calc.created_at,
      });
      
      // Updated event (if updated_at differs from created_at)
      if (calc.updated_at && calc.updated_at !== calc.created_at) {
        events.push({
          id: `${calc.id}-updated`,
          calcId: calc.id,
          type: 'updated',
          label: 'Sparad',
          icon: <Pencil className="h-4 w-4 text-accent" />,
          name: calc.name || 'Namnlös',
          ci_identity: calc.ci_identity,
          version: calc.version,
          status: calc.status,
          performedBy: calc.updated_by_name || calc.created_by_name || 'Okänd',
          date: calc.updated_at,
        });
      }
      
      // Approved event
      if (calc.status === 'approved' && calc.approved_at) {
        events.push({
          id: `${calc.id}-approved`,
          calcId: calc.id,
          type: 'approved',
          label: 'Godkänd',
          icon: <FileText className="h-4 w-4 text-primary" />,
          name: calc.name || 'Namnlös',
          ci_identity: calc.ci_identity,
          version: calc.version,
          status: 'approved' as const,
          performedBy: calc.approved_by_name || 'Okänd',
          date: calc.approved_at,
        });
      }
      
      return events;
    });
  }, [calculations]);

  // Filter events
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = allEvents;
    
    // Filter by selected calculation
    if (selectedCalculation !== 'all') {
      filtered = filtered.filter(e => e.calcId === selectedCalculation);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(query) ||
        e.ci_identity.toLowerCase().includes(query) ||
        e.performedBy.toLowerCase().includes(query)
      );
    }
    
    // Sort
    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'type':
          aValue = a.label;
          bValue = b.label;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'ci_identity':
          aValue = a.ci_identity.toLowerCase();
          bValue = b.ci_identity.toLowerCase();
          break;
        case 'version':
          aValue = a.version;
          bValue = b.version;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'performedBy':
          aValue = a.performedBy.toLowerCase();
          bValue = b.performedBy.toLowerCase();
          break;
        case 'date':
        default:
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allEvents, selectedCalculation, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ 
    field, 
    children 
  }: { 
    field: SortField; 
    children: React.ReactNode;
  }) => {
    const isActive = sortField === field;
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/70 transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </div>
      </TableHead>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Historik</h1>
        <p className="text-muted-foreground mt-1">
          Visa dina beräkningar och systemets granskningslogg
        </p>
      </div>

      <Tabs defaultValue="calculations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calculations" className="gap-2">
            <Calculator className="h-4 w-4" />
            Mina beräkningar
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-4 w-4" />
            Granskningslogg
          </TabsTrigger>
        </TabsList>

        {/* Calculations Tab */}
        <TabsContent value="calculations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Kalkylhändelser
              </CardTitle>
              <CardDescription>
                Historik över skapade, sparade och godkända kalkyler
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Sök på kalkyl eller CI-identitet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedCalculation} onValueChange={setSelectedCalculation}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Välj kalkyl..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla kalkyler</SelectItem>
                    {calculations.map((calc) => (
                      <SelectItem key={calc.id} value={calc.id}>
                        {calc.name || 'Namnlös'} ({calc.ci_identity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableHeader field="type">
                        Händelse
                      </SortableHeader>
                      <SortableHeader field="name">
                        Kalkyl
                      </SortableHeader>
                      <SortableHeader field="ci_identity">
                        CI-identitet
                      </SortableHeader>
                      <SortableHeader field="version">
                        Version
                      </SortableHeader>
                      <SortableHeader field="status">
                        Status
                      </SortableHeader>
                      <SortableHeader field="performedBy">
                        Utförd av
                      </SortableHeader>
                      <SortableHeader field="date">
                        Datum
                      </SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {calculations.length === 0 
                            ? 'Inga kalkylhändelser ännu. Använd kalkylatorn för att skapa en!'
                            : 'Inga händelser matchar din sökning'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {event.icon}
                              <Badge variant={
                                event.type === 'created' ? 'default' : 
                                event.type === 'approved' ? 'secondary' : 'outline'
                              }>
                                {event.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {event.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {event.ci_identity}
                          </TableCell>
                          <TableCell className="font-mono">
                            v{event.version}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(event.status)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.performedBy}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(event.date), 'd MMM yyyy HH:mm', { locale: sv })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {filteredAndSortedEvents.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Visar {filteredAndSortedEvents.length} händelse(r)
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Systemets granskningslogg
              </CardTitle>
              <CardDescription>
                Spåra alla ändringar gjorda på priser, användare och beräkningar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Åtgärd</TableHead>
                      <TableHead>Tabell</TableHead>
                      <TableHead>Ändringar</TableHead>
                      <TableHead>Datum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Inga granskningsposter ännu
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              {getActionBadge(log.action)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {translateTableName(log.table_name)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {log.new_values && (
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                                  {JSON.stringify(log.new_values, null, 2)}
                                </pre>
                              )}
                              {log.old_values && log.action === 'delete' && (
                                <pre className="text-xs bg-destructive/10 p-2 rounded overflow-auto max-h-20">
                                  {JSON.stringify(log.old_values, null, 2)}
                                </pre>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
