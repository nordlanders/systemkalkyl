import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import BudgetOutcomeInfo from '@/components/calculator/BudgetOutcomeInfo';
import { sv } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingCalculation {
  id: string;
  name: string | null;
  ci_identity: string;
  service_type: string;
  municipality: string;
  owning_organization: string | null;
  calculation_year: number;
  total_cost: number;
  status: 'draft' | 'pending_approval' | 'approved';
  version: number;
  created_at: string;
  created_by_name: string | null;
  user_id: string;
}

export default function ApprovalsPage() {
  const { user, loading: authLoading, canApprove, approvalOrganizations } = useAuth();
  const navigate = useNavigate();
  const [calculations, setCalculations] = useState<PendingCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [selectedCalc, setSelectedCalc] = useState<PendingCalculation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calculationItems, setCalculationItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedObjectNumber, setSelectedObjectNumber] = useState<string | null>(null);
  const [calculationCostsByUkonto, setCalculationCostsByUkonto] = useState<Record<string, number>>({});

  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (canApprove) {
      loadPendingCalculations();
    } else {
      setLoading(false);
    }
  }, [canApprove, approvalOrganizations]);

  async function loadPendingCalculations() {
    try {
      let query = supabase
        .from('calculations')
        .select('*')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      // If user has specific organizations to approve, filter by those
      if (approvalOrganizations && approvalOrganizations.length > 0) {
        query = query.in('owning_organization', approvalOrganizations);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCalculations((data || []) as PendingCalculation[]);
    } catch (error) {
      console.error('Error loading pending calculations:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda väntande kalkyler.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(calc: PendingCalculation) {
    setSelectedCalc(calc);
    setDetailsOpen(true);
    setLoadingItems(true);
    setSelectedObjectNumber(null);
    setCalculationCostsByUkonto({});

    try {
      // Load calculation items
      const { data, error } = await supabase
        .from('calculation_items')
        .select('*')
        .eq('calculation_id', calc.id);

      if (error) throw error;
      setCalculationItems(data || []);

      // Look up object_number from configuration_items
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calc.ci_identity);
      if (isUuid) {
        const { data: ciData } = await supabase
          .from('configuration_items')
          .select('object_number')
          .eq('id', calc.ci_identity)
          .maybeSingle();
        setSelectedObjectNumber(ciData?.object_number || null);
      }

      // Build calculationCostsByUkonto from items + pricing_config
      if (data && data.length > 0) {
        const pricingIds = data.filter((i: any) => i.pricing_config_id).map((i: any) => i.pricing_config_id);
        if (pricingIds.length > 0) {
          const { data: pricingData } = await supabase
            .from('pricing_config')
            .select('id, ukonto')
            .in('id', pricingIds);

          if (pricingData) {
            const ukontoMap: Record<string, string> = {};
            pricingData.forEach((p: any) => { if (p.ukonto) ukontoMap[p.id] = p.ukonto; });

            const costMap: Record<string, number> = {};
            data.forEach((item: any) => {
              const ukonto = ukontoMap[item.pricing_config_id];
              if (ukonto) {
                costMap[ukonto] = (costMap[ukonto] || 0) + Number(item.total_price || 0);
              }
            });
            setCalculationCostsByUkonto(costMap);
          }
        }
      }
    } catch (error) {
      console.error('Error loading calculation items:', error);
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleApprove(calcId: string) {
    if (!user) return;

    setApproving(calcId);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('calculations')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_by_name: profile?.full_name || user.email,
          approved_at: new Date().toISOString(),
        })
        .eq('id', calcId);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'approve',
        table_name: 'calculations',
        record_id: calcId,
        new_values: { status: 'approved', approved_by: user.id },
      });

      toast({
        title: 'Kalkyl godkänd',
        description: 'Kalkylen har godkänts.',
      });

      setCalculations(calculations.filter(c => c.id !== calcId));
      setDetailsOpen(false);
    } catch (error) {
      console.error('Error approving calculation:', error);
      toast({
        title: 'Fel vid godkännande',
        description: 'Kunde inte godkänna kalkylen.',
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canApprove) {
    return (
      <DashboardLayout>
        <div className="space-y-8 fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Godkännanden</h1>
            <p className="text-muted-foreground mt-1">Granska och godkänn kalkyler</p>
          </div>

          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-warning" />
              <p className="text-muted-foreground">
                Du har inte behörighet att godkänna kalkyler. Kontakta en administratör om du behöver denna behörighet.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Godkännanden</h1>
          <p className="text-muted-foreground mt-1">
            Granska och godkänn kalkyler som väntar på godkännande
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{calculations.length}</p>
                  <p className="text-sm text-muted-foreground">Väntar på godkännande</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {approvalOrganizations?.length || 'Alla'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {approvalOrganizations?.length ? 'Organisationer att godkänna' : 'organisationer'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Calculations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Väntande kalkyler
            </CardTitle>
            <CardDescription>
              Kalkyler som väntar på ditt godkännande
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calculations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
                <p className="text-lg font-medium">Inga väntande kalkyler</p>
                <p className="text-sm">Alla kalkyler har godkänts</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Namn</TableHead>
                      <TableHead>CI-identitet</TableHead>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Kalkylår</TableHead>
                      <TableHead>Total kostnad</TableHead>
                      <TableHead>Skapad av</TableHead>
                      <TableHead>Skapad</TableHead>
                      <TableHead className="text-right">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.map((calc) => (
                      <TableRow key={calc.id}>
                        <TableCell className="font-medium">
                          {calc.name || 'Namnlös kalkyl'}
                        </TableCell>
                        <TableCell>{calc.ci_identity}</TableCell>
                        <TableCell>{calc.owning_organization || '-'}</TableCell>
                        <TableCell>{calc.calculation_year}</TableCell>
                        <TableCell>{formatCurrency(calc.total_cost)}</TableCell>
                        <TableCell>{calc.created_by_name || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(calc.created_at), 'd MMM yyyy', { locale: sv })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewDetails(calc)}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              Granska
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(calc.id)}
                              disabled={approving === calc.id}
                              className="gap-1"
                            >
                              {approving === calc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Godkänn
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Granska kalkyl</DialogTitle>
              <DialogDescription>
                {selectedCalc?.name || 'Namnlös kalkyl'} - {selectedCalc?.ci_identity}
              </DialogDescription>
            </DialogHeader>

            {selectedCalc && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tjänstetyp</p>
                    <p className="font-medium">{selectedCalc.service_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kund</p>
                    <p className="font-medium">{selectedCalc.municipality}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Organisation</p>
                    <p className="font-medium">{selectedCalc.owning_organization || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kalkylår</p>
                    <p className="font-medium">{selectedCalc.calculation_year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Version</p>
                    <p className="font-medium">{selectedCalc.version}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Skapad av</p>
                    <p className="font-medium">{selectedCalc.created_by_name || '-'}</p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-medium mb-2">Prisrader</h4>
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Pristyp</TableHead>
                            <TableHead className="text-right">Antal</TableHead>
                            <TableHead className="text-right">Enhetspris</TableHead>
                            <TableHead className="text-right">Summa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {calculationItems.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.price_type}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(Number(item.unit_price))}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(Number(item.total_price))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                  <span className="font-medium">Total kostnad (per månad)</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(selectedCalc.total_cost)}
                  </span>
                </div>

                {/* Budget & Utfall */}
                {selectedObjectNumber && (
                  <BudgetOutcomeInfo
                    objectNumber={selectedObjectNumber}
                    calculationCostsByUkonto={calculationCostsByUkonto}
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Stäng
              </Button>
              <Button
                onClick={() => selectedCalc && handleApprove(selectedCalc.id)}
                disabled={approving === selectedCalc?.id}
                className="gap-1"
              >
                {approving === selectedCalc?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Godkänn kalkyl
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
