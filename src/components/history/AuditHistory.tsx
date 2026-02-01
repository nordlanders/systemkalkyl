import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';

export default function AuditHistory() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

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
        title: 'Error loading history',
        description: 'Could not load history data.',
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
    return (
      <Badge variant={variants[action] || 'outline'} className="capitalize">
        {action}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
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
        <h1 className="text-3xl font-bold text-foreground">History</h1>
        <p className="text-muted-foreground mt-1">
          View your calculations and system audit trail
        </p>
      </div>

      <Tabs defaultValue="calculations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calculations" className="gap-2">
            <Calculator className="h-4 w-4" />
            My Calculations
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Calculations Tab */}
        <TabsContent value="calculations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Saved Calculations
              </CardTitle>
              <CardDescription>
                History of all cost calculations you've saved
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>CPUs</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Servers</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No calculations saved yet. Use the calculator to create one!
                        </TableCell>
                      </TableRow>
                    ) : (
                      calculations.map((calc) => (
                        <TableRow key={calc.id}>
                          <TableCell className="font-medium">
                            {calc.name || 'Unnamed'}
                          </TableCell>
                          <TableCell className="font-mono">{calc.cpu_count}</TableCell>
                          <TableCell className="font-mono">{calc.storage_gb} GB</TableCell>
                          <TableCell className="font-mono">{calc.server_count}</TableCell>
                          <TableCell className="font-mono">{calc.operation_hours.toLocaleString()}</TableCell>
                          <TableCell className="font-mono font-medium text-primary">
                            {formatCurrency(Number(calc.total_cost))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(calc.created_at), 'MMM d, yyyy HH:mm')}
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

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                System Audit Log
              </CardTitle>
              <CardDescription>
                Track all changes made to pricing, users, and calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Changes</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No audit entries yet
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
                          <TableCell className="capitalize">
                            {log.table_name.replace('_', ' ')}
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
                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
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
