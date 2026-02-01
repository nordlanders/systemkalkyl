import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type Calculation } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calculator, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CalculationsListProps {
  onEdit: (calculation: Calculation) => void;
  onCreateNew: () => void;
}

export default function CalculationsList({ onEdit, onCreateNew }: CalculationsListProps) {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { user, isAdmin, canWrite } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadCalculations();
  }, [isAdmin, user?.id]);

  async function loadCalculations() {
    try {
      let query = supabase
        .from('calculations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCalculations(data as Calculation[]);
    } catch (error) {
      console.error('Error loading calculations:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda kalkyler.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const calcToDelete = calculations.find(c => c.id === deleteId);
      
      const { error } = await supabase
        .from('calculations')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      await logAudit('delete', 'calculations', deleteId, {
        name: calcToDelete?.name,
        total_cost: calcToDelete?.total_cost,
      });

      setCalculations(calculations.filter(c => c.id !== deleteId));
      toast({
        title: 'Kalkyl borttagen',
        description: 'Kalkylen har tagits bort.',
      });
    } catch (error) {
      console.error('Error deleting calculation:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort kalkylen.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mina kalkyler</h1>
          <p className="text-muted-foreground mt-1">
            Hantera dina sparade kostnadskalkyler
          </p>
        </div>
        {canWrite && (
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Skapa ny kalkyl
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Sparade kalkyler
          </CardTitle>
          <CardDescription>
            Klicka på en kalkyl för att redigera den
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Inga kalkyler ännu
              </h3>
              <p className="text-muted-foreground mb-4">
                {canWrite ? 'Skapa din första kalkyl för att komma igång.' : 'Det finns inga kalkyler att visa.'}
              </p>
              {canWrite && (
                <Button onClick={onCreateNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Skapa ny kalkyl
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Namn</TableHead>
                    <TableHead>CPU:er</TableHead>
                    <TableHead>Lagring</TableHead>
                    <TableHead>Servrar</TableHead>
                    <TableHead>Timmar</TableHead>
                    <TableHead>Total kostnad</TableHead>
                    <TableHead>Skapad</TableHead>
                    {canWrite && <TableHead className="text-right">Åtgärder</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculations.map((calc) => (
                    <TableRow 
                      key={calc.id} 
                      className={canWrite ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => canWrite && onEdit(calc)}
                    >
                      <TableCell className="font-medium">
                        {calc.name || 'Namnlös'}
                      </TableCell>
                      <TableCell className="font-mono">{calc.cpu_count}</TableCell>
                      <TableCell className="font-mono">{calc.storage_gb} GB</TableCell>
                      <TableCell className="font-mono">{calc.server_count}</TableCell>
                      <TableCell className="font-mono">{calc.operation_hours.toLocaleString('sv-SE')}</TableCell>
                      <TableCell className="font-mono font-medium text-primary">
                        {formatCurrency(Number(calc.total_cost))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(calc.created_at), 'd MMM yyyy', { locale: sv })}
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(calc)}
                              title="Redigera"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(calc.id)}
                              title="Ta bort"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kalkyl</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort denna kalkyl? 
              Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
